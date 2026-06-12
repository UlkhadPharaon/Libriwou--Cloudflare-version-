import OpenAI from 'openai';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'NVIDIA_API_KEY manquante' });
    }

    const openai = new OpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: apiKey
    });
    
    const { base64, mimeType, documentType, documentName } = req.body || {};
    
    let messages: any[] = [
        {
            role: "user",
            content: [
                { type: "text", text: `Tu es un expert comptable AI. L'utilisateur vient de te fournir un document de référence de type "${documentType}" (nom: ${documentName}).
Ton objectif est de comprendre et d'enregistrer la structure, le format, le ton, et les détails récurrents (logo, mentions légales, style du tableau) de ce document pour de futurs usages.

Renvoie UNIQUEMENT un objet JSON strict avec ces champs:
{
  "extractedRules": "Une chaîne de caractères Markdown résumant les règles de formatage et la structure du document à répliquer dans le futur.",
  "detectedVariables": ["liste", "des", "variables", "identifiées", "ex: nom_client, montant_ht"],
  "visualStyle": "Résumé du style visuel (ex: minimaliste, tableau avec bordures épaisses, couleurs...)",
  "confidenceScore": 95
}` }
            ]
        }
    ];

    if (base64 && mimeType) {
        messages[0].content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } });
    } else if (req.body.text) {
        messages[0].content.push({ type: "text", text: "Voici le contenu textuel du document :\n" + req.body.text });
    }

    const response = await openai.chat.completions.create({
        model: "stepfun-ai/step-3.7-flash",
        messages: messages as any,
        temperature: 0.1,
    });
    
    let text = response.choices[0].message.content || "{}";
    
    // Safety matching
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        text = text.substring(firstBrace, lastBrace + 1);
    }
    
    res.json({ analysis: JSON.parse(text) });
  } catch (error: any) {
    console.error("Erreur gérée dans /api/reference :", error);
    res.status(500).json({ error: error.message || 'Erreur NVIDIA NIM API', details: error.toString() });
  }
}
