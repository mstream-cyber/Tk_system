import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './hooks/useToast';
import { Spinner } from './components/ui/Spinner';
import { initAnalytics, captureEvent } from './lib/analytics';
import { Analytics } from '@vercel/analytics/react';

const BookingPage = lazy(() => import('./pages/BookingPage'));
const TicketPage = lazy(() => import('./pages/TicketPage'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ScanPage = lazy(() => import('./pages/ScanPage'));
const EventPage = lazy(() => import('./pages/EventPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <Spinner size="md" />
    </div>
  );
}

function PageViewTracker() {
  const location = useLocation()
  useEffect(() => {
    captureEvent('$pageview', { url: location.pathname + location.search })
    if (typeof fbq !== 'undefined') {
      fbq('track', 'PageView')
    }
  }, [location])
  return null
}

export default function App() {
  useEffect(() => { initAnalytics() }, [])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <PageViewTracker />
          <Analytics />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<BookingPage />} />
              <Route path="/ticket/:ticket_id" element={<TicketPage />} />
              <Route path="/23646" element={<Navigate to="/23646/login" replace />} />
              <Route path="/23646/login" element={<AdminLogin />} />
              <Route path="/23646/dashboard" element={<AdminDashboard />} />
              <Route path="/event/:id" element={<EventPage />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
