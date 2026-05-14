import 'dotenv/config';
import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import chatRoutes from './routes/chat.js';

const app = express();
const port = Number(process.env.PORT) || 8000;
const uri = process.env.MONGODB_URI;
const shouldLogStartup = process.env.SUPPRESS_STARTUP_LOGS !== 'true';
let server;

if (!uri) {
  console.error('Falta la variable de entorno MONGODB_URI.');
  process.exitCode = 1;
  process.exit();
}

const client = new MongoClient(uri, {
  tls: true,
  serverSelectionTimeoutMS: 3000,
  autoSelectFamily: false,
});

let dbConnected = false;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/chat', chatRoutes);

async function main() {
  try {
    try {
      await client.connect();
      dbConnected = true;
      if (shouldLogStartup) {
        console.log('Connected to MongoDB successfully.');
      }
    } catch (error) {
      console.error('MongoDB connection failed at startup:', error?.message || error);
      dbConnected = false;
    }
  } catch (error) {
    console.error('Unexpected error during startup:', error?.stack || error?.message || error);
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

  if (dbConnected) {
    try {
      await client.close();
      if (shouldLogStartup) console.log('MongoDB client cerrado correctamente.');
    } catch (err) {
      console.error('Error cerrando el cliente MongoDB:', err?.stack || err?.message || err);
    }
  }

  if (!server) {
    process.exit(process.exitCode ?? 0);
    return;
  }

  server.close(() => {
    process.exit(process.exitCode ?? 0);
  });
}

globalThis.__backendShutdown = shutdown;

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
