// ─── Dashboard ───
export const dashboardOverview = {
  totalRevenue: 2_847_320,
  revenueDelta: 12.4,
  activeTrips: 1_247,
  tripsDelta: 8.2,
  totalMerchants: 3_842,
  merchantsDelta: 5.1,
  totalDrivers: 12_456,
  driversDelta: 3.7,
  pendingApprovals: 84,
  activeUsers: 48_293,
};

export const revenueTrend = [
  { month: 'Sep', revenue: 1_920_000 },
  { month: 'Oct', revenue: 2_100_000 },
  { month: 'Nov', revenue: 1_980_000 },
  { month: 'Dec', revenue: 2_340_000 },
  { month: 'Jan', revenue: 2_580_000 },
  { month: 'Feb', revenue: 2_847_320 },
];

export const topMerchants = [
  { id: 'm1', name: 'Manila Express Mart', revenue: 342_100, trips: 4_210 },
  { id: 'm2', name: 'Cebu Fresh Market', revenue: 287_400, trips: 3_680 },
  { id: 'm3', name: 'Davao Quick Stop', revenue: 234_800, trips: 2_940 },
  { id: 'm4', name: 'Quezon Grocery Hub', revenue: 198_600, trips: 2_410 },
  { id: 'm5', name: 'Makati Deli & More', revenue: 176_300, trips: 2_120 },
];

export const recentActivity = [
  { id: 'a1', action: 'Merchant approved', target: 'Manila Express Mart', user: 'Alex Rivera', time: '2 min ago' },
  { id: 'a2', action: 'Driver suspended', target: 'Juan Dela Cruz', user: 'Jordan Lee', time: '15 min ago' },
  { id: 'a3', action: 'Trip cancelled', target: 'TRP-2024-8834', user: 'System', time: '32 min ago' },
  { id: 'a4', action: 'POI verified', target: 'SM Mall Cebu', user: 'Alex Rivera', time: '1 hr ago' },
  { id: 'a5', action: 'Commission updated', target: 'Cebu Fresh Market', user: 'Morgan Diaz', time: '2 hrs ago' },
  { id: 'a6', action: 'New team member', target: 'Riley Park', user: 'Alex Rivera', time: '3 hrs ago' },
];

// ─── Merchants ───
export type MerchantStatus = 'active' | 'pending' | 'suspended' | 'rejected';

export interface Merchant {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  status: MerchantStatus;
  revenue: number;
  trips: number;
  joinDate: string;
  address: string;
  commissionRate: number;
  contactPerson: string;
}

export const merchants: Merchant[] = [
  { id: 'MCH-001', name: 'Manila Express Mart', email: 'info@manilaexpress.ph', phone: '+63 917 123 4567', category: 'Grocery', status: 'active', revenue: 342100, trips: 4210, joinDate: '2025-03-15', address: '123 Rizal Ave, Manila', commissionRate: 12, contactPerson: 'Maria Santos' },
  { id: 'MCH-002', name: 'Cebu Fresh Market', email: 'hello@cebufresh.ph', phone: '+63 918 234 5678', category: 'Market', status: 'active', revenue: 287400, trips: 3680, joinDate: '2025-04-22', address: '456 Osmena Blvd, Cebu', commissionRate: 10, contactPerson: 'Carlos Reyes' },
  { id: 'MCH-003', name: 'Davao Quick Stop', email: 'support@davaoquick.ph', phone: '+63 919 345 6789', category: 'Convenience', status: 'pending', revenue: 0, trips: 0, joinDate: '2026-02-10', address: '789 JP Laurel Ave, Davao', commissionRate: 15, contactPerson: 'Ana Cruz' },
  { id: 'MCH-004', name: 'Quezon Grocery Hub', email: 'contact@qchub.ph', phone: '+63 920 456 7890', category: 'Grocery', status: 'active', revenue: 198600, trips: 2410, joinDate: '2025-06-08', address: '321 Commonwealth Ave, QC', commissionRate: 11, contactPerson: 'Pedro Ramos' },
  { id: 'MCH-005', name: 'Makati Deli & More', email: 'info@makatideli.ph', phone: '+63 921 567 8901', category: 'Restaurant', status: 'active', revenue: 176300, trips: 2120, joinDate: '2025-07-14', address: '555 Ayala Ave, Makati', commissionRate: 14, contactPerson: 'Lisa Tan' },
  { id: 'MCH-006', name: 'Taguig Food Corner', email: 'tfc@email.ph', phone: '+63 922 678 9012', category: 'Restaurant', status: 'suspended', revenue: 45200, trips: 620, joinDate: '2025-08-20', address: '888 BGC, Taguig', commissionRate: 13, contactPerson: 'Mark Lim' },
  { id: 'MCH-007', name: 'Pasig Pharmacy Plus', email: 'rx@pasigpharm.ph', phone: '+63 923 789 0123', category: 'Pharmacy', status: 'pending', revenue: 0, trips: 0, joinDate: '2026-02-12', address: '222 Ortigas Ave, Pasig', commissionRate: 8, contactPerson: 'Dr. Reyes' },
  { id: 'MCH-008', name: 'Caloocan Mart', email: 'cmart@email.ph', phone: '+63 924 890 1234', category: 'Grocery', status: 'rejected', revenue: 0, trips: 0, joinDate: '2026-01-05', address: '111 EDSA, Caloocan', commissionRate: 12, contactPerson: 'Juan Razo' },
  { id: 'MCH-009', name: 'Iloilo Bakeshop', email: 'bake@iloilo.ph', phone: '+63 925 901 2345', category: 'Bakery', status: 'active', revenue: 89400, trips: 1340, joinDate: '2025-09-01', address: '444 Jaro, Iloilo City', commissionRate: 10, contactPerson: 'Elena Garcia' },
  { id: 'MCH-010', name: 'Baguio Coffee Co', email: 'brew@baguio.ph', phone: '+63 926 012 3456', category: 'Cafe', status: 'active', revenue: 67800, trips: 980, joinDate: '2025-10-15', address: '777 Session Rd, Baguio', commissionRate: 12, contactPerson: 'David Aquino' },
];

// ─── Drivers ───
export type DriverStatus = 'active' | 'pending' | 'suspended' | 'inactive';

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  status: DriverStatus;
  rating: number;
  totalTrips: number;
  earnings: number;
  joinDate: string;
  licensePlate: string;
  documents: { type: string; status: 'verified' | 'pending' | 'expired' }[];
}

export const drivers: Driver[] = [
  { id: 'DRV-001', name: 'Juan Dela Cruz', email: 'juan@email.ph', phone: '+63 917 111 2222', vehicleType: 'Motorcycle', status: 'active', rating: 4.8, totalTrips: 3240, earnings: 456000, joinDate: '2025-01-10', licensePlate: 'ABC 1234', documents: [{ type: 'License', status: 'verified' }, { type: 'Registration', status: 'verified' }, { type: 'Insurance', status: 'verified' }] },
  { id: 'DRV-002', name: 'Pedro Santos', email: 'pedro@email.ph', phone: '+63 918 222 3333', vehicleType: 'Car', status: 'active', rating: 4.6, totalTrips: 2180, earnings: 389000, joinDate: '2025-02-20', licensePlate: 'DEF 5678', documents: [{ type: 'License', status: 'verified' }, { type: 'Registration', status: 'verified' }, { type: 'Insurance', status: 'pending' }] },
  { id: 'DRV-003', name: 'Maria Garcia', email: 'maria@email.ph', phone: '+63 919 333 4444', vehicleType: 'Motorcycle', status: 'pending', rating: 0, totalTrips: 0, earnings: 0, joinDate: '2026-02-14', licensePlate: 'GHI 9012', documents: [{ type: 'License', status: 'pending' }, { type: 'Registration', status: 'pending' }, { type: 'Insurance', status: 'pending' }] },
  { id: 'DRV-004', name: 'Roberto Lim', email: 'rob@email.ph', phone: '+63 920 444 5555', vehicleType: 'Van', status: 'suspended', rating: 3.2, totalTrips: 890, earnings: 178000, joinDate: '2025-04-05', licensePlate: 'JKL 3456', documents: [{ type: 'License', status: 'verified' }, { type: 'Registration', status: 'expired' }, { type: 'Insurance', status: 'expired' }] },
  { id: 'DRV-005', name: 'Ana Reyes', email: 'ana@email.ph', phone: '+63 921 555 6666', vehicleType: 'Motorcycle', status: 'active', rating: 4.9, totalTrips: 5120, earnings: 678000, joinDate: '2024-11-15', licensePlate: 'MNO 7890', documents: [{ type: 'License', status: 'verified' }, { type: 'Registration', status: 'verified' }, { type: 'Insurance', status: 'verified' }] },
  { id: 'DRV-006', name: 'Miguel Torres', email: 'mig@email.ph', phone: '+63 922 666 7777', vehicleType: 'Car', status: 'active', rating: 4.5, totalTrips: 1890, earnings: 345000, joinDate: '2025-05-22', licensePlate: 'PQR 1234', documents: [{ type: 'License', status: 'verified' }, { type: 'Registration', status: 'verified' }, { type: 'Insurance', status: 'verified' }] },
  { id: 'DRV-007', name: 'Elena Cruz', email: 'elena@email.ph', phone: '+63 923 777 8888', vehicleType: 'Motorcycle', status: 'pending', rating: 0, totalTrips: 0, earnings: 0, joinDate: '2026-02-13', licensePlate: 'STU 5678', documents: [{ type: 'License', status: 'pending' }, { type: 'Registration', status: 'verified' }, { type: 'Insurance', status: 'pending' }] },
  { id: 'DRV-008', name: 'Carlos Ramos', email: 'carlos@email.ph', phone: '+63 924 888 9999', vehicleType: 'Van', status: 'active', rating: 4.3, totalTrips: 1560, earnings: 298000, joinDate: '2025-06-30', licensePlate: 'VWX 9012', documents: [{ type: 'License', status: 'verified' }, { type: 'Registration', status: 'verified' }, { type: 'Insurance', status: 'verified' }] },
];

// ─── Users ───
export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'banned' | 'inactive';
  totalBookings: number;
  totalSpent: number;
  joinDate: string;
  lastActive: string;
}

export const users: AppUser[] = [
  { id: 'USR-001', name: 'Isabella Mendoza', email: 'bella@email.ph', phone: '+63 917 100 2000', status: 'active', totalBookings: 87, totalSpent: 34200, joinDate: '2025-01-05', lastActive: '2 hours ago' },
  { id: 'USR-002', name: 'Gabriel Tan', email: 'gab@email.ph', phone: '+63 918 200 3000', status: 'active', totalBookings: 124, totalSpent: 56800, joinDate: '2024-11-20', lastActive: '30 min ago' },
  { id: 'USR-003', name: 'Sofia Ramirez', email: 'sofia@email.ph', phone: '+63 919 300 4000', status: 'banned', totalBookings: 12, totalSpent: 4500, joinDate: '2025-06-10', lastActive: '2 weeks ago' },
  { id: 'USR-004', name: 'Matteo Cruz', email: 'matteo@email.ph', phone: '+63 920 400 5000', status: 'active', totalBookings: 45, totalSpent: 18900, joinDate: '2025-03-15', lastActive: '1 hour ago' },
  { id: 'USR-005', name: 'Luna Santos', email: 'luna@email.ph', phone: '+63 921 500 6000', status: 'inactive', totalBookings: 3, totalSpent: 1200, joinDate: '2025-09-01', lastActive: '3 months ago' },
  { id: 'USR-006', name: 'Diego Villanueva', email: 'diego@email.ph', phone: '+63 922 600 7000', status: 'active', totalBookings: 201, totalSpent: 89400, joinDate: '2024-08-12', lastActive: '5 min ago' },
];

// ─── Trips ───
export type TripStatus = 'active' | 'completed' | 'cancelled' | 'pending';

export interface Trip {
  id: string;
  driver: string;
  rider: string;
  merchant?: string;
  origin: string;
  destination: string;
  status: TripStatus;
  fare: number;
  distance: string;
  duration: string;
  startTime: string;
  type: 'ride' | 'delivery';
}

export const trips: Trip[] = [
  { id: 'TRP-8834', driver: 'Juan Dela Cruz', rider: 'Isabella Mendoza', origin: 'Makati CBD', destination: 'BGC, Taguig', status: 'active', fare: 180, distance: '4.2 km', duration: '12 min', startTime: '2026-02-15T14:23:00', type: 'ride' },
  { id: 'TRP-8833', driver: 'Ana Reyes', rider: 'Gabriel Tan', merchant: 'Manila Express Mart', origin: 'Manila Express Mart', destination: 'Ortigas, Pasig', status: 'active', fare: 245, distance: '8.1 km', duration: '22 min', startTime: '2026-02-15T14:15:00', type: 'delivery' },
  { id: 'TRP-8832', driver: 'Pedro Santos', rider: 'Matteo Cruz', origin: 'Quezon City', destination: 'Mandaluyong', status: 'completed', fare: 320, distance: '12.3 km', duration: '35 min', startTime: '2026-02-15T13:40:00', type: 'ride' },
  { id: 'TRP-8831', driver: 'Miguel Torres', rider: 'Luna Santos', origin: 'Pasig', destination: 'Marikina', status: 'completed', fare: 150, distance: '5.8 km', duration: '18 min', startTime: '2026-02-15T13:10:00', type: 'ride' },
  { id: 'TRP-8830', driver: 'Carlos Ramos', rider: 'Diego Villanueva', merchant: 'Cebu Fresh Market', origin: 'Cebu Fresh Market', destination: 'IT Park, Cebu', status: 'cancelled', fare: 0, distance: '3.5 km', duration: '-', startTime: '2026-02-15T12:50:00', type: 'delivery' },
  { id: 'TRP-8829', driver: 'Juan Dela Cruz', rider: 'Sofia Ramirez', origin: 'Alabang', destination: 'Las Pinas', status: 'completed', fare: 210, distance: '7.2 km', duration: '25 min', startTime: '2026-02-15T12:20:00', type: 'ride' },
  { id: 'TRP-8828', driver: 'Ana Reyes', rider: 'Gabriel Tan', origin: 'Makati', destination: 'Paranaque', status: 'completed', fare: 280, distance: '9.5 km', duration: '30 min', startTime: '2026-02-15T11:45:00', type: 'ride' },
  { id: 'TRP-8827', driver: 'Pedro Santos', rider: 'Isabella Mendoza', merchant: 'Makati Deli & More', origin: 'Makati Deli & More', destination: 'Rockwell, Makati', status: 'pending', fare: 120, distance: '2.1 km', duration: '-', startTime: '2026-02-15T14:30:00', type: 'delivery' },
];

// ─── Bookings ───
export interface Booking {
  id: string;
  type: 'ride' | 'delivery';
  user: string;
  merchant?: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  scheduledAt: string;
  fare: number;
  origin: string;
  destination: string;
}

export const bookings: Booking[] = [
  { id: 'BKG-4401', type: 'ride', user: 'Isabella Mendoza', status: 'confirmed', scheduledAt: '2026-02-15T16:00:00', fare: 250, origin: 'Makati', destination: 'Quezon City' },
  { id: 'BKG-4402', type: 'delivery', user: 'Gabriel Tan', merchant: 'Manila Express Mart', status: 'pending', scheduledAt: '2026-02-15T17:30:00', fare: 180, origin: 'Manila Express Mart', destination: 'BGC, Taguig' },
  { id: 'BKG-4403', type: 'ride', user: 'Matteo Cruz', status: 'completed', scheduledAt: '2026-02-15T10:00:00', fare: 320, origin: 'Pasig', destination: 'Makati' },
  { id: 'BKG-4404', type: 'delivery', user: 'Diego Villanueva', merchant: 'Cebu Fresh Market', status: 'cancelled', scheduledAt: '2026-02-15T11:00:00', fare: 0, origin: 'Cebu Fresh Market', destination: 'Mabolo, Cebu' },
  { id: 'BKG-4405', type: 'ride', user: 'Luna Santos', status: 'confirmed', scheduledAt: '2026-02-16T09:00:00', fare: 190, origin: 'Marikina', destination: 'Ortigas' },
];

// ─── Finance ───
export const financeSummary = {
  totalRevenue: 2_847_320,
  totalCommission: 398_624,
  pendingPayouts: 87_430,
  completedPayouts: 1_245_890,
};

export const commissionByTier = [
  { tier: 'Premium', count: 42, avgRate: 8, revenue: 890_000 },
  { tier: 'Standard', count: 186, avgRate: 12, revenue: 1_450_000 },
  { tier: 'Basic', count: 324, avgRate: 15, revenue: 507_320 },
];

// ─── POIs ───
export interface POI {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  verified: boolean;
  active: boolean;
  address: string;
  merchantId?: string;
  anchors: { id: string; lat: number; lng: number; isDefault: boolean; verified: boolean }[];
  mediaCount: number;
}

export const pois: POI[] = [
  { id: 'POI-001', name: 'SM Mall of Asia', category: 'Mall', lat: 14.5353, lng: 120.9826, verified: true, active: true, address: 'Seaside Blvd, Pasay City', anchors: [{ id: 'ANC-001', lat: 14.5354, lng: 120.9827, isDefault: true, verified: true }], mediaCount: 5 },
  { id: 'POI-002', name: 'Ayala Center Cebu', category: 'Mall', lat: 10.3189, lng: 123.9053, verified: true, active: true, address: 'Cebu Business Park, Cebu City', anchors: [{ id: 'ANC-002', lat: 10.3190, lng: 123.9054, isDefault: true, verified: true }], mediaCount: 3 },
  { id: 'POI-003', name: 'Jollibee Tower', category: 'Restaurant', lat: 14.5547, lng: 121.0244, verified: false, active: true, address: 'F. Ortigas Jr. Rd, Pasig', anchors: [{ id: 'ANC-003', lat: 14.5548, lng: 121.0245, isDefault: true, verified: false }], mediaCount: 1 },
  { id: 'POI-004', name: 'Manila Ocean Park', category: 'Attraction', lat: 14.5797, lng: 120.9794, verified: true, active: false, address: 'Quirino Grandstand, Manila', anchors: [], mediaCount: 4 },
  { id: 'POI-005', name: 'Greenbelt 5', category: 'Mall', lat: 14.5518, lng: 121.0196, verified: true, active: true, address: 'Legazpi St, Makati', anchors: [{ id: 'ANC-005', lat: 14.5519, lng: 121.0197, isDefault: true, verified: true }, { id: 'ANC-006', lat: 14.5520, lng: 121.0198, isDefault: false, verified: false }], mediaCount: 6 },
];

// ─── Team ───
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  lastLogin: string;
  joinDate: string;
}

export const teamMembers: TeamMember[] = [
  { id: 'TM-001', name: 'Alex Rivera', email: 'admin@direkto.com', role: 'SUPER_ADMIN', status: 'active', lastLogin: '2 min ago', joinDate: '2024-01-15' },
  { id: 'TM-002', name: 'Jordan Lee', email: 'ops@direkto.com', role: 'OPERATIONS_MANAGER', status: 'active', lastLogin: '1 hr ago', joinDate: '2024-03-20' },
  { id: 'TM-003', name: 'Sam Chen', email: 'merchant@direkto.com', role: 'MERCHANT_MANAGER', status: 'active', lastLogin: '30 min ago', joinDate: '2024-05-10' },
  { id: 'TM-004', name: 'Morgan Diaz', email: 'finance@direkto.com', role: 'FINANCE_MANAGER', status: 'active', lastLogin: '3 hrs ago', joinDate: '2024-06-01' },
  { id: 'TM-005', name: 'Casey Kim', email: 'support@direkto.com', role: 'SUPPORT_AGENT', status: 'active', lastLogin: '15 min ago', joinDate: '2024-08-15' },
  { id: 'TM-006', name: 'Riley Park', email: 'analyst@direkto.com', role: 'ANALYST', status: 'active', lastLogin: '45 min ago', joinDate: '2025-01-10' },
];

// ─── Notifications ───
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  time: string;
}

export const notifications: Notification[] = [
  { id: 'N-001', title: 'New merchant application', message: 'Davao Quick Stop has applied for merchant status', type: 'info', read: false, time: '5 min ago' },
  { id: 'N-002', title: 'Driver document expired', message: "Roberto Lim's insurance has expired", type: 'warning', read: false, time: '15 min ago' },
  { id: 'N-003', title: 'Export complete', message: 'Commission report for January has been exported', type: 'success', read: false, time: '1 hr ago' },
  { id: 'N-004', title: 'High cancellation rate', message: 'Trip cancellation rate has exceeded 15% threshold', type: 'error', read: true, time: '2 hrs ago' },
  { id: 'N-005', title: 'Bulk approval completed', message: '12 merchants have been approved', type: 'success', read: true, time: '3 hrs ago' },
  { id: 'N-006', title: 'System maintenance', message: 'Scheduled maintenance tonight at 2:00 AM', type: 'info', read: true, time: '5 hrs ago' },
];

// ─── Settings ───
export const appSettings = {
  platformName: 'Direkto',
  defaultCommissionRate: 12,
  maxCancellationRate: 15,
  autoApprovalEnabled: false,
  maintenanceMode: false,
  supportEmail: 'support@direkto.com',
  timezone: 'Asia/Manila',
  currency: 'PHP',
};
