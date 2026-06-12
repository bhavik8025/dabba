import { useEffect, useState } from "react";
import { GroupData } from "../App";
import { isDemo } from "../lib/supabase";
import { Entry } from "../lib/types";
import AddEntryScreen from "./AddEntryScreen";
import HistoryScreen from "./HistoryScreen";
import BalancesScreen from "./BalancesScreen";
import SettingsScreen from "./SettingsScreen";

export type Tab = "add" | "history" | "balances" | "settings";

export interface ShellProps {
  data: GroupData;
  myId: string;
  refresh: () => Promise<void>;
  onSwitchGroup: (gid: string) => void;
  onAddGroup: () => void;
}

export default function MainShell({ data, myId, refresh, onSwitchGroup, onAddGroup }: ShellProps) {
  // remember the tab across remounts (e.g. going to "add group" and back)
  const [tab, setTabState] = useState<Tab>(() => {
    const t = sessionStorage.getItem("tiffin-tab");
    return t === "history" || t === "balances" || t === "settings" ? t : "add";
  });
  const setTab = (t: Tab) => {
    sessionStorage.setItem("tiffin-tab", t);
    setTabState(t);
  };
  const [editing, setEditing] = useState<Entry | null>(null);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const startEdit = (e: Entry) => {
    setEditing(e);
    setTab("add");
  };

  const tabs: { id: Tab; label: string; ico: string }[] = [
    { id: "add", label: "Add", ico: "✏️" },
    { id: "history", label: "History", ico: "🗓️" },
    { id: "balances", label: "Balances", ico: "⚖️" },
    { id: "settings", label: "Settings", ico: "⚙️" },
  ];

  return (
    <>
      {isDemo && (
        <div className="demo-banner">Demo mode — sample data, stored only on this device</div>
      )}
      {!online && (
        <div className="offline-banner">No internet — you can look around, but saving won't work until you're back online</div>
      )}
      {tab === "add" && (
        <AddEntryScreen
          data={data}
          myId={myId}
          editing={editing}
          onDone={async (msg) => {
            setEditing(null);
            await refresh();
            showToast(msg);
            setTab("history");
          }}
          onCancelEdit={() => {
            setEditing(null);
            setTab("history"); // editing always starts from History — go back there
          }}
        />
      )}
      {tab === "history" && <HistoryScreen data={data} myId={myId} refresh={refresh} onEdit={startEdit} showToast={showToast} />}
      {tab === "balances" && <BalancesScreen data={data} myId={myId} refresh={refresh} showToast={showToast} />}
      {tab === "settings" && (
        <SettingsScreen
          data={data}
          myId={myId}
          refresh={refresh}
          showToast={showToast}
          onSwitchGroup={onSwitchGroup}
          onAddGroup={onAddGroup}
        />
      )}

      <nav className="tabbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => {
              if (t.id !== "add") setEditing(null);
              setTab(t.id);
            }}
          >
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
