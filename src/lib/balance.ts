import { Entry, Settlement, personShare, entryTotal, activeEntries, activeSettlements } from "./types";

// Positive balance = this person should receive money; negative = they owe.
// Soft-deleted entries/payments are excluded — tombstones don't count.
export function computeBalances(entries: Entry[], settlements: Settlement[]): Map<string, number> {
  const bal = new Map<string, number>();
  const add = (id: string, amt: number) => bal.set(id, (bal.get(id) || 0) + amt);

  for (const e of activeEntries(entries)) {
    add(e.payer_id, entryTotal(e));
    for (const it of e.entry_items) add(it.user_id, -personShare(it, e));
  }
  for (const s of activeSettlements(settlements)) {
    add(s.from_user, s.amount);
    add(s.to_user, -s.amount);
  }
  return bal;
}

export interface Suggestion {
  from: string;
  to: string;
  amount: number;
}

// Greedy "who pays whom" simplification, like Splitwise's settle up.
export function settleSuggestions(balances: Map<string, number>): Suggestion[] {
  const debtors = [...balances.entries()].filter(([, v]) => v < -0.01).map(([id, v]) => ({ id, amt: -v }));
  const creditors = [...balances.entries()].filter(([, v]) => v > 0.01).map(([id, v]) => ({ id, amt: v }));
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const out: Suggestion[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(pay * 100) / 100 });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }
  return out;
}
