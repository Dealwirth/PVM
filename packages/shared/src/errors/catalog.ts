/**
 * PVM error catalogue.
 *
 * Every error has a stable code (PVM-xxx), a category, a severity and a
 * human readable description plus a remediation hint shown in the UI.
 */

export const ERROR_CATEGORIES = [
  'config',
  'network',
  'device',
  'planner',
  'addon',
  'security',
  'unknown',
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface ErrorDefinition {
  code: string;
  category: ErrorCategory;
  severity: Severity;
  /** Short title shown in lists. */
  title: string;
  /** Longer description of what happened. */
  description: string;
  /** Hint how to resolve it. */
  remediation: string;
  /** Whether the safety system should trigger a shutdown reaction. */
  triggersShutdown: boolean;
}

export const ERROR_CATALOG: Record<string, ErrorDefinition> = {
  'PVM-001': {
    code: 'PVM-001',
    category: 'config',
    severity: 'critical',
    title: 'Pflichteinstellung fehlt',
    description: 'Eine verpflichtende Einstellung (z. B. HA-URL oder Token) ist nicht gesetzt.',
    remediation: 'Einstellungen öffnen und die markierten Pflichtfelder ausfüllen.',
    triggersShutdown: true,
  },
  'PVM-002': {
    code: 'PVM-002',
    category: 'network',
    severity: 'high',
    title: 'Home Assistant nicht erreichbar',
    description: 'Die HA-API konnte nicht erreicht werden (Timeout oder Verbindungsfehler).',
    remediation: 'HA-Host/Port prüfen, Netzwerk prüfen, HA-Status prüfen.',
    triggersShutdown: false,
  },
  'PVM-003': {
    code: 'PVM-003',
    category: 'security',
    severity: 'critical',
    title: 'HA-Authentifizierung fehlgeschlagen',
    description: 'Der Long-Lived Access Token wurde von Home Assistant abgelehnt.',
    remediation: 'Neuen Long-Lived Access Token in HA erstellen und in PVM eintragen.',
    triggersShutdown: true,
  },
  'PVM-004': {
    code: 'PVM-004',
    category: 'security',
    severity: 'critical',
    title: 'PVM-API-Authentifizierung fehlgeschlagen',
    description: 'Ein Aufruf der PVM-API hatte einen ungültigen oder fehlenden Token.',
    remediation: 'PVM-API-Token prüfen und neu setzen.',
    triggersShutdown: false,
  },
  'PVM-005': {
    code: 'PVM-005',
    category: 'device',
    severity: 'medium',
    title: 'Gerät nicht verfügbar',
    description: 'Ein Gerät ist in Home Assistant als unavailable/unknown gemeldet.',
    remediation: 'Gerät in HA prüfen, Verbindung/Integration prüfen.',
    triggersShutdown: false,
  },
  'PVM-006': {
    code: 'PVM-006',
    category: 'device',
    severity: 'high',
    title: 'Gerätesteuerung fehlgeschlagen',
    description: 'Ein Steuerbefehl an ein Gerät wurde von HA abgelehnt oder schlug fehl.',
    remediation: 'Entität/Dienst prüfen, Berechtigungen des Tokens prüfen.',
    triggersShutdown: false,
  },
  'PVM-007': {
    code: 'PVM-007',
    category: 'device',
    severity: 'critical',
    title: 'Leistungsgrenze überschritten',
    description: 'Die gemessene Leistung überschreitet die konfigurierte Obergrenze.',
    remediation: 'Lastmanagement/Prioritäten prüfen; PVM reduziert Lasten automatisch.',
    triggersShutdown: true,
  },
  'PVM-008': {
    code: 'PVM-008',
    category: 'device',
    severity: 'high',
    title: 'Temperaturgrenze überschritten',
    description: 'Eine konfigurierte Temperatur-Ober-/Untergrenze wurde verletzt.',
    remediation: 'Sollwerte und Grenzwerte prüfen.',
    triggersShutdown: true,
  },
  'PVM-009': {
    code: 'PVM-009',
    category: 'planner',
    severity: 'medium',
    title: 'Prognose fehlgeschlagen',
    description: 'Die Prognose konnte mit den vorhandenen Daten nicht berechnet werden.',
    remediation: 'Historische Daten und Wetterquelle prüfen.',
    triggersShutdown: false,
  },
  'PVM-010': {
    code: 'PVM-010',
    category: 'planner',
    severity: 'low',
    title: 'Planlade-Algorithmus ohne Ergebnis',
    description: 'Es konnte kein gültiger Ladeplan erzeugt werden.',
    remediation: 'Prioritäten, Batterie-Level und Kalender prüfen.',
    triggersShutdown: false,
  },
  'PVM-011': {
    code: 'PVM-011',
    category: 'addon',
    severity: 'high',
    title: 'Addon-Manifest ungültig',
    description: 'Das Manifest des Addons ist fehlerhaft oder unvollständig.',
    remediation: 'Manifest des Addons prüfen oder Autor kontaktieren.',
    triggersShutdown: false,
  },
  'PVM-012': {
    code: 'PVM-012',
    category: 'addon',
    severity: 'critical',
    title: 'Addon-Sicherheitsprüfung fehlgeschlagen',
    description: 'Ein Addon hat die Sicherheitsprüfung nicht bestanden.',
    remediation: 'Addon deaktivieren/entfernen; Sicherheits-Modus prüfen.',
    triggersShutdown: true,
  },
  'PVM-013': {
    code: 'PVM-013',
    category: 'addon',
    severity: 'medium',
    title: 'Addon-Ausführung fehlgeschlagen',
    description: 'Ein installiertes Addon konnte nicht ausgeführt werden.',
    remediation: 'Addon-Logs prüfen, Addon neu installieren.',
    triggersShutdown: false,
  },
  'PVM-014': {
    code: 'PVM-014',
    category: 'security',
    severity: 'critical',
    title: 'Sicherheits-Abschaltung ausgelöst',
    description: 'Das Sicherheitssystem hat eine Abschaltung ausgelöst.',
    remediation: 'Sicherheits-Log prüfen; Ursache beheben, dann reaktivieren.',
    triggersShutdown: true,
  },
  'PVM-015': {
    code: 'PVM-015',
    category: 'security',
    severity: 'high',
    title: 'Eingabe ungültig',
    description: 'Eine API-Eingabe hat die Validierung nicht bestanden.',
    remediation: 'Eingabewerte prüfen.',
    triggersShutdown: false,
  },
  'PVM-016': {
    code: 'PVM-016',
    category: 'network',
    severity: 'high',
    title: 'Nicht-lokale HA-URL blockiert',
    description:
      'Die konfigurierte HA-URL ist nicht lokal und wurde aus Sicherheitsgründen blockiert.',
    remediation: 'Lokale HA-URL verwenden oder HA_LOCAL_ONLY bewusst deaktivieren.',
    triggersShutdown: true,
  },
  'PVM-017': {
    code: 'PVM-017',
    category: 'planner',
    severity: 'medium',
    title: 'Kalender-Synchronisation fehlgeschlagen',
    description: 'Der HA-Kalender konnte nicht synchronisiert werden.',
    remediation: 'Kalender-URL und Aktualisierungsintervall prüfen.',
    triggersShutdown: false,
  },
  'PVM-018': {
    code: 'PVM-018',
    category: 'device',
    severity: 'medium',
    title: 'Selbstheilung durchgeführt',
    description: 'PVM hat einen vorherigen Zustand automatisch wiederhergestellt.',
    remediation: 'Keine Aktion nötig; Log zur Information prüfen.',
    triggersShutdown: false,
  },
  'PVM-019': {
    code: 'PVM-019',
    category: 'security',
    severity: 'critical',
    title: 'Rate-Limit überschritten',
    description: 'Zu viele Anfragen in kurzer Zeit.',
    remediation: 'Anfragefrequenz reduzieren.',
    triggersShutdown: false,
  },
  'PVM-020': {
    code: 'PVM-020',
    category: 'unknown',
    severity: 'medium',
    title: 'Unbekannter Fehler',
    description: 'Ein unerwarteter Fehler ist aufgetreten.',
    remediation: 'Dev-Log prüfen und ggf. Fehlerbericht erstellen.',
    triggersShutdown: false,
  },
  'PVM-021': {
    code: 'PVM-021',
    category: 'config',
    severity: 'medium',
    title: 'Backup ungültig',
    description: 'Die Backup-Datei ist beschädigt oder stammt nicht von PVM.',
    remediation:
      'Eine mit dieser PVM-Version erstellte Backup-Datei (.json) verwenden. Es wurde nichts geändert.',
    triggersShutdown: false,
  },
};

export function getErrorDefinition(code: string): ErrorDefinition {
  return ERROR_CATALOG[code] ?? ERROR_CATALOG['PVM-020']!;
}

/** Runtime error object that carries a catalogue code. */
export class PvmError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: Severity;
  public readonly remediation: string;
  public readonly triggersShutdown: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, details?: Record<string, unknown>, messageOverride?: string) {
    const def = getErrorDefinition(code);
    super(messageOverride ?? def.description);
    this.name = 'PvmError';
    this.code = def.code;
    this.category = def.category;
    this.severity = def.severity;
    this.remediation = def.remediation;
    this.triggersShutdown = def.triggersShutdown;
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      category: this.category,
      severity: this.severity,
      title: getErrorDefinition(this.code).title,
      message: this.message,
      remediation: this.remediation,
      details: this.details,
    };
  }
}
