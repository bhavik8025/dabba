// Demo mode: a tiny stand-in for the Supabase client backed by localStorage,
// so the whole app can be tried locally without creating a backend.
// It implements only the query-builder surface the app actually uses.

const DB_KEY = "tiffin-demo-db-v4";
export const DEMO_FLAG = "tiffin-demo";
export const DEMO_USER_ID = "demo-me";

type Row = Record<string, any>;
type Db = Record<string, Row[]>;

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const dstr = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function seed(): Db {
  const gid = "demo-group";
  const P = { me: DEMO_USER_ID, raj: "demo-raj", amit: "demo-amit", priya: "demo-priya" };
  const profiles = [
    { id: P.me, name: "Bhavik", phone: "98XXXXXX01" },
    { id: P.raj, name: "Raj", phone: "98XXXXXX02" },
    { id: P.amit, name: "Amit", phone: "98XXXXXX03" },
    { id: P.priya, name: "Priya", phone: "98XXXXXX04" },
  ];
  const groups = [
    { id: gid, name: "Tiffin Gang (Demo)", invite_code: "DEMO12", tiffin_price: 70, roti_price: 10, created_by: P.me },
  ];
  const group_members = Object.values(P).map((user_id) => ({ group_id: gid, user_id }));

  const entries: Row[] = [];
  const entry_items: Row[] = [];
  // items: [user, ownTiffin, ownRoti, inShared?, extra₹?]
  const mk = (
    daysAgo: number, payer: string, items: [string, number, number, boolean?, number?][],
    note?: string, sharedT = 0, sharedR = 0, addedBy?: string
  ) => {
    const id = uuid();
    entries.push({
      id, group_id: gid, entry_date: dstr(daysAgo), payer_id: payer,
      tiffin_price: 70, roti_price: 10, shared_tiffin: sharedT, shared_roti: sharedR,
      note: note || null,
      created_by: addedBy || payer, created_at: new Date(Date.now() - daysAgo * 864e5).toISOString(),
    });
    for (const [user_id, tiffin_count, roti_count, in_shared, extra] of items)
      entry_items.push({
        id: uuid(), entry_id: id, user_id, tiffin_count, roti_count,
        in_shared: !!in_shared, extra_amount: extra || 0,
      });
  };
  // last month (shows month grouping + monthly totals)
  mk(34, P.me, [[P.me, 1, 0], [P.raj, 1, 0], [P.amit, 1, 0], [P.priya, 1, 0]]);
  mk(33, P.raj, [[P.me, 1, 2], [P.raj, 1, 0], [P.amit, 1, 0]]);
  mk(32, P.me, [[P.me, 0, 0, true], [P.raj, 0, 0, true], [P.priya, 0, 0, true]], "3 shared 2 tiffins", 2, 0);
  // this week
  mk(6, P.me, [[P.me, 1, 0], [P.raj, 1, 2], [P.amit, 1, 0], [P.priya, 1, 0]]);
  mk(5, P.me, [[P.me, 1, 0], [P.raj, 1, 0], [P.amit, 2, 0]], "Amit's cousin visited");
  // Amit later corrected this one — shows the "edited by" audit trail
  Object.assign(entries[entries.length - 1], {
    edited_by: P.amit,
    edited_at: new Date(Date.now() - 4 * 864e5).toISOString(),
  });
  mk(4, P.raj, [[P.me, 1, 2], [P.raj, 1, 0], [P.priya, 1, 0]]);
  // double-entered by mistake, then deleted — shows the tombstone trail
  mk(4, P.me, [[P.me, 1, 2], [P.raj, 1, 0], [P.priya, 1, 0]], "duplicate, ignore");
  Object.assign(entries[entries.length - 1], {
    deleted_by: P.raj,
    deleted_at: new Date(Date.now() - 3 * 864e5).toISOString(),
  });
  mk(3, P.me, [[P.me, 1, 0], [P.amit, 1, 0], [P.priya, 1, 3, false, 30]], "Priya's sweet ₹30");
  mk(2, P.me, [[P.me, 0, 0, true], [P.raj, 0, 0, true], [P.amit, 0, 0, true]], "2 tiffins shared by 3", 2, 0);
  mk(1, P.amit, [[P.me, 1, 0], [P.raj, 1, 0, true], [P.amit, 0, 0, true], [P.priya, 1, 0]], "Raj+Amit also shared one", 1, 0, P.raj);
  mk(0, P.me, [[P.me, 1, 0], [P.raj, 1, 1], [P.amit, 1, 0]]);

  const settlements = [
    {
      id: uuid(), group_id: gid, from_user: P.raj, to_user: P.me, amount: 200,
      settle_date: dstr(2), note: null, created_by: P.me, created_at: new Date().toISOString(),
      deleted_by: null, deleted_at: null,
    },
    {
      // typo (₹500 instead of ₹50), deleted with a visible trace
      id: uuid(), group_id: gid, from_user: P.amit, to_user: P.me, amount: 500,
      settle_date: dstr(3), note: null, created_by: P.me, created_at: new Date().toISOString(),
      deleted_by: P.me, deleted_at: new Date(Date.now() - 2 * 864e5).toISOString(),
    },
    {
      id: uuid(), group_id: gid, from_user: P.priya, to_user: P.me, amount: 150,
      settle_date: dstr(20), note: null, created_by: P.me, created_at: new Date().toISOString(),
      deleted_by: null, deleted_at: null,
    },
  ];
  return { profiles, groups, group_members, entries, entry_items, settlements };
}

function load(): Db {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch { /* re-seed below */ }
  }
  const db = seed();
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}

const save = (db: Db) => localStorage.setItem(DB_KEY, JSON.stringify(db));

class DemoQuery implements PromiseLike<{ data: any; error: any }> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private cols = "*";
  private filters: [string, any][] = [];
  private inFilters: [string, any[]][] = [];
  private orders: [string, boolean][] = [];
  private isSingle = false;
  private lim = Infinity;
  private rows: Row[] = [];
  private patch: Row = {};
  private returning = false;

  constructor(private table: string) {}

  select(cols = "*") {
    if (this.op === "insert") this.returning = true;
    else this.cols = cols;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push([col, val]);
    return this;
  }
  in(col: string, vals: any[]) {
    this.inFilters.push([col, vals]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push([col, opts?.ascending !== false]);
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  single() {
    this.isSingle = true;
    return this;
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private embed(db: Db, r: Row): Row {
    if (this.table === "entries" && this.cols.includes("entry_items"))
      return { ...r, entry_items: db.entry_items.filter((it) => it.entry_id === r.id) };
    if (this.table === "group_members" && this.cols.includes("profiles"))
      return { ...r, profiles: db.profiles.find((p) => p.id === r.user_id) };
    return r;
  }

  private run(): { data: any; error: any } {
    const db = load();
    const match = (r: Row) =>
      this.filters.every(([c, v]) => r[c] === v) &&
      this.inFilters.every(([c, vals]) => vals.includes(r[c]));
    let data: any = null;

    if (this.op === "insert") {
      for (const r of this.rows) {
        if (!r.id && this.table !== "group_members") r.id = uuid();
        if (!r.created_at) r.created_at = new Date().toISOString();
        db[this.table].push(r);
      }
      data = this.returning ? (this.isSingle ? this.rows[0] : this.rows) : null;
    } else if (this.op === "update") {
      for (const r of db[this.table]) if (match(r)) Object.assign(r, this.patch);
    } else if (this.op === "delete") {
      const dead = db[this.table].filter(match);
      db[this.table] = db[this.table].filter((r) => !match(r));
      if (this.table === "entries")
        db.entry_items = db.entry_items.filter((it) => !dead.some((d) => d.id === it.entry_id));
    } else {
      let rows = db[this.table].filter(match);
      for (const [col, asc] of [...this.orders].reverse())
        rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
      rows = rows.slice(0, this.lim).map((r) => this.embed(db, r));
      data = this.isSingle ? rows[0] ?? null : rows;
    }

    if (this.op !== "select") save(db);
    return { data, error: null };
  }
}

export const demoClient = {
  from: (table: string) => new DemoQuery(table),

  rpc: async (name: string, params: Row) => {
    const db = load();
    if (name === "create_group") {
      const gid = uuid();
      db.groups.push({
        id: gid, name: params.p_name, invite_code: "DEMO" + Math.floor(10 + Math.random() * 90),
        tiffin_price: params.p_tiffin, roti_price: params.p_roti, created_by: DEMO_USER_ID,
      });
      db.group_members.push({ group_id: gid, user_id: DEMO_USER_ID });
      save(db);
      return { data: gid, error: null };
    }
    if (name === "regenerate_invite") {
      const g = db.groups.find((x) => x.id === params.p_group);
      if (!g) return { data: null, error: { message: "Group not found" } };
      g.invite_code = "DEMO" + Math.floor(10 + Math.random() * 90);
      save(db);
      return { data: g.invite_code, error: null };
    }
    if (name === "join_group") {
      const g = db.groups.find((x) => x.invite_code === String(params.p_code).toUpperCase().trim());
      if (!g) return { data: null, error: { message: "Invalid invite code" } };
      if (!db.group_members.some((m) => m.group_id === g.id && m.user_id === DEMO_USER_ID))
        db.group_members.push({ group_id: g.id, user_id: DEMO_USER_ID });
      save(db);
      return { data: g.id, error: null };
    }
    return { data: null, error: { message: `Unknown RPC ${name}` } };
  },

  auth: {
    getSession: async () => ({ data: { session: { user: { id: DEMO_USER_ID } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => {
      localStorage.removeItem(DEMO_FLAG);
      localStorage.removeItem(DB_KEY);
      location.reload();
    },
    signUp: async () => ({ data: {}, error: null }),
    signInWithPassword: async () => ({ data: {}, error: null }),
  },
};

export const enterDemo = () => {
  localStorage.setItem(DEMO_FLAG, "1");
  location.reload();
};
