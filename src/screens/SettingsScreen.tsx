import { useMemo, useState } from "react";
import { GroupData } from "../App";
import { isDemo, supabase } from "../lib/supabase";
import { computeBalances } from "../lib/balance";
import { canPromptInstall, isIOS, isStandalone, promptInstall } from "../lib/install";
import { fmtMoney, Profile } from "../lib/types";

interface Props {
  data: GroupData;
  myId: string;
  refresh: () => Promise<void>;
  showToast: (msg: string) => void;
  onSwitchGroup: (gid: string) => void;
  onAddGroup: () => void;
}

export default function SettingsScreen({ data, myId, refresh, showToast, onSwitchGroup, onAddGroup }: Props) {
  const { group, groups, members, entries, settlements } = data;
  const [tiffin, setTiffin] = useState(String(group.tiffin_price));
  const [roti, setRoti] = useState(String(group.roti_price));
  const [busy, setBusy] = useState(false);

  const balances = useMemo(() => computeBalances(entries, settlements), [entries, settlements]);

  const removeMember = async (m: Profile) => {
    const me = m.id === myId;
    const b = Math.round(((balances.get(m.id) || 0) + Number.EPSILON) * 100) / 100;
    const balWarn =
      Math.abs(b) > 0.009
        ? `\n\n⚠️ ${me ? "You" : m.name} still ${b < 0 ? `owe${me ? "" : "s"} ${fmtMoney(Math.abs(b))}` : `${me ? "are" : "is"} owed ${fmtMoney(b)}`} in this group — settle up first if possible.`
        : "";
    const msg = me
      ? `Leave "${group.name}"? You'll lose access to this group (old records keep your name).${balWarn}`
      : `Remove ${m.name} from "${group.name}"? They lose access; their old records stay visible.${balWarn}`;
    if (!confirm(msg)) return;
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", group.id)
      .eq("user_id", m.id);
    if (error) return alert(error.message);
    await refresh();
    showToast(me ? "You left the group" : `${m.name} removed`);
  };

  const regenInvite = async () => {
    if (!confirm("Generate a new invite code? The old code stops working immediately."))
      return;
    const { data: code, error } = await supabase.rpc("regenerate_invite", { p_group: group.id });
    if (error) return alert(error.message);
    await refresh();
    showToast(`New invite code: ${code}`);
  };

  const saveRates = async () => {
    const t = parseFloat(tiffin);
    const r = parseFloat(roti);
    if (!(t > 0) || !(r >= 0)) return alert("Enter valid prices");
    setBusy(true);
    const { error } = await supabase
      .from("groups")
      .update({ tiffin_price: t, roti_price: r })
      .eq("id", group.id);
    setBusy(false);
    if (error) return alert(error.message);
    await refresh();
    showToast("Prices updated for future entries");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(group.invite_code);
      showToast("Invite code copied");
    } catch {
      /* code is visible on screen anyway */
    }
  };

  const shareOnWhatsApp = () => {
    const msg =
      `🍱 Join our tiffin group "${group.name}" on Dabba!\n\n` +
      `1. Open ${location.origin}\n` +
      `2. Create an account (phone number + a 6-digit PIN)\n` +
      `3. Tap "Join with invite code" and enter: *${group.invite_code}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="screen">
      <h2 className="page-title">
        {group.name}
        <small>Group settings</small>
      </h2>

      <div className="section-title">Invite friends</div>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>
          Ask them to install the app, create an account, then tap "Join with invite code" and enter:
        </p>
        <div className="invite-code" onClick={copyCode}>{group.invite_code}</div>
        <div className="row2">
          <button className="btn secondary" onClick={copyCode}>Copy code</button>
          <button className="btn" onClick={shareOnWhatsApp}>Share on WhatsApp</button>
        </div>
        <button className="btn ghost" style={{ marginTop: 6 }} onClick={regenInvite}>
          Code leaked? Generate a new one
        </button>
      </div>

      <div className="section-title">Prices</div>
      <div className="card">
        <div className="row2">
          <div className="field">
            <label>Tiffin price (₹)</label>
            <input type="number" inputMode="decimal" value={tiffin} onChange={(e) => setTiffin(e.target.value)} />
          </div>
          <div className="field">
            <label>Extra roti (₹)</label>
            <input type="number" inputMode="decimal" value={roti} onChange={(e) => setRoti(e.target.value)} />
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          New prices apply to entries added from now on. Old entries keep the price that was active when they were saved.
        </p>
        <button className="btn" disabled={busy} onClick={saveRates}>{busy ? "Saving…" : "Save prices"}</button>
      </div>

      <div className="section-title">Members ({members.length})</div>
      <div className="card">
        {members.map((m) => (
          <div key={m.id} className="bal-row">
            <span className="who">
              {m.id === myId ? `${m.name} (me)` : m.name}
              <small>{m.phone}</small>
            </span>
            <button className="btn small danger" onClick={() => removeMember(m)}>
              {m.id === myId ? "Leave group" : "Remove"}
            </button>
          </div>
        ))}
        <p className="hint">
          Removing someone only takes away their access — every entry and payment with their
          name stays in the records.
        </p>
      </div>

      {!isStandalone() && (
        <>
          <div className="section-title">Install on your phone</div>
          <div className="card">
            {canPromptInstall() ? (
              <>
                <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
                  Installs like a normal app — own icon, full screen, no browser bar.
                </p>
                <button
                  className="btn"
                  onClick={async () => {
                    const ok = await promptInstall();
                    showToast(ok ? "Installed! Check your home screen" : "Install cancelled");
                  }}
                >
                  📲 Install app
                </button>
              </>
            ) : (
              <p className="hint" style={{ margin: 0, lineHeight: 1.7 }}>
                {isIOS()
                  ? "On iPhone: tap the Share button in Safari, then \"Add to Home Screen\"."
                  : "In Chrome: tap the ⋮ menu, then \"Add to Home screen\" / \"Install app\"."}
                {" "}It then opens like a normal app — own icon, full screen.
              </p>
            )}
          </div>
        </>
      )}

      <div className="section-title">My groups ({groups.length})</div>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>
          You stay a member of every group — this only changes which one you're viewing. Each
          group's entries, prices and balances are completely separate.
        </p>
        {groups.map((g) => (
          <div
            key={g.id}
            className="bal-row"
            style={{ cursor: "pointer" }}
            onClick={() => g.id !== group.id && onSwitchGroup(g.id)}
          >
            <span className="who">{g.name}</span>
            {g.id === group.id ? (
              <span className="pos">✓ viewing</span>
            ) : (
              <span style={{ color: "var(--brand-dark)", fontWeight: 600, fontSize: "0.85rem" }}>View</span>
            )}
          </div>
        ))}
        <div style={{ height: 10 }} />
        <button className="btn secondary" onClick={onAddGroup}>Create or join another group</button>
      </div>

      <button className="btn danger" onClick={() => supabase.auth.signOut()}>
        {isDemo ? "Exit demo (clears sample data)" : "Log out"}
      </button>
    </div>
  );
}
