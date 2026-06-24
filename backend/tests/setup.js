import { vi } from "vitest";

// Mock de MongoDB
vi.mock("../src/db/mongoClient.js", () => {
  const mockCollection = {
    findOne: vi.fn(),
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
        toArray: vi.fn(() => Promise.resolve([])),
      })),
    })),
    insertOne: vi.fn(() => Promise.resolve({ insertedId: "mock-id" })),
    updateOne: vi.fn(() => Promise.resolve({ modifiedCount: 1 })),
    deleteMany: vi.fn(() => Promise.resolve({ deletedCount: 0 })),
    aggregate: vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
    })),
  };

  return {
    connectMongo: vi.fn(() => Promise.resolve()),
    closeMongoConnection: vi.fn(() => Promise.resolve()),
    getDatabase: vi.fn(() => ({
      collection: vi.fn(() => mockCollection),
    })),
    getUsersCollection: vi.fn(() => mockCollection),
    getMessagesCollection: vi.fn(() => mockCollection),
    getConversationsCollection: vi.fn(() => mockCollection),
    getRiskAssessmentsCollection: vi.fn(() => mockCollection),
    getRiskAlertsCollection: vi.fn(() => mockCollection),
  };
});

// Mock de Anthropic/LLM Provider
vi.mock("../src/llm/llmProvider.js", () => ({
  sendMessage: vi.fn(),
}));

// Mock de Risk Classifier
vi.mock("../src/llm/riskClassifier.js", () => ({
  classifyRisk: vi.fn(),
}));

// Mock de Email Service (Brevo)
vi.mock("../src/services/emailService.js", () => ({
  sendRiskAlertEmail: vi.fn(() =>
    Promise.resolve({ messageId: "mock-email-id" }),
  ),
}));

// Mock de Axios (para llamadas externas)
vi.mock("axios", () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: {} })),
    get: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

console.log("✅ Test setup complete - all mocks active");
