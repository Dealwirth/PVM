import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import { useUiStore } from '../store/ui.js';
import { useRealtime } from '../hooks/useRealtime.js';

const NAV = [
  { to: '/', key: 'dashboard', icon: '🏠' },
  { to: '/devices', key: 'devices', icon: '🔌' },
  { to: '/store', key: 'store', icon: '🧩' },
  { to: '/calendar', key: 'calendar', icon: '📅' },
  { to: '/forecast', key: 'forecast', icon: '📈' },
  { to: '/safety', key: 'safety', icon: '🛡️' },
  { to: '/devlog', key: 'devlog', icon: '📝' },
  { to: '/settings', key: 'settings', icon: '⚙️' },
  { to: '/tutorial', key: 'tutorial', icon: '🎓' },
];

export function Layout(): JSX.Element {
  const { t } = useTranslation();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const { connected } = useRealtime(() => {});

  const toggleLanguage = (): void => {
    void i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de');
  };

  return (
    <div className="flex min-h-screen bg-ha-bg">
      <aside
        className={`${sidebarOpen ? 'w-60' : 'w-16'} flex flex-col border-r border-ha-border bg-ha-surface transition-all`}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="text-xl">☀️</span>
          {sidebarOpen && (
            <span className="font-semibold">
              {t('app.name')} <span className="text-xs text-gray-400">{t('app.tagline')}</span>
            </span>
          )}
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-ha-primary/20 text-ha-primary'
                    : 'text-gray-300 hover:bg-ha-surfaceAlt'
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              {sidebarOpen && <span>{t(`nav.${item.key}`)}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between px-3 py-3 text-xs text-gray-400">
          <span className={connected ? 'text-green-400' : 'text-red-400'}>
            ● {connected ? 'WS' : 'offline'}
          </span>
          <button type="button" className="hover:text-gray-200" onClick={toggleLanguage}>
            {i18n.language === 'de' ? 'EN' : 'DE'}
          </button>
          <button
            type="button"
            className="hover:text-gray-200"
            onClick={toggleSidebar}
            aria-label="toggle sidebar"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
