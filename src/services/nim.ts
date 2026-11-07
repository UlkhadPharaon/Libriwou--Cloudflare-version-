import { extractTextFromFile } from '../lib/file-extractor';
import {
  loadAiConfig,
  loadCustomBaseUrl,
  getProvider,
  getProviderKey,
  resolveModel,
  sendChat,
  type ChatMessage,
  type ChatTool,
  type ContentPart,
  type ToolCall,
} from './ai';

/**
 * Builds the tool-calling payload shared by chat and vision calls.
 * The 12 tools below are the agentic surface of NEO — they are provider-agnostic
 * (OpenAI `tools` shape) and translated to Anthropic's schema inside the client.
 */
export type { ChatMessage, ContentPart, ToolCall };

/** Reads the user's BYOK configuration. Throws a helpful error when incomplete. */
async function resolveAiSetup(): Promise<{
  providerId: string;
  apiKey: string;
  model: string;
  baseUrlOverride: string | undefined;
}> {
  const config = loadAiConfig();
  const apiKey = await getProviderKey(config.providerId);

  if (!apiKey) {
    throw new Error(
      `Aucune clé API configurée pour ${getProvider(config.providerId).label}. ` +
        `Ouvrez Réglages → Fournisseur IA pour ajouter votre clé.`
    );
  }

  const model = resolveModel(config, config.providerId);
  if (!model) {
    throw new Error(
      `Aucun modèle sélectionné. Ouvrez Réglages → Fournisseur IA et choisissez un modèle ` +
        `avec vision + outils.`
    );
  }

  return {
    providerId: config.providerId,
    apiKey,
    model,
    baseUrlOverride: config.providerId === 'custom' ? loadCustomBaseUrl() || undefined : undefined,
  };
}

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
  const setup = await resolveAiSetup();

  const VISION_PROMPT = `Analyse ce document (facture, reçu, ticket de caisse ou note).
Extrais la transaction principale et réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec cette forme exacte :
{"type":"INCOME|EXPENSE","amountExclTax":0,"vatAmount":0,"amountInclTax":0,"date":"YYYY-MM-DD","description":"...","category":"...","vendorName":"...","currency":"XOF","syscohadaCode":"...","lineItems":[{"description":"...","quantity":1,"unitPrice":0,"amountExclTax":0}]}
Pour tout ticket multi-articles, extrais CHAQUE ligne dans lineItems. Aucun texte avant ou après le JSON.`;

  let content: ContentPart[];
  if (file.type === 'application/pdf' || file.type.includes('wordprocessingml')) {
    const text = await extractTextFromFile(file);
    content = [{ type: 'text', text: `${VISION_PROMPT}\n\nCONTENU DU DOCUMENT :\n---\n${text}\n---` }];
  } else {
    const base64 = await fileToBase64(file);
    content = [
      { type: 'text', text: VISION_PROMPT },
      { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}` } },
    ];
  }

  let text: string;
  try {
    const result = await sendChat({
      providerId: setup.providerId,
      apiKey: setup.apiKey,
      model: setup.model,
      baseUrlOverride: setup.baseUrlOverride,
      temperature: 0.1,
      maxTokens: 2048,
      messages: [{ role: 'user', content }],
    });
    text = result.text;
  } catch (error: any) {
    console.error('[Vision] provider call failed', error);
    throw new Error(error?.message || "Impossible d'analyser le document.");
  }

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

const tools: ChatTool[] = [
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
          syscohadaCode: { type: "string", description: 'Code de Plan Comptable SYSCOHADA approprié' },
          lineItems: {
            type: "array",
            description: "DÉTAIL LIGNE PAR LIGNE du document (chaque article/produit/service). OBLIGATOIRE pour tickets de caisse, factures multi-articles, reçus de supermarché.",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "Nom de l'article" },
                quantity: { type: "number", description: "Quantité" },
                unitPrice: { type: "number", description: "Prix unitaire HT" },
                amountExclTax: { type: "number", description: "Montant total HT de la ligne" }
              },
              required: ['description', 'quantity', 'unitPrice', 'amountExclTax']
            }
          }
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

/**
 * Extrait un bloc de proposition ```propose_transaction {...} ``` (ou un objet
 * JSON brut contenant les champs d'une transaction) du texte de l'assistant.
 * Retourne null si aucun bloc valide (type + montants numériques requis).
 */
export function extractProposalBlock(text: string): any | null {
  if (!text) return null;
  const candidates: string[] = [];
  const fenced = text.match(/```propose_transaction\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1]);
  // Dernier recours : le plus grand objet JSON du texte
  const objMatch = text.match(/\{[\s\S]*"amountInclTax"[\s\S]*\}/);
  if (objMatch) candidates.push(objMatch[0]);

  for (const raw of candidates) {
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) continue;
      const parsed = JSON.parse(raw.substring(start, end + 1));
      const type = typeof parsed.type === 'string' ? parsed.type.toUpperCase() : '';
      const amountInclTax = Number(parsed.amountInclTax);
      if ((type === 'INCOME' || type === 'EXPENSE') && Number.isFinite(amountInclTax) && amountInclTax >= 0) {
        const lineItems = Array.isArray(parsed.lineItems)
          ? parsed.lineItems
              .filter((l: any) => l && typeof l.description === 'string' && l.description.trim() !== '')
              .map((l: any) => ({
                description: String(l.description),
                quantity: Number(l.quantity) || 1,
                unitPrice: Number(l.unitPrice) || 0,
                amountExclTax: Number(l.amountExclTax) || (Number(l.quantity) || 1) * (Number(l.unitPrice) || 0),
              }))
          : [];
        return {
          type,
          amountExclTax: Number(parsed.amountExclTax) || 0,
          vatAmount: Number(parsed.vatAmount) || 0,
          amountInclTax,
          date: typeof parsed.date === 'string' ? parsed.date : new Date().toISOString().split('T')[0],
          description: typeof parsed.description === 'string' ? parsed.description : '',
          category: typeof parsed.category === 'string' ? parsed.category : 'Divers',
          fecValid: parsed.fecValid !== false,
          vendorName: typeof parsed.vendorName === 'string' ? parsed.vendorName : '',
          currency: typeof parsed.currency === 'string' ? parsed.currency : 'XOF',
          syscohadaCode: typeof parsed.syscohadaCode === 'string' ? parsed.syscohadaCode : '',
          ...(lineItems.length > 0 ? { lineItems } : {}),
          ...(typeof parsed.fraudSuspected === 'boolean' ? { fraudSuspected: parsed.fraudSuspected } : {}),
          ...(typeof parsed.fraudReason === 'string' ? { fraudReason: parsed.fraudReason } : {}),
        };
      }
    } catch { /* candidat invalide : on essaie le suivant */ }
  }
  return null;
}

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
    // Greeting fast-path: avoid calling the heavy reasoning model for "salut"
    const trimmed = (newMessage || '').trim().toLowerCase();
    const isGreeting = !file && !extractedText && history.length === 0 && /^(salut|bonjour|hello|hey|cc|yo|coucou|bjr|bonsoir)(\s+neo)?[!.\s]*$/i.test(trimmed);
    if (isGreeting) {
      const name = context?.companyName ? ` pour ${context.companyName}` : '';
      return {
        text: `Salut ! Je suis NEO, ton expert SYSCOHADA${name}. Comment puis-je t'aider aujourd'hui — un reçu à analyser, un point TVA, ou ton stock ?`,
        actions: []
      };
    }

    // BYOK: resolve provider, key and model before any call. A missing key is a
    // configuration error the user can fix in Réglages — say so plainly.
    let setup: Awaited<ReturnType<typeof resolveAiSetup>>;
    try {
      setup = await resolveAiSetup();
    } catch (error: any) {
      return { text: error?.message || "Configurez votre fournisseur IA dans les Réglages.", actions: [] };
    }

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
   DOCUMENTS VISUELS (facture/reçu/ticket en image) : décris brièvement PUIS appelle OBLIGATOIREMENT \`propose_transaction\` avec TOUS les champs extraits (type, montants HT/TVA/TTC, date YYYY-MM-DD, vendeur, catégorie, code SYSCOHADA). Ne te contente JAMAIS de décrire l'image sans appeler l'outil.
   DÉTAIL OBLIGATOIRE : pour tout ticket de caisse, reçu de supermarché ou facture multi-articles, extrais CHAQUE ligne dans \`lineItems\` (description + quantité + prix unitaire + montant HT de la ligne). INTERDIT de résumer en un seul total : chaque article acheté doit apparaître. Vérifie que la somme des lignes ≈ montant HT déclaré.
   SECOURS : si l'appel d'outil est impossible, termine ta réponse par un bloc JSON strict (aucun texte après), lignes incluses :
   \`\`\`propose_transaction
   {"type":"EXPENSE","amountExclTax":100000,"vatAmount":18000,"amountInclTax":118000,"date":"2026-09-20","description":"...","category":"...","vendorName":"...","currency":"XOF","syscohadaCode":"...","lineItems":[{"description":"Riz 5kg","quantity":2,"unitPrice":4500,"amountExclTax":9000}]}
   \`\`\`
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
    
    const VISION_NUDGE = "Analyse ce document (facture/reçu/ticket) : extrais type, montants HT/TVA/TTC, date, vendeur, catégorie et code SYSCOHADA, puis appelle IMMÉDIATEMENT l'outil propose_transaction avec ces valeurs. N'affiche jamais les chiffres uniquement dans le texte sans appeler l'outil.";
    if (file && file.type.startsWith('image/')) {
        try {
            const base64 = await fileToBase64(file);
            finalContent = [
                { type: "text", text: `${newMessage || "Voici un document."}\n\n${VISION_NUDGE}` },
                { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}` } }
            ];
        } catch (e) {
            console.error("Impossible de lire l'image :", e);
            finalContent = newMessage;
        }
    } else if (extractedText) {
        finalContent = `${newMessage}\n\nCONTENU DU DOCUMENT EXTRAIT :\n---\n${extractedText}\n---\n\n${VISION_NUDGE}`;
    }

    if (finalContent || (Array.isArray(finalContent) && finalContent.length > 0)) {
        conversationMessages.push({ role: 'user', content: finalContent });
    }

    
    const allActions: any[] = [];
    let assistantText = '';
    let pendingToolCalls: ToolCall[] = [];

    // Reasoning Loop — tightened to 3 max to avoid 15min on simple "salut"
    for (let i = 0; i < 3; i++) {
        let result;
        try {
          result = await sendChat({
            providerId: setup.providerId,
            apiKey: setup.apiKey,
            model: setup.model,
            baseUrlOverride: setup.baseUrlOverride,
            messages: conversationMessages,
            tools,
            ...(enableThinking ? { temperature: 0.3 } : {}),
          });
        } catch (error: any) {
          console.error('[NEO] provider call failed', error);
          return {
            text:
              `Désolé, la connexion au fournisseur IA a échoué : ${error?.message || 'erreur inconnue'}. ` +
              `Vérifiez votre clé et votre modèle dans Réglages → Fournisseur IA.`,
            actions: allActions,
          };
        }

        assistantText = result.text;
        pendingToolCalls = result.toolCalls;

        // Record the assistant turn so the next iteration sees it.
        conversationMessages.push({
          role: 'assistant',
          content: result.text,
          ...(result.toolCalls.length ? { tool_calls: result.toolCalls } : {}),
        });

        if (result.toolCalls.length > 0) {
            for (const toolCall of result.toolCalls) {
                try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const toolResult = await actionHandler!(toolCall.function.name, args);
                    
                    allActions.push({ name: toolCall.function.name, args, result: toolResult });
                    
                    // Add tool result to conversation
                    conversationMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
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

    // Some providers put output in `reasoning` when `content` is empty.
    const fallbackText =
      assistantText ||
      (allActions.length > 0 ? "J'ai effectué les actions demandées." : "Je n'ai pas pu générer de réponse.");

    // SECOURS proposition : si le modèle a décrit un document sans appeler l'outil
    // (bloc ```propose_transaction {...}), on synthétise l'action pour que le
    // popup interactif s'affiche quand même.
    if (allActions.length === 0 && actionHandler && typeof fallbackText === 'string') {
      const proposal = extractProposalBlock(fallbackText);
      if (proposal) {
        try {
          const result = await actionHandler('propose_transaction', proposal);
          allActions.push({ name: 'propose_transaction', args: proposal, result });
        } catch (e) {
          console.warn("Proposal fallback handler failed:", e);
          allActions.push({ name: 'propose_transaction', args: proposal, result: { success: true, status: 'proposed_to_user' } });
        }
      }
    }

    return {
        text: fallbackText,
        actions: allActions
    };

  } catch (error) {
    console.error("Error in sendChatMessage:", error);
    return null;
  }
}
