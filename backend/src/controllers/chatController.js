import { ObjectId } from 'mongodb';
import { decryptMessage, encryptMessage } from '../crypto/messageCrypto.js';
import { getMessagesCollection } from '../db/mongoClient.js';
import { sendMessage } from '../llm/llmProvider.js';

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

		try {
			const reply = await sendMessage(normalizedMessage);
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

			res.json({ response: reply, conversationId: String(conversationId) });
		} catch (error) {
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
			});
		}
	} catch (error) {
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
		res.status(500).json({ error: error.message || 'No se pudo cargar el historial.' });
	}
}
