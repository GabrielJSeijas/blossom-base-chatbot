import { ObjectId } from 'mongodb';
import { decryptJson, encryptJson } from '../crypto/dataCrypto.js';
import { decryptMessage, encryptMessage } from '../crypto/messageCrypto.js';
import {
	getConversationsCollection,
	getMessagesCollection,
	getRiskAlertsCollection,
	getRiskAssessmentsCollection,
	getUsersCollection,
} from '../db/mongoClient.js';
import { classifyRisk } from '../llm/riskClassifier.js';
import { sendMessage } from '../llm/llmProvider.js';

const MAX_LLM_CONTEXT_MESSAGES = 8;
const SUMMARY_MAX_BULLETS = 6;
const SUMMARY_REBUILD_EVERY_MESSAGES = Number(process.env.CONVERSATION_SUMMARY_REBUILD_EVERY || 8);
const RISK_DECAY_HOLD_MESSAGES = Number(process.env.RISK_DECAY_HOLD_MESSAGES || 5);
const RISK_DECAY_STEP_MESSAGES = Number(process.env.RISK_DECAY_STEP_MESSAGES || 5);
const RISK_DECAY_LOOKBACK_MESSAGES = Number(process.env.RISK_DECAY_LOOKBACK_MESSAGES || 40);
const RISK_LEVEL_SCORES = {
	none: 0,
	low: 1,
	medium: 2,
	high: 3,
	critical: 4,
};

function normalizeTextSnippet(text, maxLength = 140) {
	return String(text || '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength);
}

function getRiskLevelScore(level) {
	return RISK_LEVEL_SCORES[String(level || '').trim().toLowerCase()] ?? 0;
}

function scoreToRiskLevel(score) {
	if (score >= 4) {
		return 'critical';
	}

	if (score === 3) {
		return 'high';
	}

	if (score === 2) {
		return 'medium';
	}

	if (score === 1) {
		return 'low';
	}

	return 'none';
}

function normalizeUrgencyValue(value) {
	const normalizedValue = String(value || '').trim().toLowerCase();
	const allowed = new Set(['none', 'routine', 'soon', 'immediate']);

	return allowed.has(normalizedValue) ? normalizedValue : 'none';
}

function getUrgencyScore(urgency) {
	const scores = {
		none: 0,
		routine: 1,
		soon: 2,
		immediate: 3,
	};

	return scores[normalizeUrgencyValue(urgency)] ?? 0;
}

function maxUrgency(a, b) {
	return getUrgencyScore(a) >= getUrgencyScore(b) ? normalizeUrgencyValue(a) : normalizeUrgencyValue(b);
}

function getMinimumUrgencyForRiskLevel(level) {
	if (level === 'critical') {
		return 'immediate';
	}

	if (level === 'high') {
		return 'soon';
	}

	if (level === 'medium') {
		return 'soon';
	}

	if (level === 'low') {
		return 'routine';
	}

	return 'none';
}

function normalizeRiskAssessmentShape(riskAssessment) {
	return {
		risk_level: scoreToRiskLevel(getRiskLevelScore(riskAssessment?.risk_level)),
		categories: Array.isArray(riskAssessment?.categories)
			? riskAssessment.categories.map(item => String(item || '').trim()).filter(Boolean).slice(0, 12)
			: [],
		should_alert: Boolean(riskAssessment?.should_alert),
		urgency: normalizeUrgencyValue(riskAssessment?.urgency),
		confidence: Number.isFinite(Number(riskAssessment?.confidence)) ? Number(riskAssessment.confidence) : 0,
		summary_for_moderator: String(riskAssessment?.summary_for_moderator || '').trim(),
		recommended_bot_mode: String(riskAssessment?.recommended_bot_mode || 'normal').trim().toLowerCase(),
	};
}

function buildConversationSummaryFromMessages(messages) {
	if (!Array.isArray(messages) || messages.length === 0) {
		return '';
	}

	const userSnippets = [];
	const assistantSnippets = [];

	for (const messageDocument of messages) {
		const content = normalizeTextSnippet(decryptMessage(messageDocument.content));

		if (!content) {
			continue;
		}

		if (messageDocument.role === 'assistant') {
			assistantSnippets.push(content);
		} else {
			userSnippets.push(content);
		}
	}

	if (userSnippets.length === 0 && assistantSnippets.length === 0) {
		return '';
	}

	const summaryLines = [];
	const latestUserSnippets = userSnippets.slice(-SUMMARY_MAX_BULLETS);
	const latestAssistantSnippets = assistantSnippets.slice(-3);

	if (latestUserSnippets.length > 0) {
		summaryLines.push('Temas recientes del usuario:');
		for (const snippet of latestUserSnippets) {
			summaryLines.push(`- ${snippet}`);
		}
	}

	if (latestAssistantSnippets.length > 0) {
		summaryLines.push('Apoyo previo del asistente:');
		for (const snippet of latestAssistantSnippets) {
			summaryLines.push(`- ${snippet}`);
		}
	}

	return summaryLines.join('\n').slice(0, 1200);
}

function formatConversationSummaryDocument(document) {
	if (!document) {
		return {
			summaryText: '',
			summaryMessageCount: 0,
		};
	}

	const summaryData = document.encryptedData ? decryptJson(document.encryptedData) : document;

	return {
		summaryText: String(summaryData.summaryText || '').trim(),
		summaryMessageCount: Number(summaryData.summaryMessageCount || 0),
	};
}

async function getConversationSummaryState(conversationId, userObjectId) {
	const conversationsCollection = getConversationsCollection();
	const conversationDocument = await conversationsCollection.findOne({
		_id: conversationId,
		userId: userObjectId,
	});

	return formatConversationSummaryDocument(conversationDocument);
}

async function saveConversationSummary({ conversationId, userObjectId, summaryText, summaryMessageCount }) {
	const conversationsCollection = getConversationsCollection();
	const now = new Date();

	await conversationsCollection.updateOne(
		{ _id: conversationId, userId: userObjectId },
		{
			$set: {
				userId: userObjectId,
				encryptedData: encryptJson({
					summaryText,
					summaryMessageCount,
				}),
				updatedAt: now,
			},
			$setOnInsert: {
				createdAt: now,
			},
		},
		{ upsert: true }
	);
}

async function getRecentRiskAssessmentsForUser(userObjectId) {
	const riskAssessmentsCollection = getRiskAssessmentsCollection();

	return riskAssessmentsCollection
		.find({ userId: userObjectId })
		.sort({ createdAt: -1, _id: -1 })
		.limit(Math.max(RISK_DECAY_LOOKBACK_MESSAGES, 1))
		.toArray();
}

function countStableMessagesForDecay(previousRiskAssessments, anchorScore) {
	if (!Array.isArray(previousRiskAssessments) || previousRiskAssessments.length < 2) {
		return 0;
	}

	let stableCount = 0;

	for (let index = 1; index < previousRiskAssessments.length; index += 1) {
		const assessment = previousRiskAssessments[index];
		const score = getRiskLevelScore(assessment?.riskLevel);

		if (score >= anchorScore) {
			break;
		}

		stableCount += 1;
	}

	return stableCount;
}

function applyRiskCooldown(riskAssessment, previousRiskAssessments) {
	const current = normalizeRiskAssessmentShape(riskAssessment);
	const previousRiskAssessment = Array.isArray(previousRiskAssessments) ? previousRiskAssessments[0] : null;

	if (!previousRiskAssessment) {
		return current;
	}

	const previousLevel = String(previousRiskAssessment.riskLevel || 'none').toLowerCase();
	const previousLevelScore = getRiskLevelScore(previousLevel);
	const incomingLevelScore = getRiskLevelScore(current.risk_level);

	if (incomingLevelScore >= previousLevelScore || previousLevelScore < getRiskLevelScore('high')) {
		return current;
	}

	const stableMessagesBeforeCurrent = countStableMessagesForDecay(previousRiskAssessments, previousLevelScore);
	const stableMessagesIncludingCurrent = stableMessagesBeforeCurrent + 1;
	let maxDrop = 0;

	if (stableMessagesIncludingCurrent > RISK_DECAY_HOLD_MESSAGES) {
		const messagesAfterHold = stableMessagesIncludingCurrent - RISK_DECAY_HOLD_MESSAGES;
		maxDrop = 1 + Math.floor((messagesAfterHold - 1) / Math.max(RISK_DECAY_STEP_MESSAGES, 1));
	}

	const allowedScore = Math.max(previousLevelScore - maxDrop, incomingLevelScore);

	if (allowedScore === incomingLevelScore) {
		return current;
	}

	const adjustedLevel = scoreToRiskLevel(allowedScore);
	const adjustedUrgency = maxUrgency(current.urgency, getMinimumUrgencyForRiskLevel(adjustedLevel));
	const mergedCategories = Array.from(
		new Set([...(previousRiskAssessment.categories || []), ...(current.categories || [])])
	).slice(0, 12);

	return {
		...current,
		risk_level: adjustedLevel,
		urgency: adjustedUrgency,
		should_alert: getRiskLevelScore(adjustedLevel) >= getRiskLevelScore('medium'),
		categories: mergedCategories,
		recommended_bot_mode:
			getRiskLevelScore(adjustedLevel) >= getRiskLevelScore('high')
				? 'crisis'
				: getRiskLevelScore(adjustedLevel) >= getRiskLevelScore('low')
					? 'supportive'
					: 'normal',
		summary_for_moderator: [
			current.summary_for_moderator,
			`Se mantiene vigilancia por antecedente reciente de riesgo ${previousLevel}.`,
		]
			.filter(Boolean)
			.join(' ')
			.trim(),
	};
}

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

	const riskData = document.encryptedData ? decryptJson(document.encryptedData) : document;

	return {
		id: document._id ? String(document._id) : null,
		userId: document.userId ? String(document.userId) : null,
		conversationId: document.conversationId ? String(document.conversationId) : null,
		message: riskData.message || null,
		riskLevel: riskData.riskLevel || 'none',
		categories: Array.isArray(riskData.categories) ? riskData.categories : [],
		shouldAlert: Boolean(riskData.shouldAlert),
		urgency: riskData.urgency || 'none',
		confidence: Number(riskData.confidence || 0),
		summaryForModerator: riskData.summaryForModerator || '',
		recommendedBotMode: riskData.recommendedBotMode || 'normal',
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
	const riskPayload = {
		message,
		riskLevel: riskAssessment.risk_level,
		categories: riskAssessment.categories,
		shouldAlert: riskAssessment.should_alert,
		urgency: riskAssessment.urgency,
		confidence: riskAssessment.confidence,
		summaryForModerator: riskAssessment.summary_for_moderator,
		recommendedBotMode: riskAssessment.recommended_bot_mode,
	};
	const now = new Date();

	const assessmentDocument = {
		userId: userObjectId,
		conversationId,
		encryptedData: encryptJson(riskPayload),
		createdAt: now,
		updatedAt: now,
	};

	await riskAssessmentsCollection.insertOne(assessmentDocument);

	if (shouldCreateRiskAlert(riskAssessment)) {
		const riskAlertsCollection = getRiskAlertsCollection();
		const alertPayload = {
			riskLevel: riskAssessment.risk_level,
			urgency: riskAssessment.urgency,
			categories: riskAssessment.categories,
			summaryForModerator: riskAssessment.summary_for_moderator,
			triggeringMessage: message,
		};

		await riskAlertsCollection.insertOne({
			userId: userObjectId,
			conversationId,
			encryptedData: encryptJson(alertPayload),
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
		const olderMessages = storedConversationMessages.slice(0, -MAX_LLM_CONTEXT_MESSAGES);
		let { summaryText, summaryMessageCount } = await getConversationSummaryState(conversationId, userObjectId);

		if (olderMessages.length > 0) {
			const shouldRebuildSummary =
				!summaryText ||
				storedConversationMessages.length - summaryMessageCount >= SUMMARY_REBUILD_EVERY_MESSAGES;

			if (shouldRebuildSummary) {
				summaryText = buildConversationSummaryFromMessages(olderMessages);
				summaryMessageCount = storedConversationMessages.length;

				await saveConversationSummary({
					conversationId,
					userObjectId,
					summaryText,
					summaryMessageCount,
				});
			}
		}

		const conversationHistory = storedConversationMessages.slice(-MAX_LLM_CONTEXT_MESSAGES).map(messageDocument => ({
			role: messageDocument.role,
			content: decryptMessage(messageDocument.content),
		}));

		if (summaryText) {
			conversationHistory.unshift({
				role: 'assistant',
				content: `Resumen contextual previo: ${summaryText}`,
			});
		}

		const previousRiskDocuments = await getRecentRiskAssessmentsForUser(userObjectId);
		const previousRiskAssessments = previousRiskDocuments
			.map(document => formatRiskAssessmentDocument(document))
			.filter(Boolean);

		let riskAssessment = null;
		let savedRiskAssessment = null;

		try {
			riskAssessment = await classifyRisk(normalizedMessage, conversationHistory);
			riskAssessment = applyRiskCooldown(riskAssessment, previousRiskAssessments);
			savedRiskAssessment = await saveRiskAssessment({
				userObjectId,
				conversationId,
				message: normalizedMessage,
				riskAssessment,
			});
		} catch (error) {
			console.error('[RISK] No se pudo clasificar o guardar el riesgo:', error?.message || error);
			riskAssessment = applyRiskCooldown(
				{
					risk_level: 'none',
					categories: [],
					should_alert: false,
					urgency: 'none',
					confidence: 0,
					summary_for_moderator: 'No disponible por error interno.',
					recommended_bot_mode: 'normal',
				},
				previousRiskAssessments
			);
			savedRiskAssessment = {
				_id: null,
				userId: userObjectId,
				conversationId,
				encryptedData: encryptJson({
					message: normalizedMessage,
					riskLevel: riskAssessment.risk_level,
					categories: riskAssessment.categories,
					shouldAlert: riskAssessment.should_alert,
					urgency: riskAssessment.urgency,
					confidence: riskAssessment.confidence,
					summaryForModerator: riskAssessment.summary_for_moderator,
					recommendedBotMode: riskAssessment.recommended_bot_mode,
				}),
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

		const alerts = groupedRisks.map(item => {
			const formattedRisk = formatRiskAssessmentDocument(item.risk);

			return {
				userId: item.userId ? String(item.userId) : null,
				userLabel: formatUserLabel(item.user, item.userId),
				riskLevel: formattedRisk?.riskLevel || 'none',
				urgency: formattedRisk?.urgency || 'none',
				categories: Array.isArray(formattedRisk?.categories) ? formattedRisk.categories : [],
				shouldAlert: Boolean(formattedRisk?.shouldAlert),
				summaryForModerator: formattedRisk?.summaryForModerator || '',
				recommendedBotMode: formattedRisk?.recommendedBotMode || 'normal',
			};
		});

		res.json({
			count: alerts.length,
			alerts,
		});
	} catch (error) {
		console.error('[RISK] Error cargando el último riesgo:', error?.message || error);
		res.status(500).json({ error: error.message || 'No se pudo cargar el riesgo.' });
	}
}
