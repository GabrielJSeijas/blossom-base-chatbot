import 'dotenv/config';
import { MongoClient } from 'mongodb';

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


async function main() {
  try {
    await client.connect();
    console.log("Connected to MongoDB successfully.");
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error('MongoDB connection failed:', error.message);
  console.error('Revisa usuario, contraseÃ±a, permisos del usuario en Atlas y la allowlist de IP.');
  process.exitCode = 1;
});