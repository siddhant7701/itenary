import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { PageLoader } from '../../components/ui';
import { useAdminAuth } from '../../lib/auth';
import AdminShell from './AdminShell';
import AdminLogin from './Login';

const Dashboard = lazy(() => import('./Dashboard'));
const Users = lazy(() => import('./Users'));
const UserDetail = lazy(() => import('./UserDetail'));
const Trips = lazy(() => import('./Trips'));
const TripDetail = lazy(() => import('./TripDetail'));
const Bookings = lazy(() => import('./Bookings'));
const Payments = lazy(() => import('./Payments'));
const Payouts = lazy(() => import('./Payouts'));
const Marketplace = lazy(() => import('./Marketplace'));
const Reviews = lazy(() => import('./Reviews'));
const Events = lazy(() => import('./Events'));
const Providers = lazy(() => import('./Providers'));
const Safety = lazy(() => import('./Safety'));
const Audit = lazy(() => import('./Audit'));
const Settings = lazy(() => import('./Settings'));

function RequireAdmin({ children }) {
  const { user, loading } = useAdminAuth();
  const location = useLocation();
  if (loading) return <PageLoader label="Opening admin console…" />;
  if (!user) {
    const next = location.pathname + location.search;
    return <Navigate to={next && next !== '/admin' && next !== '/admin/' ? `/admin/login?next=${encodeURIComponent(next)}` : '/admin/login'} replace />;
  }
  return children;
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route
        element={
          <RequireAdmin>
            <AdminShell />
          </RequireAdmin>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:id" element={<UserDetail />} />
        <Route path="trips" element={<Trips />} />
        <Route path="trips/:id" element={<TripDetail />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payouts" element={<Payouts />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="events" element={<Events />} />
        <Route path="providers" element={<Providers />} />
        <Route path="safety" element={<Safety />} />
        <Route path="audit" element={<Audit />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
