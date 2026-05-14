import axios from 'axios';

const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-latest';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_MISTRAL_MODEL = 'mistral-medium-2508';

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

function getMistralApiKey() {
	return process.env.MISTRAL_API_KEY || process.env.CHATBOT_API_KEY;
}

function getProvider() {
	return normalizeProvider(process.env.LLM_PROVIDER) || (getMistralApiKey() ? 'mistral' : '');
}

export async function sendMessage(text) {
	const message = String(text || '').trim();

	if (!message) {
		throw new Error('El mensaje es requerido.');
	}

	const provider = getProvider();

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

	if (provider === 'mistral') {
		const apiKey = getMistralApiKey();

		if (!apiKey) {
			throw new Error('Falta la variable de entorno MISTRAL_API_KEY o chatbot.');
		}

		const response = await axios.post(
			'https://api.mistral.ai/v1/chat/completions',
			{
				model: process.env.MISTRAL_MODEL || DEFAULT_MISTRAL_MODEL,
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
			throw new Error('Mistral no devolvió texto.');
		}

		return reply;
	}

	throw new Error('LLM_PROVIDER debe ser anthropic, openai o mistral.');
}
