import type { AppContext } from '../context.js';

/**
 * Lightweight in-process scheduler for recurring jobs.
 * Uses fixed intervals; failures are logged and never stop the loop.
 */
export class Scheduler {
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly ctx: AppContext) {}

  start(): void {
    // Calendar sync every 5 minutes.
    this.every(5 * 60_000, 'calendar-sync', async () => {
      if (this.ctx.settings.get().calendar.enabled) {
        await this.ctx.calendar.syncAll();
      }
    });

    // Safety evaluation every 30 seconds.
    this.every(30_000, 'safety-eval', async () => {
      const total = this.ctx.devices.currentTotalPowerW();
      await this.ctx.safety.evaluateLoad(total);
    });

    // Self-healing every 2 minutes.
    this.every(2 * 60_000, 'self-heal', async () => {
      await this.ctx.safety.selfHeal();
    });

    this.ctx.log.info('scheduler', 'Scheduler started', { jobs: this.timers.length });
  }

  private every(intervalMs: number, name: string, fn: () => Promise<void>): void {
    const timer = setInterval(() => {
      void fn().catch((err) => {
        this.ctx.log.error(
          'scheduler',
          `Job ${name} failed`,
          {
            error: (err as Error).message,
          },
          'PVM-020',
        );
      });
    }, intervalMs);
    timer.unref();
    this.timers.push(timer);
  }

  stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
  }
}
