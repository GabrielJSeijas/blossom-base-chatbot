import crypto from 'crypto';

const PASSWORD_HASH_VERSION = 'scrypt-v1';
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function getTokenSecret() {
	const secret = process.env.AUTH_TOKEN_SECRET || process.env.MESSAGE_ENC_KEY_V1;

	if (!secret) {
		throw new Error('Falta AUTH_TOKEN_SECRET o MESSAGE_ENC_KEY_V1 para firmar tokens.');
	}

	return secret;
}

export function hashPassword(plainPassword) {
	const password = String(plainPassword || '');

	if (password.length < 8) {
		throw new Error('La contraseña debe tener al menos 8 caracteres.');
	}

	const salt = crypto.randomBytes(16).toString('base64');
	const derivedKey = crypto.scryptSync(password, salt, 64).toString('base64');

	return `${PASSWORD_HASH_VERSION}$${salt}$${derivedKey}`;
}

export function verifyPassword(plainPassword, storedHash) {
	const password = String(plainPassword || '');
	const [version, salt, hash] = String(storedHash || '').split('$');

	if (version !== PASSWORD_HASH_VERSION || !salt || !hash) {
		return false;
	}

	const expectedHash = Buffer.from(hash, 'base64');
	const actualHash = crypto.scryptSync(password, salt, expectedHash.length);

	if (actualHash.length !== expectedHash.length) {
		return false;
	}

	return crypto.timingSafeEqual(actualHash, expectedHash);
}

function signPayload(payload) {
	return crypto
		.createHmac('sha256', getTokenSecret())
		.update(payload)
		.digest('base64url');
}

export function createAuthToken(user) {
	const nowSeconds = Math.floor(Date.now() / 1000);
	const body = {
		sub: String(user._id),
		email: normalizeEmail(user.email),
		role: user.role || 'user',
		iat: nowSeconds,
		exp: nowSeconds + TOKEN_MAX_AGE_SECONDS,
	};

	const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
	const signature = signPayload(payload);

	return `${payload}.${signature}`;
}

export function verifyAuthToken(token) {
	const [payload, signature] = String(token || '').split('.');

	if (!payload || !signature) {
		throw new Error('Token inválido.');
	}

	const expectedSignature = signPayload(payload);
	const expectedBuffer = Buffer.from(expectedSignature);
	const incomingBuffer = Buffer.from(signature);

	if (expectedBuffer.length !== incomingBuffer.length || !crypto.timingSafeEqual(expectedBuffer, incomingBuffer)) {
		throw new Error('Token inválido.');
	}

	const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
	const nowSeconds = Math.floor(Date.now() / 1000);

	if (!decoded?.sub || !decoded?.exp || decoded.exp < nowSeconds) {
		throw new Error('Token expirado o inválido.');
	}

	return decoded;
}

export function sanitizeUser(user) {
	return {
		id: String(user._id),
		email: user.email,
		username: user.username || null,
		displayName: user.displayName || null,
		role: user.role,
		status: user.status,
	};
}

export function normalizeUserInput(payload) {
	const email = normalizeEmail(payload?.email);
	const password = String(payload?.password || '');
	const usernameValue = String(payload?.username || '').trim();
	const displayNameValue = String(payload?.displayName || '').trim();

	if (!email || !email.includes('@')) {
		throw new Error('Email inválido.');
	}

	if (!password) {
		throw new Error('La contraseña es requerida.');
	}

	return {
		email,
		password,
		username: usernameValue || null,
		displayName: displayNameValue || null,
	};
}