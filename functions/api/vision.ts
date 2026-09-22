import OpenAI from 'openai';

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL = "inclusionai/ling-3.0-flash-vl:free";

export const onRequestPost = async ({ request, env }: any) => {
  try {
    const apiKey = env.OPENROUTER_API_KEY || env.NVIDIA_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'OPENROUTER_API_KEY manquante' }, { status: 500 });
    }

    const openai = new OpenAI({
        baseURL: (env as any).OPENROUTER_BASE_URL || OPENROUTER_BASE_URL,
        apiKey: apiKey,
        defaultHeaders: {
          ...(env.APP_URL ? { "HTTP-Referer": env.APP_URL } : {}),
          "X-Title": "Libriwouo Vision OCR",
        },
    } as any);
    
    const body: any = await request.json().catch(() => ({}));
    const { base64, mimeType, text } = body;
    
    const messages: any[] = [
        {
            role: "user",
            content: [
                { type: "text", text: `Tu es un expert en vision comptable spécialisé dans le plan comptable SYSCOHADA révisé et la fiscalité du Burkina Faso.
Analyse ce document (facture, reçu, ticket) avec une précision extrême.

EXTRACTION DES DONNÉES:
1. Identifie le Type (INCOME/EXPENSE).
2. Extraits les montants: Montant Hors Taxe (HT), Montant TVA (taux standard 18% au Burkina si non spécifié mais calculable), Montant TTC.
3. Date au format YYYY-MM-DD.
4. Identifie le fournisseur (vendorName) et son IFU si présent.
5. Détecte les anomalies (fraudSuspected : doublons, montants incohérents).

ANALYSE COMPTABLE (SYSCOHADA):
- Détermine la catégorie de dépense.
- Assigne le CODE SYSCOHADA approprié (ex: 601 pour Achats de marchandises, 605 pour Fournitures, 622 pour Locations, 632 pour Transports, etc.).
- Vérifie la conformité DGI (fecValid : présence de mentions obligatoires).

Renvoie UNIQUEMENT un objet JSON strict avec ces champs:
{
  "type": "EXPENSE" | "INCOME",
  "amountExclTax": number,
  "vatAmount": number,
  "amountInclTax": number,
  "date": "YYYY-MM-DD",
  "category": "string",
  "fecValid": boolean,
  "vendorName": "string",
  "currency": "XOF",
  "fraudSuspected": boolean,
  "fraudReason": "string" | null,
  "syscohadaCode": "string",
  "description": "Brève description du contenu",
  "lineItems": [
    {
      "description": "string (Nom de l'article)",
      "quantity": number,
      "unitPrice": number,
      "amountExclTax": number
    }
  ]
}` }
            ]
        }
    ];

    if (base64 && mimeType) {
        messages[0].content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } });
    } else if (text) {
        messages[0].content.push({ type: "text", text: "Voici le contenu textuel du document :\n" + text });
    }

    const visionModel = (env as any).OPENROUTER_VISION_MODEL || (env as any).OPENROUTER_CHAT_MODEL || OPENROUTER_DEFAULT_MODEL;

    const response = await openai.chat.completions.create({
        model: visionModel,
        messages: messages as any,
        temperature: 0.1,
    });
    
    return Response.json({ text: response.choices[0].message.content });
  } catch (error: any) {
    console.error("Erreur gérée dans /api/vision :", error);
    return Response.json({ error: error.message || 'Erreur OCR OpenRouter API', details: error.toString() }, { status: 500 });
  }
};
