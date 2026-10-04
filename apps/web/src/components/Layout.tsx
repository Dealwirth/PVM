import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import { useUiStore } from '../store/ui.js';
import { useRealtime } from '../hooks/useRealtime.js';

interface NavItem {
  to: string;
  key: string;
  icon: string;
}

const NAV: NavItem[] = [
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
  const { sidebarOpen, toggleSidebar, mobileNavOpen, setMobileNav } = useUiStore();
  const { connected } = useRealtime(() => {});

  // Close the mobile drawer whenever the viewport grows past the mobile breakpoint.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent): void => {
      if (e.matches) setMobileNav(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [setMobileNav]);

  const toggleLanguage = (): void => {
    void i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de');
  };

  return (
    <div className="flex min-h-screen bg-ha-bg">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label={t('common.close')}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileNav(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-ha-border bg-ha-surface transition-transform md:static md:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarOpen ? 'md:w-60' : 'md:w-16'}`}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="text-xl" aria-hidden>
            ☀️
          </span>
          {sidebarOpen && (
            <span className="font-semibold">
              {t('app.name')} <span className="text-xs text-gray-400">{t('app.tagline')}</span>
            </span>
          )}
        </div>
        <nav className="flex-1 space-y-1 px-2" aria-label={t('app.name')}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={t(`nav.${item.key}`)}
              onClick={() => setMobileNav(false)}
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
          <span
            className={connected ? 'text-green-400' : 'text-red-400'}
            title={connected ? t('app.connected') : t('app.offline')}
          >
            ● {connected ? t('app.connected') : t('app.offline')}
          </span>
          <button
            type="button"
            className="hover:text-gray-200"
            onClick={toggleLanguage}
            title={t('app.language')}
            aria-label={t('app.language')}
          >
            {i18n.language === 'de' ? 'EN' : 'DE'}
          </button>
          <button
            type="button"
            className="hidden hover:text-gray-200 md:inline"
            onClick={toggleSidebar}
            title={sidebarOpen ? t('app.collapse') : t('app.expand')}
            aria-label={sidebarOpen ? t('app.collapse') : t('app.expand')}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-ha-border bg-ha-surface px-4 py-3 md:hidden">
          <button
            type="button"
            className="text-xl"
            aria-label={t('app.expand')}
            onClick={() => setMobileNav(true)}
          >
            ☰
          </button>
          <span className="font-semibold">
            {t('app.name')} <span className="text-xs text-gray-400">{t('app.tagline')}</span>
          </span>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
