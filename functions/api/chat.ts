import OpenAI from 'openai';

export const onRequestPost = async ({ request, env }: any) => {
  try {
    const apiKey = env.NVIDIA_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'NVIDIA_API_KEY manquante' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { messages = [], tools, stream, enable_thinking } = body;
    const isThinkingEnabled = !!enable_thinking;
    
    const openai = new OpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: apiKey
    });

    const cleanMessages = messages.map((msg: any) => {
      if (Array.isArray(msg.content)) {
        msg.content = msg.content.map((part: any) => {
          if (part.type === 'image_url' && part.image_url && part.image_url.url) {
            return part; 
          }
          if (part.type === 'text') return { type: 'text', text: part.text };
          return part;
        });
      }
      return msg;
    });

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

    // Valid model for this account (tested 2026-09-08): reasoning is the only 30b that supports tools correctly and is not 404 for this API key.
    // Do NOT use nvidia/nemotron-3-nano-4b-a3b (404) or nvidia/nemotron-3.5-lightning-30b-a3b (25s). Keep temp 0.3 + max_tokens 900 to keep "salut" <4s instead of 15min.
    // Override via env NVIDIA_CHAT_MODEL if you get a faster entitled model.
    const chatModel = (env as any).NVIDIA_CHAT_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

    const callWithRetry = async (opts: any, retries = 2): Promise<any> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await openai.chat.completions.create(opts);
        } catch (e: any) {
          const msg = e?.message || '';
          const isRateLimited = msg.includes('ResourceExhausted') || msg.includes('429') || e?.status === 429 || e?.status === 503;
          if (isRateLimited && attempt < retries) {
            const backoff = 800 * Math.pow(2, attempt);
            console.warn(`[chat] rate-limited, retry ${attempt+1}/${retries} after ${backoff}ms`);
            await new Promise(r => setTimeout(r, backoff));
            continue;
          }
          throw e;
        }
      }
    };

    if (stream) {
      const streamOptions: any = {
          model: chatModel,
          messages: finalMessages,
          tools,
          temperature: 0.30,
          max_tokens: 900,
          stream: true,
      };
      
      const streamResponse: any = await callWithRetry(streamOptions);

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          for await (const chunk of streamResponse) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new Response(readable, {
          headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
          }
      });
    } else {
      const options: any = {
          model: chatModel,
          messages: finalMessages,
          tools,
          temperature: 0.30,
          max_tokens: 900,
      };
      const response = await callWithRetry(options);
      return Response.json(response);
    }
  } catch (error: any) {
    console.error("Deep chat api error:", error);
    const isRateLimited = (error?.message || '').includes('ResourceExhausted');
    if (isRateLimited) {
      return Response.json({ error: "NEO est surchargé (trop de requêtes simultanées). Réessaie dans 5s. Astuce: 'salut' est maintenant instantané sans passer par l'IA.", details: error.message }, { status: 429 });
    }
    return Response.json({ error: error.message || 'Erreur NVIDIA NIM API', details: error.toString() }, { status: 500 });
  }
};
