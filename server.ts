import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { onRequestPost as chatHandler } from './functions/api/chat.js';
import { onRequestPost as visionHandler } from './functions/api/vision.js';
import { onRequestPost as intelligenceHandler } from './functions/api/intelligence.js';
import { onRequestPost as referenceHandler } from './functions/api/reference.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Helper pour combler le pont Express -> Fetch API (Standard Cloudflare)
  const bridgeCloudflare = (handler: any) => async (req: express.Request, res: express.Response) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(key, value);
        else if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
      }

      const init: RequestInit = { method: req.method, headers };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = req.body ? JSON.stringify(req.body) : null;
      }

      const fetchRequest = new Request(url, init);
      const env = process.env;

      const response = await handler({ request: fetchRequest, env });

      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });
      res.status(response.status);

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error('Error bridging to CF function:', err);
      res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
  };

  // API Routes adaptées pour le dev local / Express
  app.post('/api/chat', bridgeCloudflare(chatHandler));
  app.post('/api/vision', bridgeCloudflare(visionHandler));
  app.post('/api/intelligence', bridgeCloudflare(intelligenceHandler));
  app.post('/api/reference', bridgeCloudflare(referenceHandler));

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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
