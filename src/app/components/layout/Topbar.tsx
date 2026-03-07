import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, Bell, X, Plus, Store, Car, MapPin, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ROLE_LABELS, type Role } from '../../lib/permissions';
import { notifications as mockNotifications } from '../../lib/mock-data';

export function Topbar() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const unreadCount = mockNotifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) setQuickActionsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Keyboard shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '/' && !searchOpen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [searchOpen]);

  const searchResults = searchQuery.length > 1
    ? [
        { label: 'Merchants', items: [{ name: 'Manila Express Mart', path: '/merchants' }] },
        { label: 'Drivers', items: [{ name: 'Juan Dela Cruz', path: '/drivers' }] },
        { label: 'Trips', items: [{ name: 'TRP-8834', path: '/trips' }] },
      ].filter(g => g.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())))
    : [];

  const quickActions = [
    { label: 'Add Merchant', icon: <Store size={14} />, path: '/merchants' },
    { label: 'Add Driver', icon: <Car size={14} />, path: '/drivers' },
    { label: 'Create POI', icon: <MapPin size={14} />, path: '/poi-map' },
  ];

  return (
    <header className="h-[56px] flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-xl shrink-0">
      <div className="flex-1" />

      <div className="flex items-center gap-1">
        {/* Global Search */}
        <div className="relative">
          {searchOpen ? (
            <div className="flex items-center gap-2 bg-[var(--accent)] rounded-lg px-3 py-1.5">
              <Search size={14} className="text-[var(--muted-foreground)]" aria-hidden="true" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search merchants, drivers, trips..."
                className="bg-transparent text-[13px] w-[260px] outline-none text-[var(--foreground)]"
                role="searchbox"
                aria-label="Global search"
              />
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                aria-label="Close search"
              >
                <X size={14} className="text-[var(--muted-foreground)]" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
              aria-label="Open search (press /)"
            >
              <Search size={14} />
              <span>Search</span>
              <kbd className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] border border-[var(--border)] text-[var(--muted-foreground)]">
                /
              </kbd>
            </button>
          )}

          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 right-0 w-[340px] bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden z-50">
              {searchResults.map(group => (
                <div key={group.label}>
                  <div className="px-3 py-2 text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider bg-[var(--accent)]" style={{ fontWeight: 600 }}>
                    {group.label}
                  </div>
                  {group.items.map(item => (
                    <button
                      key={item.name}
                      className="w-full text-left px-3 py-2.5 text-[13px] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
                      onClick={() => { navigate(item.path); setSearchOpen(false); setSearchQuery(''); }}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="relative" ref={quickRef}>
          <button
            onClick={() => setQuickActionsOpen(!quickActionsOpen)}
            className="p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
            aria-label="Quick actions"
          >
            <Plus size={16} className="text-[var(--muted-foreground)]" />
          </button>
          {quickActionsOpen && (
            <div className="absolute top-full mt-2 right-0 w-[200px] bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden z-50 py-1">
              <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider" style={{ fontWeight: 600 }}>
                Quick Actions
              </p>
              {quickActions.map(action => (
                <button
                  key={action.label}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
                  style={{ fontWeight: 500 }}
                  onClick={() => { navigate(action.path); setQuickActionsOpen(false); }}
                >
                  <span className="text-[var(--muted-foreground)]">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell size={16} className="text-[var(--muted-foreground)]" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center"
                style={{ fontWeight: 600 }}
                aria-hidden="true"
              >
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-full mt-2 right-0 w-[360px] bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <span className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Notifications</span>
                <button
                  className="text-[12px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500"
                  onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                >
                  View all
                </button>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {mockNotifications.slice(0, 5).map(n => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-[var(--border)] last:border-0 ${
                      !n.read ? 'bg-blue-50/50 dark:bg-blue-950/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          n.type === 'error' ? 'bg-red-500' :
                          n.type === 'warning' ? 'bg-orange-500' :
                          n.type === 'success' ? 'bg-green-500' :
                          'bg-blue-500'
                        }`}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{n.title}</p>
                        <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{n.message}</p>
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-1">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center bg-[var(--accent)] rounded-lg p-0.5">
          <button
            onClick={() => setTheme('light')}
            className={`p-1.5 rounded-md transition-all ${
              theme === 'light'
                ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
            aria-label="Light mode"
            title="Light"
          >
            <Sun size={14} />
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`p-1.5 rounded-md transition-all ${
              theme === 'dark'
                ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
            aria-label="Dark mode"
            title="Dark"
          >
            <Moon size={14} />
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`p-1.5 rounded-md transition-all ${
              theme === 'system'
                ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
            aria-label="System theme"
            title="System"
          >
            <Monitor size={14} />
          </button>
        </div>

        {/* Profile */}
        {user && (
          <div className="relative ml-1 pl-2 border-l border-[var(--border)]" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-[var(--accent)] transition-colors"
              aria-label="Admin profile"
            >
              <div
                className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] text-[11px]"
                style={{ fontWeight: 600 }}
                aria-hidden="true"
              >
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
            </button>

            {profileOpen && (
              <div className="absolute top-full mt-2 right-0 w-[240px] bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{user.name}</p>
                  <p className="text-[12px] text-[var(--muted-foreground)]">{user.email}</p>
                </div>
                <div className="px-4 py-2.5 border-b border-[var(--border)]">
                  <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5">Role</p>
                  <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                    {ROLE_LABELS[user.role as Role]}
                  </p>
                </div>
                <div className="py-1 text-[13px] text-[var(--foreground)]">
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-[var(--accent)] transition-colors text-red-600"
                    style={{ fontWeight: 500 }}
                    onClick={() => { setProfileOpen(false); navigate('/login'); }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}