import express from 'express';
import fs from 'fs';
import path from 'path';
import apiRoutes from './routes/index.js';
import { CLIENT_DIST_DIR } from './config/paths.js';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js';
import { sanitizeMongoInput } from './middleware/sanitize.js';

const app = express();

// CORS handling for separate frontend / backend deployment
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Body parser
app.use(express.json({ limit: '100kb' }));

// Input sanitization against MongoDB operator injection
app.use(sanitizeMongoInput);

// API routes
app.use('/api', apiRoutes);

// Explicit 404 for unknown api routes
app.all('/api/*', notFoundHandler);

// Serve React production build if available
app.use(express.static(CLIENT_DIST_DIR));
app.get('*', (_req, res) => {
  const indexHtml = path.join(CLIENT_DIST_DIR, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(503).send('Frontend build not found. Please build the client project.');
  }
});

// Centralized error handler
app.use(globalErrorHandler);

export { app };
export default app;
