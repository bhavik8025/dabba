import { useEffect, useMemo, useState } from "react";
import { GroupData } from "../App";
import { supabase } from "../lib/supabase";
import { activeEntries, Entry, fmtMoney, fmtQty, roundQty, todayStr } from "../lib/types";

interface ItemDraft {
  on: boolean; // has individual items
  tiffin: number;
  roti: number;
  extra: number; // one-off extras in ₹ (sweet, papad, cold drink…)
  shared: boolean; // participates in the shared pool
}

interface Props {
  data: GroupData;
  myId: string;
  editing: Entry | null;
  onDone: (msg: string) => void;
  onCancelEdit: () => void;
}

export default function AddEntryScreen({ data, myId, editing, onDone, onCancelEdit }: Props) {
  const { group, members, entries } = data;

  const blankItems = () =>
    Object.fromEntries(
      members.map((m) => [m.id, { on: false, tiffin: 0, roti: 0, extra: 0, shared: false } as ItemDraft])
    );

  const [date, setDate] = useState(todayStr());
  const [payer, setPayer] = useState(myId);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<Record<string, ItemDraft>>(blankItems);
  const [sharedT, setSharedT] = useState(0);
  const [sharedR, setSharedR] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadEntry = (e: Entry) => {
    setPayer(e.payer_id);
    setNote(e.note || "");
    const next = blankItems();
    for (const it of e.entry_items) {
      next[it.user_id] = {
        on: it.tiffin_count > 0 || it.roti_count > 0 || (it.extra_amount || 0) > 0,
        tiffin: it.tiffin_count,
        roti: it.roti_count,
        extra: it.extra_amount || 0,
        shared: !!it.in_shared,
      };
    }
    setItems(next);
    setSharedT(e.shared_tiffin || 0);
    setSharedR(e.shared_roti || 0);
  };

  useEffect(() => {
    if (!editing) return;
    setDate(editing.entry_date);
    loadEntry(editing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, members]);

  const copyLast = () => {
    const last = activeEntries(entries)[0];
    if (last) loadEntry(last);
  };

  const setItem = (id: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  // prices: snapshot from group for new entries, keep original for edits
  const tp = editing ? editing.tiffin_price : group.tiffin_price;
  const rp = editing ? editing.roti_price : group.roti_price;

  const sharedPeople = useMemo(
    () => members.filter((m) => items[m.id]?.shared),
    [members, items]
  );

  const preview = useMemo(() => {
    const sharedCostEach =
      sharedPeople.length > 0 ? (sharedT * tp + sharedR * rp) / sharedPeople.length : 0;
    return members
      .map((m) => {
        const it = items[m.id] || { on: false, tiffin: 0, roti: 0, extra: 0, shared: false };
        const own = it.on ? it.tiffin * tp + it.roti * rp + it.extra : 0;
        const shared = it.shared ? sharedCostEach : 0;
        return { member: m, total: own + shared };
      })
      .filter((row) => row.total > 0);
  }, [items, members, sharedPeople.length, sharedT, sharedR, tp, rp]);

  const total = useMemo(() => preview.reduce((s, row) => s + row.total, 0), [preview]);

  const save = async () => {
    setError("");
    const hasIndividual = members.some((m) => {
      const it = items[m.id];
      return it?.on && (it.tiffin > 0 || it.roti > 0 || it.extra > 0);
    });
    const hasShared = (sharedT > 0 || sharedR > 0) && sharedPeople.length > 0;

    if (!date || !items[payer]) return setError("Pick a date and payer");
    if (!hasIndividual && !hasShared) return setError("Add individual food or shared food");
    if ((sharedT > 0 || sharedR > 0) && sharedPeople.length === 0)
      return setError("Tick who is sharing the shared food");

    const active = members.filter((m) => {
      const it = items[m.id];
      return (it?.on && (it.tiffin > 0 || it.roti > 0 || it.extra > 0)) || (hasShared && it?.shared);
    });

    setBusy(true);
    try {
      let entryId: string;
      if (editing) {
        const { error: e1 } = await supabase
          .from("entries")
          .update({
            entry_date: date,
            payer_id: payer,
            shared_tiffin: hasShared ? sharedT : 0,
            shared_roti: hasShared ? sharedR : 0,
            note: note.trim() || null,
            edited_by: myId,
            edited_at: new Date().toISOString(),
          })
          .eq("id", editing.id);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("entry_items").delete().eq("entry_id", editing.id);
        if (e2) throw e2;
        entryId = editing.id;
      } else {
        const { data: row, error: e1 } = await supabase
          .from("entries")
          .insert({
            group_id: group.id,
            entry_date: date,
            payer_id: payer,
            tiffin_price: tp,
            roti_price: rp,
            shared_tiffin: hasShared ? sharedT : 0,
            shared_roti: hasShared ? sharedR : 0,
            note: note.trim() || null,
            created_by: myId,
          })
          .select("id")
          .single();
        if (e1) throw e1;
        entryId = row.id;
      }

      const { error: e3 } = await supabase.from("entry_items").insert(
        active.map((m) => {
          const it = items[m.id];
          return {
            entry_id: entryId,
            user_id: m.id,
            tiffin_count: it.on ? it.tiffin : 0,
            roti_count: it.on ? it.roti : 0,
            extra_amount: it.on ? it.extra : 0,
            in_shared: hasShared && it.shared,
          };
        })
      );
      if (e3) throw e3;

      setDate(todayStr());
      setPayer(myId);
      setNote("");
      setItems(blankItems());
      setSharedT(0);
      setSharedR(0);
      onDone(editing ? "Entry updated" : "Entry saved");
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <div className="page-head">
        {editing && (
          <button className="back-btn" onClick={onCancelEdit} aria-label="Go back">←</button>
        )}
        <h2 className="page-title">
          {editing ? "Edit entry" : "Add tiffin entry"}
          <small>
            Tiffin {fmtMoney(tp)} · Extra roti {fmtMoney(rp)}
          </small>
        </h2>
      </div>

      <div className="card">
        <div className="row2">
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Who paid?</label>
            <select value={payer} onChange={(e) => setPayer(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === myId ? `${m.name} (me)` : m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. dinner" />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <strong>Individual</strong>
          {!editing && entries.length > 0 && (
            <button className="btn small secondary" onClick={copyLast}>Same as last time</button>
          )}
        </div>
        {members
          .filter((m) => items[m.id]?.on)
          .map((m) => {
            const it = items[m.id];
            return (
              <div key={m.id} className="member-row">
                <button
                  className="remove-x"
                  onClick={() => setItem(m.id, { on: false, tiffin: 0, roti: 0, extra: 0 })}
                  aria-label={`remove ${m.name}`}
                >
                  ✕
                </button>
                <span className="name">{m.id === myId ? `${m.name} (me)` : m.name}</span>
                <div className="stepper">
                  <span className="lbl">tiffin</span>
                  <button onClick={() => setItem(m.id, { tiffin: roundQty(Math.max(0, it.tiffin - 0.5)) })}>-</button>
                  <span className="val">{fmtQty(it.tiffin)}</span>
                  <button onClick={() => setItem(m.id, { tiffin: roundQty(it.tiffin + 0.5) })}>+</button>
                </div>
                <div className="stepper">
                  <span className="lbl">roti</span>
                  <button onClick={() => setItem(m.id, { roti: roundQty(Math.max(0, it.roti - 1)) })}>-</button>
                  <span className="val">{fmtQty(it.roti)}</span>
                  <button onClick={() => setItem(m.id, { roti: roundQty(it.roti + 1) })}>+</button>
                </div>
                <div className="stepper">
                  <span className="lbl">extra ₹</span>
                  <input
                    className="extra-in"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    placeholder="0"
                    value={it.extra || ""}
                    onChange={(ev) =>
                      setItem(m.id, { extra: Math.max(0, parseFloat(ev.target.value) || 0) })
                    }
                  />
                </div>
              </div>
            );
          })}
        {members.some((m) => !items[m.id]?.on) && (
          <div className="field" style={{ margin: "8px 0 0" }}>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setItem(e.target.value, { on: true, tiffin: 1, roti: 0 });
              }}
            >
              <option value="">+ Add person for individual items…</option>
              {members
                .filter((m) => !items[m.id]?.on)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === myId ? `${m.name} (me)` : m.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <strong>Shared</strong>
          <span className="hint-inline">{sharedPeople.length} selected</span>
        </div>
        <div className="shared-controls">
          <div className="stepper">
            <span className="lbl">tiffin</span>
            <button onClick={() => setSharedT(roundQty(Math.max(0, sharedT - 0.5)))}>-</button>
            <span className="val">{fmtQty(sharedT)}</span>
            <button onClick={() => setSharedT(roundQty(sharedT + 0.5))}>+</button>
          </div>
          <div className="stepper">
            <span className="lbl">roti</span>
            <button onClick={() => setSharedR(roundQty(Math.max(0, sharedR - 1)))}>-</button>
            <span className="val">{fmtQty(sharedR)}</span>
            <button onClick={() => setSharedR(roundQty(sharedR + 1))}>+</button>
          </div>
        </div>
        {members.map((m) => {
          const it = items[m.id] || { on: false, tiffin: 0, roti: 0, shared: false };
          return (
            <div key={m.id} className={`member-row compact ${it.shared ? "" : "off"}`}>
              <button
                className="member-check"
                onClick={() => setItem(m.id, { shared: !it.shared })}
                aria-label={`toggle shared for ${m.name}`}
              >
                {it.shared ? "✓" : ""}
              </button>
              <span className="name">{m.id === myId ? `${m.name} (me)` : m.name}</span>
            </div>
          );
        })}
        <p className="hint">
          Shared food is divided only among the people ticked here. A person can be in both Individual and Shared.
        </p>
      </div>

      {preview.length > 0 && (
        <div className="card">
          <div className="card-head">
            <strong>Amount preview</strong>
            <b>{fmtMoney(total)}</b>
          </div>
          {preview.map((row) => (
            <div key={row.member.id} className="preview-row">
              <span>{row.member.id === myId ? `${row.member.name} (me)` : row.member.name}</span>
              <b>{fmtMoney(row.total)}</b>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy} onClick={save}>
        {busy ? "Saving..." : `${editing ? "Update" : "Save"} entry · ${fmtMoney(total)}`}
      </button>
      {editing && (
        <button className="btn ghost" onClick={onCancelEdit}>Cancel editing</button>
      )}
    </div>
  );
}
