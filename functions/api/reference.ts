import OpenAI from 'openai';

export const onRequestPost = async ({ request, env }: any) => {
  try {
    const apiKey = env.NVIDIA_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'NVIDIA_API_KEY manquante' }, { status: 500 });
    }

    const openai = new OpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: apiKey
    });
    
    const body: any = await request.json().catch(() => ({}));
    const { base64, mimeType, documentType, documentName, text: textPayload } = body;
    
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
    } else if (textPayload) {
        messages[0].content.push({ type: "text", text: "Voici le contenu textuel du document :\n" + textPayload });
    }

    const response = await openai.chat.completions.create({
        model: "nvidia/nemotron-3.5-lightning-30b-a3b",
        messages: messages as any,
        temperature: 0.1,
    });
    
    let text = response.choices[0].message.content || "{}";
    
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        text = text.substring(firstBrace, lastBrace + 1);
    }
    
    return Response.json({ analysis: JSON.parse(text) });
  } catch (error: any) {
    console.error("Erreur gérée dans /api/reference :", error);
    return Response.json({ error: error.message || 'Erreur NVIDIA NIM API', details: error.toString() }, { status: 500 });
  }
};
