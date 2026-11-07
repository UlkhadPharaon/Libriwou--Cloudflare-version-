import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import 'dotenv/config';

/**
 * Local development server.
 *
 * Previously this also bridged `/api/chat`, `/api/vision`, `/api/intelligence`,
 * `/api/reference`, `/api/create-checkout-session`, `/api/stripe-webhook` and
 * `/api/waitlist` to Cloudflare Function handlers. Those handlers are gone with
 * Firebase: the app now calls the user's AI provider directly from the browser
 * (BYOK), so this server only serves the SPA.
 */

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
