export type Role =
  | 'SUPER_ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'CONTENT_EDITOR'
  | 'MERCHANT_MANAGER'
  | 'FINANCE_MANAGER'
  | 'SUPPORT_AGENT'
  | 'ANALYST';

export interface Permission {
  view: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  approve?: boolean;
  export?: boolean;
}

export type Module =
  | 'dashboard'
  | 'poi_map'
  | 'merchants'
  | 'drivers'
  | 'users'
  | 'trips'
  | 'bookings'
  | 'finance'
  | 'export'
  | 'team'
  | 'settings'
  | 'notifications';

const ROLE_PERMISSIONS: Record<Role, Record<Module, Permission>> = {
  SUPER_ADMIN: {
    dashboard: { view: true },
    poi_map: { view: true, create: true, edit: true, delete: true, approve: true },
    merchants: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
    drivers: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
    users: { view: true, edit: true, delete: true },
    trips: { view: true, edit: true, export: true },
    bookings: { view: true, edit: true, export: true },
    finance: { view: true, export: true },
    export: { view: true, export: true },
    team: { view: true, create: true, edit: true, delete: true },
    settings: { view: true, edit: true },
    notifications: { view: true },
  },
  OPERATIONS_MANAGER: {
    dashboard: { view: true },
    poi_map: { view: true, create: true, edit: true, approve: true },
    merchants: { view: true, edit: true, approve: true, export: true },
    drivers: { view: true, edit: true, approve: true, export: true },
    users: { view: true, edit: true },
    trips: { view: true, edit: true, export: true },
    bookings: { view: true, edit: true, export: true },
    finance: { view: true },
    export: { view: true, export: true },
    team: { view: true },
    settings: { view: true },
    notifications: { view: true },
  },
  MERCHANT_MANAGER: {
    dashboard: { view: true },
    poi_map: { view: true, edit: true },
    merchants: { view: true, edit: true, approve: true, export: true },
    drivers: { view: false },
    users: { view: false },
    trips: { view: true },
    bookings: { view: true },
    finance: { view: true },
    export: { view: true, export: true },
    team: { view: false },
    settings: { view: false },
    notifications: { view: true },
  },
  CONTENT_EDITOR: {
    dashboard: { view: true },
    poi_map: { view: true, create: true, edit: true, approve: true },
    merchants: { view: true },
    drivers: { view: false },
    users: { view: false },
    trips: { view: false },
    bookings: { view: false },
    finance: { view: false },
    export: { view: false },
    team: { view: false },
    settings: { view: false },
    notifications: { view: true },
  },
  FINANCE_MANAGER: {
    dashboard: { view: true },
    poi_map: { view: false },
    merchants: { view: true },
    drivers: { view: true },
    users: { view: false },
    trips: { view: true },
    bookings: { view: true },
    finance: { view: true, export: true },
    export: { view: true, export: true },
    team: { view: false },
    settings: { view: false },
    notifications: { view: true },
  },
  SUPPORT_AGENT: {
    dashboard: { view: true },
    poi_map: { view: true },
    merchants: { view: true },
    drivers: { view: true },
    users: { view: true, edit: true },
    trips: { view: true, edit: true },
    bookings: { view: true, edit: true },
    finance: { view: false },
    export: { view: false },
    team: { view: false },
    settings: { view: false },
    notifications: { view: true },
  },
  ANALYST: {
    dashboard: { view: true },
    poi_map: { view: true },
    merchants: { view: true },
    drivers: { view: true },
    users: { view: true },
    trips: { view: true },
    bookings: { view: true },
    finance: { view: true },
    export: { view: true, export: true },
    team: { view: false },
    settings: { view: false },
    notifications: { view: true },
  },
};

export function getPermissions(role: Role, module: Module): Permission {
  return ROLE_PERMISSIONS[role]?.[module] ?? { view: false };
}

export function canView(role: Role, module: Module): boolean {
  return getPermissions(role, module).view;
}

export function canEdit(role: Role, module: Module): boolean {
  return getPermissions(role, module).edit ?? false;
}

export function canCreate(role: Role, module: Module): boolean {
  return getPermissions(role, module).create ?? false;
}

export function canApprove(role: Role, module: Module): boolean {
  return getPermissions(role, module).approve ?? false;
}

export function canDelete(role: Role, module: Module): boolean {
  return getPermissions(role, module).delete ?? false;
}

export function canExport(role: Role, module: Module): boolean {
  return getPermissions(role, module).export ?? false;
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPERATIONS_MANAGER: 'Operations Manager',
  CONTENT_EDITOR: 'Content Editor',
  MERCHANT_MANAGER: 'Merchant Manager',
  FINANCE_MANAGER: 'Finance Manager',
  SUPPORT_AGENT: 'Support Agent',
  ANALYST: 'Analyst',
};
