import { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { determineTaxRegime } from '../lib/tax-rules';
import { AlertCircle } from 'lucide-react';
import { Tooltip } from '../components/Tooltip';
import { OnboardingChecklist } from '../components/OnboardingChecklist';

import { NeoLogo } from '../components/NeoLogo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    ifu: '',
    rccm: '',
    phone: '',
    email: user?.email || '',
    address: '',
    legalStatus: 'SARL',
    sector: '',
    estimatedRevenue: ''
  });

  const checklistItems = [
    { label: t('onboarding.companyName'), completed: !!formData.companyName },
    { label: "IFU", completed: !!formData.ifu },
    { label: "RCCM", completed: !!formData.rccm },
    { label: t('onboarding.legalStatus'), completed: !!formData.legalStatus },
    { label: t('onboarding.sector'), completed: !!formData.sector },
    { label: t('onboarding.revenue'), completed: !!formData.estimatedRevenue },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!formData.companyName.trim() || !formData.ifu.trim() || !formData.rccm.trim() || !formData.sector.trim() || !formData.estimatedRevenue.trim()) {
      setError(t('onboarding.requiredError'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const revenue = parseFloat(formData.estimatedRevenue) || 0;
      const taxRegime = determineTaxRegime(revenue);

      const companyPayload = {
        userId: user.uid,
        companyName: formData.companyName,
        ifu: formData.ifu,
        rccm: formData.rccm,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        legalStatus: formData.legalStatus,
        sector: formData.sector,
        taxRegime,
        notificationSettings: {
          daysBefore: 7
        },
        createdAt: new Date().toISOString()
      };
      try { const { localDb } = await import('../services/localDb'); localDb.add('companies', { id: user.uid, ...companyPayload }); } catch(e){ console.warn("[Onboarding] localDb save failed", e); }
      await setDoc(doc(db, 'companies', user.uid), companyPayload);

      await refreshProfile();
      
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error("Error saving profile", err);
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-luxury-900 text-gold-100 flex flex-col p-6 font-sans selection:bg-gold-500/20 overflow-y-auto">
      <div className="w-full max-w-md mx-auto flex justify-end mb-2">
        <LanguageSwitcher variant="compact" />
      </div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md mx-auto my-auto bg-luxury-800/80 backdrop-blur-xl border border-gold-500/20 p-8 rounded-3xl shadow-[0_0_40px_rgba(212,175,55,0.1)]"
      >
        <div className="mb-8 text-center flex flex-col items-center">
          <NeoLogo size="lg" className="mb-4" />
          <h1 className="text-3xl font-serif tracking-tight mb-2 text-gold-100">{t('onboarding.title')}</h1>
          <p className="text-sm text-gold-500/70 font-sans">{t('onboarding.subtitle')}</p>
          <button 
            onClick={() => auth.signOut()}
            className="mt-4 text-xs font-semibold text-gold-500/60 hover:text-gold-400 transition-colors"
          >
            {t('onboarding.logout')}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm text-left">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <OnboardingChecklist items={checklistItems} />

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="block text-xs font-medium text-gold-500/70">{t('onboarding.companyName')}</label>
                <Tooltip content={t('onboarding.companyNameHint')} />
              </div>
              <input 
                type="text"
                value={formData.companyName}
                onChange={e => setFormData({...formData, companyName: e.target.value})}
                className="w-full bg-black/40 border border-gold-500/20 rounded-xl px-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all duration-300 placeholder:text-gold-500/30"
                placeholder={t('onboarding.companyNamePlaceholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-xs font-medium text-gold-500/70">{t('onboarding.ifu')}</label>
                  <Tooltip content={t('onboarding.ifuHint')} />
                </div>
                <input 
                  type="text"
                  value={formData.ifu}
                  onChange={e => setFormData({...formData, ifu: e.target.value})}
                  className="w-full bg-black/40 border border-gold-500/20 rounded-xl px-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all duration-300 placeholder:text-gold-500/30"
                  placeholder="00000000A"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-xs font-medium text-gold-500/70">{t('onboarding.rccm')}</label>
                  <Tooltip content={t('onboarding.rccmHint')} />
                </div>
                <input 
                  type="text"
                  value={formData.rccm}
                  onChange={e => setFormData({...formData, rccm: e.target.value})}
                  className="w-full bg-black/40 border border-gold-500/20 rounded-xl px-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all duration-300 placeholder:text-gold-500/30"
                  placeholder="BF OUA 2024 B 1234"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-xs font-medium text-gold-500/70">{t('onboarding.phone')}</label>
                  <Tooltip content={t('onboarding.phoneHint')} />
                </div>
                <input 
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-black/40 border border-gold-500/20 rounded-xl px-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all duration-300 placeholder:text-gold-500/30"
                  placeholder="+226 70 00 00 00"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-xs font-medium text-gold-500/70">{t('onboarding.companyEmail')}</label>
                  <Tooltip content={t('onboarding.companyEmailHint')} />
                </div>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-black/40 border border-gold-500/20 rounded-xl px-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all duration-300 placeholder:text-gold-500/30"
                  placeholder="contact@entreprise.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="block text-xs font-medium text-gold-500/70">{t('onboarding.address')}</label>
                <Tooltip content={t('onboarding.addressHint')} />
              </div>
              <input 
                type="text"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full bg-black/40 border border-gold-500/20 rounded-xl px-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all duration-300 placeholder:text-gold-500/30"
                placeholder="Ex : Koulouba, Ouagadougou, Burkina Faso"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-xs font-medium text-gold-500/70">{t('onboarding.legalStatus')}</label>
                  <Tooltip content={t('onboarding.legalStatusHint')} />
                </div>
                <select 
                  value={formData.legalStatus}
                  onChange={e => setFormData({...formData, legalStatus: e.target.value})}
                  className="w-full bg-black/40 border border-gold-500/20 rounded-xl px-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all duration-300 appearance-none"
                >
                  <option value="SARL">{t('onboarding.legalOptions.SARL')}</option>
                  <option value="SA">{t('onboarding.legalOptions.SA')}</option>
                  <option value="SUARL">{t('onboarding.legalOptions.SUARL')}</option>
                  <option value="Entreprise Individuelle">{t('onboarding.legalOptions.EI')}</option>
                  <option value="Autre">{t('onboarding.legalOptions.other')}</option>
                </select>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-xs font-medium text-gold-500/70">{t('onboarding.sector')}</label>
                  <Tooltip content={t('onboarding.sectorHint')} />
                </div>
                <input 
                  type="text"
                  value={formData.sector}
                  onChange={e => setFormData({...formData, sector: e.target.value})}
                  className="w-full bg-black/40 border border-gold-500/20 rounded-xl px-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all duration-300 placeholder:text-gold-500/30"
                  placeholder="Services"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="block text-xs font-medium text-gold-500/70">{t('onboarding.revenue')}</label>
                <Tooltip content={t('onboarding.revenueHint')} />
              </div>
              <input 
                type="number"
                value={formData.estimatedRevenue}
                onChange={e => setFormData({...formData, estimatedRevenue: e.target.value})}
                className="w-full bg-black/40 border border-gold-500/20 rounded-xl px-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all duration-300 placeholder:text-gold-500/30"
                placeholder={t('onboarding.revenuePlaceholder')}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-6 text-sm font-semibold bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 rounded-xl hover:from-gold-400 hover:to-gold-300 transition-all duration-300 disabled:opacity-50 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
          >
            {loading ? t('onboarding.submitting') : t('onboarding.submit')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
