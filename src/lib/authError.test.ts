import { describe, it, expect } from "vitest";
import {
  isNetworkError,
  isAlreadyRegistered,
  isInvalidCredentials,
  friendlyAuthError,
  withRetry,
} from "./authError";

describe("error classifiers", () => {
  it("flags 'Failed to fetch' and friends as network errors", () => {
    expect(isNetworkError({ message: "Failed to fetch" })).toBe(true);
    expect(isNetworkError({ name: "AuthRetryableFetchError", message: "x" })).toBe(true);
    expect(isNetworkError({ name: "TypeError", message: "Load failed" })).toBe(true);
    expect(isNetworkError({ status: 0 })).toBe(true);
  });

  it("does NOT flag real server rejections as network errors", () => {
    expect(isNetworkError({ message: "Invalid login credentials", status: 400 })).toBe(false);
    expect(isNetworkError({ message: "User already registered", status: 422 })).toBe(false);
  });

  it("detects already-registered in all its shapes", () => {
    expect(isAlreadyRegistered({ message: "User already registered" })).toBe(true);
    expect(isAlreadyRegistered({ code: "user_already_exists" })).toBe(true);
    expect(isAlreadyRegistered({ message: "Invalid login credentials" })).toBe(false);
  });

  it("detects invalid credentials", () => {
    expect(isInvalidCredentials({ message: "Invalid login credentials" })).toBe(true);
    expect(isInvalidCredentials({ code: "invalid_credentials" })).toBe(true);
    expect(isInvalidCredentials({ message: "Failed to fetch" })).toBe(false);
  });
});

describe("friendlyAuthError", () => {
  it("gives actionable network guidance for fetch failures", () => {
    expect(friendlyAuthError({ message: "Failed to fetch" })).toMatch(/internet/i);
  });
  it("maps wrong PIN cleanly", () => {
    expect(friendlyAuthError({ message: "Invalid login credentials" })).toMatch(/wrong phone number or pin/i);
  });
  it("falls back to the raw message for unknown errors", () => {
    expect(friendlyAuthError({ message: "something odd" })).toBe("something odd");
  });
});

describe("withRetry", () => {
  it("retries on a transient network error, then succeeds", async () => {
    let calls = 0;
    const res = await withRetry(
      async () => {
        calls++;
        if (calls < 2) return { error: { message: "Failed to fetch" } };
        return { error: null, data: "ok" };
      },
      3,
      1
    );
    expect(calls).toBe(2);
    expect(res.error).toBeNull();
  });

  it("does NOT retry a non-network error (e.g. wrong PIN)", async () => {
    let calls = 0;
    await withRetry(
      async () => {
        calls++;
        return { error: { message: "Invalid login credentials" } };
      },
      3,
      1
    );
    expect(calls).toBe(1);
  });

  it("gives up after `tries` consecutive network errors", async () => {
    let calls = 0;
    const res = await withRetry(
      async () => {
        calls++;
        return { error: { message: "Failed to fetch" } };
      },
      3,
      1
    );
    expect(calls).toBe(3);
    expect(res.error).toBeTruthy();
  });
});
