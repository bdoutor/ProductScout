import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { safeHelmet, safeRateLimit } from './utils/safe-middlewares';

import searchRouter from './routes/search';
import authRouter from './routes/auth';
import supplierCredsRouter from './routes/supplier-creds';
import { isSupabaseConfigured, trySupabasePing } from './utils/supabase';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(safeHelmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || 'change-me-dev'));

// Basic rate limiting (per IP)
app.use(safeRateLimit({ windowMs: 60 * 1000, max: 120 }));

// Health check
app.get('/health', async (req, res) => {
  const supabaseConfigured = isSupabaseConfigured();
  const ping = supabaseConfigured ? await trySupabasePing() : { ok: false, error: 'Supabase not configured' };
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabase: {
      configured: supabaseConfigured,
      reachable: ping.ok,
      error: ping.error,
    },
  });
});

// Routes
app.use('/api', searchRouter);
app.use('/auth', authRouter);
app.use('/admin/supplier-creds', supplierCredsRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`ProductScout API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
