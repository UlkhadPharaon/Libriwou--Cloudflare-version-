import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

export const ErrorReporter = {
    report: (message: string) => {
        // This is a simple implementation. In a real app,
        // this would send the error to a logging service.
        console.error('Beta Tester Error:', message);
        window.dispatchEvent(new CustomEvent('show-error', { detail: message }));
    }
};

export function ErrorReporterProvider({ children }: { children: React.ReactNode }) {
    const [error, setError] = useState<string | null>(null);

    const dismissError = useCallback(() => setError(null), []);

    // Listen for error events
    if (typeof window !== 'undefined') {
        window.addEventListener('show-error', (e: any) => setError(e.detail));
    }

    return (
        <>
            {children}
            <AnimatePresence>
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-6 right-6 z-50 p-4 bg-red-950 border border-red-500/20 text-red-500 rounded-xl shadow-2xl flex items-center gap-4 max-w-sm"
                    >
                        <AlertCircle className="w-6 h-6 shrink-0" />
                        <div className="flex-1">
                            <h4 className="font-semibold">Oups, une erreur est survenue</h4>
                            <p className="text-sm opacity-80">{error}</p>
                        </div>
                        <button onClick={dismissError} className="p-1 hover:bg-red-500/10 rounded">
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
