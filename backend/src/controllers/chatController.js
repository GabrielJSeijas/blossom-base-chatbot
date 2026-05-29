import { ObjectId } from 'mongodb';
import { decryptMessage, encryptMessage } from '../crypto/messageCrypto.js';
import { getMessagesCollection, getRiskAlertsCollection, getRiskAssessmentsCollection, getUsersCollection } from '../db/mongoClient.js';
import { classifyRisk } from '../llm/riskClassifier.js';
import { sendMessage } from '../llm/llmProvider.js';

const MAX_LLM_CONTEXT_MESSAGES = 20;

function parseUserId(res, userId) {
	if (!userId) {
		res.status(401).json({ error: 'Usuario no autenticado.' });
		return null;
	}

	if (!ObjectId.isValid(userId)) {
		res.status(400).json({ error: 'Token inválido: userId no válido.' });
		return null;
	}

	return new ObjectId(userId);
}

function formatMessageDocument(messageDocument) {
	return {
		id: String(messageDocument._id),
		conversationId: String(messageDocument.conversationId),
		sender: messageDocument.role === 'assistant' ? 'bot' : 'user',
		text: decryptMessage(messageDocument.content),
		createdAt: messageDocument.createdAt,
	};
}

function getAssistantFallbackMessage(error) {
	if (error?.response?.status === 429) {
		return 'La IA está ocupada en este momento. Tu mensaje quedó guardado; intenta responder de nuevo en unos minutos.';
	}

	return 'No pudimos generar una respuesta en este momento. Tu mensaje quedó guardado.';
}

function getErrorStatus(error) {
	if (error?.response?.status === 429) {
		return 429;
	}

	return 503;
}

function formatRiskAssessmentDocument(document) {
	if (!document) {
		return null;
	}

	return {
		id: document._id ? String(document._id) : null,
		userId: document.userId ? String(document.userId) : null,
		conversationId: document.conversationId ? String(document.conversationId) : null,
		message: document.message || null,
		riskLevel: document.riskLevel || 'none',
		categories: Array.isArray(document.categories) ? document.categories : [],
		shouldAlert: Boolean(document.shouldAlert),
		urgency: document.urgency || 'none',
		confidence: Number(document.confidence || 0),
		summaryForModerator: document.summaryForModerator || '',
		recommendedBotMode: document.recommendedBotMode || 'normal',
		createdAt: document.createdAt || null,
		updatedAt: document.updatedAt || null,
	};
}

function formatUserLabel(userDocument, fallbackId) {
	if (!userDocument) {
		return `Usuario ${String(fallbackId).slice(-6)}`;
	}

	return userDocument.displayName || userDocument.username || userDocument.email || `Usuario ${String(fallbackId).slice(-6)}`;
}

function shouldCreateRiskAlert(riskAssessment) {
	return ['high', 'critical'].includes(riskAssessment?.risk_level) || Boolean(riskAssessment?.should_alert);
}

async function saveRiskAssessment({ userObjectId, conversationId, message, riskAssessment }) {
	const riskAssessmentsCollection = getRiskAssessmentsCollection();
	const now = new Date();

	const assessmentDocument = {
		userId: userObjectId,
		conversationId,
		message,
		riskLevel: riskAssessment.risk_level,
		categories: riskAssessment.categories,
		shouldAlert: riskAssessment.should_alert,
		urgency: riskAssessment.urgency,
		confidence: riskAssessment.confidence,
		summaryForModerator: riskAssessment.summary_for_moderator,
		recommendedBotMode: riskAssessment.recommended_bot_mode,
		createdAt: now,
		updatedAt: now,
	};

	await riskAssessmentsCollection.insertOne(assessmentDocument);

	if (shouldCreateRiskAlert(riskAssessment)) {
		const riskAlertsCollection = getRiskAlertsCollection();

		await riskAlertsCollection.insertOne({
			userId: userObjectId,
			conversationId,
			riskLevel: riskAssessment.risk_level,
			urgency: riskAssessment.urgency,
			categories: riskAssessment.categories,
			summaryForModerator: riskAssessment.summary_for_moderator,
			triggeringMessage: message,
			status: 'open',
			assignedTo: null,
			createdAt: now,
			updatedAt: now,
		});
	}

	return assessmentDocument;
}

export async function chatController(req, res) {
	try {
		const { message } = req.body ?? {};
		const incomingConversationId = String(req.body?.conversationId || '').trim();
		const normalizedMessage = String(message ?? '').trim();
		const userId = String(req.authUser?.sub || '').trim();

		if (!normalizedMessage) {
			res.status(400).json({ error: 'El mensaje es requerido.' });
			return;
		}

		const userObjectId = parseUserId(res, userId);

		if (!userObjectId) {
			return;
		}

		const conversationId =
			incomingConversationId && ObjectId.isValid(incomingConversationId)
				? new ObjectId(incomingConversationId)
				: new ObjectId();
		const messagesCollection = getMessagesCollection();
		const now = new Date();
		const storedMessage = encryptMessage(normalizedMessage);

		await messagesCollection.insertOne({
			conversationId,
			userId: userObjectId,
			role: 'user',
			content: storedMessage,
			createdAt: now,
			updatedAt: now,
		});

		const storedConversationMessages = await messagesCollection
			.find({ conversationId, userId: userObjectId })
			.sort({ createdAt: 1, _id: 1 })
			.toArray();

		const conversationHistory = storedConversationMessages.slice(-MAX_LLM_CONTEXT_MESSAGES).map(messageDocument => ({
			role: messageDocument.role,
			content: decryptMessage(messageDocument.content),
		}));

		let riskAssessment = null;
		let savedRiskAssessment = null;

		try {
			riskAssessment = await classifyRisk(normalizedMessage, conversationHistory);
			savedRiskAssessment = await saveRiskAssessment({
				userObjectId,
				conversationId,
				message: normalizedMessage,
				riskAssessment,
			});
		} catch (error) {
			console.error('[RISK] No se pudo clasificar o guardar el riesgo:', error?.message || error);
			riskAssessment = {
				risk_level: 'none',
				categories: [],
				should_alert: false,
				urgency: 'none',
				confidence: 0,
				summary_for_moderator: 'No disponible por error interno.',
				recommended_bot_mode: 'normal',
			};
			savedRiskAssessment = {
				_id: null,
				userId: userObjectId,
				conversationId,
				message: normalizedMessage,
				riskLevel: riskAssessment.risk_level,
				categories: riskAssessment.categories,
				shouldAlert: riskAssessment.should_alert,
				urgency: riskAssessment.urgency,
				confidence: riskAssessment.confidence,
				summaryForModerator: riskAssessment.summary_for_moderator,
				recommendedBotMode: riskAssessment.recommended_bot_mode,
				createdAt: null,
				updatedAt: null,
			};
		}

		const formattedRiskAssessment = formatRiskAssessmentDocument(savedRiskAssessment);

		try {
			const reply = await sendMessage(normalizedMessage, { history: conversationHistory });
			const storedReply = encryptMessage(reply);
			const replyNow = new Date();

			await messagesCollection.insertOne({
				conversationId,
				userId: userObjectId,
				role: 'assistant',
				content: storedReply,
				createdAt: replyNow,
				updatedAt: replyNow,
			});

			res.json({
				response: reply,
				conversationId: String(conversationId),
				risk: formattedRiskAssessment,
			});
		} catch (error) {
			console.error('[CHAT] Error generando respuesta:', error?.message || error);
			const fallbackReply = getAssistantFallbackMessage(error);
			const fallbackNow = new Date();

			await messagesCollection.insertOne({
				conversationId,
				userId: userObjectId,
				role: 'assistant',
				content: encryptMessage(fallbackReply),
				createdAt: fallbackNow,
				updatedAt: fallbackNow,
			});

			res.status(getErrorStatus(error)).json({
				error: error?.message || fallbackReply,
				conversationId: String(conversationId),
				risk: formattedRiskAssessment,
			});
		}
	} catch (error) {
		console.error('[CHAT] Error inesperado en chatController:', error?.message || error);
		res.status(500).json({ error: error.message || 'Error procesando el chat.' });
	}
}

export async function getChatHistoryController(req, res) {
	try {
		const userId = String(req.authUser?.sub || '').trim();
		const userObjectId = parseUserId(res, userId);

		if (!userObjectId) {
			return;
		}
		const messagesCollection = getMessagesCollection();

		const storedMessages = await messagesCollection
			.find({ userId: userObjectId })
			.sort({ createdAt: 1, _id: 1 })
			.toArray();

		const messages = storedMessages.map(formatMessageDocument);
		const latestConversationId =
			messages.length > 0 ? messages[messages.length - 1].conversationId : null;

		res.json({ messages, latestConversationId });
	} catch (error) {
		console.error('[CHAT] Error cargando historial:', error?.message || error);
		res.status(500).json({ error: error.message || 'No se pudo cargar el historial.' });
	}
}

export async function getLatestRiskAssessmentController(req, res) {
	try {
		const userIdFilter = String(req.query?.userId || '').trim();
		const riskAssessmentsCollection = getRiskAssessmentsCollection();
		const usersCollection = getUsersCollection();

		const pipeline = [
			{ $sort: { createdAt: -1, _id: -1 } },
			{
				$group: {
					_id: '$userId',
					latest: { $first: '$$ROOT' },
				},
			},
			{
				$lookup: {
					from: usersCollection.collectionName,
					localField: '_id',
					foreignField: '_id',
					as: 'user',
				},
			},
			{ $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
			{
				$project: {
					userId: '$_id',
					user: 1,
					risk: '$latest',
				},
			},
		];

		if (userIdFilter && ObjectId.isValid(userIdFilter)) {
			pipeline.unshift({ $match: { userId: new ObjectId(userIdFilter) } });
		}

		const groupedRisks = await riskAssessmentsCollection.aggregate(pipeline).toArray();

		const alerts = groupedRisks.map(item => ({
			userId: item.userId ? String(item.userId) : null,
			userLabel: formatUserLabel(item.user, item.userId),
			riskLevel: item.risk?.riskLevel || 'none',
			urgency: item.risk?.urgency || 'none',
			categories: Array.isArray(item.risk?.categories) ? item.risk.categories : [],
			shouldAlert: Boolean(item.risk?.shouldAlert),
			summaryForModerator: item.risk?.summaryForModerator || '',
			recommendedBotMode: item.risk?.recommendedBotMode || 'normal',
			risk: formatRiskAssessmentDocument(item.risk),
		}));

		res.json({
			count: alerts.length,
			alerts,
		});
	} catch (error) {
		console.error('[RISK] Error cargando el último riesgo:', error?.message || error);
		res.status(500).json({ error: error.message || 'No se pudo cargar el riesgo.' });
	}
}
