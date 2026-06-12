import { GroupData } from "../App";
import { supabase } from "../lib/supabase";
import { Entry, entryTotal, fmtDate, fmtMoney, fmtMonth, fmtQty, isDeleted, personShares } from "../lib/types";

interface Props {
  data: GroupData;
  myId: string;
  refresh: () => Promise<void>;
  onEdit: (e: Entry) => void;
  showToast: (msg: string) => void;
}

export default function HistoryScreen({ data, myId, refresh, onEdit, showToast }: Props) {
  const { entries, people } = data;
  const nameOf = (id: string) => people.find((m) => m.id === id)?.name || "?";
  const firstName = (id: string) => nameOf(id).split(" ")[0];
  const activeCount = entries.filter((e) => !isDeleted(e)).length;

  const del = async (e: Entry) => {
    if (
      !confirm(
        `Delete the entry for ${fmtDate(e.entry_date)} (${fmtMoney(entryTotal(e))})?\n\nIt will stay in the list as a deleted record (with your name), and can be restored.`
      )
    )
      return;
    const { error } = await supabase
      .from("entries")
      .update({ deleted_by: myId, deleted_at: new Date().toISOString() })
      .eq("id", e.id);
    if (error) return alert(error.message);
    await refresh();
    showToast("Entry deleted — tombstone kept");
  };

  const restore = async (e: Entry) => {
    if (!confirm(`Restore the deleted entry for ${fmtDate(e.entry_date)}?`)) return;
    const { error } = await supabase
      .from("entries")
      .update({ deleted_by: null, deleted_at: null, edited_by: myId, edited_at: new Date().toISOString() })
      .eq("id", e.id);
    if (error) return alert(error.message);
    await refresh();
    showToast("Entry restored");
  };

  // group by month, newest first (entries already arrive sorted by date desc);
  // tombstones stay visible in place but don't count toward totals
  const months: { key: string; label: string; total: number; items: Entry[] }[] = [];
  for (const e of entries) {
    const key = e.entry_date.slice(0, 7);
    let bucket = months[months.length - 1];
    if (!bucket || bucket.key !== key) {
      bucket = { key, label: fmtMonth(e.entry_date), total: 0, items: [] };
      months.push(bucket);
    }
    if (!isDeleted(e)) bucket.total += entryTotal(e);
    bucket.items.push(e);
  }

  return (
    <div className="screen">
      <h2 className="page-title">
        History
        <small>{activeCount} entr{activeCount === 1 ? "y" : "ies"} · tap to edit</small>
      </h2>

      {!entries.length && (
        <div className="empty">No entries yet.<br />Add today's tiffin from the Add tab.</div>
      )}

      {months.map((mo) => (
        <div key={mo.key}>
          <div className="month-head">
            <span>{mo.label}</span>
            <b>{fmtMoney(mo.total)}</b>
          </div>
          {mo.items.map((e) => {
            const tiffins =
              e.entry_items.reduce((s, i) => s + i.tiffin_count, 0) + (e.shared_tiffin || 0);
            const rotis =
              e.entry_items.reduce((s, i) => s + i.roti_count, 0) + (e.shared_roti || 0);
            const shared = (e.shared_tiffin || 0) > 0 || (e.shared_roti || 0) > 0;
            const who = e.entry_items.map((i) => firstName(i.user_id)).join(", ");
            const shares = personShares(e);
            if (isDeleted(e))
              return (
                <div key={e.id} className="card entry-card tombstone">
                  <div className="meta">
                    <div className="date struck">
                      {fmtDate(e.entry_date)}
                      {e.note ? (
                        <span style={{ fontWeight: 400 }}> · {e.note}</span>
                      ) : null}
                    </div>
                    <div className="sub struck">
                      {fmtQty(tiffins)} tiffin{tiffins !== 1 ? "s" : ""}
                      {rotis > 0 ? `, ${fmtQty(rotis)} roti${rotis !== 1 ? "s" : ""}` : ""} · {who}
                    </div>
                    <div className="sub deleted-by">
                      Deleted by {firstName(e.deleted_by || "")} — not counted anywhere
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="amt struck">{fmtMoney(entryTotal(e))}</div>
                    <button
                      className="btn small secondary"
                      style={{ marginTop: 6 }}
                      onClick={() => restore(e)}
                    >
                      Restore
                    </button>
                  </div>
                </div>
              );
            return (
              <div key={e.id} className="card entry-card" onClick={() => onEdit(e)}>
                <div className="meta">
                  <div className="date">
                    {fmtDate(e.entry_date)}
                    {e.note ? (
                      <span style={{ fontWeight: 400, color: "var(--muted)" }}> · {e.note}</span>
                    ) : null}
                  </div>
                  <div className="sub">
                    {fmtQty(tiffins)} tiffin{tiffins !== 1 ? "s" : ""}
                    {rotis > 0 ? `, ${fmtQty(rotis)} roti${rotis !== 1 ? "s" : ""}` : ""}
                    {shared ? " (incl. shared)" : ""} · {who}
                  </div>
                  <div className="sub">
                    Paid by {nameOf(e.payer_id)}
                    {e.created_by ? ` · added by ${firstName(e.created_by)}` : ""}
                    {e.edited_by ? ` · edited by ${firstName(e.edited_by)}` : ""}
                  </div>
                  <div className="history-shares">
                    {shares.map((s) => (
                      <span key={s.user_id}>
                        {firstName(s.user_id)} {fmtMoney(s.amount)}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="amt">{fmtMoney(entryTotal(e))}</div>
                  <button
                    className="btn small danger"
                    style={{ marginTop: 6 }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      del(e);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
