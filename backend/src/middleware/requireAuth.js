import { verifyAuthToken } from '../auth/authService.js';

function extractBearerToken(headerValue) {
	const value = String(headerValue || '').trim();

	if (!value.toLowerCase().startsWith('bearer ')) {
		return null;
	}

	return value.slice(7).trim();
}

export function requireAuth(req, res, next) {
	try {
		const token = extractBearerToken(req.headers.authorization);

		if (!token) {
			res.status(401).json({ error: 'Falta token de autenticación.' });
			return;
		}

		req.authUser = verifyAuthToken(token);
		next();
	} catch (error) {
		res.status(401).json({ error: error.message || 'No autorizado.' });
	}
}