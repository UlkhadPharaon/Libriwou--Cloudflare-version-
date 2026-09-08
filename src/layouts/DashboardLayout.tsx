import { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Wallet, LayoutDashboard, Inbox, LogOut, Menu, X, FileText, Calendar, Landmark, Calculator, Receipt, FolderLock, Bell, Settings, Sparkles, ShieldAlert, Activity, Users, ShoppingCart, Package, BookOpen, FileSpreadsheet, Scale, Library, BrainCircuit, FlaskConical } from 'lucide-react';
import { logout } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { useTaxNotifications } from '../hooks/useTaxNotifications';
import { BugReporterButton } from '../components/BugReporter';
import { HelpCircle } from 'lucide-react';

import { NeoLogo } from '../components/NeoLogo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function DashboardLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { deadlines } = useTaxNotifications();
  const { isBeta } = useAuth();

  const navItems = [
    { path: '/dashboard', label: t('nav.overview'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { path: '/hub', label: t('nav.assistant'), icon: <Sparkles className="w-4 h-4" /> },
    { path: '/agent-skills', label: t('nav.aiSkills'), icon: <BrainCircuit className="w-4 h-4" /> },
    { path: '/expenses', label: t('nav.expenses'), icon: <ShoppingCart className="w-4 h-4" /> },
    { path: '/invoices', label: t('nav.invoices'), icon: <Receipt className="w-4 h-4" /> },
    { path: '/inventory', label: t('nav.inventory'), icon: <Package className="w-4 h-4" /> },
    { path: '/payroll', label: t('nav.team'), icon: <Users className="w-4 h-4" /> },
    { path: '/cashflow', label: t('nav.cashflow'), icon: <Activity className="w-4 h-4" /> },
    { path: '/bank', label: t('nav.bank'), icon: <Landmark className="w-4 h-4" /> },
    { path: '/declarations', label: t('nav.taxes'), icon: <FileSpreadsheet className="w-4 h-4" /> },
    { path: '/financial-statements', label: t('nav.reports'), icon: <Calculator className="w-4 h-4" /> },
    { path: '/bilan', label: t('nav.bilan'), icon: <Scale className="w-4 h-4" /> },
    { path: '/documents', label: t('nav.documents'), icon: <FileText className="w-4 h-4" /> },
    { path: '/references', label: t('nav.references'), icon: <Library className="w-4 h-4" /> },
    { path: '/journal', label: t('nav.journal'), icon: <BookOpen className="w-4 h-4" /> },
    { path: '/calendar', label: t('nav.calendar'), icon: <Calendar className="w-4 h-4" /> },
    { path: '/simulator', label: t('nav.simulator'), icon: <Calculator className="w-4 h-4" /> },
    { path: '/settings', label: t('nav.settings'), icon: <Settings className="w-4 h-4" /> },
    { path: '/vault', label: t('nav.vault'), icon: <FolderLock className="w-4 h-4" /> },
  ];

  const SidebarContent = () => {
    const { t } = useTranslation();
    const { user, isBeta: isBetaSidebar } = useAuth();
    const isAdmin = user?.email === 'ulrichtapsoba2009@gmail.com';

    return (
      <>
        <div className="p-6 flex flex-col gap-3 neo-logo-container">
          <div className="flex items-center justify-between">
            <NeoLogo size="sm" showText={false} />
            <button 
              className="md:hidden p-2 text-gold-500/60 hover:text-gold-400"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {isBetaSidebar && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-black tracking-widest uppercase w-fit">
              <FlaskConical className="w-3 h-3" />
              {t('auth.betaSidebarBadge')}
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1 mt-4 pb-4">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <motion.div
                key={item.path}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05, duration: 0.5, ease: "easeOut" }}
              >
                <Link
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300",
                    isActive 
                      ? "bg-gold-500/10 text-gold-300 border border-border-subtle glow-gold" 
                      : "text-zinc-400 hover:text-gold-100 hover:bg-bg-overlay"
                  )}
                >
                  <span className={cn("transition-colors", isActive ? "text-gold-400" : "text-zinc-500")}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </motion.div>
            );
          })}
          
          {isAdmin && (
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: navItems.length * 0.05, duration: 0.5, ease: "easeOut" }}
            >
              <Link
                to="/admin-hub"
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 mt-6",
                  location.pathname === '/admin-hub'
                    ? "bg-red-500/10 text-red-300 border border-red-500/20" 
                    : "text-red-400/60 hover:text-red-400 hover:bg-red-500/5"
                )}
              >
                <ShieldAlert className="w-4 h-4" />
                {t('nav.admin')}
              </Link>
            </motion.div>
          )}
        </nav>

        <div className="p-4 border-t border-border-subtle flex flex-col gap-2">
          <LanguageSwitcher variant="compact" />
          {isBetaSidebar && (
            <div className="px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-emerald-300/80 leading-relaxed">
              {t('auth.betaSidebarHint')}
            </div>
          )}
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {isBetaSidebar ? t('auth.logoutDemo') : t('auth.logout')}
          </button>
        </div>
    </>
    );
  };

  return (
    <div className="min-h-screen bg-transparent text-gold-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border-subtle bg-luxury-900/80 backdrop-blur-xl sticky top-0 z-20 neo-logo-container">
        <div className="flex items-center gap-2">
          <NeoLogo size="sm" showText={false} />
          <LanguageSwitcher variant="compact" />
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-gold-500/60 hover:text-gold-400"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border-subtle bg-luxury-900/50 backdrop-blur-xl flex-col sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/80 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300",
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      />
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 w-[280px] bg-luxury-800 border-r border-border-subtle flex flex-col z-40 md:hidden shadow-2xl transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {isBeta && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 flex items-center gap-3">
            <FlaskConical className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">{t('auth.betaBannerTitle')}</p>
              <p className="text-xs opacity-80 mt-1">{t('auth.betaBannerDesc')}</p>
            </div>
            <button onClick={logout} className="hidden sm:inline-flex px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-bold hover:bg-emerald-400 transition-colors shrink-0">{t('auth.logoutDemo')}</button>
          </div>
        )}
        {deadlines.length > 0 && (
          <div className="mx-4 mt-4 p-4 rounded-xl bg-gold-500/10 border border-border-subtle text-gold-200 flex items-center gap-3">
            <Bell className="w-5 h-5" />
            <p className="text-sm font-sans">{t('nav.deadlines', { count: deadlines.length })}</p>
          </div>
        )}
        <Outlet />
        <BugReporterButton />
      </main>
    </div>
  );
}

