import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

import chatHandler from './api/chat.ts';
import visionHandler from './api/vision.ts';
import intelligenceHandler from './api/intelligence.ts';
import referenceHandler from './api/reference.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post('/api/chat', (req, res) => chatHandler(req, res));
  app.post('/api/vision', (req, res) => visionHandler(req, res));
  app.post('/api/intelligence', (req, res) => intelligenceHandler(req, res));
  app.post('/api/reference', (req, res) => referenceHandler(req, res));

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
