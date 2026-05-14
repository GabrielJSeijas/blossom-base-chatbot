import 'dotenv/config';
import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import chatRoutes from './routes/chat.js';

const app = express();
const port = Number(process.env.PORT) || 8000;
const uri = process.env.MONGODB_URI;

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

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/chat', chatRoutes);

async function main() {
  try {
    await client.connect();
    console.log('Connected to MongoDB successfully.');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('Revisa usuario, contraseña, permisos del usuario en Atlas y la allowlist de IP.');
    process.exitCode = 1;
    return;
  } finally {
    await client.close();
  }

  app.listen(port, () => {
    console.log(`Backend listo en http://localhost:${port}`);
  });
}

main().catch(error => {
  console.error('Unhandled rejection:', error);
  process.exitCode = 1;
});
