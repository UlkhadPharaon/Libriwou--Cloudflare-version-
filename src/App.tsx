/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LandingPage } from './pages/LandingPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import { HubPage } from './pages/HubPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { CalendarPage } from './pages/CalendarPage';
import { BankPage } from './pages/BankPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { SettingsPage } from './pages/SettingsPage';
import { InvoicePage } from './pages/InvoicePage';
import { VaultPage } from './pages/VaultPage';
import { JournalPage } from './pages/JournalPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { InventoryPage } from './pages/InventoryPage';
import { PayrollPage } from './pages/PayrollPage';
import { PayrollSlipPage } from './pages/PayrollSlipPage';
import { CashflowPage } from './pages/CashflowPage';
import { AdminHubPage } from './pages/AdminHubPage';
import { ReferencesPage } from './pages/ReferencesPage';
import { AgentSkillsPage } from './pages/AgentSkillsPage';
import { ScanPage } from './pages/ScanPage';
import { DeclarationsPage } from './pages/DeclarationsPage';
import { FinancialStatementsPage } from './pages/FinancialStatementsPage';
import { BilanPage } from './pages/BilanPage';
import { ErrorReporterProvider } from './components/ErrorReporter';
import { SplashScreen } from './components/SplashScreen';
import { AnimatePresence, motion } from 'motion/react';

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
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
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
