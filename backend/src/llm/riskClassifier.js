import axios from 'axios';
import { getRiskClassifierPrompt } from '../prompts/riskClassifierPrompt.js';

const DEFAULT_RISK_ASSESSMENT = {
	risk_level: 'none',
	categories: [],
	should_alert: false,
	urgency: 'none',
	confidence: 0,
	summary_for_moderator: 'No se detectó riesgo relevante.',
	recommended_bot_mode: 'normal',
};

function getAnthropicApiKey() {
	return process.env.ANTHROPIC_API_KEY;
}

function getAnthropicModel() {
	return process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
}

function sanitizeRecentHistory(history) {
	if (!Array.isArray(history)) {
		return [];
	}

	return history
		.slice(-20)
		.map(item => ({
			role: item?.role === 'assistant' ? 'assistant' : 'user',
			content: String(item?.content || '').trim(),
		}))
		.filter(item => item.content);
}

function extractJsonObject(text) {
	const rawText = String(text || '').trim();

	if (!rawText) {
		return null;
	}

	try {
		return JSON.parse(rawText);
	} catch {
		const firstBrace = rawText.indexOf('{');
		const lastBrace = rawText.lastIndexOf('}');

		if (firstBrace >= 0 && lastBrace > firstBrace) {
			try {
				return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
			} catch {
				return null;
			}
		}

		return null;
	}
}

function normalizeRiskLevel(value) {
	const normalizedValue = String(value || '').trim().toLowerCase();
	const allowed = new Set(['none', 'low', 'medium', 'high', 'critical']);

	return allowed.has(normalizedValue) ? normalizedValue : 'none';
}

function normalizeUrgency(value) {
	const normalizedValue = String(value || '').trim().toLowerCase();
	const allowed = new Set(['none', 'routine', 'soon', 'immediate']);

	return allowed.has(normalizedValue) ? normalizedValue : 'none';
}

function normalizeCategories(value) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 10);
}

function normalizeConfidence(value) {
	const numericValue = Number(value);

	if (!Number.isFinite(numericValue)) {
		return 0;
	}

	return Math.max(0, Math.min(1, numericValue));
}

function normalizeBotMode(value) {
	const normalizedValue = String(value || '').trim().toLowerCase();
	const allowed = new Set(['normal', 'supportive', 'crisis', 'refuse_and_redirect']);

	return allowed.has(normalizedValue) ? normalizedValue : 'normal';
}

function normalizeRiskAssessment(data) {
	return {
		risk_level: normalizeRiskLevel(data?.risk_level),
		categories: normalizeCategories(data?.categories),
		should_alert: Boolean(data?.should_alert),
		urgency: normalizeUrgency(data?.urgency),
		confidence: normalizeConfidence(data?.confidence),
		summary_for_moderator: String(data?.summary_for_moderator || DEFAULT_RISK_ASSESSMENT.summary_for_moderator).trim(),
		recommended_bot_mode: normalizeBotMode(data?.recommended_bot_mode),
	};
}

function logRiskClassifierError(error) {
	console.error('[RISK] Error clasificando riesgo:', error?.message || error);

	if (error?.response?.status) {
		console.error('[RISK] Anthropic status:', error.response.status);
	}

	if (error?.response?.data) {
		console.error('[RISK] Anthropic response:', error.response.data);
	}
}

export async function classifyRisk(userMessage, recentHistory = []) {
	const apiKey = getAnthropicApiKey();

	if (!apiKey) {
		console.error('[RISK] Falta ANTHROPIC_API_KEY, se usará riesgo none por defecto.');
		return { ...DEFAULT_RISK_ASSESSMENT };
	}

	const message = String(userMessage || '').trim();
	const history = sanitizeRecentHistory(recentHistory);

	if (!message) {
		return { ...DEFAULT_RISK_ASSESSMENT };
	}

	try {
		const response = await axios.post(
			'https://api.anthropic.com/v1/messages',
			{
				model: getAnthropicModel(),
				max_tokens: 400,
				temperature: 0,
				system: getRiskClassifierPrompt(),
				messages: [
					{
						role: 'user',
						content: JSON.stringify({
							userMessage: message,
							recentHistory: history,
						}),
					},
				],
			},
			{
				headers: {
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
					'content-type': 'application/json',
				},
			}
		);

		const text = Array.isArray(response.data?.content)
			? response.data.content
					.filter(part => part && part.type === 'text' && typeof part.text === 'string')
					.map(part => part.text)
					.join('')
				.trim()
			: '';

		const parsed = extractJsonObject(text);

		if (!parsed) {
			console.error('[RISK] No se pudo parsear el JSON del clasificador:', text);
			return { ...DEFAULT_RISK_ASSESSMENT };
		}

		return normalizeRiskAssessment(parsed);
	} catch (error) {
		logRiskClassifierError(error);
		return { ...DEFAULT_RISK_ASSESSMENT };
	}
}
