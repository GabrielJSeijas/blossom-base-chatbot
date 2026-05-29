import { MongoClient } from 'mongodb';

let client;
let database;

function getDatabaseName() {
	return String(process.env.MONGODB_DB_NAME || 'blossomlocal').trim();
}

function createClient(uri) {
	return new MongoClient(uri, {
		tls: true,
		serverSelectionTimeoutMS: 3000,
		autoSelectFamily: false,
	});
}

export async function connectMongo(uri) {
	if (!uri) {
		throw new Error('Falta la variable de entorno MONGODB_URI.');
	}

	if (database) {
		return database;
	}

	if (!client) {
		client = createClient(uri);
	}

	await client.connect();
	database = client.db(getDatabaseName());

	return database;
}

export function getDatabase() {
	if (!database) {
		throw new Error('MongoDB no está inicializado todavía.');
	}

	return database;
}

export function getConversationsCollection() {
	return getDatabase().collection('conversations');
}

export function getUsersCollection() {
	return getDatabase().collection('users');
}

export function getMessagesCollection() {
	return getDatabase().collection('messages');
}

export function getRiskAssessmentsCollection() {
	return getDatabase().collection('risk_assessments');
}

export function getRiskAlertsCollection() {
	return getDatabase().collection('risk_alerts');
}

export async function closeMongoConnection() {
	if (!client) {
		return;
	}

	await client.close();
	client = undefined;
	database = undefined;
}
