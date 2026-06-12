// The money math IS the product — these tests keep it honest no matter who
// (or which AI tool) edits the app next. Run with: npm test
import { describe, expect, it } from "vitest";
import {
  Entry, EntryItem, Settlement,
  activeEntries, activeSettlements, entryTotal, fmtMoney, fmtQty,
  itemCost, personShare, personShares, sharedCost, sharerCount,
} from "./types";
import { computeBalances, settleSuggestions } from "./balance";

const item = (user_id: string, t: number, r: number, shared = false, extra = 0): EntryItem => ({
  id: "i-" + user_id, entry_id: "e1", user_id,
  tiffin_count: t, roti_count: r, in_shared: shared, extra_amount: extra,
});

const entry = (items: EntryItem[], over: Partial<Entry> = {}): Entry => ({
  id: "e1", group_id: "g", entry_date: "2026-06-10", payer_id: "A",
  tiffin_price: 70, roti_price: 10, shared_tiffin: 0, shared_roti: 0,
  note: null, created_by: "A", edited_by: null, edited_at: null,
  deleted_by: null, deleted_at: null, entry_items: items, ...over,
});

const settle = (from: string, to: string, amount: number, over: Partial<Settlement> = {}): Settlement => ({
  id: "s1", group_id: "g", from_user: from, to_user: to, amount,
  settle_date: "2026-06-10", note: null, created_by: to,
  deleted_by: null, deleted_at: null, ...over,
});

describe("item & entry costs", () => {
  it("itemCost = tiffin + roti + extras", () => {
    expect(itemCost(item("A", 1, 2), entry([]))).toBe(90);
    expect(itemCost(item("A", 1, 0, false, 30), entry([]))).toBe(100);
    expect(itemCost(item("A", 0.5, 0), entry([]))).toBe(35);
  });

  it("entryTotal = sum of items + shared pool", () => {
    const e = entry([item("A", 1, 0), item("B", 1, 1, true)], { shared_tiffin: 2 });
    expect(entryTotal(e)).toBe(70 + 80 + 140);
  });
});

describe("shared pool", () => {
  it("splits exactly among sharers — no paisa lost (2 tiffins / 3 people)", () => {
    const e = entry(
      [item("A", 0, 0, true), item("B", 0, 0, true), item("C", 0, 0, true)],
      { shared_tiffin: 2 }
    );
    expect(sharerCount(e)).toBe(3);
    expect(sharedCost(e)).toBe(140);
    const shares = personShares(e).map((s) => s.amount);
    // each share is the exact fraction, and they sum back to exactly 140
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(140, 10);
    expect(shares[0]).toBeCloseTo(140 / 3, 10);
  });

  it("own items + shared slice combine per person", () => {
    const e = entry(
      [item("A", 1, 0, true), item("B", 0, 0, true)],
      { shared_tiffin: 1 }
    );
    // A: own 70 + 35 shared; B: 35 shared
    expect(personShare(e.entry_items[0], e)).toBeCloseTo(105, 10);
    expect(personShare(e.entry_items[1], e)).toBeCloseTo(35, 10);
    expect(entryTotal(e)).toBe(140);
  });

  it("derived quantities include the shared slice", () => {
    const e = entry(
      [item("A", 1, 0, true), item("B", 0, 0, true)],
      { shared_tiffin: 1 }
    );
    const a = personShares(e).find((s) => s.user_id === "A")!;
    expect(a.tiffin_count).toBeCloseTo(1.5, 10);
  });
});

describe("balances", () => {
  it("payer is credited the total, eaters owe their shares; settlements shift both sides", () => {
    const e = entry([item("A", 1, 0), item("B", 1, 0)]); // A pays 140, both ate 70
    const bal = computeBalances([e], [settle("B", "A", 50)]);
    expect(bal.get("A")).toBeCloseTo(70 - 50, 10); // +70 owed, minus 50 received
    expect(bal.get("B")).toBeCloseTo(-70 + 50, 10);
  });

  it("balances always sum to zero", () => {
    const e1 = entry([item("A", 1, 2), item("B", 0.5, 0, true), item("C", 0, 0, true, 30)], {
      shared_tiffin: 2, shared_roti: 3, payer_id: "B",
    });
    const bal = computeBalances([e1], [settle("C", "B", 123.45)]);
    const sum = [...bal.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0, 8);
  });

  it("soft-deleted entries and payments count for nothing", () => {
    const live = entry([item("A", 1, 0), item("B", 1, 0)]);
    const dead = entry([item("B", 10, 0)], { id: "e2", deleted_at: "2026-06-11T00:00:00Z", deleted_by: "A" });
    const deadPay = settle("B", "A", 500, { id: "s2", deleted_at: "2026-06-11T00:00:00Z", deleted_by: "A" });
    const bal = computeBalances([live, dead], [deadPay]);
    expect(bal.get("B")).toBeCloseTo(-70, 10);
    expect(activeEntries([live, dead])).toHaveLength(1);
    expect(activeSettlements([deadPay])).toHaveLength(0);
  });

  it("settle suggestions clear all dues exactly", () => {
    const e = entry([item("A", 1, 0), item("B", 1, 0), item("C", 1, 0)]); // A paid 210
    const bal = computeBalances([e], []);
    const sug = settleSuggestions(bal);
    expect(sug).toHaveLength(2);
    for (const s of sug) expect(s.to).toBe("A");
    expect(sug.reduce((a, s) => a + s.amount, 0)).toBeCloseTo(140, 2);
  });
});

describe("formatting", () => {
  it("money rounds only at display time", () => {
    expect(fmtMoney(140 / 3)).toBe("₹46.67");
    expect(fmtMoney(140)).toBe("₹140");
    expect(fmtMoney(1690)).toBe("₹1,690");
  });
  it("quantities print clean", () => {
    expect(fmtQty(2 / 3 + 2 / 3 + 2 / 3)).toBe("2");
    expect(fmtQty(0.5)).toBe("0.5");
  });
});
