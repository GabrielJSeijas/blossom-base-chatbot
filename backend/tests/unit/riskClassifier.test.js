import { beforeEach, describe, expect, it, vi } from "vitest";

// 1. Mockear axios (para interceptar las llamadas a Anthropic)
vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// 2. DES-MOCKEAR riskClassifier para usar la implementación REAL en este archivo
vi.mock("../../src/llm/riskClassifier.js", async () => {
  const actual = await vi.importActual("../../src/llm/riskClassifier.js");
  return { ...actual };
});

import axios from "axios";
import { classifyRisk } from "../../src/llm/riskClassifier.js";

describe("🚨 Clasificador de Riesgo (HU-07) - Implementación Real", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  const mockAnthropicResponse = (jsonString) => {
    // axios es el default export, así que axios.post es la función mockeada
    axios.post.mockResolvedValue({
      data: {
        content: [{ type: "text", text: jsonString }],
      },
    });
  };

  it("Debe detectar ideación suicida directa como CRITICAL", async () => {
    mockAnthropicResponse(
      JSON.stringify({
        risk_level: "critical",
        categories: ["ideacion_suicida", "plan_suicida"],
        should_alert: true,
        urgency: "immediate",
        confidence: 0.95,
        summary_for_moderator: "Usuario expresa plan suicida.",
        recommended_bot_mode: "crisis",
      }),
    );

    const result = await classifyRisk("Quiero suicidarme hoy", []);

    expect(result.risk_level).toBe("critical");
    expect(result.should_alert).toBe(true);
    expect(result.urgency).toBe("immediate");
  });

  it("Debe detectar autolesión explícita como HIGH", async () => {
    mockAnthropicResponse(
      JSON.stringify({
        risk_level: "high",
        categories: ["autolesion"],
        should_alert: true,
        urgency: "soon",
        confidence: 0.85,
        summary_for_moderator: "Usuario menciona cortarse.",
        recommended_bot_mode: "crisis",
      }),
    );

    const result = await classifyRisk("Me quiero cortar los brazos", []);

    expect(result.risk_level).toBe("high");
    expect(result.categories).toContain("autolesion");
  });

  it("Debe detectar desesperanza ambigua como MEDIUM", async () => {
    mockAnthropicResponse(
      JSON.stringify({
        risk_level: "medium",
        categories: ["malestar_emocional"],
        should_alert: true,
        urgency: "soon",
        confidence: 0.6,
        summary_for_moderator: "Frases de desesperanza.",
        recommended_bot_mode: "supportive",
      }),
    );

    const result = await classifyRisk(
      "A veces siento que todos estarían mejor sin mí",
      [],
    );

    expect(result.risk_level).toBe("medium");
    expect(result.should_alert).toBe(true);
  });

  it("Debe clasificar tristeza normal como LOW", async () => {
    mockAnthropicResponse(
      JSON.stringify({
        risk_level: "low",
        categories: ["malestar_emocional"],
        should_alert: false,
        urgency: "routine",
        confidence: 0.7,
        summary_for_moderator: "Tristeza por duelo migratorio.",
        recommended_bot_mode: "supportive",
      }),
    );

    const result = await classifyRisk(
      "Extraño mucho a mi mamá y me siento solo",
      [],
    );

    expect(result.risk_level).toBe("low");
    expect(result.should_alert).toBe(false);
  });

  it("Debe clasificar un saludo normal como NONE", async () => {
    mockAnthropicResponse(
      JSON.stringify({
        risk_level: "none",
        categories: [],
        should_alert: false,
        urgency: "none",
        confidence: 1.0,
        summary_for_moderator: "Sin riesgo.",
        recommended_bot_mode: "normal",
      }),
    );

    const result = await classifyRisk("Hola, ¿cómo estás?", []);

    expect(result.risk_level).toBe("none");
  });
});
