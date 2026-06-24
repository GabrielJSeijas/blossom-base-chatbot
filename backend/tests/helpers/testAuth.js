import crypto from "crypto";

const TEST_TOKEN_SECRET = "test-secret-key-for-blossom-qa-1234567890";

export function createTestToken(userId = "507f1f77bcf86cd799439011") {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const body = {
    sub: userId,
    email: "test@blossom.test",
    role: "user",
    iat: nowSeconds,
    exp: nowSeconds + 60 * 60 * 24 * 7,
  };

  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", TEST_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function createExpiredToken(userId = "507f1f77bcf86cd799439011") {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const body = {
    sub: userId,
    email: "test@blossom.test",
    role: "user",
    iat: nowSeconds - 60 * 60 * 24 * 8,
    exp: nowSeconds - 60 * 60 * 24,
  };

  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", TEST_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}
