import { describe, expect, it } from "vitest";
import { classify } from "../../src/server/domain/messaging";

const fail = (code: string) => ({ ok: false as const, error: { code: code as never, message: "x" } });

describe("email delivery outcomes", () => {
  it("records the Cloudflare message id on success", () => {
    expect(classify({ ok: true, ids: [{ recipient: "a@b.co", messageId: "<m1@cf>" }] }, {})).toEqual({ status: "sent", error: null, messageId: "<m1@cf>" });
  });
  it("keeps mail in the dev inbox when there is no binding, but fails (and retries) in production", () => {
    expect(classify(fail("BINDING_MISSING"), { APP_ENV: "development" }).status).toBe("logged");
    expect(classify(fail("BINDING_MISSING"), { APP_ENV: "production" }).status).toBe("failed");
  });
  it("never retries bad recipients", () => {
    for (const c of ["INVALID_TO", "UNVERIFIED_DESTINATION", "MIME_ERROR"]) expect(classify(fail(c), {}).status).toBe("rejected");
  });
  it("never resends when Cloudflare may already have accepted the message", () => {
    expect(classify(fail("OUTCOME_UNKNOWN"), {}).status).toBe("unknown");
  });
  it("retries quota, upstream and sender-setup errors", () => {
    for (const c of ["QUOTA_EXCEEDED", "UPSTREAM_ERROR", "INVALID_FROM"]) expect(classify(fail(c), {}).status).toBe("failed");
  });
  it("reads per-recipient failures", () => {
    const r = classify({ ok: false, deliveries: [{ recipient: "a@b.co", ok: false, error: { code: "UNVERIFIED_DESTINATION", message: "not verified" } }] }, {});
    expect(r).toMatchObject({ status: "rejected", error: "UNVERIFIED_DESTINATION: not verified" });
  });
});
