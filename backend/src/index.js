import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { connectDb } from './db.js';
import { serverKeyHolder } from './crypto/serverKeyHolder.js';
import { idempotencyService } from './services/idempotency.service.js';
import * as demoService from './services/demo.service.js';
import apiRoutes from './routes/api.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
  serverKeyHolder.init();
  await connectDb();
  await demoService.seedAccounts();
  idempotencyService.start();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api', apiRoutes);

  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  app.listen(config.port, () => {
    console.log(`Started UPI Mesh MERN backend on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { start };
