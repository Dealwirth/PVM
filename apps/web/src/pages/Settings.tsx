import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { LogLevel, SecurityMode, Settings } from '@pvm/shared';
import { api } from '../lib/api.js';
import { Badge, Card, ErrorBanner, Spinner, Toggle } from '../components/ui.js';

type PublicSettings = Settings & { ha: Settings['ha'] & { token: string } };

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
  const [testResult, setTestResult] = useState<string>();

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.put<PublicSettings>('/settings', patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['settings-required'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const testHa = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; error?: string; config?: { version: string } }>('/settings/test-ha'),
    onSuccess: (r) =>
      setTestResult(r.ok ? `OK (${r.config?.version ?? ''})` : `Fehler: ${r.error}`),
  });

  if (settings.isLoading || !settings.data) return <Spinner />;
  const s = settings.data;

  const patchGeneral = (key: string, value: unknown): void =>
    save.mutate({ general: { [key]: value } });
  const patchSafety = (key: string, value: unknown): void =>
    save.mutate({ safety: { [key]: value } });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('settings.title')}</h1>

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
              {t('settings.haUrl')} <span className="text-red-400">*</span>
            </label>
            <input
              id="ha-url"
              className="pvm-input"
              defaultValue={s.ha.url}
              onChange={(e) => setHaUrl(e.target.value)}
              placeholder="http://homeassistant.local:8123"
            />
          </div>
          <div>
            <label className="pvm-label" htmlFor="ha-token">
              {t('settings.haToken')} <span className="text-red-400">*</span>
            </label>
            <input
              id="ha-token"
              className="pvm-input"
              type="password"
              placeholder={s.ha.token || '••••••••'}
              onChange={(e) => setHaToken(e.target.value)}
            />
          </div>
          <Toggle
            label={t('settings.localOnly')}
            checked={s.ha.localOnly}
            onChange={(v) => save.mutate({ ha: { localOnly: v } })}
          />
          <div className="flex items-center gap-2">
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
              {t('settings.testConnection')}
            </button>
            {testResult && (
              <Badge tone={testResult.startsWith('OK') ? 'success' : 'error'}>{testResult}</Badge>
            )}
          </div>
        </div>
      </Card>

      <Card title={t('settings.general')}>
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="pvm-label" htmlFor="lang">
                {t('settings.language')}
              </label>
              <select
                id="lang"
                className="pvm-input"
                value={s.general.language}
                onChange={(e) => patchGeneral('language', e.target.value)}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
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
              checked={s.general.autoStartOnHaStart}
              onChange={(v) => patchGeneral('autoStartOnHaStart', v)}
            />
            <Toggle
              label={t('settings.shutdownOnError')}
              checked={s.general.shutdownOnError}
              onChange={(v) => patchGeneral('shutdownOnError', v)}
            />
            <Toggle
              label={t('settings.selfHealing')}
              checked={s.general.selfHealing}
              onChange={(v) => patchGeneral('selfHealing', v)}
            />
            <Toggle
              label={t('settings.safetyMode')}
              checked={s.general.safetyMode}
              onChange={(v) => patchGeneral('safetyMode', v)}
            />
            <Toggle
              label={t('settings.backupExport')}
              checked={s.general.backupExport}
              onChange={(v) => patchGeneral('backupExport', v)}
            />
            <Toggle
              label={t('settings.developerMode')}
              checked={s.general.developerMode}
              onChange={(v) => patchGeneral('developerMode', v)}
            />
          </div>
        </div>
      </Card>

      <Card title={t('settings.safety')}>
        <div className="space-y-3">
          <div>
            <label className="pvm-label" htmlFor="secmode">
              {t('store.securityMode')}
            </label>
            <select
              id="secmode"
              className="pvm-input"
              value={s.safety.mode}
              onChange={(e) => patchSafety('mode', e.target.value as SecurityMode)}
            >
              <option value="strict">Strict</option>
              <option value="moderate">Moderate</option>
              <option value="lenient">Lenient</option>
            </select>
          </div>
          <Toggle
            label={t('safety.autoShutdown')}
            checked={s.safety.autoShutdown}
            onChange={(v) => patchSafety('autoShutdown', v)}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <NumberField
              label="Max. Netzbezug (W)"
              value={s.safety.maxGridImportW}
              onSave={(v) => patchSafety('maxGridImportW', v)}
            />
            <NumberField
              label="Max. Geräteleistung (W)"
              value={s.safety.maxDevicePowerW}
              onSave={(v) => patchSafety('maxDevicePowerW', v)}
            />
            <NumberField
              label="Min. Batterie (%)"
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
          <div>
            <label className="pvm-label" htmlFor="loglevel">
              {t('settings.logLevel')}
            </label>
            <select
              id="loglevel"
              className="pvm-input"
              value={s.log.level}
              onChange={(e) => save.mutate({ log: { level: e.target.value as LogLevel } })}
            >
              {(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as LogLevel[]).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {save.isError && <ErrorBanner message={(save.error as Error).message} />}
    </div>
  );
}

function NumberField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (v: number) => void;
}): JSX.Element {
  return (
    <div>
      <label className="pvm-label">{label}</label>
      <input
        className="pvm-input"
        type="number"
        defaultValue={value}
        onBlur={(e) => onSave(Number(e.target.value))}
      />
    </div>
  );
}
