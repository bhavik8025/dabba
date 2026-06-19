import { useState } from "react";
import { supabase, phoneToEmail } from "../lib/supabase";
import {
  withRetry,
  isAlreadyRegistered,
  isInvalidCredentials,
  friendlyAuthError,
} from "../lib/authError";

interface Props {
  onBack?: () => void;
}

// Make sure the signed-in user has a profile row. Safe to call repeatedly:
// 23505 (already exists) is treated as success, so a re-tried or recovered
// signup never errors here.
async function ensureProfile(id: string, name: string, phone: string) {
  const { error } = await withRetry(() =>
    supabase.from("profiles").insert({ id, name, phone })
  );
  if (error && error.code !== "23505") throw error;
}

export default function AuthScreen({ onBack }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    // normalize to the last 10 digits so "+91 98765 43210", "09876543210" and
    // "9876543210" all map to the SAME account — no accidental duplicates
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) return setError("Enter a valid 10-digit phone number");
    if (!/^\d{6}$/.test(pin)) return setError("PIN must be exactly 6 digits");
    if (mode === "register" && !name.trim()) return setError("Enter your name");

    setBusy(true);
    try {
      const email = phoneToEmail(digits);
      if (mode === "register") {
        const { data, error } = await withRetry(() =>
          supabase.auth.signUp({ email, password: pin })
        );

        // A previous attempt may have actually succeeded but lost its response
        // on a flaky network — the account exists server-side. Supabase signals
        // this either with an "already registered" error, or (with enumeration
        // protection on) a user object that has no identities. Either way, log
        // the person in with the same PIN instead of dead-ending them.
        const obfuscatedExisting =
          data?.user &&
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0;

        if ((error && isAlreadyRegistered(error)) || obfuscatedExisting) {
          const { data: liData, error: liErr } = await withRetry(() =>
            supabase.auth.signInWithPassword({ email, password: pin })
          );
          if (liErr) {
            if (isInvalidCredentials(liErr)) {
              setError(
                "This number already has an account. If it's yours, switch to Log in and check your PIN."
              );
              return;
            }
            throw liErr;
          }
          if (liData?.user) await ensureProfile(liData.user.id, name.trim(), digits);
          return;
        }

        if (error) throw error;
        if (data?.user) await ensureProfile(data.user.id, name.trim(), digits);
      } else {
        const { error } = await withRetry(() =>
          supabase.auth.signInWithPassword({ email, password: pin })
        );
        if (error) throw error;
      }
    } catch (e: any) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen no-tabs">
      {onBack && (
        <button className="back-btn" onClick={onBack} aria-label="Go back">←</button>
      )}
      <div className="hero">
        <img className="logo" src="/icon.svg" alt="" />
        <h1>Dabba</h1>
        <p>Split tiffin costs with your group</p>
      </div>

      <div className="card">
        {mode === "register" && (
          <div className="field">
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bhavik" />
          </div>
        )}
        <div className="field">
          <label>Phone number</label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98XXXXXXXX"
          />
        </div>
        <div className="field">
          <label>6-digit PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
          />
          {mode === "register" && <p className="hint">You'll log in with this PIN — remember it!</p>}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy} onClick={submit}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </div>

      <button
        className="btn ghost"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}
      >
        {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
      </button>
      {mode === "login" && (
        <button
          className="btn ghost"
          style={{ fontWeight: 400, fontSize: "0.85rem" }}
          onClick={() =>
            alert(
              "PINs can't be reset by SMS or email (the app deliberately uses neither, to stay free).\n\nAsk the person who set up the app — they can set a new PIN for your account in about a minute from the Supabase dashboard:\n\nAuthentication → Users → find your phone number → ⋯ → Update user → new password = your new 6-digit PIN."
            )
          }
        >
          Forgot PIN?
        </button>
      )}
    </div>
  );
}
