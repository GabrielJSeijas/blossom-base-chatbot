import 'dotenv/config';
import { closeMongoConnection, connectMongo, getRiskAlertsCollection, getRiskAssessmentsCollection } from '../db/mongoClient.js';
import { encryptJson } from '../crypto/dataCrypto.js';

function hasEncryptedPayload(document) {
	return Boolean(document?.encryptedData?.ciphertext && document?.encryptedData?.iv && document?.encryptedData?.authTag);
}

function buildAssessmentPayload(document) {
	return {
		message: document.message || null,
		riskLevel: document.riskLevel || 'none',
		categories: Array.isArray(document.categories) ? document.categories : [],
		shouldAlert: Boolean(document.shouldAlert),
		urgency: document.urgency || 'none',
		confidence: Number(document.confidence || 0),
		summaryForModerator: document.summaryForModerator || '',
		recommendedBotMode: document.recommendedBotMode || 'normal',
	};
}

function buildAlertPayload(document) {
	return {
		riskLevel: document.riskLevel || 'none',
		urgency: document.urgency || 'none',
		categories: Array.isArray(document.categories) ? document.categories : [],
		summaryForModerator: document.summaryForModerator || '',
		triggeringMessage: document.triggeringMessage || null,
	};
}

async function migrateCollection(collection, collectionName, payloadBuilder, plaintextFields) {
	const documents = await collection.find({}).toArray();
	let migrated = 0;
	let skipped = 0;

	for (const document of documents) {
		if (hasEncryptedPayload(document)) {
			skipped += 1;
			continue;
		}

		const payload = payloadBuilder(document);
		const now = new Date();
		const encryptedData = encryptJson(payload);
		const unsetFields = Object.fromEntries(plaintextFields.map(field => [field, '']));

		await collection.updateOne(
			{ _id: document._id },
			{
				$set: {
					encryptedData,
					updatedAt: document.updatedAt || now,
				},
				$unset: unsetFields,
			}
		);

		migrated += 1;
	}

	console.log(`${collectionName}: migrados ${migrated}, omitidos ${skipped}, total ${documents.length}`);

	return { migrated, skipped, total: documents.length };
}

async function main() {
	const uri = process.env.MONGODB_URI;

	if (!uri) {
		throw new Error('Falta MONGODB_URI para ejecutar la migración.');
	}

	await connectMongo(uri);

	const assessments = await migrateCollection(
		getRiskAssessmentsCollection(),
		'risk_assessments',
		buildAssessmentPayload,
		['message', 'riskLevel', 'categories', 'shouldAlert', 'urgency', 'confidence', 'summaryForModerator', 'recommendedBotMode']
	);

	const alerts = await migrateCollection(
		getRiskAlertsCollection(),
		'risk_alerts',
		buildAlertPayload,
		['riskLevel', 'urgency', 'categories', 'summaryForModerator', 'triggeringMessage']
	);

	console.log('Migración completada correctamente.');
	console.log(JSON.stringify({ assessments, alerts }, null, 2));
}

main()
	.catch(error => {
		console.error('Error en la migración de riesgos:');
		console.error(error?.stack || error?.message || error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await closeMongoConnection();
	});