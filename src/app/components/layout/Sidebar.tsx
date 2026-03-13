import { NavLink, useLocation } from 'react-router';
import {
  LayoutDashboard,
  MapPin,
  Store,
  Car,
  ClipboardCheck,
  Users,
  Navigation,
  CalendarCheck,
  DollarSign,
  Download,
  Shield,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  List,
  Globe,
  ScanFace,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canView, ROLE_LABELS, type Role, type Module } from '../../lib/permissions';
import { useState, type ReactNode } from 'react';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  module: Module;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} />, module: 'dashboard' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'POI Map', path: '/poi-map', icon: <MapPin size={18} />, module: 'poi_map' },
      { label: 'Service Areas', path: '/service-areas', icon: <Navigation size={18} />, module: 'poi_map' },
      { label: 'Lookup Types', path: '/lookup-types', icon: <List size={18} />, module: 'poi_map' },
      { label: 'Markets', path: '/markets', icon: <Globe size={18} />, module: 'settings' },
      { label: 'Trips', path: '/trips', icon: <Navigation size={18} />, module: 'trips' },
      { label: 'Bookings', path: '/bookings', icon: <CalendarCheck size={18} />, module: 'bookings' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { label: 'Merchants', path: '/merchants', icon: <Store size={18} />, module: 'merchants', badge: 2 },
      { label: 'Drivers', path: '/drivers', icon: <Car size={18} />, module: 'drivers', badge: 2 },
      { label: 'Pending Drivers', path: '/drivers/pending', icon: <ClipboardCheck size={18} />, module: 'drivers' },
      { label: 'Selfie Review', path: '/drivers/liveness', icon: <ScanFace size={18} />, module: 'drivers' },
      { label: 'Users', path: '/users', icon: <Users size={18} />, module: 'users' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Finance & Reports', path: '/finance', icon: <DollarSign size={18} />, module: 'finance' },
      { label: 'Exports', path: '/export', icon: <Download size={18} />, module: 'export' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Team', path: '/team', icon: <Shield size={18} />, module: 'team' },
      { label: 'Settings', path: '/settings', icon: <Settings size={18} />, module: 'settings' },
    ],
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;
  const role = user.role as Role;

  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => canView(role, item.module)),
  })).filter(group => group.items.length > 0);

  return (
    <aside
      className={`h-screen flex flex-col bg-[var(--card)] border-r border-[var(--border)] transition-all duration-200 shrink-0 ${
        collapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      {/* Logo + collapse */}
      <div className="h-[56px] flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0">
        {!collapsed && (
          <span className="text-[18px] tracking-tight text-[var(--foreground)]" style={{ fontWeight: 600 }}>
            Direkto
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-3" role="navigation" aria-label="Main navigation">
        {filteredGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
            {/* Group label */}
            {!collapsed && (
              <p
                className="px-3 mb-1 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]"
                style={{ fontWeight: 600 }}
              >
                {group.label}
              </p>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-3 mb-2 border-t border-[var(--border)]" />
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                      isActive
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'
                    }`}
                    style={{ fontWeight: 500 }}
                    title={collapsed ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span
                            className={`text-[11px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-white/20 text-[var(--primary-foreground)]'
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                            }`}
                            style={{ fontWeight: 500 }}
                            aria-label={`${item.badge} pending`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-[var(--border)] p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <div
              className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] text-[12px] shrink-0"
              style={{ fontWeight: 600 }}
              aria-hidden="true"
            >
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] truncate text-[var(--foreground)]" style={{ fontWeight: 500 }}>{user.name}</p>
              <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                {ROLE_LABELS[role]}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] text-[12px]"
              style={{ fontWeight: 600 }}
              aria-hidden="true"
            >
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <button
              onClick={logout}
              className="w-full flex justify-center p-2 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}