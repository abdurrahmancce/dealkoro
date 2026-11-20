import React from 'react';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  FileText,
  Gamepad2,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  PlusSquare,
  Search,
  Settings,
  Shield,
  Sun,
  User,
  X,
} from 'lucide-react';
import type { AppRoute, Language, ThemeMode, UserProfile } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { ResilientImage } from './ResilientImage';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';

interface AppShellProps {
  user: UserProfile;
  language: Language;
  theme: ThemeMode;
  route: AppRoute;
  unreadNotifications: number;
  unreadMessages: number;
  drawerOpen: boolean;
  onToggleTheme: (next?: ThemeMode) => void;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onNavigate: (route: AppRoute) => void;
  onLogout: () => void;
  onBack?: () => void;
  headerTitle?: string;
  children: React.ReactNode;
}

export function AppShell({
  user,
  language,
  theme,
  route,
  unreadNotifications,
  unreadMessages,
  drawerOpen,
  onToggleTheme,
  onOpenDrawer,
  onCloseDrawer,
  onNavigate,
  onLogout,
  onBack,
  headerTitle,
  children,
}: AppShellProps) {
  const isTabActive = (tab: 'profile' | 'create_post' | 'home' | 'admin_queue' | 'inbox') => {
    if (tab === 'profile') {
      return ['profile', 'your_posts', 'personal_info', 'settings', 'security'].includes(
        route.screen
      );
    }
    if (tab === 'admin_queue') {
      return (
        route.screen === 'admin_queue' ||
        route.screen === 'admin_dashboard' ||
        route.screen === 'admin_detail'
      );
    }
    if (tab === 'inbox') {
      return route.screen === 'inbox' || route.screen === 'chat' || route.screen === 'deal';
    }
    return route.screen === tab;
  };

  const drawerItems: {
    label: string;
    icon: React.ReactNode;
    action: () => void;
    active?: boolean;
  }[] = [
    {
      label: t(language, 'home'),
      icon: <Home className="w-4 h-4" />,
      action: () => onNavigate({ screen: 'home' }),
      active: route.screen === 'home',
    },
    ...(user.role === 'admin'
      ? [
          {
            label: t(language, 'adminDashboard'),
            icon: <LayoutDashboard className="w-4 h-4" />,
            action: () => onNavigate({ screen: 'admin_dashboard' }),
            active: route.screen === 'admin_dashboard',
          },
        ]
      : []),
    {
      label: t(language, 'escrowMap'),
      icon: <MapPin className="w-4 h-4" />,
      action: () => onNavigate({ screen: 'escrow_map' }),
      active: route.screen === 'escrow_map',
    },
    {
      label: t(language, 'strikerGame'),
      icon: <Gamepad2 className="w-4 h-4" />,
      action: () => onNavigate({ screen: 'arcade_game' }),
      active: route.screen === 'arcade_game',
    },
    {
      label: t(language, 'statement'),
      icon: <FileText className="w-4 h-4" />,
      action: () => onNavigate({ screen: 'statement' }),
      active: route.screen === 'statement',
    },
    {
      label: t(language, 'bookmark'),
      icon: <Bookmark className="w-4 h-4" />,
      action: () => onNavigate({ screen: 'bookmarks' }),
      active: route.screen === 'bookmarks',
    },
    {
      label: t(language, 'helpFeedback'),
      icon: <HelpCircle className="w-4 h-4" />,
      action: () => onNavigate({ screen: 'help' }),
      active: route.screen === 'help',
    },
    {
      label: t(language, 'settings'),
      icon: <Settings className="w-4 h-4" />,
      action: () => onNavigate({ screen: 'settings' }),
      active: route.screen === 'settings',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row transition-colors">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30 transition-colors">
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onNavigate({ screen: 'home' })}
            className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap"
          >
            DEAL<span className="text-blue-600 dark:text-blue-400">KORO</span>
          </button>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums">
            {user.role === 'admin' ? 'Admin' : `Lv.${user.level}`}
          </span>
        </div>

        {/* User summary */}
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'profile' })}
          className="m-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shrink-0">
            {user.avatarUrl ? (
              <ResilientImage
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{user.displayName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {user.displayName}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user.sellCount} {t(language, 'sellStat')} · {user.buyCount}{' '}
              {t(language, 'buyStat')}
            </div>
          </div>
        </button>

        {/* Primary Desktop Nav */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {[
            {
              key: 'home',
              label: t(language, 'home'),
              icon: <Home className="w-4 h-4" />,
              active: isTabActive('home'),
              onClick: () => onNavigate({ screen: 'home' }),
            },
            {
              key: 'search',
              label: t(language, 'search'),
              icon: <Search className="w-4 h-4" />,
              active: route.screen === 'search',
              onClick: () => onNavigate({ screen: 'search' }),
            },
            {
              key: 'create_post',
              label: t(language, 'post'),
              icon: <PlusSquare className="w-4 h-4" />,
              active: isTabActive('create_post'),
              onClick: () => onNavigate({ screen: 'create_post' }),
            },
            {
              key: 'inbox',
              label: t(language, 'message'),
              icon: <MessageSquare className="w-4 h-4" />,
              active: isTabActive('inbox'),
              badge: unreadMessages,
              onClick: () => onNavigate({ screen: 'inbox' }),
            },
            ...(user.role === 'admin'
              ? [
                  {
                    key: 'admin_dashboard',
                    label: t(language, 'adminDashboard'),
                    icon: <LayoutDashboard className="w-4 h-4" />,
                    active: route.screen === 'admin_dashboard',
                    onClick: () => onNavigate({ screen: 'admin_dashboard' }),
                  },
                ]
              : []),
            {
              key: 'admin_queue',
              label: t(language, 'admin'),
              icon: <Shield className="w-4 h-4" />,
              active: route.screen === 'admin_queue' || route.screen === 'admin_detail',
              onClick: () => onNavigate({ screen: 'admin_queue' }),
            },
            {
              key: 'notifications',
              label: t(language, 'notifications'),
              icon: <Bell className="w-4 h-4" />,
              active: route.screen === 'notifications',
              badge: unreadNotifications,
              onClick: () => onNavigate({ screen: 'notifications' }),
            },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors ${
                item.active
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-3 whitespace-nowrap">
                {item.icon}
                <span>{item.label}</span>
              </span>
              {item.badge ? (
                <span className="text-xs font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
            {drawerItems
              .filter(
                (item) =>
                  item.label !== t(language, 'home') &&
                  item.label !== t(language, 'adminDashboard')
              )
              .map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                    item.active
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              ))}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <PWAInstallButton language={language} showGuideFallback />

          <button
            type="button"
            onClick={onLogout}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-3 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t(language, 'logout')}</span>
          </button>
          <div className="px-3.5 text-xs text-slate-400 dark:text-slate-500">
            {t(language, 'appVersion')}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Top Bar (Mobile + Desktop unified compact header) */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Go back"
                className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenDrawer}
                aria-label="Open navigation menu"
                className="lg:hidden min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate({ screen: 'home' })}
              className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap truncate"
            >
              {headerTitle ? (
                headerTitle
              ) : (
                <>
                  DEAL<span className="text-blue-600 dark:text-blue-400">KORO</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onToggleTheme()}
              data-testid="theme-toggle-btn"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? t(language, 'lightMode') : t(language, 'darkMode')}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ screen: 'search' })}
              aria-label={t(language, 'search')}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ screen: 'notifications' })}
              aria-label={t(language, 'notifications')}
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotifications}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Screen Body */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Slide-Over Navigation Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
        >
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs"
            onClick={onCloseDrawer}
          />
          <div className="relative w-72 max-w-[82vw] h-full bg-white dark:bg-slate-900 shadow-xl flex flex-col justify-between p-5 z-10 border-r border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  DEAL<span className="text-blue-600 dark:text-blue-400">KORO</span>
                </span>
                <button
                  type="button"
                  onClick={onCloseDrawer}
                  aria-label="Close navigation menu"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onNavigate({ screen: 'profile' });
                  onCloseDrawer();
                }}
                className="w-full mt-4 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl flex items-center gap-3 text-left"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shrink-0">
                  {user.avatarUrl ? (
                    <ResilientImage
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{user.displayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {user.displayName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </div>
                </div>
              </button>

              <nav className="mt-5 space-y-1">
                {drawerItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action();
                      onCloseDrawer();
                    }}
                    className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                      item.active
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    onCloseDrawer();
                    onLogout();
                  }}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-3 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t(language, 'logout')}</span>
                </button>
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs text-slate-400 dark:text-slate-500">
              <PWAInstallButton language={language} showGuideFallback />
              <div>{t(language, 'appVersion')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed 5-Tab Bottom Navigation Bar */}
      <nav
        aria-label="Bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center transition-colors"
      >
        {[
          {
            id: 'profile',
            label: t(language, 'profile'),
            icon: <User className="w-5 h-5" />,
            active: isTabActive('profile'),
            onClick: () => onNavigate({ screen: 'profile' }),
          },
          {
            id: 'create_post',
            label: t(language, 'post'),
            icon: <PlusSquare className="w-5 h-5" />,
            active: isTabActive('create_post'),
            onClick: () => onNavigate({ screen: 'create_post' }),
          },
          {
            id: 'home',
            label: t(language, 'home'),
            icon: <Home className="w-5 h-5" />,
            active: isTabActive('home'),
            onClick: () => onNavigate({ screen: 'home' }),
          },
          {
            id: 'admin_queue',
            label: t(language, 'admin'),
            icon: <Shield className="w-5 h-5" />,
            active: isTabActive('admin_queue'),
            onClick: () =>
              onNavigate({
                screen: user.role === 'admin' ? 'admin_dashboard' : 'admin_queue',
              }),
          },
          {
            id: 'inbox',
            label: t(language, 'message'),
            icon: <MessageSquare className="w-5 h-5" />,
            active: isTabActive('inbox'),
            badge: unreadMessages,
            onClick: () => onNavigate({ screen: 'inbox' }),
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={tab.onClick}
            className={`relative h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              tab.active
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/50 font-semibold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <span className="relative">
              {tab.icon}
              {tab.badge ? (
                <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {tab.badge}
                </span>
              ) : null}
            </span>
            <span className="whitespace-nowrap truncate max-w-[64px]">{tab.label}</span>
          </button>
        ))}
      </nav>
      <OfflineIndicator language={language} />
    </div>
  );
}
