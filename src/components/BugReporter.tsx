import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useTranslation } from 'react-i18next';
import { Bug, Send, Sparkles, MessageSquare, Lightbulb, HelpCircle, AlertTriangle, X } from 'lucide-react';
import { ErrorReporter } from './ErrorReporter';
import { isBetaEmail } from '../lib/betaConfig';

type FeedbackCategory = 'bug' | 'idea' | 'question' | 'other';

export function BugReporterButton() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyLabel, setCompanyLabel] = useState<string | null>(null);

  const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
    bug: t('feedback.catBug'),
    idea: t('feedback.catIdea'),
    question: t('feedback.catQuestion'),
    other: t('feedback.catOther')
  };

  // Try to fetch company name for richer admin reference (best-effort)
  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    getDoc(doc(db, 'companies', uid))
      .then(snap => {
        if (snap.exists()) {
          const d: any = snap.data();
          setCompanyLabel(d.companyName || null);
        }
      })
      .catch(() => {});
    // fallback to localDb
    import('../services/localDb').then(({ localDb }) => {
      try {
        const local: any = localDb.get('companies', uid);
        if (local?.companyName) setCompanyLabel(local.companyName);
      } catch {}
    });
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!auth.currentUser || message.trim().length < 10) return;
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      const isBeta = isBetaEmail(user.email);
      // Enrich with references for admin triage
      await addDoc(collection(db, 'bug_reports'), {
        userId: user.uid,
        userEmail: user.email || null,
        companyName: companyLabel || null,
        message: message.trim(),
        category,
        page: window.location.pathname,
        url: window.location.href,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
        isBeta,
        status: 'new', // new | reviewed | resolved | archived
        createdAt: serverTimestamp(),
        // denormalized time for local fallback sorting
        createdAtClient: new Date().toISOString(),
      });
      setMessage('');
      setCategory('bug');
      setIsOpen(false);
      window.dispatchEvent(new CustomEvent('show-error', { detail: t('feedback.thanks') } as any));
      console.log('[Feedback] sent', { category, isBeta });
    } catch (error: any) {
      console.error('[Feedback] send failed', error);
      ErrorReporter.report(t('feedback.error', { msg: error?.message || '—' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 p-3.5 bg-red-900/80 text-red-200 rounded-full shadow-lg border border-red-500/30 hover:bg-red-800 hover:scale-105 z-50 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-luxury-900 group"
        title={t('feedback.buttonTitle')}
      >
        <Bug className="w-5 h-5 group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-6 z-50 p-5 bg-luxury-900 border border-red-500/20 rounded-2xl shadow-2xl w-[360px] max-w-[92vw] backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gold-100 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gold-500" />
          {t('feedback.title')}
        </h3>
        <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
        {t('feedback.subtitle')}
      </p>

      {/* Category selector */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {(Object.keys(CATEGORY_LABEL) as FeedbackCategory[]).map(cat => {
          const active = category === cat;
          const Icon = cat === 'bug' ? AlertTriangle : cat === 'idea' ? Lightbulb : cat === 'question' ? HelpCircle : Sparkles;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all text-left ${active ? 'bg-gold-500/15 border-gold-500/30 text-gold-200' : 'bg-white/[0.03] border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'}`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {CATEGORY_LABEL[cat]}
            </button>
          );
        })}
      </div>

      <textarea 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-gold-100 placeholder:text-zinc-500 mb-2 focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/20 min-h-[96px] resize-none"
        placeholder={category === 'bug' ? t('feedback.placeholderBug') : category === 'idea' ? t('feedback.placeholderIdea') : t('feedback.placeholderOther')}
        rows={4}
        autoFocus
      />
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] text-zinc-600">{message.trim().length < 10 ? t('feedback.minChars', { count: 10 - message.trim().length }) : t('feedback.ready')}</span>
        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
          <span className="hidden sm:inline">{t('feedback.context', { page: window.location.pathname })}</span>
          {auth.currentUser?.email && isBetaEmail(auth.currentUser.email) && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-[10px]">BÊTA</span>}
        </span>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setIsOpen(false)} className="flex-1 px-3 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-xl transition-colors">{t('feedback.cancel')}</button>
        <button 
          onClick={handleSubmit} 
          disabled={isSubmitting || message.trim().length < 10}
          className="flex-[1.4] px-3 py-2.5 bg-gold-500 text-zinc-950 rounded-xl text-sm font-bold hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
        >
          {isSubmitting ? t('feedback.sending') : <><Send className="w-4 h-4" /> {t('feedback.send')}</>}
        </button>
      </div>
      <p className="mt-2.5 text-[11px] text-zinc-600 text-center">
        {t('feedback.hint')}
      </p>
    </div>
  );
}
