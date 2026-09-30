import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore.js';
import { authApi } from '../../api/index.js';

const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: '🏡' },
  { to: '/farms', labelKey: 'nav.farms', icon: '🌾' },
  { to: '/advisory', labelKey: 'nav.advisory', icon: '💡' },
  { to: '/diagnostics', labelKey: 'nav.diagnostics', icon: '🔬' },
  { to: '/profile', labelKey: 'nav.profile', icon: '👤' },
];

export function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshToken, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* ignore network errors on logout */ }
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top header */}
      <header className="bg-agri-700 text-white shadow-md safe-top" role="banner">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🌿</span>
            <span className="font-semibold text-lg tracking-tight">BRICS AgriN</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-agri-100 hidden sm:block">
                {user.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-agri-100 hover:text-white transition-colors px-2 py-1 rounded hover:bg-agri-600 focus-visible:outline-white"
              aria-label={t('nav.logout')}
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6" role="main">
        <Outlet />
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav
        className="bg-white border-t border-gray-200 safe-bottom fixed bottom-0 left-0 right-0 md:relative md:border-t-0 md:bg-transparent z-20"
        aria-label="Main navigation"
      >
        <ul className="flex justify-around md:justify-start md:gap-6 max-w-5xl mx-auto px-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.to} className="flex-1 md:flex-none">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col md:flex-row items-center gap-0.5 md:gap-2 px-2 py-2 md:py-1 rounded-lg text-xs md:text-sm font-medium transition-colors
                   ${isActive
                     ? 'text-agri-700 md:bg-agri-50'
                     : 'text-gray-500 hover:text-agri-700 hover:bg-gray-50'
                   }`
                }
                aria-current={({ isActive }) => isActive ? 'page' : undefined}
              >
                <span className="text-lg md:text-base" aria-hidden="true">{item.icon}</span>
                <span className="leading-tight text-center">{t(item.labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom padding to prevent content hiding behind fixed nav on mobile */}
      <div className="h-16 md:hidden" aria-hidden="true" />
    </div>
  );
}
