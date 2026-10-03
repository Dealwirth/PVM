import { EventEmitter } from 'node:events';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { LogEntry, LogFilter, LogLevel } from '@pvm/shared';
import { LOG_LEVEL_ORDER, newId } from '@pvm/shared';

export interface DevLogOptions {
  dir: string;
  level: LogLevel;
  maxFileSizeMb: number;
  enabled: boolean;
  /** Max in-memory entries kept for fast queries. */
  memoryLimit?: number;
}

const DEFAULT_OPTIONS: DevLogOptions = {
  dir: './data/logs',
  level: 'INFO',
  maxFileSizeMb: 100,
  enabled: true,
  memoryLimit: 10_000,
};

/**
 * Structured developer log.
 *
 * Writes three artifacts:
 *  - devlog.json  (append-only JSON lines, for AI/LLM feedback)
 *  - devlog.csv   (append-only CSV, for export)
 *  - devlog-ui.json (bounded JSON array, served to the UI)
 *
 * Emits 'entry' events so the WebSocket layer can stream in real time.
 */
export class DevLog extends EventEmitter {
  private readonly opts: DevLogOptions;
  private readonly jsonPath: string;
  private readonly csvPath: string;
  private readonly uiPath: string;
  private memory: LogEntry[] = [];
  private errorTimestamps: number[] = [];

  constructor(options: Partial<DevLogOptions> = {}) {
    super();
    this.opts = { ...DEFAULT_OPTIONS, ...options };
    if (!existsSync(this.opts.dir)) mkdirSync(this.opts.dir, { recursive: true });
    this.jsonPath = join(this.opts.dir, 'devlog.json');
    this.csvPath = join(this.opts.dir, 'devlog.csv');
    this.uiPath = join(this.opts.dir, 'devlog-ui.json');
    if (!existsSync(this.jsonPath)) writeFileSync(this.jsonPath, '');
    if (!existsSync(this.csvPath))
      writeFileSync(this.csvPath, 'timestamp,level,category,message,errorCode\n');
    if (!existsSync(this.uiPath)) writeFileSync(this.uiPath, '[]');
  }

  setLevel(level: LogLevel): void {
    this.opts.level = level;
  }

  setEnabled(enabled: boolean): void {
    this.opts.enabled = enabled;
  }

  log(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, unknown>,
    extra?: { userId?: string; errorCode?: string; stack?: string },
  ): LogEntry | undefined {
    if (!this.opts.enabled) return undefined;
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.opts.level]) return undefined;

    const entry: LogEntry = {
      id: newId('log'),
      level,
      category,
      message,
      data,
      timestamp: new Date().toISOString(),
      userId: extra?.userId,
      errorCode: extra?.errorCode,
      stack: extra?.stack,
    };

    this.memory.push(entry);
    if (this.memory.length > (this.opts.memoryLimit ?? DEFAULT_OPTIONS.memoryLimit!)) {
      this.memory.splice(
        0,
        this.memory.length - (this.opts.memoryLimit ?? DEFAULT_OPTIONS.memoryLimit!),
      );
    }

    this.persist(entry);

    if (LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER.ERROR) {
      this.errorTimestamps.push(Date.now());
      const cutoff = Date.now() - 60_000;
      this.errorTimestamps = this.errorTimestamps.filter((t) => t >= cutoff);
    }

    this.emit('entry', entry);
    return entry;
  }

  debug(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('DEBUG', category, message, data);
  }
  info(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('INFO', category, message, data);
  }
  warn(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('WARN', category, message, data);
  }
  error(
    category: string,
    message: string,
    data?: Record<string, unknown>,
    errorCode?: string,
    stack?: string,
  ): void {
    this.log('ERROR', category, message, data, { errorCode, stack });
  }
  fatal(
    category: string,
    message: string,
    data?: Record<string, unknown>,
    errorCode?: string,
    stack?: string,
  ): void {
    this.log('FATAL', category, message, data, { errorCode, stack });
  }

  /** Number of ERROR+FATAL entries in the last 60 seconds. */
  recentErrorCount(): number {
    return this.errorTimestamps.length;
  }

  query(filter: LogFilter = {}): LogEntry[] {
    const minOrder = filter.minLevel ? LOG_LEVEL_ORDER[filter.minLevel] : 0;
    const exactOrder = filter.level ? LOG_LEVEL_ORDER[filter.level] : undefined;
    const since = filter.since ? Date.parse(filter.since) : undefined;
    const until = filter.until ? Date.parse(filter.until) : undefined;
    const search = filter.search?.toLowerCase();

    let result = this.memory.filter((e) => {
      if (exactOrder !== undefined && LOG_LEVEL_ORDER[e.level] !== exactOrder) return false;
      if (LOG_LEVEL_ORDER[e.level] < minOrder) return false;
      if (filter.category && e.category !== filter.category) return false;
      if (filter.errorCode && e.errorCode !== filter.errorCode) return false;
      const ts = Date.parse(e.timestamp);
      if (since !== undefined && ts < since) return false;
      if (until !== undefined && ts > until) return false;
      if (search) {
        const hay = `${e.message} ${e.category} ${JSON.stringify(e.data ?? {})}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    result = result.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    if (filter.limit) result = result.slice(0, filter.limit);
    return result;
  }

  exportJson(filter: LogFilter = {}): string {
    return JSON.stringify(this.query(filter), null, 2);
  }

  exportCsv(filter: LogFilter = {}): string {
    const header = 'timestamp,level,category,message,errorCode,data';
    const rows = this.query(filter).map((e) =>
      [
        e.timestamp,
        e.level,
        e.category,
        csvEscape(e.message),
        e.errorCode ?? '',
        csvEscape(JSON.stringify(e.data ?? {})),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  /** Aggregate counts per level for the Dev-Log UI. */
  stats(): { total: number; byLevel: Record<string, number>; recentErrors: number } {
    const byLevel: Record<string, number> = {};
    for (const entry of this.memory) {
      byLevel[entry.level] = (byLevel[entry.level] ?? 0) + 1;
    }
    return { total: this.memory.length, byLevel, recentErrors: this.errorTimestamps.length };
  }

  /** Clear the in-memory buffer (files are rotated, not deleted). */
  clear(): void {
    this.memory = [];
    this.errorTimestamps = [];
    try {
      writeFileSync(this.uiPath, '[]');
    } catch {
      // ignore
    }
  }

  private persist(entry: LogEntry): void {
    try {
      appendFileSync(this.jsonPath, `${JSON.stringify(entry)}\n`);
      appendFileSync(
        this.csvPath,
        [
          entry.timestamp,
          entry.level,
          entry.category,
          csvEscape(entry.message),
          entry.errorCode ?? '',
        ].join(',') + '\n',
      );
      writeFileSync(this.uiPath, JSON.stringify(this.memory.slice(-2000)));
      this.rotateIfNeeded();
    } catch {
      // Never let logging break the app.
    }
  }

  private rotateIfNeeded(): void {
    const maxBytes = this.opts.maxFileSizeMb * 1024 * 1024;
    for (const path of [this.jsonPath, this.csvPath]) {
      try {
        if (existsSync(path) && statSync(path).size > maxBytes) {
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          renameSync(path, `${path}.${stamp}.bak`);
          writeFileSync(path, '');
        }
      } catch {
        // ignore rotation failures
      }
    }
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
