/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
// Eager: the two public entry pages (they are what a first-time visitor lands on).
import { LandingPage } from './pages/LandingPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ErrorReporterProvider } from './components/ErrorReporter';
import { SplashScreen } from './components/SplashScreen';
import { useMotionPreference } from './hooks/useMotionPreference';
import { warmKeyVault } from './services/ai';
import { AnimatePresence, motion } from 'motion/react';

/**
 * Phase 6.2 — route-level code splitting.
 *
 * Measured before: the landing page downloaded 3.7 MB of JS (app shell + recharts +
 * pdfjs + the Firebase SDK) because all 22 pages were statically imported, so every
 * marketing visitor paid for the dashboard, the OCR stack and the chart library.
 *
 * After: only the app shell is in the entry chunk; each authenticated page (and its
 * heavy dependencies) is fetched when the user navigates to it.
 */const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const HubPage = lazy(() => import('./pages/HubPage').then((m) => ({ default: m.HubPage })));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const BankPage = lazy(() => import('./pages/BankPage').then((m) => ({ default: m.BankPage })));
const SimulatorPage = lazy(() => import('./pages/SimulatorPage').then((m) => ({ default: m.SimulatorPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const InvoicePage = lazy(() => import('./pages/InvoicePage').then((m) => ({ default: m.InvoicePage })));
const VaultPage = lazy(() => import('./pages/VaultPage').then((m) => ({ default: m.VaultPage })));
const JournalPage = lazy(() => import('./pages/JournalPage').then((m) => ({ default: m.JournalPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const PayrollPage = lazy(() => import('./pages/PayrollPage').then((m) => ({ default: m.PayrollPage })));
const PayrollSlipPage = lazy(() => import('./pages/PayrollSlipPage').then((m) => ({ default: m.PayrollSlipPage })));
const CashflowPage = lazy(() => import('./pages/CashflowPage').then((m) => ({ default: m.CashflowPage })));
const AdminHubPage = lazy(() => import('./pages/AdminHubPage').then((m) => ({ default: m.AdminHubPage })));
const ReferencesPage = lazy(() => import('./pages/ReferencesPage').then((m) => ({ default: m.ReferencesPage })));
const AgentSkillsPage = lazy(() => import('./pages/AgentSkillsPage').then((m) => ({ default: m.AgentSkillsPage })));
const ScanPage = lazy(() => import('./pages/ScanPage').then((m) => ({ default: m.ScanPage })));
const DeclarationsPage = lazy(() => import('./pages/DeclarationsPage').then((m) => ({ default: m.DeclarationsPage })));
const FinancialStatementsPage = lazy(() =>
  import('./pages/FinancialStatementsPage').then((m) => ({ default: m.FinancialStatementsPage }))
);
const BilanPage = lazy(() => import('./pages/BilanPage').then((m) => ({ default: m.BilanPage })));

function ProtectedRoute({ children, requireProfile = true }: { children: React.ReactNode, requireProfile?: boolean }) {
  const { user, loading, hasProfile } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requireProfile && hasProfile === false) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!requireProfile && hasProfile === true) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<SplashScreen />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname.split('/')[1] || 'root'}>
          <Route
            path="/"
            element={
              <PageWrapper>
                <LandingPage />
              </PageWrapper>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute requireProfile={false}>
                <PageWrapper>
                  <OnboardingPage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<PageWrapper><DashboardPage /></PageWrapper>} />
            <Route path="expenses" element={<PageWrapper><ExpensesPage /></PageWrapper>} />
            <Route path="inventory" element={<PageWrapper><InventoryPage /></PageWrapper>} />
            <Route path="payroll" element={<PageWrapper><PayrollPage /></PageWrapper>} />
            <Route path="payroll-slip" element={<PageWrapper><PayrollSlipPage /></PageWrapper>} />
            <Route path="hub" element={<PageWrapper><HubPage /></PageWrapper>} />
            <Route path="documents" element={<PageWrapper><DocumentsPage /></PageWrapper>} />
            <Route path="references" element={<PageWrapper><ReferencesPage /></PageWrapper>} />
            <Route path="agent-skills" element={<PageWrapper><AgentSkillsPage /></PageWrapper>} />
            <Route path="calendar" element={<PageWrapper><CalendarPage /></PageWrapper>} />
            <Route path="bank" element={<PageWrapper><BankPage /></PageWrapper>} />
            <Route path="simulator" element={<PageWrapper><SimulatorPage /></PageWrapper>} />
            <Route path="settings" element={<PageWrapper><SettingsPage /></PageWrapper>} />
            <Route path="scan" element={<PageWrapper><ScanPage /></PageWrapper>} />
            <Route path="invoices" element={<PageWrapper><InvoicePage /></PageWrapper>} />
            <Route path="cashflow" element={<PageWrapper><CashflowPage /></PageWrapper>} />
            <Route path="vault" element={<PageWrapper><VaultPage /></PageWrapper>} />
            <Route path="journal" element={<PageWrapper><JournalPage /></PageWrapper>} />
            <Route path="declarations" element={<PageWrapper><DeclarationsPage /></PageWrapper>} />
            <Route path="financial-statements" element={<PageWrapper><FinancialStatementsPage /></PageWrapper>} />
            <Route path="bilan" element={<PageWrapper><BilanPage /></PageWrapper>} />
            <Route path="admin-hub" element={<PageWrapper><AdminHubPage /></PageWrapper>} />
            {/* Fallback for when at / but logged in */}
            <Route path="" element={<Navigate to="dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  // Phase 6.2 — skip the route transition animation on mobile / reduced-motion.
  // The slide+fade was one of the longest tasks on low-end devices.
  const reduceMotion = useMotionPreference();

  if (reduceMotion) return <div className="h-full">{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  // Warm the encrypted key vault once at boot so the AI layer can read the user's
  // BYOK key synchronously on the first AI call.
  useEffect(() => {
    void warmKeyVault();
  }, []);

  return (
    <ThemeProvider>
      <ErrorReporterProvider>
        <AuthProvider>
          <Router>
            <AnimatedRoutes />
          </Router>
        </AuthProvider>
      </ErrorReporterProvider>
    </ThemeProvider>
  );
}
