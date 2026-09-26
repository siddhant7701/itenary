import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { AuthProvider, AdminAuthProvider, useAuth } from './lib/auth';
import { ConfigProvider } from './lib/config';
import { ConfirmProvider, PageLoader } from './components/ui';
import AppShell from './components/AppShell';

// Public & onboarding
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const JoinTrip = lazy(() => import('./pages/JoinTrip'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Traveller app
const Home = lazy(() => import('./pages/Home'));
const Trips = lazy(() => import('./pages/Trips'));
const TripHub = lazy(() => import('./pages/trip/TripHub'));
const Bookings = lazy(() => import('./pages/Bookings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));

// Community, marketplace & creator economy
const Explore = lazy(() => import('./pages/discover/Explore'));
const ItineraryDetail = lazy(() => import('./pages/discover/ItineraryDetail'));
const Events = lazy(() => import('./pages/discover/Events'));
const CreatorDashboard = lazy(() => import('./pages/discover/CreatorDashboard'));
const PublicProfile = lazy(() => import('./pages/discover/PublicProfile'));

// Admin panel
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

function RequireAuth({ children, allowUnonboarded = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!user.onboarded && !allowUnonboarded) return <Navigate to={`/onboarding?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

export default function App() {
  return (
    <ConfigProvider>
      <AuthProvider>
        <ConfirmProvider>
          <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'var(--font-sans)', borderRadius: 14 } }} />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/onboarding" element={<RequireAuth allowUnonboarded><Onboarding /></RequireAuth>} />
              <Route path="/join/:code" element={<RequireAuth><JoinTrip /></RequireAuth>} />
              <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
                <Route index element={<Home />} />
                <Route path="trips" element={<Trips />} />
                <Route path="trips/:id" element={<TripHub />} />
                <Route path="bookings" element={<Bookings />} />
                <Route path="explore" element={<Explore />} />
                <Route path="itineraries/:id" element={<ItineraryDetail />} />
                <Route path="events" element={<Events />} />
                <Route path="creator" element={<CreatorDashboard />} />
                <Route path="u/:id" element={<PublicProfile />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="/admin/*" element={<AdminAuthProvider><AdminApp /></AdminAuthProvider>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ConfirmProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}
