import { encryptMessage } from '../crypto/messageCrypto.js';
import { getConversationsCollection } from '../db/mongoClient.js';
import { sendMessage } from '../llm/llmProvider.js';

export async function chatController(req, res) {
	try {
		const { message } = req.body ?? {};
		const normalizedMessage = String(message ?? '').trim();
		const reply = await sendMessage(normalizedMessage);
		const storedMessage = encryptMessage(normalizedMessage);
		const storedReply = encryptMessage(reply);

		await getConversationsCollection().insertOne({
			message: storedMessage,
			reply: storedReply,
			createdAt: new Date(),
		});

		res.json({ response: reply });
	} catch (error) {
		res.status(500).json({ error: error.message || 'Error procesando el chat.' });
	}
}
