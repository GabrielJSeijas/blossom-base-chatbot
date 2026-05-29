import axios from 'axios';
import { getBlossomSystemPrompt } from '../prompts/blossomSysPrompt.js';

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

function logProviderError(provider, error, context = {}) {
	const modelLabel = context.model ? ` (model: ${context.model})` : '';
	const errorMessage = error?.message || String(error);
	console.error(`[LLM] Error con ${provider}${modelLabel}: ${errorMessage}`);

	if (error?.response?.status) {
		console.error(`[LLM] ${provider} status: ${error.response.status}`);
	}

	if (error?.response?.data) {
		console.error(`[LLM] ${provider} response:`, error.response.data);
	}

	if (context.extra) {
		console.error(`[LLM] ${provider} contexto:`, context.extra);
	}
}

function normalizeHistoryMessage(message) {
	const role = message?.role === 'assistant' ? 'assistant' : 'user';
	const content = String(message?.content || '').trim();

	if (!content) {
		return null;
	}

	return { role, content };
}

function normalizeHistory(history) {
	if (!Array.isArray(history)) {
		return [];
	}

	return history.map(normalizeHistoryMessage).filter(Boolean);
}

function buildConversationMessages(message, history) {
	const normalizedHistory = normalizeHistory(history);

	if (normalizedHistory.length > 0) {
		return normalizedHistory;
	}

	return [{ role: 'user', content: String(message || '').trim() }];
}

function getProvider() {
	const configuredProvider = normalizeProvider(process.env.LLM_PROVIDER);

	if (configuredProvider === 'anthropic' || configuredProvider === 'openai' || configuredProvider === 'mistral') {
		return configuredProvider;
	}

	if (process.env.ANTHROPIC_API_KEY) {
		return 'anthropic';
	}

	if (getMistralApiKey()) {
		return 'mistral';
	}

	return '';
}

export async function sendMessage(text, options = {}) {
	const message = String(text || '').trim();
	const systemPrompt = getBlossomSystemPrompt();
	const conversationMessages = buildConversationMessages(message, options.history);

	if (!message) {
		throw new Error('El mensaje es requerido.');
	}

	const provider = getProvider();

	if (process.env.SUPPRESS_STARTUP_LOGS !== 'true') {
		console.log(`LLM provider seleccionado: ${provider || 'ninguno'}`);
	}

	if (provider === 'anthropic') {
		const apiKey = process.env.ANTHROPIC_API_KEY;
		const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

		if (!apiKey) {
			console.error('[LLM] Error con Anthropic: falta ANTHROPIC_API_KEY.');
			throw new Error('Falta la variable de entorno ANTHROPIC_API_KEY.');
		}

		let response;

		try {
			response = await axios.post(
				'https://api.anthropic.com/v1/messages',
				{
					model,
					max_tokens: 512,
					system: systemPrompt,
					messages: conversationMessages,
				},
				{
					headers: {
						'x-api-key': apiKey,
						'anthropic-version': '2023-06-01',
						'content-type': 'application/json',
					},
				}
			);
		} catch (error) {
			logProviderError('Anthropic', error, { model });
			throw error;
		}

		const reply = extractAnthropicText(response.data);

		if (!reply) {
			throw new Error('Anthropic no devolvió texto.');
		}

		return reply;
	}

	if (provider === 'openai') {
		const apiKey = process.env.OPENAI_API_KEY;
		const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

		if (!apiKey) {
			console.error('[LLM] Error con OpenAI: falta OPENAI_API_KEY.');
			throw new Error('Falta la variable de entorno OPENAI_API_KEY.');
		}

		let response;

		try {
			response = await axios.post(
				'https://api.openai.com/v1/chat/completions',
				{
					model,
					messages: [{ role: 'system', content: systemPrompt }, ...conversationMessages],
				},
				{
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'content-type': 'application/json',
					},
				}
			);
		} catch (error) {
			logProviderError('OpenAI', error, { model });
			throw error;
		}

		const reply = response.data?.choices?.[0]?.message?.content?.trim();

		if (!reply) {
			throw new Error('OpenAI no devolvió texto.');
		}

		return reply;
	}

	if (provider === 'mistral') {
		const apiKey = getMistralApiKey();
		const model = process.env.MISTRAL_MODEL || DEFAULT_MISTRAL_MODEL;

		if (!apiKey) {
			console.error('[LLM] Error con Mistral: falta MISTRAL_API_KEY o CHATBOT_API_KEY.');
			throw new Error('Falta la variable de entorno MISTRAL_API_KEY o chatbot.');
		}

		let response;

		try {
			response = await axios.post(
				'https://api.mistral.ai/v1/chat/completions',
				{
					model,
					messages: [{ role: 'system', content: systemPrompt }, ...conversationMessages],
				},
				{
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'content-type': 'application/json',
					},
				}
			);
		} catch (error) {
			logProviderError('Mistral', error, { model });
			throw error;
		}

		const reply = response.data?.choices?.[0]?.message?.content?.trim();

		if (!reply) {
			throw new Error('Mistral no devolvió texto.');
		}

		return reply;
	}

	throw new Error('LLM_PROVIDER debe ser anthropic, openai o mistral.');
}
