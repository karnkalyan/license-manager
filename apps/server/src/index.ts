import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config, repoRoot } from './config.js';
import { prisma, closeDb } from './db.js';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { tenantsRouter } from './routes/tenants.js';
import { licensesRouter } from './routes/licenses.js';
import { clientsRouter } from './routes/clients.js';
import { dashboardRouter } from './routes/dashboard.js';
import { auditRouter } from './routes/audit.js';
import { startTcpServer } from './tcp/server.js';

const app = express();
app.set('trust proxy', config.TRUST_PROXY ? 1 : false);
app.use(helmet());
app.use(cors({ origin: config.ADMIN_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use((req, res, next) => {
  if (['POST','PUT','PATCH','DELETE'].includes(req.method) && req.headers.origin && req.headers.origin !== config.ADMIN_ORIGIN) return res.status(403).json({ error: 'Origin rejected' });
  next();
});
app.use(express.json({ limit: '64kb' }));
app.use(pinoHttp());
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

app.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, time: new Date().toISOString() });
});
app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/products', productsRouter);
app.use('/api/applications', productsRouter);
app.use('/api/licenses', licensesRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit', auditRouter);

const adminDist = resolve(repoRoot, 'apps/admin/dist');
if (config.NODE_ENV === 'production' && existsSync(adminDist)) {
  app.use(express.static(adminDist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || !req.accepts('html')) return next();
    return res.sendFile(resolve(adminDist, 'index.html'));
  });
}

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = app.listen(config.PORT, () => console.log(`Admin API listening on :${config.PORT}`));
const tcpServer = startTcpServer();

async function shutdown() {
  httpServer.close();
  tcpServer.close();
  await closeDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
