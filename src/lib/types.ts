export interface Profile {
  id: string;
  name: string;
  phone: string;
}

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  tiffin_price: number;
  roti_price: number;
  created_by: string;
}

export interface EntryItem {
  id: string;
  entry_id: string;
  user_id: string;
  // own (individual) items only — shared slice is derived from in_shared
  tiffin_count: number;
  roti_count: number;
  in_shared: boolean;
  // one-off extras in rupees (sweet, papad, cold drink…)
  extra_amount: number;
}

export interface Entry {
  id: string;
  group_id: string;
  entry_date: string; // yyyy-mm-dd
  payer_id: string;
  tiffin_price: number;
  roti_price: number;
  // the shared pool, split equally among items with in_shared = true
  shared_tiffin: number;
  shared_roti: number;
  note: string | null;
  created_by: string;
  // audit trail: null until someone edits the entry
  edited_by: string | null;
  edited_at: string | null;
  // soft delete: deleted entries stay visible as tombstones
  deleted_by: string | null;
  deleted_at: string | null;
  entry_items: EntryItem[];
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  settle_date: string;
  note: string | null;
  created_by: string;
  deleted_by: string | null;
  deleted_at: string | null;
}

export const isDeleted = (x: { deleted_at?: string | null }) => !!x.deleted_at;
export const activeEntries = (es: Entry[]) => es.filter((e) => !isDeleted(e));
export const activeSettlements = (ss: Settlement[]) => ss.filter((s) => !isDeleted(s));

export const itemCost = (it: EntryItem, e: Entry) =>
  it.tiffin_count * e.tiffin_price + it.roti_count * e.roti_price + (it.extra_amount || 0);

export const sharedCost = (e: Entry) =>
  (e.shared_tiffin || 0) * e.tiffin_price + (e.shared_roti || 0) * e.roti_price;

export const sharerCount = (e: Entry) =>
  e.entry_items.filter((it) => it.in_shared).length;

// what one participant owes: own items + an equal slice of the shared pool
export const personShare = (it: EntryItem, e: Entry) =>
  itemCost(it, e) + (it.in_shared ? sharedCost(e) / Math.max(1, sharerCount(e)) : 0);

// per-person breakdown incl. derived quantities (for chips and audit)
export const personShares = (e: Entry) => {
  const n = Math.max(1, sharerCount(e));
  return e.entry_items.map((it) => ({
    user_id: it.user_id,
    amount: personShare(it, e),
    tiffin_count: it.tiffin_count + (it.in_shared ? (e.shared_tiffin || 0) / n : 0),
    roti_count: it.roti_count + (it.in_shared ? (e.shared_roti || 0) / n : 0),
  }));
};

export const entryTotal = (e: Entry) =>
  e.entry_items.reduce((s, it) => s + itemCost(it, e), 0) + sharedCost(e);

export const roundQty = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

export const fmtQty = (n: number) =>
  roundQty(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const fmtMoney = (n: number) => {
  const r = Math.round((n + Number.EPSILON) * 100) / 100;
  return (
    "₹" +
    (Number.isInteger(r)
      ? r.toLocaleString("en-IN")
      : r.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  );
};

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

export const fmtMonth = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};
