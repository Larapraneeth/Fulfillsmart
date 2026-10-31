import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardCardSkeleton } from './components/common/LoadingSkeleton';

// Code-split 9 modules
const OverviewPage = lazy(() => import('./modules/overview/OverviewPage'));
const NetworkMapPage = lazy(() => import('./modules/network/NetworkMapPage'));
const OrdersPage = lazy(() => import('./modules/orders/OrdersPage'));
const AllocationPage = lazy(() => import('./modules/allocation/AllocationPage'));
const CarriersPage = lazy(() => import('./modules/carriers/CarriersPage'));
const TrackingPage = lazy(() => import('./modules/tracking/TrackingPage'));
const AnomaliesPage = lazy(() => import('./modules/anomalies/AnomaliesPage'));
const SimulationPage = lazy(() => import('./modules/simulation/SimulationPage'));
const AnalyticsPage = lazy(() => import('./modules/analytics/AnalyticsPage'));

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route
          path="/overview"
          element={
            <Suspense fallback={<DashboardCardSkeleton />}>
              <OverviewPage />
            </Suspense>
          }
        />
        <Route
          path="/network"
          element={
            <Suspense fallback={<DashboardCardSkeleton />}>
              <NetworkMapPage />
            </Suspense>
          }
        />
        <Route
          path="/orders"
          element={
            <Suspense fallback={<DashboardCardSkeleton />}>
              <OrdersPage />
            </Suspense>
          }
        />
        <Route
          path="/allocation"
          element={
            <Suspense fallback={<DashboardCardSkeleton />}>
              <AllocationPage />
            </Suspense>
          }
        />
        <Route
          path="/carriers"
          element={
            <Suspense fallback={<DashboardCardSkeleton />}>
              <CarriersPage />
            </Suspense>
          }
        />
        <Route
          path="/tracking"
          element={
            <Suspense fallback={<DashboardCardSkeleton />}>
              <TrackingPage />
            </Suspense>
          }
        />
        <Route
          path="/anomalies"
          element={
            <Suspense fallback={<DashboardCardSkeleton />}>
              <AnomaliesPage />
            </Suspense>
          }
        />
        <Route
          path="/simulation"
          element={
            <Suspense fallback={<DashboardCardSkeleton />}>
              <SimulationPage />
            </Suspense>
          }
        />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<DashboardCardSkeleton />}>
              <AnalyticsPage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <div className="p-12 text-center">
              <h2 className="text-xl font-bold text-midnight-100 font-display mb-2">404 — Module Not Found</h2>
              <p className="text-sm text-midnight-400">The requested control tower module does not exist.</p>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
