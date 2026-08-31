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

    if (stream) {
      const streamOptions: any = {
          model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
          messages: finalMessages,
          tools,
          temperature: 0.60,
          stream: true,
      };
      
      const streamResponse: any = await openai.chat.completions.create(streamOptions);

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
          model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
          messages: finalMessages,
          tools,
          temperature: 0.60,
      };
      const response = await openai.chat.completions.create(options);
      return Response.json(response);
    }
  } catch (error: any) {
    console.error("Deep chat api error:", error);
    return Response.json({ error: error.message || 'Erreur NVIDIA NIM API', details: error.toString() }, { status: 500 });
  }
};
