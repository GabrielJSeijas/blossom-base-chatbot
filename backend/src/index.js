import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { validateMessageEncryptionConfig } from './crypto/messageCrypto.js';
import { closeMongoConnection, connectMongo } from './db/mongoClient.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';

const app = express();
const port = Number(process.env.PORT) || 8000;
const uri = process.env.MONGODB_URI;
const shouldLogStartup = process.env.SUPPRESS_STARTUP_LOGS !== 'true';
let server;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);

async function main() {
  try {
    validateMessageEncryptionConfig();
    await connectMongo(uri);
    if (shouldLogStartup) {
      console.log('Connected to MongoDB successfully.');
    }
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('Revisa usuario, contraseña, permisos del usuario en Atlas y la allowlist de IP.');
    process.exitCode = 1;
    return;
  }

  server = app.listen(port, () => {
    if (shouldLogStartup) {
      console.log(`Backend listo en http://localhost:${port}`);
      console.log('Backend en ejecucion. Presiona Ctrl+C para detenerlo.');
    }
  });

  process.stdin.resume();
}

main().catch(error => {
  console.error('Unhandled rejection:', error);
  process.exitCode = 1;
});

async function shutdown(signal) {
  if (shouldLogStartup) {
    console.log(`Recibido ${signal}, cerrando backend...`);
  }

  process.stdin.pause();

  if (!server) {
    await closeMongoConnection();
    process.exit(process.exitCode ?? 0);
    return;
  }

  server.close(() => {
    closeMongoConnection().finally(() => {
      process.exit(process.exitCode ?? 0);
    });
  });
}

globalThis.__backendShutdown = shutdown;

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
