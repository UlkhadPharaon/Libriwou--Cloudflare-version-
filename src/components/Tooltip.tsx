import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Tooltip({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-gold-500/50 hover:text-gold-400 transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute z-50 bottom-full mb-2 w-64 p-3 bg-luxury-900 border border-gold-500/20 rounded-xl text-xs text-gold-100 shadow-xl"
            style={{ left: '-120px' }}
          >
            {content}
            <div className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-gold-500/20" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
