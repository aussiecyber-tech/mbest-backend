import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import net from 'net';

const DB_PORT = 5432;
const DB_DIR = path.resolve(__dirname, '../data/db');

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

export async function ensureDatabase(): Promise<void> {
  const active = await isPortInUse(DB_PORT);
  if (active) {
    console.log(`[Database] PostgreSQL is already running and listening on port ${DB_PORT}.`);
    return;
  }

  console.log(`[Database] Starting Embedded PostgreSQL server on port ${DB_PORT}...`);
  try {
    const pg = new EmbeddedPostgres({
      databaseDir: DB_DIR,
      port: DB_PORT,
      user: 'postgres',
      password: 'password',
      authMethod: 'password',
      persistent: true,
    });

    await pg.initialise();
    await pg.start();
    console.log('[Database] PostgreSQL instance started successfully.');

    // Ensure mbest_db database exists
    try {
      await pg.createDatabase('mbest_db');
      console.log('[Database] Created database: mbest_db');
    } catch (dbErr: any) {
      if (dbErr?.message?.includes('already exists')) {
        console.log('[Database] Database mbest_db already exists.');
      } else {
        console.log('[Database] Database check notice:', dbErr?.message);
      }
    }
  } catch (err: any) {
    console.error('[Database] Failed to start embedded postgres:', err.message);
  }
}

if (require.main === module) {
  ensureDatabase().then(() => {
    console.log('[Database] Ready.');
  });
}
