import type { Severity } from '@pvm/shared';
import type { DevLog } from './devlog.js';
import type { SettingsService } from './settings.js';

export interface Notification {
  title: string;
  message: string;
  severity: Severity;
  timestamp: string;
}

/**
 * Notification dispatcher.
 *
 * Email uses an SMTP URL if provided; push uses an HTTPS webhook. Failures are
 * logged but never propagate, so notifications can't break the control loop.
 */
export class NotificationService {
  constructor(
    private readonly settings: SettingsService,
    private readonly log: DevLog,
  ) {}

  async notify(notification: Notification): Promise<void> {
    const s = this.settings.get().notifications;
    const tasks: Array<Promise<void>> = [];

    if (s.email?.enabled && s.email.address && s.email.smtpUrl) {
      tasks.push(this.sendEmail(s.email.address, s.email.smtpUrl, notification));
    }
    if (s.push?.enabled && s.push.webhookUrl) {
      tasks.push(this.sendPush(s.push.webhookUrl, notification));
    }
    await Promise.allSettled(tasks);
  }

  private async sendEmail(
    address: string,
    smtpUrl: string,
    notification: Notification,
  ): Promise<void> {
    // SMTP delivery is delegated to the configured SMTP relay via a webhook-style
    // HTTP bridge to avoid pulling a full mail stack into the control process.
    try {
      const res = await fetch(smtpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: address, ...notification }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      this.log.info('notifications', 'Email sent', { to: address });
    } catch (err) {
      this.log.warn('notifications', 'Email failed', { error: (err as Error).message });
    }
  }

  private async sendPush(webhookUrl: string, notification: Notification): Promise<void> {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      this.log.info('notifications', 'Push sent');
    } catch (err) {
      this.log.warn('notifications', 'Push failed', { error: (err as Error).message });
    }
  }
}
