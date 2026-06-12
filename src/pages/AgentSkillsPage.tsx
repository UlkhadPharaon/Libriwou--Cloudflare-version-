import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BrainCircuit, Cpu, Plus, Sparkles, Trash2, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  triggerKeywords: string[];
  systemCapability: boolean;
  isActive: boolean;
  createdAt: any;
}

export function AgentSkillsPage() {
  const { user } = useAuth();
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', description: '', instructions: '', triggerKeywords: '' });

  const fetchSkills = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'agent_skills'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const items: AgentSkill[] = [];
      snapshot.forEach(d => {
        items.push({ id: d.id, ...d.data() } as AgentSkill);
      });
      items.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
      });
      setSkills(items);
    } catch (err) {
      console.error("Erreur chargement skills:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleCreateSkill = async () => {
      if (!user || !newSkill.name || !newSkill.instructions) return;
      
      const skillData = {
          userId: user.uid,
          name: newSkill.name,
          description: newSkill.description,
          instructions: newSkill.instructions,
          triggerKeywords: newSkill.triggerKeywords.split(',').map(k => k.trim()).filter(k => k),
          systemCapability: false,
          isActive: true,
          createdAt: Timestamp.now()
      };

      try {
          const docRef = await addDoc(collection(db, 'agent_skills'), skillData);
          setSkills([{id: docRef.id, ...skillData}, ...skills]);
          setIsCreating(false);
          setNewSkill({ name: '', description: '', instructions: '', triggerKeywords: '' });
      } catch (e) {
          console.error("Error creating skill", e);
          alert("Erreur lors de la création de la compétence.");
      }
  };

  const handleToggleActive = async (skill: AgentSkill) => {
      try {
          await updateDoc(doc(db, 'agent_skills', skill.id), {
              isActive: !skill.isActive
          });
          setSkills(skills.map(s => s.id === skill.id ? { ...s, isActive: !s.isActive } : s));
      } catch (e) {
          console.error("Error toggling skill", e);
      }
  };

  const handleDelete = async (id: string) => {
      if (!window.confirm("Oublier cette compétence ? NEO ne pourra plus l'utiliser.")) return;
      try {
          await deleteDoc(doc(db, 'agent_skills', id));
          setSkills(skills.filter(s => s.id !== id));
      } catch (e) {
          console.error("Error deleting skill", e);
      }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto font-sans">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif tracking-tight mb-2 text-gold-100 flex items-center gap-3">
                <BrainCircuit className="w-8 h-8 text-gold-500" />
                Compétences IA (Agent Skills)
            </h1>
            <p className="text-zinc-400 text-sm max-w-2xl">
                C'est ici que NEO apprend de nouvelles compétences. L'agent stocke ses propres protocoles (auto-générés ou définis par vous) pour devenir plus intelligent et autonome sur vos cas d'usage spécifiques.
            </p>
        </div>
        <button 
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 bg-gold-500 text-zinc-900 px-5 py-2.5 rounded-xl font-semibold hover:bg-gold-400 transition-colors shrink-0"
        >
            <Plus className="w-5 h-5" />
            Enseigner une compétence
        </button>
      </header>

      {isCreating && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-luxury-900 border border-gold-500/30 rounded-2xl p-6 mb-8 shadow-[0_0_30px_rgba(212,175,55,0.1)]"
          >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-gold-400" />
                  Nouvelle Capacité (Skill)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Nom de la compétence</label>
                      <input 
                          type="text" 
                          value={newSkill.name}
                          onChange={(e) => setNewSkill({...newSkill, name: e.target.value})}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none"
                          placeholder="EX: Analyseur de Bilans BTP"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Mots-clés de déclenchement (séparés par des virgules)</label>
                      <input 
                          type="text" 
                          value={newSkill.triggerKeywords}
                          onChange={(e) => setNewSkill({...newSkill, triggerKeywords: e.target.value})}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none"
                          placeholder="btp, bilan construction, chantier"
                      />
                  </div>
                  <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Description (Ce que ça fait)</label>
                      <input 
                          type="text" 
                          value={newSkill.description}
                          onChange={(e) => setNewSkill({...newSkill, description: e.target.value})}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none"
                          placeholder="Spécifie comment analyser les marges et l'avancement BTP."
                      />
                  </div>
                  <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Protocole d'exécution (Instructions système pour l'IA)</label>
                      <textarea 
                          value={newSkill.instructions}
                          onChange={(e) => setNewSkill({...newSkill, instructions: e.target.value})}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold-500 focus:outline-none min-h-[120px] font-mono text-sm"
                          placeholder={`Lorsque tu analyses un bilan de construction :
1. Recherche spécifiquement les "produits constatés d'avance" ou "en-cours de travaux".
2. Applique la marge sectorielle de 12%.
3. Vérifie les décalages de TVA sur encaissement.`}
                      />
                  </div>
              </div>
              <div className="flex justify-end gap-3">
                  <button onClick={() => setIsCreating(false)} className="px-5 py-2.5 rounded-xl text-zinc-400 font-medium hover:bg-white/5 transition-colors">
                      Annuler
                  </button>
                  <button onClick={handleCreateSkill} className="px-5 py-2.5 rounded-xl bg-gold-500 text-zinc-900 font-bold hover:bg-gold-400 transition-colors">
                      Sauvegarder le protocole
                  </button>
              </div>
          </motion.div>
      )}

      {loading ? (
          <div className="flex items-center justify-center py-20">
              <Activity className="w-8 h-8 text-gold-500 animate-spin" />
          </div>
      ) : skills.length === 0 ? (
          <div className="bg-luxury-900 border border-white/5 rounded-2xl p-12 text-center text-zinc-500">
              <Cpu className="w-16 h-16 mx-auto text-zinc-700 mb-4" />
              <p className="text-lg">NEO n'a pas encore de compétences personnalisées.</p>
              <p className="text-sm mt-2">Créez des skills pour l'aider à traiter des secteurs ou règles très spécifiques à votre métier.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                  {skills.map(skill => (
                      <motion.div 
                          key={skill.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className={cn(
                              "border rounded-2xl overflow-hidden flex flex-col transition-all",
                              skill.isActive ? "bg-luxury-900 border-gold-500/20" : "bg-zinc-900/50 border-white/5 grayscale-[50%]"
                          )}
                      >
                          <div className="p-5 border-b border-white/5 flex gap-3 items-start justify-between">
                              <div className="flex gap-3">
                                  <div className={cn("p-2 rounded-lg mt-1", skill.isActive ? "bg-gold-500/10 text-gold-500" : "bg-white/5 text-zinc-500")}>
                                      <BrainCircuit className="w-5 h-5" />
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-white text-lg leading-tight">{skill.name}</h3>
                                      <p className="text-zinc-500 text-xs mt-1">{skill.description}</p>
                                  </div>
                              </div>
                              <button 
                                  onClick={() => handleToggleActive(skill)}
                                  className={cn(
                                      "shrink-0 w-10 h-6 rounded-full flex items-center p-1 transition-colors",
                                      skill.isActive ? "bg-emerald-500" : "bg-zinc-700"
                                  )}
                              >
                                  <div className={cn("w-4 h-4 rounded-full bg-white transition-transform", skill.isActive ? "translate-x-4" : "translate-x-0")} />
                              </button>
                          </div>
                          
                          <div className="p-5 flex-1 flex flex-col">
                              <div className="mb-4">
                                  <h4 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase mb-2">Mots-clés de déclenchement</h4>
                                  <div className="flex flex-wrap gap-1.5">
                                      {skill.triggerKeywords?.map((kw, i) => (
                                          <span key={i} className="px-2 py-0.5 bg-black/40 border border-white/5 rounded text-xs text-zinc-300">
                                              {kw}
                                          </span>
                                      ))}
                                      {(!skill.triggerKeywords || skill.triggerKeywords.length === 0) && (
                                          <span className="text-xs text-zinc-600 italic">Automatique</span>
                                      )}
                                  </div>
                              </div>
                              <div className="flex-1 bg-black/30 rounded-xl p-3 border border-white/5">
                                  <h4 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase mb-2">Instructions système</h4>
                                  <div className="text-xs text-zinc-300 font-mono overflow-y-auto max-h-32 whitespace-pre-wrap">
                                      {skill.instructions}
                                  </div>
                              </div>
                          </div>
                          <div className="p-3 border-t border-white/5 flex justify-end">
                              <button 
                                  onClick={() => handleDelete(skill.id)}
                                  className="text-zinc-500 hover:text-red-400 p-2 transition-colors flex items-center gap-1.5 text-xs font-medium"
                              >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Oublier
                              </button>
                          </div>
                      </motion.div>
                  ))}
              </AnimatePresence>
          </div>
      )}
    </div>
  );
}
