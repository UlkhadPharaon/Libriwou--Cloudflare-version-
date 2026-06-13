import { extractTextFromFile } from '../lib/file-extractor';

export interface ExtractedTransaction {
  id?: string;
  type: 'INCOME' | 'EXPENSE' | 'PAYROLL';
  syscohadaCode?: string;
  amountExclTax: number;
  vatAmount: number;
  amountInclTax: number;
  date: string;
  description?: string;
  category: string;
  fecValid: boolean;
  vendorName?: string;
  currency?: string;
  originalAmountInclTax?: number;
  originalAmountExclTax?: number;
  exchangeRate?: number;
  fraudSuspected?: boolean;
  fraudReason?: string;
  lineItems?: {
    description: string;
    quantity: number;
    unitPrice: number;
    amountExclTax: number;
  }[];
}

export interface UserContext {
  companyName?: string;
  taxRegime?: string;
  ifu?: string;
  sector?: string;
  revenue: number;
  expenses: number;
  taxes: any;
  recentTransactions?: any[];
  agentSkills?: any[];
}

export async function extractTransactionFromFile(file: File): Promise<ExtractedTransaction> {
  let payload: any = {};
  
  if (file.type === 'application/pdf' || file.type.includes('wordprocessingml')) {
    const text = await extractTextFromFile(file);
    payload = { text, mimeType: file.type };
  } else {
    const base64 = await fileToBase64(file);
    payload = { base64, mimeType: file.type };
  }

  const response = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Impossible d'analyser le document.");
  }

  const data = await response.json();
  const text = data.text || "";
  
  try {
    // Robust extraction: find the first '{' and last '}'
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    
    if (start !== -1 && end !== -1 && end > start) {
        const jsonPart = text.substring(start, end + 1);
        return JSON.parse(jsonPart) as ExtractedTransaction;
    }
    
    return JSON.parse(text) as ExtractedTransaction;
  } catch (e) {
    console.error("Vision JSON parse failed. Raw text:", text);
    throw new Error("Structure de données invalide reçue de l'analyse visuelle.");
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const tools = [
  {
    type: "function",
    function: {
      name: 'propose_transaction',
      description: 'Propose une transaction (extraite d\'un document ou du texte) pour validation par l\'utilisateur AVANT enregistrement.',
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: 'INCOME ou EXPENSE' },
          amountExclTax: { type: "number", description: 'Montant Hors Taxe' },
          vatAmount: { type: "number", description: 'Montant de la TVA' },
          amountInclTax: { type: "number", description: 'Montant TTC' },
          date: { type: "string", description: 'Date YYYY-MM-DD' },
          description: { type: "string", description: 'Description complète de la transaction' },
          category: { type: "string", description: 'Catégorie comptable' },
          fecValid: { type: "boolean", description: 'Présence de QR code ou certification' },
          vendorName: { type: "string", description: 'Nom du tiers' },
          currency: { type: "string", description: 'Devise (ex: XOF, EUR, USD)' },
          syscohadaCode: { type: "string", description: 'Code de Plan Comptable SYSCOHADA approprié' }
        },
        required: ['type', 'amountExclTax', 'vatAmount', 'amountInclTax', 'date', 'category', 'fecValid', 'syscohadaCode']
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'update_company_profile',
      description: "Met à jour le profil de l'entreprise (ex: changement de chiffre d'affaires prévisionnel, secteur).",
      parameters: {
        type: "object",
        properties: {
          estimatedRevenue: { type: "number", description: "Nouveau chiffre d'affaires prévisionnel annuel en FCFA" },
          sector: { type: "string", description: "Nouveau secteur d'activité" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'delete_transaction',
      description: "Supprime une transaction existante en utilisant son ID.",
      parameters: {
        type: "object",
        properties: {
          transactionId: { type: "string", description: "L'ID de la transaction à supprimer" }
        },
        required: ['transactionId']
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'generate_invoice',
      description: "Prépare la génération d'une facture. Renvoie les données structurées pour que l'interface affiche l'outil de facturation pré-rempli.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string", description: "Nom du client pour la facture" },
          description: { type: "string", description: "Description complète de la prestation ou du produit" },
          amountExclTax: { type: "number", description: "Montant HT en FCFA" }
        },
        required: ['clientName', 'description', 'amountExclTax']
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'generate_payroll_slip',
      description: "Prépare la génération d'un bulletin de paie et navigue vers l'écran de création du bulletin (ex: pour un salaire donné ou brut/net).",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "Nom de l'employé" },
          role: { type: "string", description: "Rôle/Poste de l'employé" },
          grossSalary: { type: "number", description: "Salaire brut en FCFA" },
          netSalary: { type: "number", description: "Salaire net en FCFA (si l'utilisateur donne le net, estimez le brut ou utilisez le net)" }
        },
        required: ['employeeName']
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'fetch_all_transactions',
      description: "Récupère l'intégralité des transactions de l'utilisateur pour une analyse approfondie (bilan, grand livre, audit). Utile si le contexte initial ne contient que les transactions récentes.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'fetch_all_invoices',
      description: "Récupère toutes les factures émises par l'entreprise.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'fetch_inventory_items',
      description: "Récupère la liste des articles en stock et leur quantité.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'fetch_employee_list',
      description: "Récupère la liste des employés de l'entreprise.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'check_duplicates',
      description: "Recherche des transactions potentiellement en double en comparant les montants, dates et types.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Le montant à vérifier" },
          date: { type: "string", description: "La date au format YYYY-MM-DD" },
          type: { type: "string", enum: ['INCOME', 'EXPENSE'], description: "Le type de transaction" }
        },
        required: ['amount', 'date', 'type']
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'fetch_fiscal_calendar',
      description: "Récupère les prochaines échéances fiscales et sociales.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'simulate_scenario',
      description: "Applique un scénario prédictif 'What-If'. Permet de tester l'impact d'une embauche, d'une augmentation des ventes ou de charges sur la trésorerie et les impôts.",
      parameters: {
        type: "object",
        properties: {
          simRevenue: { type: "number", description: "Le nouveau chiffre d'affaires annuel projeté en FCFA" },
          simExpenses: { type: "number", description: "Les nouvelles charges annuelles projetées en FCFA" },
          simRegime: { type: "string", enum: ['CME', 'RSI', 'RNI'], description: "Le régime fiscal projeté" },
          simSector: { type: "string", enum: ['service', 'commerce'], description: "Le secteur d'activité" },
          explanation: { type: "string", description: "Une explication détaillée du raisonnement pour l'utilisateur" }
        },
        required: ['simRevenue', 'simExpenses', 'simRegime', 'simSector', 'explanation']
      }
    }
  }
];

export async function sendChatMessage(
  history: { role: 'user' | 'model', text: string }[],
  newMessage: string,
  file?: File,
  extractedText?: string,
  context?: UserContext,
  actionHandler?: (name: string, args: any) => Promise<any>,
  enableThinking: boolean = false
): Promise<{ text: string, actions: any[] } | null> {
  try {
    const messages: any[] = [];
      if (context) {
        messages.push({
            role: 'system',
            content: `Tu es Libriwouô AI (NEO), l'expert-comptable virtuel, agent IA ultra-agentique et cerveau analytique de l'application. Tu es spécialisé dans les normes SYSCOHADA révisées et la fiscalité du Burkina Faso. Tu adoptes une approche similaire à celle de l'agent "Hermes": proactif, capable de s'auto-améliorer, d'acquérir de nouvelles compétences (skills) et d'interpréter dynamiquement des requêtes complexes.

PROFIL DE L'ENTREPRISE:
- Nom: ${context.companyName || 'Inconnu'}
- IFU: ${context.ifu || 'Inconnu'}
- Secteur: ${context.sector || 'Inconnu'}
- Statut: Actif

RÈGLES FISCALES (BURKINA FASO):
1. RÉGIMES & SEUILS:
   - CME (Contribution des Micro-Entreprises) : Chiffre d'Affaires (CA) < 15 000 000 FCFA. Taxe = 2% (biens) ou 5% (services). Pas de TVA.
   - RSI (Régime Simplifié) : 15M <= CA <= 50 000 000 FCFA. TVA = 18%. IS = 27.5% (ou 300 000 FCFA).
   - RNI (Régime Réel Normal) : CA > 50 000 000 FCFA. TVA = 18%. IS = 27.5% (ou 1 000 000 FCFA).

CONTEXTE FINANCIER ACTUEL: 
- Chiffre d'Affaires: ${context.revenue} FCFA
- Dépenses: ${context.expenses} FCFA
- Régime Détecté: ${context.taxRegime || 'À déterminer'}
- Bénéfice Brut: ${context.revenue - context.expenses} FCFA
- Taxes Pré-calculées: ${context.taxes ? JSON.stringify(context.taxes) : 'Non disponibles'}

TES MISSIONS ET COMPORTEMENTS (AGENTIC & AUTO-AMÉLIORATION):
1. AGENT AUTONOME ET PROACTIF: Ne te contente pas de répondre passivement. Si tu détectes une opportunité d'optimisation (fiscale ou structurelle) ou un risque potentiel, agis et alerte l'utilisateur de manière proactive détaillée et concise.
2. CRÉATION ET GESTION DE SKILLS: Tu conçois, apprends et utilises de nouvelles "skills" au fur et à mesure que les utilisateurs partagent des modèles (dans "Mes Modèles & Références") ou posent de nouvelles problématiques métiers. Retiens les règles structurelles partagées (vision/analyse) pour générer ultérieurement des documents sur ce même format.
3. ADAPTABILITÉ TYPE HERMES: Comprends et exécute les modifications demandées avec contexte et clairvoyance. Modifie ta façon d'analyser ou de présenter les données en fonction des retours itératifs de l'utilisateur, et explique pourquoi tes ajustements sont pertinents.
4. ACTION IMMÉDIATE: Tu DOIS utiliser tes outils pour interagir directement avec l'application. Appelle toujours la fonction appropriée dès que possible au lieu de décrire l'action. Par exemple : si un document est fourni, extrais sa structure, et propose IMMÉDIATEMENT la transaction via \`propose_transaction\` sans demander la permission d'enregistrer d'abord.
5. RÉPONSES CONCRÈTES: Utilise des faits précis issus des "Taxes Pré-calculées". Rejette le jargon trop théorique au profit de plans d'action chiffrés.

COMPÉTENCES ACTIVES APPRISES (AGENT SKILLS):
\${context.agentSkills && context.agentSkills.filter(s => s.isActive).length > 0 ? context.agentSkills.filter(s => s.isActive).map((s: any) => \`- [SKILL: \${s.name}]: \${s.instructions}\`).join('\\n') : '- Aucune compétence personnalisée active.'}

STYLE: Décisif, expert, autonome et en constante auto-amélioration. N'attends pas la confirmation pour formuler tes propositions chiffrées.`
        });
    }

    let conversationMessages = [...messages];
    
    // Restore history mapping
    history.forEach(m => {
      conversationMessages.push({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.text
      });
    });
    
    let finalContent: any[] | string = newMessage;
    
    if (file && file.type.startsWith('image/')) {
        try {
            const base64 = await fileToBase64(file);
            finalContent = [
                { type: "text", text: newMessage || "Voici un document." },
                { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}` } }
            ];
        } catch (e) {
            console.error("Impossible de lire l'image :", e);
            finalContent = newMessage;
        }
    } else if (extractedText) {
        finalContent = `${newMessage}\n\nCONTENU DU DOCUMENT EXTRAIT :\n---\n${extractedText}\n---`;
    }

    if (finalContent || (Array.isArray(finalContent) && finalContent.length > 0)) {
        conversationMessages.push({ role: 'user', content: finalContent });
    }

    
    const allActions: any[] = [];
    let assistantMessage: any = null;

    // Reasoning Loop
    for (let i = 0; i < 5; i++) { // Limit iterations to prevent infinite loops
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: conversationMessages,
                tools,
                stream: false,
                enable_thinking: enableThinking
            })
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            console.error("Error parsing API response. Response probably not JSON:", e);
            throw new Error(`Invalid response from API. Expected JSON. Status: ${response.status}`);
        }
        
        if (!response.ok) {
            console.error("API error:", data);
            return { text: "Désolé, une erreur technique s'est produite lors de la connexion. " + (data?.error || ""), actions: allActions };
        }

        if (!data.choices || data.choices.length === 0) {
            console.error("No choices in response:", data);
            return { text: "Désolé, je n'ai pas pu générer de réponse.", actions: allActions };
        }

        assistantMessage = data.choices[0].message;
        conversationMessages.push(assistantMessage);

        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            for (const toolCall of assistantMessage.tool_calls) {
                try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const result = await actionHandler!(toolCall.function.name, args);
                    
                    allActions.push({ name: toolCall.function.name, args, result });
                    
                    // Add tool result to conversation
                    conversationMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: typeof result === 'string' ? result : JSON.stringify(result)
                    });
                } catch (toolError) {
                    console.error("Error executing tool:", toolError);
                    conversationMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ error: toolError instanceof Error ? toolError.message : String(toolError) })
                    });
                }
            }
            // Continue loop to get final response after tool results
            continue;
        }

        // If no tool calls, we are done
        break;
    }

    return { 
        text: assistantMessage?.content || (allActions.length > 0 ? "J'ai effectué les actions demandées." : "Je n'ai pas pu générer de réponse."), 
        actions: allActions 
    };

  } catch (error) {
    console.error("Error in sendChatMessage:", error);
    return null;
  }
}
