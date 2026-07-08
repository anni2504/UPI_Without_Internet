import express from 'express';
import cors from 'cors';
import { connectDb } from '../backend/src/db.js';
import { serverKeyHolder } from '../backend/src/crypto/serverKeyHolder.js';
import { idempotencyService } from '../backend/src/services/idempotency.service.js';
import * as demoService from '../backend/src/services/demo.service.js';
import apiRoutes from '../backend/src/routes/api.routes.js';

let initialized = false;

const app = express();
app.use(cors());
app.use(express.json());

// Initialize server key, database connection, and seed accounts once per serverless worker container
app.use(async (req, res, next) => {
  if (!initialized) {
    try {
      serverKeyHolder.init();
      await connectDb();
      try {
        await demoService.seedAccounts();
      } catch (seedErr) {
        console.log('Seeding skipped or already completed:', seedErr.message);
      }
      idempotencyService.start();
      initialized = true;
    } catch (err) {
      console.error('Initialization error in serverless function:', err);
    }
  }
  next();
});

// Map routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});

export default app;
