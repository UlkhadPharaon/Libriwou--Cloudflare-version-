import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Bug, Send } from 'lucide-react';
import { ErrorReporter } from './ErrorReporter';

export function BugReporterButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!auth.currentUser || message.length < 10) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'bug_reports'), {
        userId: auth.currentUser.uid,
        message,
        page: window.location.pathname,
        createdAt: serverTimestamp()
      });
      setMessage('');
      setIsOpen(false);
      alert("Merci pour votre retour !");
    } catch (error) {
      ErrorReporter.report("Erreur lors de l'envoi du rapport de bug.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 p-3 bg-red-900/80 text-red-200 rounded-full shadow-lg border border-red-500/30 hover:bg-red-800 z-50 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-luxury-900"
        title="Signaler un bug"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-6 z-50 p-6 bg-luxury-900 border border-red-500/20 rounded-2xl shadow-2xl w-80">
      <h3 className="text-sm font-semibold text-red-200 mb-4">Signaler un problème</h3>
      <textarea 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full bg-bg-overlay border border-border-subtle rounded-lg p-3 text-sm text-gold-100 mb-4 focus:outline-none focus:ring-1 focus:ring-red-500"
        placeholder="Décrivez le problème..."
        rows={4}
      />
      <div className="flex gap-2">
        <button onClick={() => setIsOpen(false)} className="flex-1 px-3 py-2 text-sm text-gold-500 hover:text-gold-300">Annuler</button>
        <button 
          onClick={handleSubmit} 
          disabled={isSubmitting || message.length < 10}
          className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-500 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" /> Envoyer
        </button>
      </div>
    </div>
  );
}
