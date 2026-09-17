import { createApp } from './app.js';
import { parseHttpPort, parseJwtConfig } from './config/jwt.js';
import { closeApplicationPool } from './database/pool.js';

const jwtConfig = parseJwtConfig();
const port = parseHttpPort();
const app = createApp({ jwtConfig });

const server = app.listen(port, () => {
  console.log(`EMS API listening on port ${port}`);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down`);

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    try {
      if (error) throw error;
      await closeApplicationPool();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (shutdownError: unknown) {
      console.error(
        'Shutdown failed:',
        shutdownError instanceof Error ? shutdownError.message : 'Unknown error',
      );
      process.exit(1);
    }
  });
}

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
