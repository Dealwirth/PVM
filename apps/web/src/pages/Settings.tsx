import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { LogLevel, SecurityMode, Settings } from '@pvm/shared';
import { api } from '../lib/api.js';
import { BackupCard } from '../components/BackupCard.js';
import {
  Badge,
  Card,
  ErrorBanner,
  NumberField,
  PageHeader,
  Select,
  Spinner,
  Toggle,
} from '../components/ui.js';

type PublicSettings = Settings & { ha: Settings['ha'] & { token: string; tokenSet: boolean } };

export function SettingsPage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<PublicSettings>('/settings'),
  });
  const required = useQuery({
    queryKey: ['settings-required'],
    queryFn: () =>
      api.get<{ complete: boolean; missing: Array<{ key: string; label: string }> }>(
        '/settings/required',
      ),
  });

  const [haUrl, setHaUrl] = useState<string>();
  const [haToken, setHaToken] = useState<string>();
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    errorCode?: string;
    message?: string;
    haVersion?: string;
  }>();

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.put<PublicSettings>('/settings', patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['settings-required'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  // Test the connection with the values currently in the form, without saving.
  const testHa = useMutation({
    mutationFn: () =>
      api.post<{
        ok: boolean;
        url?: string;
        haVersion?: string;
        locationName?: string;
        errorCode?: string;
        message?: string;
      }>('/settings/test-ha', {
        ...(haUrl !== undefined ? { url: haUrl } : {}),
        ...(haToken !== undefined ? { token: haToken } : {}),
      }),
    onSuccess: (r) => setTestResult(r),
  });

  if (settings.isLoading || !settings.data) return <Spinner />;
  const s = settings.data;

  const patchGeneral = (key: string, value: unknown): void =>
    save.mutate({ general: { [key]: value } });
  const patchSafety = (key: string, value: unknown): void =>
    save.mutate({ safety: { [key]: value } });
  const patchUnits = (key: string, value: string): void =>
    save.mutate({ general: { units: { ...s.general.units, [key]: value } } });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={save.isPending ? <Badge tone="info">{t('common.saving')}</Badge> : undefined}
      />

      {required.data && !required.data.complete && (
        <ErrorBanner
          code="PVM-001"
          message={t('settings.requiredHint')}
          remediation={required.data.missing.map((m) => m.label).join(', ')}
        />
      )}

      <Card title={t('settings.ha')}>
        <div className="space-y-3">
          <div>
            <label className="pvm-label" htmlFor="ha-url">
              {t('settings.haUrl')}{' '}
              {!s.ha.url && <span className="text-red-400">({t('settings.requiredBadge')})</span>}
            </label>
            <input
              id="ha-url"
              className="pvm-input"
              defaultValue={s.ha.url}
              onChange={(e) => setHaUrl(e.target.value)}
              placeholder="http://homeassistant.local:8123"
            />
            {!s.ha.url && (
              <p className="mt-1 text-xs text-gray-500">{t('settings.haUrlAutoHint')}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">{t('settings.haUrlExamples')}</p>
          </div>
          <div>
            <label className="pvm-label" htmlFor="ha-token">
              {t('settings.haToken')}{' '}
              {!s.ha.tokenSet && (
                <span className="text-red-400">({t('settings.requiredBadge')})</span>
              )}
              {s.ha.tokenSet && <Badge tone="success">{t('settings.tokenSaved')}</Badge>}
            </label>
            <input
              id="ha-token"
              className="pvm-input"
              type="password"
              placeholder={s.ha.tokenSet ? '••••••••' : 'eyJ0eXAiOiJKV1Qi…'}
              onChange={(e) => setHaToken(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">{t('settings.haTokenHint')}</p>
          </div>
          <Toggle
            label={t('settings.localOnly')}
            checked={s.ha.localOnly}
            onChange={(v) => save.mutate({ ha: { localOnly: v } })}
          />
          <p className="-mt-2 text-xs text-gray-500">{t('settings.localOnlyHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="pvm-btn-primary"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  ha: {
                    ...(haUrl !== undefined ? { url: haUrl } : {}),
                    ...(haToken !== undefined ? { token: haToken } : {}),
                  },
                })
              }
            >
              {t('common.save')}
            </button>
            <button
              type="button"
              className="pvm-btn-ghost"
              onClick={() => testHa.mutate()}
              disabled={testHa.isPending}
            >
              {testHa.isPending ? t('settings.testing') : t('settings.testConnection')}
            </button>
            {testResult &&
              (testResult.ok ? (
                <Badge tone="success">
                  {t('settings.connectedTo')} {testResult.haVersion ?? 'HA'}
                </Badge>
              ) : (
                <Badge tone="error">
                  {testResult.errorCode ?? 'PVM-002'}: {testResult.message ?? t('setup.failed')}
                </Badge>
              ))}
            <button
              type="button"
              className="pvm-btn-ghost"
              onClick={() => save.mutate({ general: { setupDismissed: false } })}
            >
              {t('settings.runSetupAgain')}
            </button>
          </div>
        </div>
      </Card>

      <Card title={t('settings.general')}>
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              id="lang"
              label={t('settings.language')}
              value={s.general.language}
              options={[
                { value: 'de', label: 'Deutsch' },
                { value: 'en', label: 'English' },
              ]}
              onChange={(v) => patchGeneral('language', v)}
            />
            <div>
              <label className="pvm-label" htmlFor="tz">
                {t('settings.timezone')}
              </label>
              <input
                id="tz"
                className="pvm-input"
                defaultValue={s.general.timezone}
                onBlur={(e) => patchGeneral('timezone', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              label={t('settings.units')}
              value={s.general.units.power}
              options={[
                { value: 'W', label: 'Watt (W)' },
                { value: 'kW', label: 'Kilowatt (kW)' },
              ]}
              onChange={(v) => patchUnits('power', v)}
            />
            <Select
              label={t('devices.temperature')}
              value={s.general.units.temperature}
              options={[
                { value: 'C', label: 'Celsius (°C)' },
                { value: 'F', label: 'Fahrenheit (°F)' },
              ]}
              onChange={(v) => patchUnits('temperature', v)}
            />
            <Select
              label={t('dashboard.residual')}
              value={s.general.units.energy}
              options={[
                { value: 'Wh', label: 'Wattstunden (Wh)' },
                { value: 'kWh', label: 'Kilowattstunden (kWh)' },
              ]}
              onChange={(v) => patchUnits('energy', v)}
            />
          </div>
          <div className="grid gap-1 md:grid-cols-2">
            <Toggle
              label={t('settings.autoCache')}
              checked={s.general.autoCache}
              onChange={(v) => patchGeneral('autoCache', v)}
            />
            <Toggle
              label={t('settings.autoUpdate')}
              checked={s.general.autoUpdate}
              onChange={(v) => patchGeneral('autoUpdate', v)}
            />
            <Toggle
              label={t('settings.autoStart')}
              hint={t('settings.hintAutoStart')}
              checked={s.general.autoStartOnHaStart}
              onChange={(v) => patchGeneral('autoStartOnHaStart', v)}
            />
            <Toggle
              label={t('settings.shutdownOnError')}
              hint={t('settings.hintShutdownOnError')}
              checked={s.general.shutdownOnError}
              onChange={(v) => patchGeneral('shutdownOnError', v)}
            />
            <Toggle
              label={t('settings.selfHealing')}
              hint={t('settings.hintSelfHealing')}
              checked={s.general.selfHealing}
              onChange={(v) => patchGeneral('selfHealing', v)}
            />
            <Toggle
              label={t('settings.safetyMode')}
              hint={t('settings.hintSafetyMode')}
              checked={s.general.safetyMode}
              onChange={(v) => patchGeneral('safetyMode', v)}
            />
            <Toggle
              label={t('settings.backupExport')}
              hint={t('settings.hintBackupExport')}
              checked={s.general.backupExport}
              onChange={(v) => patchGeneral('backupExport', v)}
            />
            <Toggle
              label={t('settings.developerMode')}
              hint={t('settings.hintDeveloperMode')}
              checked={s.general.developerMode}
              onChange={(v) => patchGeneral('developerMode', v)}
            />
          </div>
        </div>
      </Card>

      <Card title={t('settings.notifications')}>
        <div className="space-y-3">
          <Toggle
            label={t('settings.email')}
            hint={s.notifications.email?.address}
            checked={Boolean(s.notifications.email?.enabled)}
            onChange={(v) =>
              save.mutate({
                notifications: {
                  email: {
                    enabled: v,
                    address: s.notifications.email?.address ?? '',
                    smtpUrl: s.notifications.email?.smtpUrl ?? '',
                  },
                },
              })
            }
          />
          {s.notifications.email?.enabled && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="pvm-label" htmlFor="email-address">
                  {t('settings.email')}
                </label>
                <input
                  id="email-address"
                  className="pvm-input"
                  type="email"
                  defaultValue={s.notifications.email.address}
                  onBlur={(e) =>
                    save.mutate({
                      notifications: {
                        email: { ...s.notifications.email!, address: e.target.value },
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="pvm-label" htmlFor="smtp-url">
                  {t('settings.smtp')}
                </label>
                <input
                  id="smtp-url"
                  className="pvm-input"
                  defaultValue={s.notifications.email.smtpUrl}
                  onBlur={(e) =>
                    save.mutate({
                      notifications: {
                        email: { ...s.notifications.email!, smtpUrl: e.target.value },
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
          <Toggle
            label={t('settings.push')}
            hint={s.notifications.push?.webhookUrl}
            checked={Boolean(s.notifications.push?.enabled)}
            onChange={(v) =>
              save.mutate({
                notifications: {
                  push: { enabled: v, webhookUrl: s.notifications.push?.webhookUrl ?? '' },
                },
              })
            }
          />
        </div>
      </Card>

      <Card title={t('settings.safety')}>
        <div className="space-y-3">
          <Select
            id="secmode"
            label={t('store.securityMode')}
            value={s.safety.mode}
            options={[
              { value: 'strict', label: t('store.securityModes.strict') },
              { value: 'moderate', label: t('store.securityModes.moderate') },
              { value: 'lenient', label: t('store.securityModes.lenient') },
            ]}
            onChange={(v) => patchSafety('mode', v as SecurityMode)}
          />
          <p className="text-xs text-gray-500">{t('store.securityModesHint')}</p>
          <Toggle
            label={t('safety.autoShutdown')}
            checked={s.safety.autoShutdown}
            onChange={(v) => patchSafety('autoShutdown', v)}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <NumberField
              label={t('settings.maxGridImport')}
              value={s.safety.maxGridImportW}
              onSave={(v) => patchSafety('maxGridImportW', v)}
            />
            <NumberField
              label={t('settings.maxDevicePower')}
              value={s.safety.maxDevicePowerW}
              onSave={(v) => patchSafety('maxDevicePowerW', v)}
            />
            <NumberField
              label={t('settings.minBattery')}
              value={s.safety.minBatteryPercent}
              onSave={(v) => patchSafety('minBatteryPercent', v)}
            />
          </div>
        </div>
      </Card>

      <Card title={t('settings.log')}>
        <div className="space-y-3">
          <Toggle
            label={t('settings.devLog')}
            checked={s.log.enabled}
            onChange={(v) => save.mutate({ log: { enabled: v } })}
          />
          <Toggle
            label={t('settings.autoLogs')}
            checked={s.log.autoLogs}
            onChange={(v) => save.mutate({ log: { autoLogs: v } })}
          />
          <Select
            id="loglevel"
            label={t('settings.logLevel')}
            value={s.log.level}
            options={(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as LogLevel[]).map((l) => ({
              value: l,
              label: l,
            }))}
            onChange={(v) => save.mutate({ log: { level: v as LogLevel } })}
          />
        </div>
      </Card>

      <BackupCard
        enabled={s.general.backupExport}
        onEnable={() => patchGeneral('backupExport', true)}
      />

      {save.isError && <ErrorBanner message={(save.error as Error).message} />}
    </div>
  );
}
