import { useEffect, useState } from "react";
import { ArrowLeft, Check, CheckCheck, Scissors, Microscope, Truck, Package, AlertCircle, FileText, IndianRupee, MessageSquare } from "lucide-react";
import { fetchNotifs, readSet, saveReadSet, type Notif, type NType } from "../../lib/notifCenter";

const ACCENT = "#C8A97E";

// Notification data + read state all live in src/lib/notifCenter.ts — shared
// with App's bell badge so the unread count and this list can never disagree.

function timeLabel(at: number): string {
  if (!at) return "";
  const diff = Date.now() - at;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const d = new Date(at);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (at >= today.getTime() - 86400000) return "Yesterday";
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}
function isTodayGroup(at: number): boolean {
  return at > 0 && Date.now() - at < 48 * 3600 * 1000;
}

const typeIcon: Record<NType, { icon: React.ReactNode; bg: string; color: string }> = {
  placed:     { icon: <FileText     size={14} strokeWidth={1.5}/>, bg: "#f3f4f6",                color: "#374151" },
  quote:      { icon: <AlertCircle  size={14} strokeWidth={1.5}/>, bg: "rgba(200,169,126,0.15)", color: ACCENT },
  confirmed:  { icon: <Check        size={14} strokeWidth={1.5}/>, bg: "#e8f5e9",                color: "#2e7d32" },
  payment:    { icon: <IndianRupee  size={14} strokeWidth={1.5}/>, bg: "#e8f5e9",                color: "#2e7d32" },
  production: { icon: <Scissors     size={14} strokeWidth={1.5}/>, bg: "#e8f5e9",                color: "#2e7d32" },
  quality:    { icon: <Microscope   size={14} strokeWidth={1.5}/>, bg: "#fff8e1",                color: "#e65100" },
  shipping:   { icon: <Truck        size={14} strokeWidth={1.5}/>, bg: "#e3f2fd",                color: "#1565c0" },
  delivered:  { icon: <Package      size={14} strokeWidth={1.5}/>, bg: "#e8f5e9",                color: "#2e7d32" },
  support:    { icon: <MessageSquare size={14} strokeWidth={1.5}/>, bg: "rgba(200,169,126,0.15)", color: ACCENT },
};

type Filter = "all" | "unread" | "updates";

export function NotificationsScreen({ onClose, onNavigate }: { onClose: () => void; onNavigate?: (tab: string, orderId?: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [notifs, setNotifs] = useState<Notif[] | null>(null); // null = loading
  const [read, setRead] = useState<Set<string>>(readSet);

  useEffect(() => {
    let alive = true;
    fetchNotifs().then((all) => { if (alive) setNotifs(all); });
    return () => { alive = false; };
  }, []);

  function markRead(key: string) {
    setRead((prev) => { const next = new Set(prev); next.add(key); saveReadSet(next); return next; });
  }
  function markAllRead() {
    setRead((prev) => { const next = new Set(prev); (notifs ?? []).forEach((n) => next.add(n.key)); saveReadSet(next); return next; });
  }

  const list = notifs ?? [];
  const filtered = list.filter((n) => {
    if (filter === "unread") return !read.has(n.key);
    return true; // "updates" — every live notification IS an order update now
  });
  const unreadCount = list.filter((n) => !read.has(n.key)).length;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft size={16} strokeWidth={1.5}/>
          </button>
          <div>
            <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>Notifications</p>
            {unreadCount > 0 && (
              <p className="text-muted-foreground" style={{ fontSize: 11 }}>{unreadCount} unread</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-foreground" style={{ fontWeight: 500 }}>
            <CheckCheck size={13} strokeWidth={1.5}/> Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex px-5 pt-3 pb-0 gap-2 flex-shrink-0">
        {(["all", "unread", "updates"] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3.5 py-1.5 rounded-full text-xs transition-all"
            style={{
              background: filter === f ? "var(--foreground)" : "var(--muted)",
              color: filter === f ? "#fff" : "var(--muted-foreground)",
              fontWeight: filter === f ? 500 : 400,
              border: "none", cursor: "pointer",
            }}
          >
            {f === "all" ? "All" : f === "unread" ? `Unread ${unreadCount > 0 ? `(${unreadCount})` : ""}` : "Order updates"}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="flex-1 overflow-y-auto pt-3 pb-4 min-h-0" style={{ scrollbarWidth: "none" }}>
        {notifs === null && (
          <div className="flex flex-col items-center justify-center h-48 text-center px-8">
            <p className="text-muted-foreground text-xs">Loading your order updates…</p>
          </div>
        )}

        {notifs !== null && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center px-8">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Check size={20} className="text-muted-foreground" strokeWidth={1.5}/>
            </div>
            <p className="text-foreground text-sm" style={{ fontWeight: 500 }}>All caught up</p>
            <p className="text-muted-foreground text-xs mt-1">
              {list.length === 0 ? "Updates about your orders will appear here" : `No ${filter === "unread" ? "unread " : ""}notifications`}
            </p>
          </div>
        )}

        {/* Group today (last 48h) vs earlier */}
        {["Today", "Earlier"].map(group => {
          const items = filtered.filter(n => (group === "Today") === isTodayGroup(n.at));
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="px-5 pb-2 pt-1 text-muted-foreground" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {group}
              </p>
              {items.map(n => {
                const vis = typeIcon[n.type];
                const isRead = read.has(n.key);
                return (
                  <button
                    key={n.key}
                    onClick={() => {
                      markRead(n.key);
                      // Support replies live under Account › Help & support;
                      // order events open in Track.
                      if (n.type === "support") onNavigate?.("account", n.ticketId);
                      else onNavigate?.("track", n.orderId);
                    }}
                    className="w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors"
                    style={{ background: isRead ? "transparent" : "rgba(200,169,126,0.05)", border: "none", cursor: "pointer" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: vis.bg, color: vis.color }}>
                      {vis.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-foreground text-sm leading-snug" style={{ fontWeight: isRead ? 400 : 600 }}>
                          {n.title}
                        </p>
                        <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: 10, marginTop: 1 }}>{timeLabel(n.at)}</span>
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">{n.body}</p>
                      {n.orderId && (
                        <span className="text-xs mt-1 inline-block" style={{ color: ACCENT, fontWeight: 500 }}>{n.orderId}</span>
                      )}
                    </div>

                    {!isRead && (
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: ACCENT }}/>
                    )}
                  </button>
                );
              })}
              <div className="border-b border-border mx-5"/>
            </div>
          );
        })}
      </div>
    </div>
  );
}
