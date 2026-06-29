import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './hooks/useToast';
import { Spinner } from './components/ui/Spinner';

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

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
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
