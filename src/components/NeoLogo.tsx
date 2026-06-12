import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export function NeoLogo({ className, size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-24 h-24',
    xl: 'w-48 h-48',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  };

  const letterSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-4xl',
    xl: 'text-8xl',
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("relative flex items-center justify-center shrink-0", sizes[size])}>
        {/* Glow background */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          className="absolute inset-0 bg-gold-500/20 blur-xl rounded-full"
        />
        
        {/* Decorative ring */}
        <div className="absolute inset-0 border border-gold-500/30 rounded-full scale-110" />
        
        {/* Main Logo Icon (The 'N') */}
        <div className="relative z-10 bg-luxury-900 rounded-full w-full h-full flex items-center justify-center border border-gold-500/10 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
          <span className={cn(
            "font-serif font-bold text-gold-400 select-none italic tracking-tighter",
            letterSizes[size]
          )}>
            N
          </span>
        </div>
      </div>

      {showText && (
        <span className={cn(
          "font-serif font-medium tracking-tight text-gold-100 italic",
          textSizes[size]
        )}>
          NeoCompta AI
        </span>
      )}
    </div>
  );
}
