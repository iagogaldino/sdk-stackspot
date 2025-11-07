import fs from 'fs/promises';
import path from 'path';

export type LogLevel = 'info' | 'warn' | 'error';

const LOG_FILE_PATH = process.env.STACKSPOT_SDK_LOG_FILE
  ? path.resolve(process.env.STACKSPOT_SDK_LOG_FILE)
  : path.resolve(process.cwd(), 'stackspot-sdk-log.json');

let logEntries: Array<Record<string, any>> = [];
let initialized = false;
let logQueue = Promise.resolve();

async function ensureInitialized() {
  if (initialized) return;
  try {
    const existing = await fs.readFile(LOG_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(existing);
    logEntries = Array.isArray(parsed) ? parsed : [];
  } catch {
    logEntries = [];
  }
  initialized = true;
}

function enqueue(level: LogLevel, message: string, meta?: Record<string, any>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };

  logQueue = logQueue
    .then(async () => {
      await ensureInitialized();
      logEntries.push(entry);
      await fs.mkdir(path.dirname(LOG_FILE_PATH), { recursive: true });
      await fs.writeFile(LOG_FILE_PATH, JSON.stringify(logEntries, null, 2), 'utf-8');
    })
    .catch(() => {
      // Falhas de log não devem interromper o fluxo do SDK.
    });
}

export const sdkLogger = {
  info(message: string, meta?: Record<string, any>) {
    enqueue('info', message, meta);
  },
  warn(message: string, meta?: Record<string, any>) {
    enqueue('warn', message, meta);
  },
  error(message: string, meta?: Record<string, any>) {
    enqueue('error', message, meta);
  },
};
