import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { NeoLogo } from './NeoLogo';

export function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, 5000); // 5s absolute max
    return () => clearTimeout(timer);
  }, [onFinish]);

  if (!isVisible) return null;

  return (
    <motion.div 
      key="splash-screen"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[100] bg-luxury-900 flex flex-col items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center"
      >
        <div className="relative mb-12">
          <NeoLogo size="xl" showText={false} />
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-3xl md:text-4xl font-serif text-gold-100 italic text-center"
          >
            NeoCompta AI
          </motion.h1>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="flex flex-col items-center"
        >
          <div className="h-1 w-48 bg-gold-500/10 rounded-full overflow-hidden relative shadow-[0_0_10px_rgba(212,175,55,0.1)]">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-gold-500 to-transparent"
            />
          </div>
          <p className="mt-4 text-gold-500/50 text-[10px] uppercase tracking-[0.2em] font-sans">
            Intelligence Fiscale Burkinabè
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
