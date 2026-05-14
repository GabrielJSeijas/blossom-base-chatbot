import axios from 'axios';

const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-latest';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

function normalizeProvider(value) {
	return (value || '').trim().toLowerCase();
}

function extractAnthropicText(data) {
	return Array.isArray(data?.content)
		? data.content
				.filter(part => part && part.type === 'text' && typeof part.text === 'string')
				.map(part => part.text)
				.join('')
		: '';
}

export async function sendMessage(text) {
	const message = String(text || '').trim();

	if (!message) {
		throw new Error('El mensaje es requerido.');
	}

	const provider = normalizeProvider(process.env.LLM_PROVIDER);

	if (provider === 'anthropic') {
		const apiKey = process.env.ANTHROPIC_API_KEY;

		if (!apiKey) {
			throw new Error('Falta la variable de entorno ANTHROPIC_API_KEY.');
		}

		const response = await axios.post(
			'https://api.anthropic.com/v1/messages',
			{
				model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
				max_tokens: 512,
				messages: [{ role: 'user', content: message }],
			},
			{
				headers: {
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
					'content-type': 'application/json',
				},
			}
		);

		const reply = extractAnthropicText(response.data);

		if (!reply) {
			throw new Error('Anthropic no devolvió texto.');
		}

		return reply;
	}

	if (provider === 'openai') {
		const apiKey = process.env.OPENAI_API_KEY;

		if (!apiKey) {
			throw new Error('Falta la variable de entorno OPENAI_API_KEY.');
		}

		const response = await axios.post(
			'https://api.openai.com/v1/chat/completions',
			{
				model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
				messages: [{ role: 'user', content: message }],
			},
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'content-type': 'application/json',
				},
			}
		);

		const reply = response.data?.choices?.[0]?.message?.content?.trim();

		if (!reply) {
			throw new Error('OpenAI no devolvió texto.');
		}

		return reply;
	}

	throw new Error('LLM_PROVIDER debe ser anthropic u openai.');
}
