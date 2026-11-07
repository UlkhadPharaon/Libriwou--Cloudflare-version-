/**
 * Cloudflare Worker entry point.
 *
 * The AI API handlers were removed along with Firebase: AI calls now go straight
 * from the browser to the provider the user configured (BYOK), so there is no
 * server-side key to protect and no proxy to run. This Worker only serves the
 * built static assets from `dist`.
 */

export default {
  async fetch(request: Request, env: any) {
    try {
      return await env.ASSETS.fetch(request);
    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Worker Error', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
