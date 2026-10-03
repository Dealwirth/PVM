import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Device, DeviceType, DiscoveredDevice, SensorMask } from '@pvm/shared';
import { api } from '../lib/api.js';
import { Badge, Card, ErrorBanner, Spinner } from '../components/ui.js';

const TYPE_LABELS: Record<DeviceType, string> = {
  pv: 'PV',
  battery: 'Batterie',
  wallbox: 'Wallbox',
  heat_pump: 'Wärmepumpe',
  heater: 'Heizung',
  load: 'Verbraucher',
  generic: 'Allgemein',
};

export function DevicesPage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showDiscovery, setShowDiscovery] = useState(false);

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

  const filtered = (devices.data ?? []).filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('devices.title')}</h1>
        <div className="flex gap-2">
          <input
            className="pvm-input w-48"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="pvm-input w-40"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">{t('common.all')}</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
        </div>
      </div>

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
              code="PVM-002"
              message={(discovery.error as Error).message}
              remediation="HA-URL und Token in den Einstellungen prüfen."
            />
          )}
          <div className="grid gap-2 md:grid-cols-2">
            {(discovery.data ?? []).map((d) => (
              <div
                key={d.haDeviceId}
                className="rounded-lg border border-ha-border bg-ha-surfaceAlt p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{d.name}</span>
                  <Badge tone="info">{TYPE_LABELS[d.suggestedType]}</Badge>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {d.entities.length} Entities · {d.manufacturer ?? '—'} {d.model ?? ''}
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
          <p className="text-sm text-gray-400">{t('devices.noDevices')}</p>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onPriority={(priority) => updatePriority.mutate({ id: device.id, priority })}
          />
        ))}
      </div>
    </div>
  );
}

function DeviceCard({
  device,
  onPriority,
}: {
  device: Device;
  onPriority: (p: number) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const power = device.entities.find((e) => e.role === 'power')?.value;
  const temperature = device.entities.find((e) => e.role === 'temperature')?.value;
  const statusTone =
    device.status === 'active' ? 'success' : device.status === 'error' ? 'error' : 'neutral';

  return (
    <div className="pvm-card">
      <div className="flex items-center justify-between">
        <span className="font-medium">{device.name}</span>
        <Badge tone={statusTone}>{device.status}</Badge>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {TYPE_LABELS[device.type]} · {device.sensorMask as SensorMask}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <span>Leistung: {typeof power === 'number' ? `${power} W` : '—'}</span>
        <span>Temperatur: {typeof temperature === 'number' ? `${temperature} °C` : '—'}</span>
      </div>
      <label className="mt-3 block text-xs text-gray-400">
        {t('common.priority')}: {device.priority}
        <input
          type="range"
          min={0}
          max={100}
          value={device.priority}
          onChange={(e) => onPriority(Number(e.target.value))}
          className="mt-1 w-full accent-ha-primary"
        />
      </label>
    </div>
  );
}
