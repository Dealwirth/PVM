import type { Db } from './db/index.js';
import type { ServerConfig } from './config.js';
import { DeviceRepository } from './db/repositories/devices.js';
import { SettingsRepository } from './db/repositories/settings.js';
import { HistoryRepository } from './db/repositories/history.js';
import {
  CalendarRepository,
  ForecastRepository,
  PlanRepository,
  SafetyRepository,
} from './db/repositories/forecast.js';
import { AddonRepository } from './db/repositories/addons.js';
import { HaClient } from './ha/client.js';
import { DevLog } from './services/devlog.js';
import { SettingsService } from './services/settings.js';
import { DeviceService } from './services/devices.js';
import { ForecastService } from './services/forecast.js';
import { PlannerService } from './services/planner.js';
import { SafetyService } from './services/safety.js';
import { CalendarService } from './services/calendar.js';
import { AddonService } from './services/addon.js';
import { GitHubAddonFetcher } from './services/addon-fetcher.js';
import { AuthService } from './services/auth.js';
import { BackupService } from './services/backup.js';
import { DashboardService } from './services/dashboard.js';
import { NotificationService } from './services/notifications.js';
import { PvmError } from '@pvm/shared';
import type { LoadPlan } from '@pvm/shared';

/** Central dependency container wiring all services together. */
export interface AppContext {
  config: ServerConfig;
  db: Db;
  log: DevLog;
  ha: HaClient;
  settings: SettingsService;
  devices: DeviceService;
  forecast: ForecastService;
  planner: PlannerService;
  safety: SafetyService;
  calendar: CalendarService;
  addons: AddonService;
  auth: AuthService;
  backup: BackupService;
  dashboard: DashboardService;
  notifications: NotificationService;
  /** Dispatch a HA-originated ``pvm.*`` service call. */
  haServiceCall: (service: string, payload: Record<string, unknown>) => Promise<unknown>;
}

export function createContext(config: ServerConfig, db: Db): AppContext {
  const log = new DevLog({
    dir: config.logsDir,
    level: config.logLevel,
    maxFileSizeMb: 100,
    enabled: true,
  });

  const deviceRepo = new DeviceRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const historyRepo = new HistoryRepository(db);
  const forecastRepo = new ForecastRepository(db);
  const planRepo = new PlanRepository(db);
  const calendarRepo = new CalendarRepository(db);
  const safetyRepo = new SafetyRepository(db);
  const addonRepo = new AddonRepository(db);

  const ha = new HaClient({
    url: config.haUrl,
    token: config.haToken,
    localOnly: config.haLocalOnly,
    reconnectBaseMs: 5000,
    log,
  });
  const settings = new SettingsService(settingsRepo, config, log, ha);
  const devices = new DeviceService(deviceRepo, historyRepo, ha, log);
  const forecast = new ForecastService(forecastRepo, log);
  const planner = new PlannerService(planRepo, log);
  const safety = new SafetyService(safetyRepo, deviceRepo, ha, settings, log);
  const calendar = new CalendarService(calendarRepo, ha, log);
  const fetcher = new GitHubAddonFetcher(log, process.env.GITHUB_TOKEN);
  const addons = new AddonService(addonRepo, settings, log, config.addonsDir, fetcher);
  const auth = new AuthService(config.apiSecret);
  const backup = new BackupService(db, log);
  const dashboard = new DashboardService(devices, forecast, planner, safety, settings, ha, log);
  const notifications = new NotificationService(settings, log);

  const haServiceCall = async (
    service: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> => {
    switch (service) {
      case 'set_device_state':
        return devices.execute({
          deviceId: String(payload.device_id ?? payload.deviceId ?? ''),
          capability: 'state',
          value: payload.state as string | number | boolean,
          source: 'api',
        });
      case 'set_device_power':
        return devices.execute({
          deviceId: String(payload.device_id ?? payload.deviceId ?? ''),
          capability: 'power',
          value: Number(payload.power ?? 0),
          source: 'api',
        });
      case 'set_device_temperature':
        return devices.execute({
          deviceId: String(payload.device_id ?? payload.deviceId ?? ''),
          capability: 'temperature',
          value: Number(payload.temperature ?? 0),
          source: 'api',
        });
      case 'update_plan': {
        const plan = payload.plan as LoadPlan | undefined;
        if (!plan) throw new PvmError('PVM-015', { field: 'plan' });
        log.info('ha-service', 'Load plan received via HA service', { id: plan.id });
        return planner.applyPlans([plan]);
      }
      case 'get_forecast':
        return forecast.latest((payload.horizon as string | undefined) ?? 'day');
      case 'get_calendar_events':
        return calendar.allEvents();
      case 'get_history':
        return devices.historyFor(
          String(payload.device_id ?? payload.deviceId ?? ''),
          payload.start as string | undefined,
          payload.end as string | undefined,
        );
      case 'get_sensors':
        return ha.getStates();
      case 'get_entities':
        return ha.getEntityRegistry();
      case 'get_devices':
        return devices.list();
      case 'run_planning_cycle':
        return dashboard.runPlanningCycle();
      default:
        throw new PvmError('PVM-020', { service }, `Unbekannter pvm-Service: ${service}`);
    }
  };

  // Keep HA client in sync with settings changes.
  const current = settings.get();
  ha.configure({ url: current.ha.url, token: current.ha.token, localOnly: current.ha.localOnly });

  return {
    config,
    db,
    log,
    ha,
    settings,
    devices,
    forecast,
    planner,
    safety,
    calendar,
    addons,
    auth,
    backup,
    dashboard,
    notifications,
    haServiceCall,
  };
}
