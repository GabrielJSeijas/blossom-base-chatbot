import { sendMessage } from '../llm/llmProvider.js';

export async function chatController(req, res) {
	try {
		const { message } = req.body ?? {};
		const reply = await sendMessage(message);

		res.json({ response: reply });
	} catch (error) {
		res.status(500).json({ error: error.message || 'Error procesando el chat.' });
	}
}
