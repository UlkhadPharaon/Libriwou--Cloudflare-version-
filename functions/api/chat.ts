import OpenAI from 'openai';

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL = "inclusionai/ling-3.0-flash-vl:free";

export const onRequestPost = async ({ request, env }: any) => {
  try {
    const apiKey = env.OPENROUTER_API_KEY || env.NVIDIA_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'OPENROUTER_API_KEY manquante' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { messages = [], tools, stream, enable_thinking } = body;
    const isThinkingEnabled = !!enable_thinking;

    const openai = new OpenAI({
        baseURL: (env as any).OPENROUTER_BASE_URL || OPENROUTER_BASE_URL,
        apiKey: apiKey,
        defaultHeaders: {
          ...(env.APP_URL ? { "HTTP-Referer": env.APP_URL } : {}),
          "X-Title": "Libriwouo NEO Assistant",
        },
    } as any);

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

    // OpenRouter unified model for NEO chat (vision-capable, free tier).
    // Override via env OPENROUTER_CHAT_MODEL if needed.
    const chatModel = (env as any).OPENROUTER_CHAT_MODEL || (env as any).NVIDIA_CHAT_MODEL || OPENROUTER_DEFAULT_MODEL;

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

    // NOTE: ling-3.0-flash-vl is a reasoning model — it spends tokens in `reasoning`
    // before writing `content`. 900 truncates during reasoning (content=null).
    // 2000+ lets it finish thinking AND answer.
    if (stream) {
      const streamOptions: any = {
          model: chatModel,
          messages: finalMessages,
          tools,
          temperature: 0.30,
          max_tokens: 2000,
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
          max_tokens: 2000,
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
    return Response.json({ error: error.message || 'Erreur OpenRouter API', details: error.toString() }, { status: 500 });
  }
};
