import assert from "node:assert/strict";
import test from "node:test";
import { captureRedirectUri, getFrontendUrl } from "../server/auth-utils.ts";

test("uses only the origin from a valid redirect URI", () => {
  const req = {
    query: { redirect_uri: "https://inventory.example/orders?status=paid" },
    headers: {},
  };

  assert.equal(getFrontendUrl(req), "https://inventory.example");
});

test("rejects unsafe redirect schemes and falls back to the request host", () => {
  const req = {
    query: { redirect_uri: "javascript:alert(1)" },
    headers: { host: "api.example", "x-forwarded-proto": "https" },
  };

  assert.equal(getFrontendUrl(req), "https://api.example");
});

test("captures only a safe redirect origin in the session", () => {
  const session: { redirectUri?: unknown } = {};
  let called = false;

  captureRedirectUri(
    {
      query: { redirect_uri: "https://inventory.example/login" },
      session,
      headers: {},
    },
    {},
    () => {
      called = true;
    },
  );

  assert.equal(session.redirectUri, "https://inventory.example");
  assert.equal(called, true);
});