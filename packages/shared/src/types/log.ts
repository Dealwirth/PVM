/** Dev-log domain types. */

export const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Numeric ordering so we can filter "level >= X". */
export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  FATAL: 50,
};

export interface LogEntry {
  id: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  /** PVM error code when this entry relates to a catalogued error. */
  errorCode?: string;
  stack?: string;
}

export interface LogFilter {
  level?: LogLevel;
  minLevel?: LogLevel;
  category?: string;
  since?: string;
  until?: string;
  search?: string;
  errorCode?: string;
  limit?: number;
}

export interface LogExport {
  format: 'json' | 'csv';
  entries: LogEntry[];
  exportedAt: string;
}
