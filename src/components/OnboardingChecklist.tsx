import { CheckCircle2, Circle } from 'lucide-react';
import { motion } from 'motion/react';

interface ChecklistItem {
  label: string;
  completed: boolean;
}

export function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="space-y-3 mb-8 p-4 bg-black/20 border border-gold-500/10 rounded-2xl">
      <h3 className="text-xs font-semibold text-gold-500 uppercase tracking-wider mb-4">Progression</h3>
      {items.map((item, index) => (
        <motion.div 
          key={index} 
          initial={false}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 text-sm"
        >
          {item.completed ? (
            <CheckCircle2 className="w-5 h-5 text-gold-500" />
          ) : (
            <Circle className="w-5 h-5 text-gold-500/30" />
          )}
          <span className={item.completed ? "text-gold-100 font-medium" : "text-gold-500/70"}>
            {item.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
