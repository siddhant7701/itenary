import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config, DIST_DIR, UPLOAD_DIR } from './config.js';
import { q } from './db.js';
import { HttpError } from './lib/http.js';
import { initRealtime } from './realtime.js';
import { sweepBookings } from './services/bookings.js';
import { refreshTripStatuses } from './services/trips.js';
import { whatsappConfigured } from './services/otp.js';
import { aiStatus } from './agent/concierge.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import tripRoutes from './routes/trips.js';
import bookingRoutes from './routes/bookings.js';
import budgetRoutes from './routes/budget.js';
import mediaRoutes from './routes/media.js';
import feedRoutes from './routes/feed.js';
import miscRoutes from './routes/misc.js';
import adminRoutes from './routes/admin.js';

// First run: create the admin account, providers and demo content.
if (!q.value('SELECT COUNT(*) FROM users')) {
  const { seed } = await import('./seed.js');
  await seed({ quiet: false });
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'connect-src': ["'self'", 'ws:', 'wss:'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'font-src': ["'self'", 'data:'],
        'script-src': ["'self'"],
        'worker-src': ["'self'", 'blob:'],
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    // The web app may be served from another domain (Vercel), so photos/API must be loadable cross-origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// CORS for a separately hosted web app (Vercel → this API).
app.use(['/api', '/uploads'], (req, res, next) => {
  const origin = req.headers.origin;
  const any = config.corsOrigins.includes('*');
  if (origin && (any || config.corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', any ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, slow down a little.' } }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api', meRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api', budgetRoutes);
app.use('/api', mediaRoutes);
app.use('/api', feedRoutes);
app.use('/api', miscRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (_req, _res) => {
  throw new HttpError(404, 'Endpoint not found');
});

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

// Serve the built web app (npm run build) with SPA fallback.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h', setHeaders: (res, file) => {
    if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (file.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
  } }));
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
} else {
  app.get('/', (_req, res) => res.type('text').send('Itenary API is running. Build the web app with `npm run build`, or run `npm run dev` and open http://localhost:5173'));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'That file is too large (max 10 MB)' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  const status = err instanceof HttpError || err?.status ? err.status || 500 : 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message, ...(err?.extra || {}) });
});

const server = http.createServer(app);
initRealtime(server);

refreshTripStatuses();
setInterval(() => {
  try {
    sweepBookings();
    refreshTripStatuses();
  } catch (err) {
    console.error('[jobs]', err);
  }
}, 60_000).unref();

server.listen(config.port, () => {
  const ai = aiStatus();
  console.log(`\n  Itenary running at ${config.publicUrl}`);
  console.log(`  • Admin panel:  ${config.publicUrl}/admin   (${config.admin.email})`);
  console.log(`  • AI concierge: ${ai.engine === 'claude' ? `Claude (${ai.model})` : 'built-in engine (set ANTHROPIC_API_KEY to use Claude)'}`);
  console.log(`  • WhatsApp OTP: ${whatsappConfigured() ? 'live' : config.demoMode ? 'demo mode (codes shown on screen)' : 'NOT CONFIGURED'}`);
  console.log(`  • Payments:     sandbox UPI\n`);
  if (config.demoMode && config.isProd) {
    console.warn('  ⚠  DEMO_MODE is on in production: OTP codes are shown on screen and demo logins are enabled.');
    console.warn('     Set DEMO_MODE=false (and configure WhatsApp) before inviting real users.\n');
  }
});
