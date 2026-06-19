// Resilient auth helpers: turn flaky-network failures into retries + friendly
// messages, and recover accounts whose signup response was lost in transit
// (request reached Supabase, but the reply never made it back to the phone).
// The pure functions here are unit-tested in authError.test.ts.

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A "Failed to fetch" is a network-level failure (the request never completed),
// NOT a server rejection. Those come back with readable messages instead.
export function isNetworkError(e: any): boolean {
  if (!e) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const name = (e.name || "").toString();
  const msg = (e.message || e.error_description || "").toString().toLowerCase();
  return (
    name === "AuthRetryableFetchError" ||
    name === "TypeError" ||
    e.status === 0 ||
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") || // Safari's wording
    msg.includes("timeout") ||
    msg.includes("timed out")
  );
}

export function isAlreadyRegistered(e: any): boolean {
  if (!e) return false;
  const msg = (e.message || "").toString().toLowerCase();
  return (
    e.code === "user_already_exists" ||
    e.code === "email_exists" ||
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("user already exists")
  );
}

export function isInvalidCredentials(e: any): boolean {
  if (!e) return false;
  const msg = (e.message || "").toString().toLowerCase();
  return e.code === "invalid_credentials" || msg.includes("invalid login credentials");
}

export function friendlyAuthError(e: any): string {
  if (isNetworkError(e)) {
    return "Couldn't reach the server. Check your internet — try switching between Wi-Fi and mobile data, and turn off any VPN, ad-blocker or Private DNS, then tap again.";
  }
  if (isInvalidCredentials(e)) return "Wrong phone number or PIN.";
  if (isAlreadyRegistered(e)) return "This phone number is already registered — tap Log in below.";
  return (e?.message || "Something went wrong. Please try again.").toString();
}

// Retry a Supabase call (which resolves to { data?, error? }) when it hits a
// transient network error. Also catches thrown network errors. Non-network
// errors (wrong PIN, already-registered, etc.) return/throw immediately so the
// user isn't made to wait through pointless retries.
export async function withRetry<T extends { error?: any; data?: any }>(
  fn: () => Promise<T>,
  tries = 3,
  baseDelay = 600
): Promise<T> {
  let result: T | undefined;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      result = await fn();
    } catch (e) {
      if (attempt < tries - 1 && isNetworkError(e)) {
        await sleep(baseDelay * (attempt + 1));
        continue;
      }
      throw e;
    }
    if (result.error && isNetworkError(result.error) && attempt < tries - 1) {
      await sleep(baseDelay * (attempt + 1));
      continue;
    }
    return result;
  }
  return result as T;
}
