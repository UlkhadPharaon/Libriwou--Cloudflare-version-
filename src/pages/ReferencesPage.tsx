import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Library, 
  UploadCloud, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  Trash2,
  AlertCircle
} from 'lucide-react';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { extractTextFromFile } from '../lib/file-extractor';
import ReactMarkdown from 'react-markdown';

interface ReferenceDocument {
  id: string;
  documentType: string;
  documentName: string;
  extractedRules: string;
  detectedVariables: string[];
  visualStyle: string;
  confidenceScore: number;
  createdAt: any;
}

export function ReferencesPage() {
  const { user } = useAuth();
  const [references, setReferences] = useState<ReferenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchReferences = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'company_references'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const items: ReferenceDocument[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as ReferenceDocument);
      });
      // Sort by creation date descending
      items.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
      });
      setReferences(items);
    } catch (err) {
      console.error("Erreur chargement références:", err);
      // Faisons un mock pour que la page marche au moins localement sans réseau
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReferences();
  }, [fetchReferences]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || !user) return;
    const file = acceptedFiles[0];
    
    setIsUploading(true);
    setError(null);
    setUploadProgress('Analyse du document par NEO (Vision AI)...');

    try {
        let docType = "Facture / Reçu";
        if (file.name.toLowerCase().includes('proforma')) docType = 'Facture Proforma';
        else if (file.name.toLowerCase().includes('bilan')) docType = 'Bilan';
        else if (file.name.toLowerCase().includes('devis')) docType = 'Devis';

        const sendToAPI = async (payload: any) => {
            try {
                const resp = await fetch('/api/reference', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
    
                if (!resp.ok) {
                    const errData = await resp.json();
                    throw new Error(errData.details || errData.error || 'Erreur API Vision');
                }
    
                const data = await resp.json();
                const analysis = data.analysis;
    
                setUploadProgress('Sauvegarde des modèles dans le coffre...');
    
                const newDoc = {
                    userId: user.uid,
                    documentName: file.name,
                    documentType: docType,
                    extractedRules: analysis.extractedRules || "Règles extraites non disponibles.",
                    detectedVariables: analysis.detectedVariables || [],
                    visualStyle: analysis.visualStyle || "Non spécifié.",
                    confidenceScore: analysis.confidenceScore || 0,
                    createdAt: Timestamp.now()
                };
    
                await addDoc(collection(db, 'company_references'), newDoc);
                
                await fetchReferences();
                setIsUploading(false);
    
            } catch (e: any) {
                console.error("Error analyzing reference:", e);
                setError(e.message || "Erreur lors de l'analyse du document");
                setIsUploading(false);
            }
        };

        if (file.type === 'application/pdf' || file.type.includes('wordprocessingml')) {
            const extractedText = await extractTextFromFile(file);
            await sendToAPI({
                text: extractedText,
                documentName: file.name,
                documentType: docType
            });
        } else {
            // FileReader as base64 for images
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64String = reader.result as string;
                const [mimePrefix, base64] = base64String.split(',');
                const mimeType = mimePrefix.replace('data:', '').replace(';base64', '');
                await sendToAPI({
                    base64,
                    mimeType,
                    documentName: file.name,
                    documentType: docType
                });
            };
            
            reader.onerror = () => {
                setError("Erreur locale lors de la lecture du fichier.");
                setIsUploading(false);
            };
        }
    } catch (err: any) {
      setError(err.message || 'Une erreur inattendue est survenue.');
      setIsUploading(false);
    }
  }, [user, fetchReferences]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    multiple: false
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer ce modèle de référence ?")) return;
    try {
        await deleteDoc(doc(db, 'company_references', id));
        setReferences(prev => prev.filter(r => r.id !== id));
    } catch(err) {
        console.error("Erreur suppression:", err);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif tracking-tight mb-2 text-gold-100 flex items-center gap-3">
            <Library className="w-8 h-8 text-gold-500" />
            Mes Modèles & Références
        </h1>
        <p className="text-zinc-400 text-sm">
            Entraînez NEO à reproduire le format de vos anciens documents (Proforma, Devis, Bilan).
        </p>
      </header>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
        </motion.div>
      )}

      {/* Upload Zone */}
      <div 
        {...getRootProps()} 
        className={cn(
          "mb-10 relative overflow-hidden rounded-[2rem] border-2 border-dashed transition-all duration-300 p-8 sm:p-12 text-center cursor-pointer group flex flex-col items-center justify-center min-h-[250px]",
          isDragActive 
            ? "border-gold-500 bg-gold-500/5" 
            : isUploading
              ? "border-emerald-500/30 bg-emerald-500/5 cursor-wait"
              : "border-border-subtle hover:border-gold-500/50 hover:bg-luxury-800"
        )}
      >
        <input {...getInputProps()} disabled={isUploading} />
        
        {isUploading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-emerald-400">
            <Loader2 className="w-12 h-12 mb-4 animate-spin" />
            <p className="text-base font-semibold">{uploadProgress}</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-gold-500/10 text-gold-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">
              {isDragActive ? "Déposez votre modèle ici" : "Cliquez ou glissez un modèle (PDF, PNG, JPG)"}
            </h3>
            <p className="text-sm text-zinc-500 max-w-md">
              NEO extraira la structure, le style et les variables pour s'en souvenir la prochaine fois qu'il générera un document.
            </p>
          </motion.div>
        )}
      </div>

      {/* Library Grid */}
      <div>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wider text-xs">Modèles mémorisés</h2>
          
          {loading ? (
             <div className="flex items-center justify-center py-10">
                 <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
             </div>
          ) : references.length === 0 ? (
             <div className="bg-luxury-900 border border-white/5 rounded-2xl p-8 text-center text-zinc-500">
                 Aucun modèle enregistré. Scannez un exemple de document pour commencer l'entraînement.
             </div>
          ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <AnimatePresence>
                    {references.map((item) => (
                        <motion.div 
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-luxury-900 border border-white/5 rounded-2xl overflow-hidden group hover:border-gold-500/20 transition-all shadow-lg"
                        >
                            <div className="border-b border-white/5 p-5 bg-black/20 flex justify-between items-start">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg leading-tight truncate max-w-full">{item.documentName}</h3>
                                        <div className="flex gap-2 items-center mt-1 text-xs">
                                            <span className="bg-gold-500/20 text-gold-300 px-2 py-0.5 rounded-full font-medium">
                                                {item.documentType}
                                            </span>
                                            <span className="text-zinc-500 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                Format mémorisé ({item.confidenceScore}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => handleDelete(item.id, e)}
                                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                    title="Supprimer la référence"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="p-5 space-y-4 text-sm">
                                <div>
                                    <h4 className="text-zinc-400 font-semibold mb-1 text-xs uppercase tracking-wider">Style Visuel (Extrait)</h4>
                                    <p className="text-zinc-300 leading-relaxed italic border-l-2 border-gold-500/30 pl-3">
                                        "{item.visualStyle}"
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-zinc-400 font-semibold mb-2 text-xs uppercase tracking-wider">Structure Identifiée</h4>
                                    <div className="bg-black/30 p-3 rounded-lg border border-white/5 text-zinc-300 text-xs overflow-auto max-h-32 prose prose-invert prose-p:my-1 prose-ul:my-1 prose-sm">
                                        <ReactMarkdown>{item.extractedRules}</ReactMarkdown>
                                    </div>
                                </div>
                                {item.detectedVariables && item.detectedVariables.length > 0 && (
                                    <div>
                                        <h4 className="text-zinc-400 font-semibold mb-2 text-xs uppercase tracking-wider">Variables Détectées</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {item.detectedVariables.map((v, i) => (
                                                <span key={i} className="px-2 py-1 text-[10px] rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                                                    {'{'}{v}{'}'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                 </AnimatePresence>
             </div>
          )}
      </div>
    </div>
  );
}
