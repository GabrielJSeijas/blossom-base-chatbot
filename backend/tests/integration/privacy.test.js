import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as mongoClient from "../../src/db/mongoClient.js";
import { app } from "../../src/index.js";
import { createTestToken } from "../helpers/testAuth.js";

vi.mock("../../src/db/mongoClient.js");
vi.mock("../../src/llm/llmProvider.js");
vi.mock("../../src/llm/riskClassifier.js");

describe("🔒 HU-10: Control de Privacidad (Derecho al Olvido)", () => {
  const authHeader = `Bearer ${createTestToken()}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Debe eliminar todos los mensajes del usuario cuando se confirma explícitamente", async () => {
    // Mock de las colecciones
    const mockMessagesCollection = {
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 50 }),
    };
    const mockConversationsCollection = {
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 5 }),
    };

    mongoClient.getMessagesCollection.mockReturnValue(mockMessagesCollection);
    mongoClient.getConversationsCollection.mockReturnValue(
      mockConversationsCollection,
    );

    const res = await request(app)
      .delete("/chat/history")
      .set("Authorization", authHeader)
      .send({ confirmation: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedMessages).toBe(50);
    expect(res.body.deletedConversations).toBe(5);
    expect(mockMessagesCollection.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.any(Object) }),
    );
  });

  it("Debe retornar 400 si no se proporciona confirmación explícita", async () => {
    const res = await request(app)
      .delete("/chat/history")
      .set("Authorization", authHeader)
      .send({}); // Sin confirmation: true

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("confirmación explícita");
  });

  it("Debe retornar 401 si no hay token de autenticación", async () => {
    const res = await request(app)
      .delete("/chat/history")
      .send({ confirmation: true });

    expect(res.statusCode).toBe(401);
  });

  it("NO debe eliminar registros de risk_assessments ni risk_alerts (Cumplimiento HIPAA/GDPR)", async () => {
    // Este test verifica que el controlador NO llama a deleteMany en las colecciones de riesgo
    const mockRiskAssessmentsCollection = {
      deleteMany: vi.fn(),
    };
    const mockRiskAlertsCollection = {
      deleteMany: vi.fn(),
    };

    mongoClient.getRiskAssessmentsCollection.mockReturnValue(
      mockRiskAssessmentsCollection,
    );
    mongoClient.getRiskAlertsCollection.mockReturnValue(
      mockRiskAlertsCollection,
    );

    const mockMessagesCollection = {
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 10 }),
    };
    const mockConversationsCollection = {
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }),
    };

    mongoClient.getMessagesCollection.mockReturnValue(mockMessagesCollection);
    mongoClient.getConversationsCollection.mockReturnValue(
      mockConversationsCollection,
    );

    await request(app)
      .delete("/chat/history")
      .set("Authorization", authHeader)
      .send({ confirmation: true });

    // Verificar que NUNCA se intentó borrar las colecciones de riesgo
    expect(mockRiskAssessmentsCollection.deleteMany).not.toHaveBeenCalled();
    expect(mockRiskAlertsCollection.deleteMany).not.toHaveBeenCalled();
  });
});
