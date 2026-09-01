import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Paperclip, Bot, User, UserCircle, FileText, X, CheckCircle2, Loader2, AlertCircle, MessageSquarePlus, MessageSquare, Menu, Mic, Receipt, Ghost, Trash2, Edit2, FolderPlus, ChevronRight, ChevronDown, Save } from 'lucide-react';
import { sendChatMessage, ExtractedTransaction } from '../services/nim';
import { extractTextFromFile } from '../lib/file-extractor';
import { db } from '../firebase';
import { localDb } from '../services/localDb';
import { useAuth } from '../contexts/AuthContext';
import { ErrorReporter } from '../components/ErrorReporter';
import { collection, addDoc, query, where, onSnapshot, doc, getDoc, updateDoc, deleteDoc, orderBy, getDocs, setDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { calculateTaxes, TaxRegime } from '../lib/tax-rules';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { useTheme } from '../contexts/ThemeContext';

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  file?: File;
  actions?: any[];
};

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  projectId?: string;
  isEphemeral?: boolean;
  messages?: Message[];
};

type Project = {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
};

function CompanionAvatar({ className = '', animated = false }: { className?: string, animated?: boolean }) {
  return (
    <motion.div
      className={cn("rounded-2xl overflow-hidden flex items-center justify-center shrink-0 bg-luxury-800/50 border border-border-subtle p-1", className)}
      animate={animated ? { y: [-2, 2, -2] } : {}}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <img src="/mascotte.png" alt="Mascotte Libriwouô" className="w-full h-full object-contain filter drop-shadow-md" />
    </motion.div>
  );
}

export function HubPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQueryHandled = useRef(false);

  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'model',
    text: "Bonjour. Je suis votre IA. Comment puis-je vous aider aujourd'hui ? Vous pouvez me poser des questions fiscales ou me transmettre vos factures pour saisie."
  }]);
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Web Speech API reference
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Web Speech API if supported
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'fr-FR';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsRecording(false);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          alert("L'accès au microphone est bloqué. Veuillez autoriser le microphone dans les paramètres de votre navigateur.");
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsRecording(true);
      } else {
        alert("La reconnaissance vocale n'est pas supportée par votre navigateur actuel.");
      }
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
    }
  }, [input]);

  // Context State
  const [company, setCompany] = useState<any>(null);
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [agentSkills, setAgentSkills] = useState<any[]>([]);
  const [enableThinking, setEnableThinking] = useState(false);
  const [isEphemeralMode, setIsEphemeralMode] = useState(false);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  
  const aiCompanionName = company?.aiCompanionName || 'NEO';
  const isWelcomeScreen = messages.length === 1 && !currentConversationId;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubscribeCompany = onSnapshot(doc(db, 'companies', user.uid), (docSnap) => {
      if (docSnap.exists()) setCompany(docSnap.data());
    }, (err) => {
      console.error("Error fetching company:", err);
    });

    const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedTransaction));
      setTransactions(txs);
    }, (err) => {
      console.error("Error fetching transactions:", err);
    });

    const convQ = query(collection(db, 'conversations'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribeConv = onSnapshot(convQ, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      setConversations(convs);
    }, (err) => {
      console.error("Error fetching conversations:", err);
    });

    const projQ = query(collection(db, 'projects'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribeProj = onSnapshot(projQ, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(projs);
    }, (err) => {
      console.error("Error fetching projects:", err);
    });

    const skillsQ = query(collection(db, 'agent_skills'), where('userId', '==', user.uid));
    const unsubscribeSkills = onSnapshot(skillsQ, (snapshot) => {
      const skills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAgentSkills(skills);
    }, (err) => {
      console.error("Error fetching agent skills:", err);
    });

    return () => {
      unsubscribeCompany();
      unsubscribeSnapshot();
      unsubscribeConv();
      unsubscribeProj();
      unsubscribeSkills();
    };
  }, [user]);

  const handleCreateProject = async (name: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'projects'), {
        userId: user.uid,
        name,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await updateDoc(doc(db, 'conversations', id), { title: newTitle });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!confirm('Supprimer cette discussion ?')) return;
    try {
      await deleteDoc(doc(db, 'conversations', id));
      if (currentConversationId === id) {
        startNewChat();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveToProject = async (id: string, projectId: string | null) => {
    try {
      await updateDoc(doc(db, 'conversations', id), { projectId });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAIAction = async (name: string, args: any) => {
    if (!user) throw new Error("Non authentifié");
    
    if (name === 'propose_transaction') {
      return { success: true, status: 'proposed_to_user' };
    }
    
    if (name === 'update_company_profile') {
      const companyRef = doc(db, 'companies', user.uid);
      await updateDoc(companyRef, args);
      setCompany((prev: any) => ({ ...prev, ...args }));
      return { success: true, updatedFields: args };
    }
    
    if (name === 'delete_transaction') {
      const txRef = doc(db, 'transactions', args.transactionId);
      const txSnap = await getDoc(txRef);
      if (txSnap.exists() && txSnap.data().userId === user.uid) {
        await deleteDoc(txRef);
        return { success: true };
      }
      throw new Error("Transaction non trouvée ou accès refusé");
    }

    if (name === 'generate_invoice' || name === 'generate_payroll_slip') {
      return { success: true };
    }

    if (name === 'fetch_all_transactions') {
      const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const allTxs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { success: true, transactions: allTxs };
    }

    if (name === 'fetch_all_invoices') {
      const q = query(collection(db, 'invoices'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      return { success: true, invoices: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
    }

    if (name === 'fetch_inventory_items') {
      const q = query(collection(db, 'inventory'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      return { success: true, inventory: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
    }

    if (name === 'fetch_employee_list') {
      const q = query(collection(db, 'employees'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      return { success: true, employees: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
    }

    if (name === 'fetch_fiscal_calendar') {
      const companyRef = doc(db, 'companies', user.uid);
      const companySnap = await getDoc(companyRef);
      const deadlines = companySnap.exists() ? (companySnap.data().deadlines || []) : [];
      return { success: true, deadlines };
    }

    if (name === 'check_duplicates') {
      const { amount, date, type } = args;
      const potentialDuplicates = transactions.filter(t => 
        Math.abs((Number(t.amountInclTax) || 0) - amount) < 1 && 
        t.date === date && 
        t.type === type
      );
      return { 
        found: potentialDuplicates.length > 0, 
        count: potentialDuplicates.length, 
        duplicates: potentialDuplicates.map(d => ({ id: d.id, description: d.description })) 
      };
    }
    
    throw new Error("Action inconnue");
  };

  const handleSend = async (customInput?: string) => {
    const messageText = customInput || input.trim();
    if (!messageText && selectedFiles.length === 0) return;

    // We process each file if any, or just the message
    const filesToProcess = selectedFiles.length > 0 ? selectedFiles : [null];
    
    // Clear input and files immediately
    setInput('');
    setSelectedFiles([]);
    setIsTyping(true);
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }

    let currentMessages = [...messages];

    for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const isLast = i === filesToProcess.length - 1;
        
        const userMsg: Message = {
            id: Date.now().toString() + i,
            role: 'user',
            text: i === 0 ? messageText : `Document ${i + 1}`,
            file: file || undefined
        };

        currentMessages = [...currentMessages, userMsg];
        setMessages(currentMessages);

        let convId = currentConversationId;
        if (!convId && user && !isEphemeralMode) {
            const docRef = await addDoc(collection(db, 'conversations'), {
                userId: user.uid,
                title: userMsg.text.slice(0, 30) + (userMsg.text.length > 30 ? '...' : '') || 'Nouvelle discussion',
                updatedAt: new Date().toISOString(),
                projectId: activeProjectId,
                isEphemeral: false,
                messages: currentMessages.map(m => ({ id: m.id, role: m.role, text: m.text, actions: m.actions || null }))
            });
            convId = docRef.id;
            setCurrentConversationId(convId);
        } else if (convId && !isEphemeralMode) {
            await updateDoc(doc(db, 'conversations', convId), {
                updatedAt: new Date().toISOString(),
                messages: currentMessages.map(m => ({ id: m.id, role: m.role, text: m.text, actions: m.actions || null }))
            });
        }

        try {
            let extractedText = '';
            if (file && !file.type.startsWith('image/')) {
                try {
                    extractedText = await extractTextFromFile(file);
                } catch (e) {
                    console.error("Erreur d'extraction du texte :", e);
                }
            }

            const history = currentMessages.slice(0, -1).map(m => ({ role: m.role, text: m.text }));
            const revenue = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (Number(t.amountExclTax) || 0), 0);
            const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + (Number(t.amountExclTax) || 0), 0);
            const taxes = company ? calculateTaxes(revenue, expenses, company.taxRegime as TaxRegime, company.sector?.toLowerCase().includes('service') ?? true) : null;

            const userContext = {
                companyName: company?.companyName,
                taxRegime: company?.taxRegime,
                ifu: company?.ifu,
                sector: company?.sector,
                revenue,
                expenses,
                taxes,
                recentTransactions: transactions.slice(-5),
                agentSkills
            };

            const response = await sendChatMessage(history, userMsg.text, userMsg.file, extractedText, userContext, handleAIAction, enableThinking);
            
            if (response) {
                const modelMsg: Message = {
                    id: (Date.now() + 1).toString() + i,
                    role: 'model',
                    text: response.text,
                    actions: response.actions
                };
                currentMessages = [...currentMessages, modelMsg];
                setMessages(currentMessages);

                if (convId && !isEphemeralMode) {
                    await updateDoc(doc(db, 'conversations', convId), {
                        updatedAt: new Date().toISOString(),
                        messages: currentMessages.map(m => ({ id: m.id, role: m.role, text: m.text, actions: m.actions || null }))
                    });
                }
            }
        } catch (error) {
            console.error(error);
            const errMsg = `Erreur sur le document ${file?.name || ''}. Veuillez réessayer.`;
            ErrorReporter.report(errMsg);
            const errorMsg: Message = { id: Date.now().toString() + "_err_" + i, role: 'model', text: errMsg };
            currentMessages = [...currentMessages, errorMsg];
            setMessages(currentMessages);
        }
    }
    
    setIsTyping(false);
  };

  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam && !initialQueryHandled.current && company) { // Wait for company to load context if needed
      initialQueryHandled.current = true;
      setSearchParams({}, { replace: true });
      handleSend(queryParam);
    }
  }, [searchParams, company]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...acceptedFiles]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    noClick: true,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([{
      id: 'welcome',
      role: 'model',
      text: "Bonjour. Je suis votre IA. Comment puis-je vous aider aujourd'hui ? Vous pouvez me poser des questions fiscales ou me transmettre vos factures pour saisie."
    }]);
    setIsSidebarOpen(false);
  };

  const loadConversation = (conv: Conversation) => {
    setCurrentConversationId(conv.id);
    if (conv.messages) {
      setMessages(conv.messages);
    }
    setIsSidebarOpen(false);
  };

  return (
    <div {...getRootProps()} className="flex h-[calc(100vh-64px)] md:h-screen relative overflow-hidden bg-transparent">
      <input {...getInputProps()} />

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-luxury-800 border-r border-border-subtle flex flex-col z-50 md:hidden shadow-2xl"
            >
              <SidebarContent 
                conversations={conversations} 
                projects={projects}
                activeProjectId={activeProjectId}
                setActiveProjectId={setActiveProjectId}
                currentId={currentConversationId} 
                onSelect={loadConversation} 
                onNew={startNewChat}
                onRename={handleRenameConversation}
                onDelete={handleDeleteConversation}
                onMove={handleMoveToProject}
                onCreateProject={handleCreateProject}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 border-r border-border-subtle bg-luxury-900/50 backdrop-blur-xl flex-col shrink-0">
        <SidebarContent 
          conversations={conversations} 
          projects={projects}
          activeProjectId={activeProjectId}
          setActiveProjectId={setActiveProjectId}
          currentId={currentConversationId} 
          onSelect={loadConversation} 
          onNew={startNewChat}
          onRename={handleRenameConversation}
          onDelete={handleDeleteConversation}
          onMove={handleMoveToProject}
          onCreateProject={handleCreateProject}
        />
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative w-full items-center justify-center">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-border-subtle bg-luxury-900/80 backdrop-blur-xl shrink-0 w-full absolute top-0 z-20">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gold-500/60 hover:text-gold-400">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center">
            <span className="font-serif text-lg text-gold-100 flex items-center gap-2">
              <CompanionAvatar className="w-6 h-6 text-blue-500" />
              {aiCompanionName}
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer mt-0.5">
              <input type="checkbox" checked={enableThinking} onChange={(e) => setEnableThinking(e.target.checked)} className="rounded border-border-subtle bg-bg-overlay w-3 h-3 text-blue-500 focus:ring-blue-500 focus:ring-offset-luxury-900" />
              <span className="text-[10px] text-zinc-400">Mode Réflexion Profonde</span>
            </label>
          </div>
          <button onClick={startNewChat} className="p-2 text-gold-500/60 hover:text-gold-400">
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        </div>

        {/* Drag Overlay */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-luxury-900/90 backdrop-blur-sm border-2 border-dashed border-gold-500/50 m-4 rounded-3xl flex flex-col items-center justify-center glow-gold"
          >
            <div className="w-20 h-20 rounded-full bg-gold-500/10 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
              <FileText className="w-10 h-10 text-gold-400" />
            </div>
            <h2 className="text-3xl font-serif text-gold-100 mb-2">Déposez votre document ici</h2>
            <p className="text-gold-500/70 font-sans">L'IA l'analysera instantanément.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {isWelcomeScreen ? (
        <div className="flex flex-col items-center justify-center w-full max-w-3xl px-4 h-full relative z-10 pt-16 md:pt-0">
          <CompanionAvatar className="w-48 h-48 md:w-56 md:h-56 text-blue-500 drop-shadow-2xl mb-8" animated={true} />
          <h1 className="text-3xl md:text-4xl font-serif text-text-title mb-8 text-center tracking-tight">
             Comment puis-je vous aider aujourd'hui ?
          </h1>
          
          <div className="w-full bg-luxury-800/80 backdrop-blur-xl border border-border-subtle rounded-3xl p-3 flex flex-col gap-3 group relative shadow-[0_0_30px_rgba(37,99,235,0.05)] transition-all">
             {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-bg-overlay border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-title">
                    <FileText className="w-4 h-4 text-gold-500" />
                    <span className="truncate max-w-[100px]">{file.name}</span>
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="ml-2 hover:text-red-400"><X className="w-3 h-3"/></button>
                  </div>
                ))}
              </div>
             )}
             <div className="flex items-end gap-2 w-full">
               <button onClick={toggleRecording} className={cn("p-3 rounded-full transition-colors shrink-0", isRecording ? "text-red-400 animate-pulse bg-red-400/10" : "text-zinc-400 hover:bg-bg-overlay")}><Mic className="w-5 h-5" /></button>
               <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Tapez un message ici..."
                  className="flex-1 bg-transparent border-none focus:outline-none resize-none py-3 text-base text-text-title placeholder:text-zinc-500"
                  rows={1}
                  style={{ minHeight: '48px', maxHeight: '160px', overflowY: 'auto' }}
               />
               <label className="p-3 text-zinc-400 hover:text-gold-400 hover:bg-bg-overlay rounded-full cursor-pointer transition-colors shrink-0">
                  <input 
                    type="file" 
                    className="hidden" 
                    multiple
                    accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                    onChange={(e) => { if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} 
                  />
                  <Paperclip className="w-5 h-5" />
               </label>
               <button onClick={() => handleSend()} disabled={(!input.trim() && selectedFiles.length === 0) || isTyping} className="p-3 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-full hover:opacity-90 disabled:opacity-50 transition-all shrink-0">
                  <Send className="w-5 h-5" />
               </button>
             </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-8 justify-center">
             {[
               { icon: <FileText className="w-4 h-4"/>, label: 'Bilan comptable' },
               { icon: <MessageSquare className="w-4 h-4"/>, label: 'Créer une facture' },
               { icon: <UserCircle className="w-4 h-4"/>, label: 'Analysez mon compte' }
             ].map(tag => (
               <button key={tag.label} onClick={() => setInput(tag.label)} className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-subtle bg-bg-overlay text-zinc-400 text-sm hover:text-text-title hover:border-blue-500/30 transition-colors">
                  {tag.icon} {tag.label}
               </button>
             ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col w-full h-full relative">
          <header className="hidden md:flex p-4 md:p-6 border-b border-border-subtle shrink-0 bg-luxury-900/30 backdrop-blur-md items-center gap-4">
            <div className="w-12 h-12 bg-luxury-800 rounded-full flex items-center justify-center border border-border-subtle shadow-sm">
              <CompanionAvatar className="w-8 h-8 text-blue-500 drop-shadow-md" animated={true} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-serif tracking-tight text-text-title">{aiCompanionName}</h1>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-sm text-zinc-500 font-sans">Interface de chat intelligente Neo.</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={enableThinking} onChange={(e) => setEnableThinking(e.target.checked)} className="rounded border-border-subtle bg-bg-overlay w-4 h-4 text-blue-500 focus:ring-blue-500 focus:ring-offset-luxury-900" />
                  <span className="text-xs text-zinc-400">Mode Réflexion Profonde (Plus lent)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer border-l border-border-subtle pl-4 ml-2">
                  <input type="checkbox" checked={isEphemeralMode} onChange={(e) => setIsEphemeralMode(e.target.checked)} className="rounded border-border-subtle bg-bg-overlay w-4 h-4 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-luxury-900" />
                  <Ghost className={cn("w-4 h-4", isEphemeralMode ? "text-indigo-400" : "text-zinc-500")} />
                  <span className="text-xs text-zinc-400">Chat Éphémère (Non sauvegardé)</span>
                </label>
              </div>
            </div>
          </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pt-20 md:pt-6 w-full max-w-4xl mx-auto">
        {messages.map((msg, index) => {
          if (index === 0 && msg.id === 'welcome') return null; // Skip welcome message in chat mode since the UI changed
          return (
          <motion.div 
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-3 max-w-3xl", msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto")}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
              msg.role === 'user' ? "bg-bg-overlay border border-border-subtle" : ""
            )}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-zinc-400" /> : <CompanionAvatar className="w-8 h-8 drop-shadow-md" />}
            </div>
            
            <div className={cn(
              "flex flex-col gap-2 max-w-[85%]",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              {msg.file && (
                <div className="mb-2">
                  {msg.file.type.startsWith('image/') ? (
                    <img 
                      src={URL.createObjectURL(msg.file)} 
                      alt={msg.file.name} 
                      className="max-w-[200px] max-h-[200px] rounded-lg shadow-md border border-border-subtle object-cover"
                    />
                  ) : (
                    <div className="flex items-center gap-2 bg-luxury-800/50 border border-border-subtle rounded-xl px-3 py-2 text-sm text-gold-100">
                      <FileText className="w-6 h-6 text-gold-500" />
                      <span className="truncate max-w-[150px]">{msg.file.name}</span>
                    </div>
                  )}
                </div>
              )}
              
              {msg.text && (
                <div className={cn(
                  "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm w-fit",
                  msg.role === 'user' 
                    ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-tr-sm font-medium" 
                    : "bg-luxury-800/80 backdrop-blur-md border border-border-subtle text-text-title rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
                )}>
                  <div className={cn("prose prose-sm max-w-none", msg.role === 'user' ? "prose-p:text-text-title prose-strong:text-text-title" : cn(theme === 'dark' && "prose-invert", "prose-p:text-text-title/90 prose-strong:text-text-title"))}>
                    <ReactMarkdown>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {msg.actions && msg.actions.map((action, idx) => (
                <div key={idx} className="mt-2 w-full max-w-md p-4 rounded-xl bg-luxury-800/80 backdrop-blur-md border border-border-subtle shadow-[0_0_15px_rgba(212,175,55,0.05)]">
                  {action.name === 'fetch_all_transactions' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-money-400" />
                      <span className="text-sm font-medium text-gold-100">Historique des transactions analysé ({action.result?.transactions?.length || 0} entrées)</span>
                    </div>
                  )}
                  {action.name === 'fetch_all_invoices' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-money-400" />
                      <span className="text-sm font-medium text-gold-100">Factures récupérées ({action.result?.invoices?.length || 0} documents)</span>
                    </div>
                  )}
                  {action.name === 'fetch_inventory_items' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-money-400" />
                      <span className="text-sm font-medium text-gold-100">Inventaire mis à jour</span>
                    </div>
                  )}
                  {action.name === 'fetch_employee_list' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-money-400" />
                      <span className="text-sm font-medium text-gold-100">Liste du personnel consultée</span>
                    </div>
                  )}
                  {action.name === 'fetch_fiscal_calendar' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-money-400" />
                      <span className="text-sm font-medium text-gold-100">Calendrier fiscal vérifié</span>
                    </div>
                  )}
                  {action.name === 'propose_transaction' && (
                    <TransactionProposal 
                      args={action.args} 
                      conversationId={currentConversationId}
                      messageId={msg.id}
                      isAlreadySaved={action.isSaved}
                    />
                  )}
                  {action.name === 'update_company_profile' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-money-400" />
                      <span className="text-sm font-medium text-gold-100">Profil entreprise mis à jour</span>
                    </div>
                  )}
                  {action.name === 'delete_transaction' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-red-400" />
                      <span className="text-sm font-medium text-gold-100">Transaction supprimée</span>
                    </div>
                  )}
                  {action.name === 'generate_invoice' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-gold-400" />
                        <span className="text-sm font-medium text-gold-100">Générateur de Facture Prêt</span>
                      </div>
                      <Link 
                        to="/invoices"
                        state={{ predefinedInvoice: action.args }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-2 bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 rounded-lg text-sm font-medium border border-gold-500/20 transition-colors"
                      >
                         Ouvrir la facture
                      </Link>
                    </div>
                  )}
                  {action.name === 'generate_payroll_slip' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium text-gold-100">Fiche de Paie prête à la création</span>
                      </div>
                      <Link 
                        to="/payroll-slip"
                        state={{ slipData: action.args }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium border border-blue-500/20 transition-colors"
                      >
                         Créer le bulletin de paie
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
          );
        })}
        
        {isTyping && (
          <div className="flex gap-4 max-w-3xl">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1">
              <CompanionAvatar className="w-8 h-8" />
            </div>
            <div className="bg-luxury-800/80 backdrop-blur-md border border-border-subtle rounded-2xl rounded-tl-sm px-4 py-4 flex items-center gap-1 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
              <motion.div className="w-1.5 h-1.5 bg-zinc-500 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
              <motion.div className="w-1.5 h-1.5 bg-zinc-500 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
              <motion.div className="w-1.5 h-1.5 bg-zinc-500 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-6 bg-luxury-900/30 backdrop-blur-md shrink-0 w-full">
        <div className="max-w-4xl mx-auto">
          {selectedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-luxury-800 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-title">
                  <FileText className="w-4 h-4 text-gold-500/70" />
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button 
                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                    className="ml-2 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="relative flex items-end gap-2 bg-bg-overlay border border-border-subtle rounded-2xl p-2 focus-within:border-blue-500/50 shadow-sm transition-all duration-300">
            <button
              onClick={toggleRecording}
              className={cn(
                "p-2.5 rounded-full transition-all duration-300 shrink-0",
                isRecording 
                  ? "bg-red-500/10 text-red-400 animate-pulse border border-red-500/30" 
                  : "text-zinc-400 hover:text-gold-400 hover:bg-bg-overlay"
              )}
            >
              <Mic className="w-5 h-5" />
            </button>
            
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Tapez un message ici..."
              className="flex-1 bg-transparent border-none focus:outline-none resize-none py-2.5 text-sm text-text-title placeholder:text-zinc-500"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '128px', overflowY: 'auto' }}
            />

            <label className="p-2.5 text-zinc-400 hover:text-gold-400 hover:bg-bg-overlay rounded-full cursor-pointer transition-colors shrink-0">
              <input 
                type="file" 
                className="hidden" 
                multiple
                accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }}
              />
              <Paperclip className="w-5 h-5" />
            </label>
            
            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && selectedFiles.length === 0) || isTyping}
              className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-full hover:opacity-90 disabled:opacity-50 transition-all duration-300 shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-zinc-500 mt-3 font-sans">
            Le compagnon IA peut faire des erreurs. Vérifiez les informations importantes.
          </p>
        </div>
      </div>
      </div>
    )}
    </div>
    </div>
  );
}

function SidebarContent({ 
  conversations, 
  projects, 
  activeProjectId, 
  setActiveProjectId, 
  currentId, 
  onSelect, 
  onNew,
  onRename,
  onDelete,
  onMove,
  onCreateProject
}: { 
  conversations: Conversation[], 
  projects: Project[],
  activeProjectId: string | null,
  setActiveProjectId: (id: string | null) => void,
  currentId: string | null, 
  onSelect: (c: Conversation) => void, 
  onNew: () => void,
  onRename: (id: string, title: string) => void,
  onDelete: (id: string) => void,
  onMove: (id: string, projectId: string | null) => void,
  onCreateProject: (name: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(['all']));

  const toggleProject = (id: string) => {
    const next = new Set(expandedProjects);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedProjects(next);
  };

  const groupedConv = conversations.reduce((acc, conv) => {
    const pid = conv.projectId || 'none';
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(conv);
    return acc;
  }, {} as { [key: string]: Conversation[] });

  return (
    <>
      <div className="p-4 border-b border-border-subtle shrink-0">
        <button 
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 px-4 py-2.5 rounded-xl text-sm font-semibold hover:from-gold-400 hover:to-gold-300 transition-all duration-300 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
        >
          <MessageSquarePlus className="w-4 h-4" />
          Nouvelle discussion
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
        {/* Project Creation */}
        <div className="px-2">
          {isAddingProject ? (
            <div className="flex items-center gap-2 bg-bg-overlay p-2 rounded-lg border border-gold-500/30">
              <input 
                autoFocus
                className="bg-transparent text-xs text-gold-100 outline-none w-full"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProjectName.trim()) {
                    onCreateProject(newProjectName.trim());
                    setNewProjectName("");
                    setIsAddingProject(false);
                  }
                  if (e.key === 'Escape') setIsAddingProject(false);
                }}
                placeholder="Nom du projet..."
              />
              <button onClick={() => setIsAddingProject(false)}><X className="w-3 h-3 text-zinc-500"/></button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAddingProject(true)}
              className="flex items-center gap-2 text-xs text-gold-500/60 hover:text-gold-400 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Créer un projet
            </button>
          )}
        </div>

        {/* Global / Unsorted */}
        <div className="space-y-1">
          <button 
            onClick={() => toggleProject('all')}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-serif uppercase tracking-wider text-zinc-500 hover:text-gold-400 transition-colors"
          >
            {expandedProjects.has('all') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Toutes les discussions
          </button>
          
          <AnimatePresence>
            {expandedProjects.has('all') && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-1"
              >
                {conversations.map(conv => (
                  <SidebarItem 
                    key={conv.id}
                    conv={conv}
                    currentId={currentId}
                    editingId={editingId}
                    editValue={editValue}
                    setEditingId={setEditingId}
                    setEditValue={setEditValue}
                    onSelect={onSelect}
                    onRename={onRename}
                    onDelete={onDelete}
                    onMove={onMove}
                    projects={projects}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Projects */}
        {projects.map(project => (
          <div key={project.id} className="space-y-1">
            <button 
              onClick={() => {
                toggleProject(project.id);
                setActiveProjectId(activeProjectId === project.id ? null : project.id);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-xs font-serif uppercase tracking-wider transition-colors",
                activeProjectId === project.id ? "text-gold-400" : "text-gold-500/40 hover:text-gold-400"
              )}
            >
              {expandedProjects.has(project.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {project.name}
              <span className="ml-auto text-[10px] text-zinc-600 bg-zinc-800/50 px-1.5 rounded-full">
                {groupedConv[project.id]?.length || 0}
              </span>
            </button>
            
            <AnimatePresence>
              {expandedProjects.has(project.id) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-1"
                >
                  {groupedConv[project.id]?.map(conv => (
                    <SidebarItem 
                      key={conv.id}
                      conv={conv}
                      currentId={currentId}
                      editingId={editingId}
                      editValue={editValue}
                      setEditingId={setEditingId}
                      setEditValue={setEditValue}
                      onSelect={onSelect}
                      onRename={onRename}
                      onDelete={onDelete}
                      onMove={onMove}
                      projects={projects}
                    />
                  ))}
                  {(!groupedConv[project.id] || groupedConv[project.id].length === 0) && (
                    <div className="px-7 py-2 text-[10px] text-zinc-600 italic">Vide</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </>
  );
}

function SidebarItem({ 
  conv, 
  currentId, 
  editingId, 
  editValue, 
  setEditingId, 
  setEditValue, 
  onSelect, 
  onRename, 
  onDelete,
  onMove,
  projects
}: { 
  conv: Conversation, 
  currentId: string | null, 
  editingId: string | null, 
  editValue: string, 
  setEditingId: (id: string | null) => void, 
  setEditValue: (v: string) => void, 
  onSelect: (c: Conversation) => void, 
  onRename: (id: string, t: string) => void, 
  onDelete: (id: string) => void,
  onMove: (id: string, pid: string | null) => void,
  projects: Project[]
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowMoveMenu(false); }}
      className="relative group px-1"
    >
      {editingId === conv.id ? (
        <div className="flex items-center gap-2 bg-luxury-800 p-2 rounded-xl border border-gold-500/50">
          <input 
            autoFocus
            className="bg-transparent text-sm text-gold-100 outline-none w-full"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRename(conv.id, editValue);
                setEditingId(null);
              }
              if (e.key === 'Escape') setEditingId(null);
            }}
          />
          <button onClick={() => { onRename(conv.id, editValue); setEditingId(null); }}><Save className="w-4 h-4 text-gold-400"/></button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSelect(conv)}
            className={cn(
              "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-300",
              currentId === conv.id 
                ? "bg-gold-500/10 text-gold-300 border border-border-subtle shadow-[0_0_15px_rgba(212,175,55,0.05)]" 
                : "text-gold-500/60 hover:text-gold-100 hover:bg-gold-500/5"
            )}
          >
            <MessageSquare className={cn("w-3.5 h-3.5 shrink-0", currentId === conv.id ? "text-gold-400" : "")} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{conv.title}</p>
            </div>
          </button>
          
          <AnimatePresence>
            {isHovered && (
              <motion.div 
                initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }}
                className="flex items-center gap-1 absolute right-2 bg-luxury-900/90 backdrop-blur-md pl-1 rounded-lg"
              >
                <div className="relative">
                  <button 
                    onClick={() => setShowMoveMenu(!showMoveMenu)}
                    className="p-1.5 text-zinc-500 hover:text-gold-400 transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                  {showMoveMenu && (
                    <div className="absolute bottom-full right-0 mb-1 w-40 bg-luxury-800 border border-border-subtle rounded-xl p-1 shadow-2xl z-50">
                      <button 
                        onClick={() => { onMove(conv.id, null); setShowMoveMenu(false); }}
                        className="w-full text-left text-[10px] px-2 py-1.5 hover:bg-bg-overlay text-zinc-400 rounded-lg"
                      >
                        (Aucun projet)
                      </button>
                      {projects.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => { onMove(conv.id, p.id); setShowMoveMenu(false); }}
                          className="w-full text-left text-[10px] px-2 py-1.5 hover:bg-bg-overlay text-zinc-400 rounded-lg truncate"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => { setEditingId(conv.id); setEditValue(conv.title); }}
                  className="p-1.5 text-zinc-500 hover:text-blue-400 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => onDelete(conv.id)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ResultItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-xs text-gold-500/80 dark:text-gold-500/60 mb-1">{label}</p>
      <p className="text-sm font-medium text-gold-100">{value}</p>
    </div>
  );
}

function TransactionProposal({ args, conversationId, messageId, isAlreadySaved = false }: { 
  args: any, 
  conversationId: string | null, 
  messageId: string,
  isAlreadySaved?: boolean
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<'pending' | 'saved' | 'error'>(isAlreadySaved ? 'saved' : 'pending');

  const handleConfirm = async () => {
    if (!user) return;
    try {
      // Force numeric conversion
      const transactionData = {
        ...args,
        amountExclTax: Number(args.amountExclTax) || 0,
        vatAmount: Number(args.vatAmount) || 0,
        tvaAmount: Number(args.vatAmount) || 0,
        amountInclTax: Number(args.amountInclTax) || 0,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        fecFingerprint: `NEO-${Date.now()}`,
        paymentMethod: 'Cash',
        fecValid: true
      };

      // 1) PRIMARY: Local-first save (IndexedDB) — visible immediately in Dépenses / Journal / Vault
      localDb.add('transactions', transactionData);

      // 2) BEST-EFFORT: Cloud sync to Firestore (for multi-device / backup)
      try {
        await addDoc(collection(db, 'transactions'), transactionData);
      } catch (error) {
        // Non-blocking: local save already succeeded. Log for diagnostics.
        console.warn('[Neo] Firestore sync failed (local save preserved):', error);
        handleFirestoreError(error, OperationType.CREATE, 'transactions');
      }
      setStatus('saved');

      // Update conversation in Firestore to mark this action as saved
      if (conversationId) {
        const convRef = doc(db, 'conversations', conversationId);
        const convSnap = await getDoc(convRef);
        if (convSnap.exists()) {
          const data = convSnap.data();
          const updatedMessages = data.messages.map((m: any) => {
            if (m.id === messageId) {
              return {
                ...m,
                actions: m.actions.map((a: any) => {
                  if (a.name === 'propose_transaction') {
                    return { ...a, isSaved: true };
                  }
                  return a;
                })
              };
            }
            return m;
          });
          await updateDoc(convRef, { messages: updatedMessages });
        }
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  if (status === 'saved') {
    return (
      <>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-money-400" />
          <span className="text-sm font-medium text-gold-100">Transaction enregistrée avec succès</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ResultItem label="Type" value={args.type === 'EXPENSE' ? 'Dépense' : 'Revenu'} />
          <ResultItem label="Montant HT" value={`${args.amountExclTax} FCFA`} />
          <ResultItem label="TVA" value={`${args.vatAmount} FCFA`} />
          <ResultItem label="Catégorie" value={args.category} />
          {args.syscohadaCode && <ResultItem label="Compte SYSCOHADA" value={args.syscohadaCode} />}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-gold-400" />
        <span className="text-sm font-medium text-gold-100">Proposition d'enregistrement</span>
      </div>
      
      {args.fraudSuspected && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-400">Alerte IA (Rapprochement photographique)</p>
              <p className="text-xs text-red-400/80 mt-1">{args.fraudReason}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <ResultItem label="Type" value={args.type === 'EXPENSE' ? 'Dépense' : 'Revenu'} />
        <ResultItem label="Fournisseur/Client" value={args.vendorName || 'N/A'} />
        <ResultItem label="Montant HT" value={`${args.amountExclTax} FCFA`} />
        <ResultItem label="TVA" value={`${args.vatAmount} FCFA`} />
        <ResultItem label="Montant TTC" value={`${args.amountInclTax} FCFA`} />
        <ResultItem label="Catégorie" value={args.category} />
        {args.syscohadaCode && <ResultItem label="Compte SYSCOHADA" value={args.syscohadaCode} />}
      </div>
      {status === 'error' && <p className="text-red-400 text-xs mb-2">Erreur lors de l'enregistrement.</p>}
      <button 
        onClick={handleConfirm}
        className="w-full py-2.5 bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 rounded-xl text-sm font-semibold hover:from-gold-400 hover:to-gold-300 transition-all duration-300 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
      >
        Confirmer et enregistrer
      </button>
    </>
  );
}
