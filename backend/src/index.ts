import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { safeHelmet, safeRateLimit } from './utils/safe-middlewares';

import searchRouter from './routes/search';
import authRouter from './routes/auth';
import supplierCredsRouter from './routes/supplier-creds';
import adminUsersRouter from './routes/admin-users';
import testSearchRouter from './routes/test-search';
import mockSearchRouter from './routes/mock-search';
import { isSupabaseConfigured, trySupabasePing } from './utils/supabase';
import { getSessionSecret, requireAuth } from './utils/session';
import { requireAdmin } from './middleware/requireAdmin';
import { startSupplierAuthScheduler } from './services/supplier-auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const enableMockRoutes =
  process.env.ENABLE_MOCK_ROUTES === '1' ||
  process.env.ENABLE_MOCK_ROUTES === 'true';

// Middleware
app.use(safeHelmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser(getSessionSecret()));

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
app.use('/api', requireAuth, searchRouter);
if (enableMockRoutes) {
  app.use('/api', requireAuth, testSearchRouter);
  app.use('/api', requireAuth, mockSearchRouter);
}
app.use('/auth', authRouter);
app.use('/admin/supplier-creds', supplierCredsRouter);
app.use('/api/admin/users', requireAuth, requireAdmin, adminUsersRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  startSupplierAuthScheduler();
  console.log(`ProductScout API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (!enableMockRoutes) {
    console.log('Mock routes disabled (set ENABLE_MOCK_ROUTES=true to re-enable)');
  }
});
