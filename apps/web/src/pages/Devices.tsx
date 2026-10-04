import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Device, DeviceType, DiscoveredDevice, SensorMask } from '@pvm/shared';
import { api, ApiError } from '../lib/api.js';
import { useUnits, formatPower, formatTemperature } from '../lib/units.js';
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui.js';

interface HistoryPoint {
  timestamp: string;
  powerW?: number;
  energyWh?: number;
  temperatureC?: number;
  state?: string;
}

export function DevicesPage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const devices = useQuery({
    queryKey: ['devices', typeFilter],
    queryFn: () => api.get<Device[]>(`/devices${typeFilter ? `?type=${typeFilter}` : ''}`),
  });

  const discovery = useQuery({
    queryKey: ['discovery'],
    queryFn: () => api.get<DiscoveredDevice[]>('/discovery'),
    enabled: showDiscovery,
  });

  const adopt = useMutation({
    mutationFn: (device: DiscoveredDevice) => api.post('/discovery/adopt', { device }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['devices'] });
      void qc.invalidateQueries({ queryKey: ['discovery'] });
    },
  });

  const updatePriority = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: number }) =>
      api.put(`/devices/${id}`, { priority }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['devices'] }),
  });

  const removeDevice = useMutation({
    mutationFn: (id: string) => api.delete(`/devices/${id}`),
    onSuccess: () => {
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  const filtered = (devices.data ?? []).filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedDevice = (devices.data ?? []).find((d) => d.id === selected) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('devices.title')}
        subtitle={t('devices.subtitle')}
        actions={
          <>
            <input
              className="pvm-input w-44"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('common.search')}
            />
            <select
              className="pvm-input w-36"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label={t('common.type')}
            >
              <option value="">{t('common.all')}</option>
              {Object.keys(TYPE_KEYS).map((value) => (
                <option key={value} value={value}>
                  {t(`devices.types.${value}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="pvm-btn-primary"
              onClick={() => setShowDiscovery((v) => !v)}
            >
              {t('devices.discover')}
            </button>
          </>
        }
      />

      {devices.isLoading && <Spinner />}
      {devices.error && (
        <ErrorBanner
          message={(devices.error as Error).message}
          onRetry={() => void devices.refetch()}
        />
      )}

      {showDiscovery && (
        <Card title={t('devices.discovered')}>
          {discovery.isLoading && <Spinner />}
          {discovery.error && (
            <ErrorBanner
              code={discovery.error instanceof ApiError ? discovery.error.code : undefined}
              message={(discovery.error as Error).message}
              remediation={
                (discovery.error instanceof ApiError && discovery.error.remediation) ||
                t('devices.noDiscoveryHint')
              }
            />
          )}
          {!discovery.isLoading && (discovery.data ?? []).length === 0 && (
            <EmptyState message={t('devices.noDiscovery')} hint={t('devices.noDiscoveryHint')} />
          )}
          <div className="grid gap-2 md:grid-cols-2">
            {(discovery.data ?? []).map((d) => (
              <div
                key={d.haDeviceId}
                className="rounded-lg border border-ha-border bg-ha-surfaceAlt p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{d.name}</span>
                  <Badge tone="info">{t(`devices.types.${d.suggestedType}`)}</Badge>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {d.entities.length} {t('devices.entities')} · {d.manufacturer ?? '—'}{' '}
                  {d.model ?? ''}
                </p>
                <button
                  type="button"
                  className="pvm-btn-primary mt-2"
                  disabled={d.alreadyManaged || adopt.isPending}
                  onClick={() => adopt.mutate(d)}
                >
                  {d.alreadyManaged ? t('devices.alreadyManaged') : t('devices.adopt')}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {filtered.length === 0 && !devices.isLoading && (
        <Card>
          <EmptyState message={t('devices.noDevices')} />
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            selected={selected === device.id}
            onSelect={() => setSelected(selected === device.id ? null : device.id)}
            onPriority={(priority) => updatePriority.mutate({ id: device.id, priority })}
          />
        ))}
      </div>

      {selectedDevice && (
        <DeviceDetails
          device={selectedDevice}
          onClose={() => setSelected(null)}
          onDelete={() => removeDevice.mutate(selectedDevice.id)}
        />
      )}
    </div>
  );
}

const TYPE_KEYS: Record<DeviceType, true> = {
  pv: true,
  battery: true,
  wallbox: true,
  heat_pump: true,
  heater: true,
  load: true,
  generic: true,
};

function statusTone(status: Device['status']): 'success' | 'error' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'error') return 'error';
  return 'neutral';
}

function DeviceCard({
  device,
  selected,
  onSelect,
  onPriority,
}: {
  device: Device;
  selected: boolean;
  onSelect: () => void;
  onPriority: (p: number) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const units = useUnits();
  const [priority, setPriority] = useState(device.priority);
  const power = device.entities.find((e) => e.role === 'power')?.value;
  const temperature = device.entities.find((e) => e.role === 'temperature')?.value;

  return (
    <div className={`pvm-card ${selected ? 'ring-1 ring-ha-primary' : ''}`}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-left font-medium hover:text-ha-primary"
          onClick={onSelect}
        >
          {device.name}
        </button>
        <Badge tone={statusTone(device.status)}>{t(`devices.status.${device.status}`)}</Badge>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {t(`devices.types.${device.type}`)} ·{' '}
        {t(`devices.masks.${device.sensorMask as SensorMask}`)}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <span>
          {t('devices.power')}: {typeof power === 'number' ? formatPower(power, units) : '—'}
        </span>
        <span>
          {t('devices.temperature')}:{' '}
          {typeof temperature === 'number' ? formatTemperature(temperature, units) : '—'}
        </span>
      </div>
      <label className="mt-3 block text-xs text-gray-400">
        {t('common.priority')}: {priority}
        <input
          type="range"
          min={0}
          max={100}
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          onMouseUp={() => onPriority(priority)}
          onTouchEnd={() => onPriority(priority)}
          onKeyUp={() => onPriority(priority)}
          className="mt-1 w-full accent-ha-primary"
        />
      </label>
    </div>
  );
}

function DeviceDetails({
  device,
  onClose,
  onDelete,
}: {
  device: Device;
  onClose: () => void;
  onDelete: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const units = useUnits();
  const qc = useQueryClient();
  const [power, setPower] = useState('');
  const [temperature, setTemperature] = useState('');
  const [feedback, setFeedback] = useState<string>();

  const history = useQuery({
    queryKey: ['device-history', device.id],
    queryFn: () => api.get<HistoryPoint[]>(`/devices/${device.id}/history`),
  });

  const command = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post(`/devices/${device.id}/command`, body),
    onSuccess: () => {
      setFeedback(t('devices.commandSent'));
      void qc.invalidateQueries({ queryKey: ['devices'] });
      void qc.invalidateQueries({ queryKey: ['device-history', device.id] });
    },
  });

  const refresh = useMutation({
    mutationFn: () => api.post(`/devices/${device.id}/refresh`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['devices'] }),
  });

  const has = (c: string): boolean => device.capabilities.includes(c as never);

  return (
    <Card
      title={device.name}
      actions={
        <div className="flex gap-2">
          <button type="button" className="pvm-btn-ghost" onClick={() => refresh.mutate()}>
            {t('common.refresh')}
          </button>
          <button type="button" className="pvm-btn-danger" onClick={onDelete}>
            {t('common.delete')}
          </button>
          <button type="button" className="pvm-btn-ghost" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <div>
          <dt className="text-xs text-gray-500">{t('common.type')}</dt>
          <dd>{t(`devices.types.${device.type}`)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">{t('devices.sensorMask')}</dt>
          <dd>{t(`devices.masks.${device.sensorMask}`)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">{t('devices.ratedPower')}</dt>
          <dd>{device.ratedPowerW ? formatPower(device.ratedPowerW, units) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">{t('devices.controllable')}</dt>
          <dd>{device.controllable ? t('common.yes') : t('common.no')}</dd>
        </div>
      </dl>

      {!device.controllable && (
        <p className="mt-3 text-sm text-amber-400">{t('devices.controlUnavailable')}</p>
      )}

      {device.controllable && (
        <div className="mt-4 space-y-2 border-t border-ha-border pt-3">
          <h3 className="pvm-card-title mb-0">{t('devices.control')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {has('state') && (
              <>
                <button
                  type="button"
                  className="pvm-btn-primary"
                  onClick={() => command.mutate({ capability: 'state', value: true })}
                >
                  {t('devices.stateOn')}
                </button>
                <button
                  type="button"
                  className="pvm-btn-ghost"
                  onClick={() => command.mutate({ capability: 'state', value: false })}
                >
                  {t('devices.stateOff')}
                </button>
              </>
            )}
            {has('power') && (
              <div className="flex items-center gap-1">
                <input
                  className="pvm-input w-28"
                  type="number"
                  placeholder={t('devices.powerPlaceholder')}
                  value={power}
                  onChange={(e) => setPower(e.target.value)}
                />
                <button
                  type="button"
                  className="pvm-btn-ghost"
                  disabled={power === ''}
                  onClick={() => command.mutate({ capability: 'power', value: Number(power) })}
                >
                  {t('common.apply')}
                </button>
              </div>
            )}
            {(has('temperature') || has('setpoint')) && (
              <div className="flex items-center gap-1">
                <input
                  className="pvm-input w-28"
                  type="number"
                  placeholder={t('devices.temperaturePlaceholder')}
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
                <button
                  type="button"
                  className="pvm-btn-ghost"
                  disabled={temperature === ''}
                  onClick={() =>
                    command.mutate({
                      capability: has('temperature') ? 'temperature' : 'setpoint',
                      value: Number(temperature),
                    })
                  }
                >
                  {t('common.apply')}
                </button>
              </div>
            )}
          </div>
          {feedback && <Badge tone="success">{feedback}</Badge>}
          {command.error && <ErrorBanner message={(command.error as Error).message} />}
        </div>
      )}

      <div className="mt-4 border-t border-ha-border pt-3">
        <h3 className="pvm-card-title">{t('devices.history')}</h3>
        {history.isLoading && <Spinner />}
        {!history.isLoading && (history.data ?? []).length === 0 && (
          <EmptyState message={t('devices.historyEmpty')} />
        )}
        {(history.data ?? []).length > 0 && (
          <ul className="max-h-48 space-y-1 overflow-auto text-xs">
            {(history.data ?? []).slice(0, 50).map((p, i) => (
              <li key={i} className="flex justify-between border-b border-ha-border/40 py-1">
                <span className="text-gray-500">{new Date(p.timestamp).toLocaleString()}</span>
                <span>
                  {p.powerW !== undefined ? formatPower(p.powerW, units) : ''}
                  {p.temperatureC !== undefined
                    ? ` · ${formatTemperature(p.temperatureC, units)}`
                    : ''}
                  {p.state !== undefined ? ` · ${p.state}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
