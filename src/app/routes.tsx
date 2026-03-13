import { createBrowserRouter } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { POIMapPage } from './pages/poi/POIMapPage';
import { ServiceAreasPage } from './pages/ServiceAreasPage';
import { MerchantsListPage } from './pages/merchants/MerchantsListPage';
import { MerchantDetailPage } from './pages/merchants/MerchantDetailPage';
import { DriversPage } from './pages/DriversPage';
import { DriverDetailPage } from './pages/DriverDetailPage';
import { PendingDriversPage } from './pages/PendingDriversPage';
import { DriverReviewPage } from './pages/DriverReviewPage';
import { LivenessReviewPage } from './pages/LivenessReviewPage';
import { UsersPage } from './pages/UsersPage';
import { TripsPage } from './pages/TripsPage';
import { BookingsPage } from './pages/BookingsPage';
import { FinancePage } from './pages/FinancePage';
import { ExportPage } from './pages/ExportPage';
import { TeamPage } from './pages/TeamPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { LookupTypesPage } from './pages/LookupTypesPage';
import { MarketsPage } from './pages/MarketsPage';
import { MarketDetailPage } from './pages/MarketDetailPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/',
    Component: AppLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: 'poi-map', Component: POIMapPage },
      { path: 'service-areas', Component: ServiceAreasPage },
      { path: 'lookup-types', Component: LookupTypesPage },
      { path: 'markets', Component: MarketsPage },
      { path: 'markets/:id', Component: MarketDetailPage },
      { path: 'merchants', Component: MerchantsListPage },
      { path: 'merchants/:id', Component: MerchantDetailPage },
      { path: 'drivers', Component: DriversPage },
      { path: 'drivers/:id', Component: DriverDetailPage },
      { path: 'drivers/pending', Component: PendingDriversPage },
      { path: 'drivers/pending/:id', Component: DriverReviewPage },
      { path: 'drivers/liveness', Component: LivenessReviewPage },
      { path: 'users', Component: UsersPage },
      { path: 'trips', Component: TripsPage },
      { path: 'bookings', Component: BookingsPage },
      { path: 'finance', Component: FinancePage },
      { path: 'export', Component: ExportPage },
      { path: 'team', Component: TeamPage },
      { path: 'settings', Component: SettingsPage },
      { path: 'notifications', Component: NotificationsPage },
      {
        path: '*',
        Component: () => (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h1 className="text-[48px] tracking-tight" style={{ fontWeight: 600 }}>404</h1>
              <p className="text-[var(--muted-foreground)] mt-2">Page not found</p>
            </div>
          </div>
        ),
      },
    ],
  },
]);
