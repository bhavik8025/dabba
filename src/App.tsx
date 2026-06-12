import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isConfigured, isDemo } from "./lib/supabase";
import { enterDemo } from "./lib/demo";
import { Entry, Group, Profile, Settlement } from "./lib/types";
import "./lib/install"; // captures the PWA install prompt early
import AuthScreen from "./screens/AuthScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import MainShell from "./screens/MainShell";

export interface GroupData {
  groups: Group[]; // every group I'm a member of
  group: Group; // the one currently being viewed
  members: Profile[]; // current members — used for pickers and balances
  people: Profile[]; // everyone ever referenced, incl. removed members — used for names
  entries: Entry[];
  settlements: Settlement[];
}

const CURRENT_GROUP_KEY = "tiffin-current-group";

function SetupNotice() {
  return (
    <div className="screen no-tabs">
      <div className="hero">
        <img className="logo" src="/icon.svg" alt="" />
        <h1>Dabba</h1>
        <p>Almost there — connect your Supabase project</p>
      </div>
      <div className="card">
        <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
          The app isn't connected to a database yet. Create a free project at{" "}
          <b>supabase.com</b>, run <b>supabase/schema.sql</b> in its SQL editor, then copy{" "}
          <b>.env.example</b> to <b>.env</b> and fill in your project URL and anon key.
          Full steps are in <b>README.md</b>.
        </p>
      </div>
      <div className="card">
        <p style={{ fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 12 }}>
          Or explore everything right now with sample data — stored only in this browser, no
          account needed.
        </p>
        <button className="btn" onClick={enterDemo}>Try demo mode</button>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false); // welcome -> login/signup
  const [data, setData] = useState<GroupData | null>(null);
  const [noGroup, setNoGroup] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }: any) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e: any, s: any) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoadError("");
    try {
      // RLS only returns groups this user belongs to
      const { data: groups, error: gErr } = await supabase.from("groups").select("*");
      if (gErr) throw gErr;
      if (!groups?.length) {
        setNoGroup(true);
        setData(null);
        return;
      }
      let gid = localStorage.getItem(CURRENT_GROUP_KEY);
      if (!groups.some((g: Group) => g.id === gid)) gid = groups[0].id;

      const [gm, en, st] = await Promise.all([
        supabase.from("group_members").select("user_id, profiles(*)").eq("group_id", gid),
        supabase
          .from("entries")
          .select("*, entry_items(*)")
          .eq("group_id", gid)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("settlements")
          .select("*")
          .eq("group_id", gid)
          .order("settle_date", { ascending: false }),
      ]);
      const err = gm.error || en.error || st.error;
      if (err) throw err;

      // names for everyone ever referenced — incl. people removed from the group
      const members: Profile[] = (gm.data || []).map((r: any) => r.profiles as Profile);
      const ids = new Set<string>(members.map((m) => m.id));
      for (const e of (en.data || []) as Entry[]) {
        for (const id of [e.payer_id, e.created_by, e.edited_by, e.deleted_by]) if (id) ids.add(id);
        for (const it of e.entry_items || []) ids.add(it.user_id);
      }
      for (const s of (st.data || []) as Settlement[])
        for (const id of [s.from_user, s.to_user, s.created_by, s.deleted_by]) if (id) ids.add(id);
      const { data: people, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .in("id", [...ids]);
      if (pErr) throw pErr;

      setNoGroup(false);
      setData({
        groups: groups as Group[],
        group: groups.find((g: Group) => g.id === gid) as Group,
        members,
        people: (people || []) as Profile[],
        entries: (en.data || []) as Entry[],
        settlements: (st.data || []) as Settlement[],
      });
    } catch (e: any) {
      setLoadError(e.message || "Failed to load data");
    }
  }, [session]);

  useEffect(() => {
    if (session) refresh();
    else {
      setData(null);
      setNoGroup(false);
    }
  }, [session, refresh]);

  // pick up entries added by others when the app comes back to the foreground
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // live updates: re-fetch when anyone in the group changes something
  const gid = data?.group.id;
  useEffect(() => {
    if (isDemo || !gid) return;
    const ch = supabase
      .channel(`grp-${gid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `group_id=eq.${gid}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements", filter: `group_id=eq.${gid}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${gid}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: `id=eq.${gid}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [gid, refresh]);

  const switchGroup = useCallback(
    (gid: string) => {
      localStorage.setItem(CURRENT_GROUP_KEY, gid);
      refresh();
    },
    [refresh]
  );

  if (!isConfigured) return <SetupNotice />;
  if (!sessionReady) return null;
  if (!session)
    return authOpen ? (
      <AuthScreen onBack={() => setAuthOpen(false)} />
    ) : (
      <WelcomeScreen onLogin={() => setAuthOpen(true)} />
    );
  if (noGroup || addingGroup)
    return (
      <OnboardingScreen
        onJoined={(gid) => {
          if (gid) localStorage.setItem(CURRENT_GROUP_KEY, gid);
          setAddingGroup(false);
          refresh();
        }}
        onBack={addingGroup ? () => setAddingGroup(false) : undefined}
      />
    );
  if (loadError)
    return (
      <div className="screen no-tabs">
        <p className="error" style={{ marginTop: 40 }}>{loadError}</p>
        <button className="btn" onClick={refresh}>Retry</button>
      </div>
    );
  if (!data) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>;

  return (
    <MainShell
      data={data}
      myId={session.user.id}
      refresh={refresh}
      onSwitchGroup={switchGroup}
      onAddGroup={() => setAddingGroup(true)}
    />
  );
}
