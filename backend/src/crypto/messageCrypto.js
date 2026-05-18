import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_VERSION = 'v1';
const IV_LENGTH = 12;

function getKeyFromEnv() {
	const envName = `MESSAGE_ENC_KEY_${KEY_VERSION.toUpperCase()}`;
	const keyValue = process.env[envName];

	if (!keyValue) {
		throw new Error(`Falta la variable de entorno ${envName}.`);
	}

	const key = Buffer.from(keyValue, 'base64');

	if (key.length !== 32) {
		throw new Error(`La clave ${envName} debe decodificar exactamente 32 bytes.`);
	}

	return key;
}

export function validateMessageEncryptionConfig() {
	getKeyFromEnv();
}

function normalizePlainText(value) {
	return String(value ?? '').trim();
}

export function encryptMessage(plainText) {
	const normalizedText = normalizePlainText(plainText);

	if (!normalizedText) {
		throw new Error('El contenido a cifrar es requerido.');
	}

	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, getKeyFromEnv(), iv);
	const encryptedText = Buffer.concat([cipher.update(normalizedText, 'utf8'), cipher.final()]);

	return {
		ciphertext: encryptedText.toString('base64'),
		iv: iv.toString('base64'),
		authTag: cipher.getAuthTag().toString('base64'),
		keyVersion: KEY_VERSION,
	};
}

export function decryptMessage(payload) {
	const { ciphertext, iv, authTag, keyVersion } = payload ?? {};

	if (keyVersion !== KEY_VERSION) {
		throw new Error('La versión de la clave no está soportada.');
	}

	if (!ciphertext || !iv || !authTag) {
		throw new Error('El payload cifrado está incompleto.');
	}

	const decipher = crypto.createDecipheriv(ALGORITHM, getKeyFromEnv(), Buffer.from(iv, 'base64'));
	decipher.setAuthTag(Buffer.from(authTag, 'base64'));

	const decryptedText = Buffer.concat([
		decipher.update(Buffer.from(ciphertext, 'base64')),
		decipher.final(),
	]);

	return decryptedText.toString('utf8');
}