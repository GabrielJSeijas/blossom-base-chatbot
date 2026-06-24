import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index.js";
import * as llmProvider from "../../src/llm/llmProvider.js";
import * as riskClassifier from "../../src/llm/riskClassifier.js";
import * as emailService from "../../src/services/emailService.js";
import { createTestToken } from "../helpers/testAuth.js";

vi.mock("../../src/llm/llmProvider.js");
vi.mock("../../src/llm/riskClassifier.js");
vi.mock("../../src/services/emailService.js");

describe("🔗 Integración: Flujo de Chat y Alertas (HU-07, HU-08, HU-11)", () => {
  const validToken = createTestToken();
  const authHeader = `Bearer ${validToken}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CI-001: Debe disparar alerta de correo cuando el riesgo es CRITICAL", async () => {
    riskClassifier.classifyRisk.mockResolvedValue({
      risk_level: "critical",
      categories: ["ideacion_suicida"],
      should_alert: true,
      urgency: "immediate",
      confidence: 0.99,
      summary_for_moderator: "Riesgo inminente.",
      recommended_bot_mode: "crisis",
    });

    llmProvider.sendMessage.mockResolvedValue("Me preocupa tu seguridad...");
    emailService.sendRiskAlertEmail.mockResolvedValue({
      messageId: "mock-123",
    });

    const res = await request(app)
      .post("/chat")
      .set("Authorization", authHeader)
      .send({
        message: "Voy a suicidarme",
        conversationId: "507f1f77bcf86cd799439011",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.response).toContain("seguridad");
    expect(res.body.risk.riskLevel).toBe("critical");

    // Esperamos un poco para que la promesa en background del email termine
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(emailService.sendRiskAlertEmail).toHaveBeenCalled();
  });

  it("NO debe disparar alerta de correo cuando el riesgo es LOW", async () => {
    riskClassifier.classifyRisk.mockResolvedValue({
      risk_level: "low",
      categories: ["malestar_emocional"],
      should_alert: false,
      urgency: "routine",
      confidence: 0.8,
      summary_for_moderator: "Tristeza normal.",
      recommended_bot_mode: "supportive",
    });

    llmProvider.sendMessage.mockResolvedValue("Entiendo que te sientas así...");

    const res = await request(app)
      .post("/chat")
      .set("Authorization", authHeader)
      .send({ message: "Estoy un poco triste hoy" });

    expect(res.statusCode).toBe(200);
    expect(res.body.risk.riskLevel).toBe("low");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(emailService.sendRiskAlertEmail).not.toHaveBeenCalled();
  });

  it("Debe retornar 401 si no hay token de autenticación", async () => {
    const res = await request(app).post("/chat").send({ message: "Hola" });

    expect(res.statusCode).toBe(401);
  });

  it("Debe retornar 400 si el mensaje está vacío", async () => {
    const res = await request(app)
      .post("/chat")
      .set("Authorization", authHeader)
      .send({ message: "" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("requerido");
  });
});
