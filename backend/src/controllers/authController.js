import { ObjectId } from 'mongodb';
import {
	createAuthToken,
	hashPassword,
	normalizeUserInput,
	sanitizeUser,
	verifyPassword,
} from '../auth/authService.js';
import { getUsersCollection } from '../db/mongoClient.js';

function getNow() {
	return new Date();
}

export async function registerController(req, res) {
	try {
		const { email, password, username, displayName } = normalizeUserInput(req.body ?? {});
		const usersCollection = getUsersCollection();
		const existingUser = await usersCollection.findOne({ email });

		if (existingUser) {
			res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
			return;
		}

		const now = getNow();
		const newUser = {
			_id: new ObjectId(),
			email,
			username,
			displayName,
			passwordHash: hashPassword(password),
			role: 'user',
			status: 'active',
			avatarUrl: null,
			lastSeenAt: now,
			createdAt: now,
			updatedAt: now,
		};

		await usersCollection.insertOne(newUser);

		res.status(201).json({
			user: sanitizeUser(newUser),
			token: createAuthToken(newUser),
		});
	} catch (error) {
		res.status(400).json({ error: error.message || 'No se pudo registrar el usuario.' });
	}
}

export async function loginController(req, res) {
	try {
		const { email, password } = normalizeUserInput(req.body ?? {});
		const usersCollection = getUsersCollection();
		const user = await usersCollection.findOne({ email });

		if (!user || !verifyPassword(password, user.passwordHash)) {
			res.status(401).json({ error: 'Credenciales inválidas.' });
			return;
		}

		if (user.status !== 'active') {
			res.status(403).json({ error: 'El usuario no está activo.' });
			return;
		}

		await usersCollection.updateOne(
			{ _id: user._id },
			{ $set: { lastSeenAt: getNow(), updatedAt: getNow() } }
		);

		res.json({
			user: sanitizeUser(user),
			token: createAuthToken(user),
		});
	} catch (error) {
		res.status(400).json({ error: error.message || 'No se pudo iniciar sesión.' });
	}
}