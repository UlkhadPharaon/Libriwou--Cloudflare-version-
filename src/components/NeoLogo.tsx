import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export function NeoLogo({ className, size = 'md', showText = true }: LogoProps) {
  // Let the image natural aspect ratio drive the width.
  const sizes = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-24',
    xl: 'h-40',
  };

  const textSizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-6xl',
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <motion.div 
        className={cn("relative flex items-center justify-center shrink-0", sizes[size])}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <img 
          src="/logo-main.png" 
          alt="Logo Libriwouô" 
          className="h-full w-auto object-contain drop-shadow-md" 
        />
      </motion.div>

      {showText && (
        <span className={cn(
          "font-serif font-bold tracking-tight text-title",
          textSizes[size]
        )}>
          Libriwouô
        </span>
      )}
    </div>
  );
}
