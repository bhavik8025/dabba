import { useState } from "react";
import { supabase } from "../lib/supabase";

interface Props {
  onJoined: (gid?: string) => void;
  onBack?: () => void; // present when adding another group from Settings
}

export default function OnboardingScreen({ onJoined, onBack }: Props) {
  const [mode, setMode] = useState<"pick" | "create" | "join">("pick");
  const [groupName, setGroupName] = useState("");
  const [tiffin, setTiffin] = useState("");
  const [roti, setRoti] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const createGroup = async () => {
    setError("");
    const t = parseFloat(tiffin);
    const r = parseFloat(roti);
    if (!groupName.trim()) return setError("Give your group a name");
    if (!(t > 0)) return setError("Enter the tiffin price");
    if (!(r >= 0)) return setError("Enter the extra roti price (0 if free)");
    setBusy(true);
    const { data, error } = await supabase.rpc("create_group", {
      p_name: groupName.trim(),
      p_tiffin: t,
      p_roti: r,
    });
    setBusy(false);
    if (error) return setError(error.message);
    onJoined(data as string);
  };

  const joinGroup = async () => {
    setError("");
    if (code.trim().length !== 6) return setError("Invite code is 6 characters");
    setBusy(true);
    const { data, error } = await supabase.rpc("join_group", { p_code: code.trim() });
    setBusy(false);
    if (error)
      return setError(error.message.includes("Invalid") ? "Invalid invite code — check with your group admin." : error.message);
    onJoined(data as string);
  };

  return (
    <div className="screen no-tabs">
      {(mode !== "pick" || onBack) && (
        <button
          className="back-btn"
          onClick={() => (mode !== "pick" ? setMode("pick") : onBack && onBack())}
          aria-label="Go back"
        >
          ←
        </button>
      )}
      <div className="hero">
        <img className="logo" src="/icon.svg" alt="" />
        <h1>Set up your group</h1>
        <p>Create a tiffin group or join your friends'</p>
      </div>

      {mode === "pick" && (
        <>
          <button className="btn" onClick={() => setMode("create")}>Create a new group</button>
          <div style={{ height: 10 }} />
          <button className="btn secondary" onClick={() => setMode("join")}>Join with invite code</button>
          <div style={{ height: 10 }} />
          {!onBack && (
            <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Log out</button>
          )}
        </>
      )}

      {mode === "create" && (
        <div className="card">
          <div className="field">
            <label>Group name</label>
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Hostel Tiffin Gang" />
          </div>
          <div className="row2">
            <div className="field">
              <label>Tiffin price (₹)</label>
              <input type="number" inputMode="decimal" value={tiffin} onChange={(e) => setTiffin(e.target.value)} placeholder="70" />
            </div>
            <div className="field">
              <label>Extra roti (₹)</label>
              <input type="number" inputMode="decimal" value={roti} onChange={(e) => setRoti(e.target.value)} placeholder="10" />
            </div>
          </div>
          <p className="hint" style={{ marginBottom: 12 }}>You can change prices later in Settings.</p>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy} onClick={createGroup}>{busy ? "Creating…" : "Create group"}</button>
        </div>
      )}

      {mode === "join" && (
        <div className="card">
          <div className="field">
            <label>Invite code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              style={{ textTransform: "uppercase", letterSpacing: "0.2em", textAlign: "center", fontWeight: 700 }}
            />
            <p className="hint">Ask the group creator — it's shown in their Settings tab.</p>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy} onClick={joinGroup}>{busy ? "Joining…" : "Join group"}</button>
        </div>
      )}
    </div>
  );
}
