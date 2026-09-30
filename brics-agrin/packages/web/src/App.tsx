import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { FullPageSpinner } from './components/common/FullPageSpinner.js';
import { AppShell } from './components/common/AppShell.js';
import { OfflineBanner } from './components/common/OfflineBanner.js';

// Lazy-load pages for code splitting and faster initial load
const LoginPage = React.lazy(() => import('./pages/LoginPage.js'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage.js'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.js'));
const FarmsPage = React.lazy(() => import('./pages/FarmsPage.js'));
const FarmDetailPage = React.lazy(() => import('./pages/FarmDetailPage.js'));
const AdvisoryPage = React.lazy(() => import('./pages/AdvisoryPage.js'));
const DiagnosticPage = React.lazy(() => import('./pages/DiagnosticPage.js'));
const DiagnosticResultPage = React.lazy(() => import('./pages/DiagnosticResultPage.js'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage.js'));
const CreateFarmPage = React.lazy(() => import('./pages/CreateFarmPage.js'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <OfflineBanner />
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

          {/* Protected routes inside app shell */}
          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/farms" element={<FarmsPage />} />
            <Route path="/farms/new" element={<CreateFarmPage />} />
            <Route path="/farms/:farmId" element={<FarmDetailPage />} />
            <Route path="/advisory" element={<AdvisoryPage />} />
            <Route path="/diagnostics" element={<DiagnosticPage />} />
            <Route path="/diagnostics/:id" element={<DiagnosticResultPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
