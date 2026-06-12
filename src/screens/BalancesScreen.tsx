import { useMemo, useRef, useState } from "react";
import { GroupData } from "../App";
import { computeBalances, settleSuggestions, Suggestion } from "../lib/balance";
import { supabase } from "../lib/supabase";
import {
  activeEntries, activeSettlements, entryTotal, fmtDate, fmtMoney, fmtQty,
  isDeleted, personShares, Settlement, todayStr,
} from "../lib/types";

interface Props {
  data: GroupData;
  myId: string;
  refresh: () => Promise<void>;
  showToast: (msg: string) => void;
}

export default function BalancesScreen({ data, myId, refresh, showToast }: Props) {
  const { group, members, people, entries, settlements } = data;
  const nameOf = (id: string) => people.find((m) => m.id === id)?.name || "?";

  const balances = useMemo(() => computeBalances(entries, settlements), [entries, settlements]);
  const suggestions = useMemo(() => settleSuggestions(balances), [balances]);

  // tap a balance row -> that person's ledger ("why is my balance this number?")
  const [detailId, setDetailId] = useState<string | null>(null);
  const [shownLedger, setShownLedger] = useState(12);
  const ledger = useMemo(() => {
    if (!detailId) return [];
    const rows: { date: string; label: string; amount: number }[] = [];
    for (const e of activeEntries(entries)) {
      if (e.payer_id === detailId)
        rows.push({ date: e.entry_date, label: "paid the vendor", amount: entryTotal(e) });
      const sh = personShares(e).find((s) => s.user_id === detailId);
      if (sh && sh.amount > 0.004)
        rows.push({
          date: e.entry_date,
          label: `ate ${fmtQty(sh.tiffin_count)} tiffin${sh.roti_count > 0.004 ? `, ${fmtQty(sh.roti_count)} roti` : ""}`,
          amount: -sh.amount,
        });
    }
    for (const s of activeSettlements(settlements)) {
      if (s.from_user === detailId)
        rows.push({ date: s.settle_date, label: `paid ${nameOf(s.to_user)} back`, amount: s.amount });
      if (s.to_user === detailId)
        rows.push({ date: s.settle_date, label: `received from ${nameOf(s.from_user)}`, amount: -s.amount });
    }
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, entries, settlements]);

  // settle-up form
  const [from, setFrom] = useState(myId);
  const [to, setTo] = useState(members.find((m) => m.id !== myId)?.id || myId);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  // audit range — defaults to the last 7 days
  const weekAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [fromDate, setFromDate] = useState(weekAgo());
  const [toDate, setToDate] = useState(todayStr());

  // payment history pagination
  const [shownPayments, setShownPayments] = useState(5);

  const saveSettlement = async (fromId: string, toId: string, amt: number) => {
    setBusy(true);
    const { error } = await supabase.from("settlements").insert({
      group_id: group.id,
      from_user: fromId,
      to_user: toId,
      amount: amt,
      settle_date: todayStr(),
      created_by: myId,
    });
    setBusy(false);
    if (error) return alert(error.message);
    await refresh();
    showToast("Payment recorded");
  };

  const recordSettlement = async () => {
    const amt = parseFloat(amount);
    if (!(amt > 0)) return alert("Enter a valid amount");
    if (from === to) return alert("Payer and receiver must be different");
    // typo guard: warn when the amount is more than this person's total dues
    const debt = Math.max(0, -(balances.get(from) || 0));
    if (
      amt > debt + 0.01 &&
      !confirm(
        `${nameOf(from)} currently owes ${fmtMoney(debt)} in total.\nRecord ${fmtMoney(amt)} anyway?`
      )
    )
      return;
    await saveSettlement(from, to, amt);
    setAmount("");
  };

  const delPayment = async (s: Settlement) => {
    if (
      !confirm(
        `Delete this payment? ${nameOf(s.from_user)} → ${nameOf(s.to_user)} ${fmtMoney(s.amount)}\n\nIt will stay in the list as a deleted record (with your name).`
      )
    )
      return;
    const { error } = await supabase
      .from("settlements")
      .update({ deleted_by: myId, deleted_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) return alert(error.message);
    await refresh();
    showToast("Payment deleted — record kept");
  };

  // tapping a "who pays whom" row pre-fills the form below (recording stays manual)
  const payFormRef = useRef<HTMLDivElement>(null);
  const prefill = (s: Suggestion) => {
    setFrom(s.from);
    setTo(s.to);
    setAmount(String(Math.round(s.amount * 100) / 100));
    payFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Form filled — tap Record payment to confirm");
  };

  const setRange =(kind: "week" | "month" | "lastMonth" | "all") => {
    const now = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (kind === "week") {
      setFromDate(weekAgo());
      setToDate(todayStr());
    } else if (kind === "month") {
      setFromDate(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setToDate(todayStr());
    } else if (kind === "lastMonth") {
      setFromDate(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setToDate(iso(new Date(now.getFullYear(), now.getMonth(), 0)));
    } else {
      setFromDate(entries.length ? entries[entries.length - 1].entry_date : todayStr());
      setToDate(todayStr());
    }
  };

  const auditText = useMemo(() => {
    const inRange = activeEntries(entries).filter((e) => e.entry_date >= fromDate && e.entry_date <= toDate);
    const stRange = activeSettlements(settlements).filter((s) => s.settle_date >= fromDate && s.settle_date <= toDate);
    const lines: string[] = [
      `🍱 ${group.name} — tiffin audit`,
      `${fmtDate(fromDate)} to ${fmtDate(toDate)}`,
      "",
    ];
    for (const m of members) {
      let tiffins = 0, rotis = 0, share = 0, paid = 0, days = 0;
      for (const e of inRange) {
        if (e.payer_id === m.id) paid += entryTotal(e);
        const sh = personShares(e).find((s) => s.user_id === m.id);
        if (sh) {
          days++;
          tiffins += sh.tiffin_count;
          rotis += sh.roti_count;
          share += sh.amount;
        }
      }
      let settled = 0;
      for (const s of stRange) {
        if (s.from_user === m.id) settled += s.amount;
        if (s.to_user === m.id) settled -= s.amount;
      }
      const net = paid - share + settled;
      lines.push(
        `${m.name}: ${days} days, ${fmtQty(tiffins)} tiffin, ${fmtQty(rotis)} roti`,
        `  ate ${fmtMoney(share)} | paid ${fmtMoney(paid)}${settled !== 0 ? ` | settled ${settled < 0 ? "−" : ""}${fmtMoney(Math.abs(settled))}` : ""} | net ${net >= 0 ? "+" : "−"}${fmtMoney(Math.abs(net))}`,
        ""
      );
    }
    if (stRange.length) {
      lines.push(`Payments recorded (${stRange.length}):`);
      for (const s of [...stRange].reverse())
        lines.push(
          `  ${fmtDate(s.settle_date)}: ${nameOf(s.from_user)} → ${nameOf(s.to_user)} ${fmtMoney(s.amount)}${s.created_by ? ` (added by ${nameOf(s.created_by)})` : ""}`
        );
      lines.push("");
    }
    const delE = entries.filter((e) => isDeleted(e) && e.entry_date >= fromDate && e.entry_date <= toDate);
    const delS = settlements.filter((s) => isDeleted(s) && s.settle_date >= fromDate && s.settle_date <= toDate);
    if (delE.length || delS.length) {
      lines.push("Deleted (not counted anywhere):");
      for (const e of delE)
        lines.push(`  ${fmtDate(e.entry_date)}: entry ${fmtMoney(entryTotal(e))} — deleted by ${nameOf(e.deleted_by || "")}`);
      for (const s of delS)
        lines.push(`  ${fmtDate(s.settle_date)}: payment ${nameOf(s.from_user)} → ${nameOf(s.to_user)} ${fmtMoney(s.amount)} — deleted by ${nameOf(s.deleted_by || "")}`);
      lines.push("");
    }
    const grand = inRange.reduce((s, e) => s + entryTotal(e), 0);
    lines.push(`Total spent: ${fmtMoney(grand)} across ${inRange.length} entries`);
    return lines.join("\n");
  }, [entries, settlements, members, group.name, fromDate, toDate]);

  const copyAudit = async () => {
    try {
      await navigator.clipboard.writeText(auditText);
      showToast("Copied — paste it in WhatsApp");
    } catch {
      alert(auditText);
    }
  };

  return (
    <div className="screen">
      <h2 className="page-title">
        Balances
        <small>+ gets money back · − owes the group</small>
      </h2>

      <div className="card">
        {members.map((m) => {
          const b = Math.round(((balances.get(m.id) || 0) + Number.EPSILON) * 100) / 100;
          return (
            <div
              key={m.id}
              className="bal-row clickable"
              onClick={() => {
                setDetailId(detailId === m.id ? null : m.id);
                setShownLedger(12);
              }}
            >
              <span className="who">
                {m.id === myId ? `${m.name} (me)` : m.name}
                {detailId === m.id ? " ▾" : ""}
              </span>
              <span className={b > 0.009 ? "pos" : b < -0.009 ? "neg" : "zero"}>
                {b > 0.009 ? "+" : b < -0.009 ? "−" : ""}{fmtMoney(Math.abs(b))}
              </span>
            </div>
          );
        })}
        <p className="hint">Tap a name to see exactly how their number adds up.</p>
      </div>

      {detailId && (
        <div className="card">
          <div className="card-head">
            <strong>{nameOf(detailId)} — line by line</strong>
            <button className="btn small ghost" onClick={() => setDetailId(null)}>✕ close</button>
          </div>
          {ledger.slice(0, shownLedger).map((row, i) => (
            <div key={i} className="preview-row">
              <span>
                {fmtDate(row.date)} · {row.label}
              </span>
              <b className={row.amount >= 0 ? "pos" : "neg"}>
                {row.amount >= 0 ? "+" : "−"}{fmtMoney(Math.abs(row.amount))}
              </b>
            </div>
          ))}
          {ledger.length > shownLedger && (
            <button className="btn ghost" style={{ marginTop: 6 }} onClick={() => setShownLedger(shownLedger + 20)}>
              See more ({ledger.length - shownLedger} older)
            </button>
          )}
          <div className="preview-row" style={{ fontWeight: 700 }}>
            <span>Net balance</span>
            <b className={(balances.get(detailId) || 0) > 0.009 ? "pos" : (balances.get(detailId) || 0) < -0.009 ? "neg" : "zero"}>
              {(balances.get(detailId) || 0) > 0.009 ? "+" : (balances.get(detailId) || 0) < -0.009 ? "−" : ""}
              {fmtMoney(Math.abs(balances.get(detailId) || 0))}
            </b>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <div className="section-title">Who pays whom</div>
          <div className="card">
            {suggestions.map((s, i) => (
              <div key={i} className="bal-row clickable" onClick={() => prefill(s)}>
                <span className="who" style={{ fontWeight: 400 }}>
                  <b>{nameOf(s.from)}</b> pays <b>{nameOf(s.to)}</b>
                </span>
                <b>{fmtMoney(s.amount)}</b>
              </div>
            ))}
            <p className="hint">The simplest way to clear all dues. Tap a line to fill the form below.</p>
          </div>
        </>
      )}

      <div className="section-title" ref={payFormRef}>Record a payment</div>
      <div className="card">
        <div className="row2">
          <div className="field">
            <label>From</label>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>To</label>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Amount (₹) — partial is fine</label>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
        </div>
        <button className="btn" disabled={busy} onClick={recordSettlement}>
          {busy ? "Saving…" : "Record payment"}
        </button>
      </div>

      {settlements.length > 0 && (
        <>
          <div className="section-title">
            Past payments ({activeSettlements(settlements).length})
          </div>
          <div className="card">
            {settlements.slice(0, shownPayments).map((s) =>
              isDeleted(s) ? (
                <div key={s.id} className="bal-row">
                  <span className="who struck" style={{ fontWeight: 400 }}>
                    {fmtDate(s.settle_date)} · <b>{nameOf(s.from_user)}</b> → <b>{nameOf(s.to_user)}</b>
                    <small className="deleted-by">deleted by {nameOf(s.deleted_by || "")} — not counted</small>
                  </span>
                  <span className="struck" style={{ fontWeight: 700 }}>{fmtMoney(s.amount)}</span>
                </div>
              ) : (
                <div key={s.id} className="bal-row">
                  <span className="who" style={{ fontWeight: 400 }}>
                    {fmtDate(s.settle_date)} · <b>{nameOf(s.from_user)}</b> → <b>{nameOf(s.to_user)}</b>
                    <small>added by {s.created_by ? nameOf(s.created_by) : "?"}</small>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>{fmtMoney(s.amount)}</span>
                    <button className="remove-x" onClick={() => delPayment(s)} aria-label="delete payment">
                      ✕
                    </button>
                  </span>
                </div>
              )
            )}
            {settlements.length > shownPayments && (
              <button
                className="btn ghost"
                style={{ marginTop: 6 }}
                onClick={() => setShownPayments(shownPayments + 10)}
              >
                See more ({settlements.length - shownPayments} older)
              </button>
            )}
          </div>
        </>
      )}

      <div className="section-title">Audit report</div>
      <div className="card">
        <div className="range-chips">
          <button onClick={() => setRange("week")}>Last 7 days</button>
          <button onClick={() => setRange("month")}>This month</button>
          <button onClick={() => setRange("lastMonth")}>Last month</button>
          <button onClick={() => setRange("all")}>All time</button>
        </div>
        <div className="row2">
          <div className="field">
            <label>From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="field">
            <label>To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
        <pre className="audit">{auditText}</pre>
        <div style={{ height: 10 }} />
        <button className="btn secondary" onClick={copyAudit}>Copy report for WhatsApp</button>
      </div>
    </div>
  );
}
