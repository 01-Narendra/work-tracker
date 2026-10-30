import path from 'path';
import { fileURLToPath } from 'url';
import { PORT, TZ } from './config/env.js';
import { connectDB } from './config/db.js';
import { app } from './app.js';
import { initCronJobs } from './services/cronService.js';

// Connect to MongoDB Atlas first
await connectDB();

// Initialize scheduled background jobs only after DB connection succeeds
initCronJobs();

// Start HTTP server if run directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Work tracker server running on port ${PORT} (${TZ})`);
  });
}

export { app };
export default app;
