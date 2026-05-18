import { ObjectId } from 'mongodb';
import { encryptMessage } from '../crypto/messageCrypto.js';
import { getMessagesCollection } from '../db/mongoClient.js';
import { sendMessage } from '../llm/llmProvider.js';

export async function chatController(req, res) {
	try {
		const { message } = req.body ?? {};
		const incomingConversationId = String(req.body?.conversationId || '').trim();
		const normalizedMessage = String(message ?? '').trim();
		const userId = String(req.authUser?.sub || '').trim();

		if (!userId) {
			res.status(401).json({ error: 'Usuario no autenticado.' });
			return;
		}

		if (!ObjectId.isValid(userId)) {
			res.status(400).json({ error: 'Token inválido: userId no válido.' });
			return;
		}

		const conversationId =
			incomingConversationId && ObjectId.isValid(incomingConversationId)
				? new ObjectId(incomingConversationId)
				: new ObjectId();

		const reply = await sendMessage(normalizedMessage);
		const storedMessage = encryptMessage(normalizedMessage);
		const storedReply = encryptMessage(reply);
		const now = new Date();

		await getMessagesCollection().insertMany([
			{
				conversationId,
				userId: new ObjectId(userId),
				role: 'user',
				content: storedMessage,
				createdAt: now,
				updatedAt: now,
			},
			{
				conversationId,
				userId: new ObjectId(userId),
				role: 'assistant',
				content: storedReply,
				createdAt: now,
				updatedAt: now,
			},
		]);

		res.json({ response: reply, conversationId: String(conversationId) });
	} catch (error) {
		res.status(500).json({ error: error.message || 'Error procesando el chat.' });
	}
}
