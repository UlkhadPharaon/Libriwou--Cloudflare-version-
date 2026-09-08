import { useTranslation } from 'react-i18next';

export function LanguageSwitcher({ variant = 'default' }: { variant?: 'default' | 'compact' | 'pill' }) {
  const { i18n, t } = useTranslation();
  const current = (i18n.language || 'fr').slice(0, 2).toLowerCase();
  const isFr = current === 'fr';
  const isEn = current === 'en';

  const setLang = (lng: 'fr' | 'en') => {
    i18n.changeLanguage(lng);
  };

  if (variant === 'compact') {
    return (
      <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-xs">
        <button
          onClick={() => setLang('fr')}
          aria-label={t('common.french')}
          className={`px-2.5 py-1 rounded-full font-semibold transition-all ${isFr ? 'bg-white text-zinc-900 shadow' : 'text-zinc-400 hover:text-white'}`}
        >
          FR
        </button>
        <button
          onClick={() => setLang('en')}
          aria-label={t('common.english')}
          className={`px-2.5 py-1 rounded-full font-semibold transition-all ${isEn ? 'bg-white text-zinc-900 shadow' : 'text-zinc-400 hover:text-white'}`}
        >
          EN
        </button>
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
        <button
          onClick={() => setLang('fr')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isFr ? 'bg-gold-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
        >
          FR
        </button>
        <button
          onClick={() => setLang('en')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isEn ? 'bg-gold-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
        >
          EN
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[11px] tracking-widest uppercase text-zinc-500 hidden sm:inline">{t('common.language')}</span>
      <div className="inline-flex rounded-full border border-white/10 overflow-hidden">
        <button
          onClick={() => setLang('fr')}
          className={`px-3 py-1.5 text-xs font-semibold ${isFr ? 'bg-white text-zinc-900' : 'bg-transparent text-zinc-400 hover:text-white'}`}
        >
          FR
        </button>
        <button
          onClick={() => setLang('en')}
          className={`px-3 py-1.5 text-xs font-semibold border-l border-white/10 ${isEn ? 'bg-white text-zinc-900' : 'bg-transparent text-zinc-400 hover:text-white'}`}
        >
          EN
        </button>
      </div>
    </div>
  );
}
