import OpenAI from 'openai';


export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'NVIDIA_API_KEY manquante' });
    }

    const body = req.body || {};
    const messages = body.messages || [];
    const tools = body.tools;
    const stream = body.stream;
    const enable_thinking = body.enable_thinking;
    const isThinkingEnabled = !!enable_thinking;
    
    const openai = new OpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: apiKey
    });

    // Clean messages to ensure multimodal content is formatted correctly for OpenAI API.
    const cleanMessages = messages.map((msg: any) => {
      // nvidia/nemotron-3-nano-omni-30b-a3b-reasoning expects text messages, not array/multimodal if not supported.
      // We will try converting arrays of content into string if necessary, but according to nemotron omni it may support some multimodal.
      // Ensure we don't crash here.
      if (Array.isArray(msg.content)) {
        msg.content = msg.content.map((part: any) => {
          if (part.type === 'image_url' && part.image_url && part.image_url.url) {
            return part; // keep it or stringify, we leave as is for now
          }
          if (part.type === 'text') return { type: 'text', text: part.text };
          return part;
        });
      }
      return msg;
    });

    // Prepare final messages
    let finalMessages = [
      {
        role: 'system',
        content: "Tu es NEO, l'assistant intelligent de gestion d'entreprise. Tu dois IMPÉRATIVEMENT répondre en FRANÇAIS. Tes réponses doivent être professionnelles, expertes en fiscalité et comptabilité (norme SYSCOHADA), et chaleureuses."
      },
      ...cleanMessages
    ];
    if (isThinkingEnabled) {
      finalMessages.unshift({
        role: 'system',
        content: "MODE RÉFLEXION PROFONDE ACTIVÉ: Décompose ton raisonnement étape par étape avant de donner ta réponse finale. Analyse les implications fiscales et comptables en détail. Tu peux utiliser des balises <reasoning> si tu le souhaites pour structurer ta pensée interne."
      });
    }

    if (stream) {
      const streamOptions: any = {
          model: "stepfun-ai/step-3.7-flash",
          messages: finalMessages,
          tools,
          temperature: 0.60,
          stream: true,
          // Removed nvidia specific kwargs if not universally supported
      };
      
      const streamResponse: any = await openai.chat.completions.create(streamOptions);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      
      for await (const chunk of streamResponse) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const options: any = {
          model: "stepfun-ai/step-3.7-flash",
          messages: finalMessages,
          tools,
          temperature: 0.60,
      };
      const response = await openai.chat.completions.create(options);
      res.json(response);
    }
  } catch (error: any) {
    console.error("Deep chat api error:", error);
    res.status(500).json({ error: error.message || 'Erreur NVIDIA NIM API', details: error.toString() });
  }
}
