import type { CalendarEvent, CalendarEventKind, CalendarSource } from '@pvm/shared';
import { PvmError, newId } from '@pvm/shared';
import type { CalendarRepository } from '../db/repositories/forecast.js';
import type { HaClient } from '../ha/client.js';
import type { DevLog } from './devlog.js';

/** Heuristics to classify a calendar event for the planner. */
export function classifyEvent(title: string, description = ''): CalendarEventKind {
  const hay = `${title} ${description}`.toLowerCase();
  if (/(urlaub|holiday|vacation|reise|trip)/.test(hay)) return 'holiday';
  if (/(arbeit|work|office|büro|buero|meeting)/.test(hay)) return 'work';
  if (/(pendel|commute|fahrt|drive|zur arbeit)/.test(hay)) return 'commute';
  if (/(laden|lade|charging|wallbox|ev|auto)/.test(hay)) return 'charging';
  if (/(wartung|maintenance|service|reparatur|repair)/.test(hay)) return 'maintenance';
  return 'other';
}

export class CalendarService {
  constructor(
    private readonly repo: CalendarRepository,
    private readonly ha: HaClient,
    private readonly log: DevLog,
  ) {}

  listSources(): CalendarSource[] {
    return this.repo.listSources();
  }

  addSource(input: Omit<CalendarSource, 'id'> & { id?: string }): CalendarSource {
    const source: CalendarSource = {
      id: input.id ?? newId('cal'),
      name: input.name,
      entityId: input.entityId,
      refreshMinutes: input.refreshMinutes,
      enabled: input.enabled,
    };
    this.repo.upsertSource(source);
    this.log.info('calendar', 'Calendar source added', { entityId: source.entityId });
    return source;
  }

  removeSource(id: string): void {
    this.repo.removeSource(id);
  }

  async syncSource(source: CalendarSource): Promise<CalendarEvent[]> {
    try {
      const states = await this.ha.getStateById(source.entityId);
      const rawEvents = (states.attributes.events as Array<Record<string, unknown>>) ?? [];
      const events: CalendarEvent[] = rawEvents.map((e) => {
        const start = String(e.start ?? '');
        const end = String(e.end ?? start);
        const title = String(e.summary ?? e.title ?? 'Ereignis');
        const description = String(e.description ?? '');
        return {
          id: newId('evt'),
          calendarEntityId: source.entityId,
          title,
          start: normalizeDate(start),
          end: normalizeDate(end),
          allDay: start.length === 10,
          kind: classifyEvent(title, description),
          description: description || undefined,
          location: e.location ? String(e.location) : undefined,
        };
      });
      this.repo.upsertEvents(events);
      this.repo.upsertSource({
        ...source,
        lastSyncAt: new Date().toISOString(),
        lastError: undefined,
      });
      this.log.info('calendar', 'Calendar synced', {
        entityId: source.entityId,
        events: events.length,
      });
      return events;
    } catch (err) {
      const message = (err as Error).message;
      this.repo.upsertSource({ ...source, lastError: message });
      this.log.error(
        'calendar',
        'Calendar sync failed',
        { entityId: source.entityId, error: message },
        'PVM-017',
      );
      throw new PvmError('PVM-017', { entityId: source.entityId, error: message });
    }
  }

  async syncAll(): Promise<number> {
    let count = 0;
    for (const source of this.repo.listSources()) {
      if (!source.enabled) continue;
      try {
        const events = await this.syncSource(source);
        count += events.length;
      } catch {
        // already logged
      }
    }
    return count;
  }

  eventsBetween(start: string, end: string): CalendarEvent[] {
    return this.repo.eventsBetween(start, end);
  }

  allEvents(): CalendarEvent[] {
    return this.repo.allEvents();
  }
}

function normalizeDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}
