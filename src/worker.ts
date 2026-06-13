import { onRequestPost as chatHandler } from '../functions/api/chat';
import { onRequestPost as visionHandler } from '../functions/api/vision';
import { onRequestPost as intelligenceHandler } from '../functions/api/intelligence';
import { onRequestPost as referenceHandler } from '../functions/api/reference';

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    try {
      if (request.method === 'POST') {
        if (url.pathname === '/api/chat') return await chatHandler({ request, env });
        if (url.pathname === '/api/vision') return await visionHandler({ request, env });
        if (url.pathname === '/api/intelligence') return await intelligenceHandler({ request, env });
        if (url.pathname === '/api/reference') return await referenceHandler({ request, env });
      }

      // Serve static assets for anything else (from the "dist" folder)
      return await env.ASSETS.fetch(request);
    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Worker Error', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
