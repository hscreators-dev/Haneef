import { useState } from "react";
import { ArrowLeft, Check, CheckCheck, Scissors, Microscope, Truck, Package, Shield, AlertCircle } from "lucide-react";

const ACCENT = "#C8A97E";

type NType = "quote" | "production" | "quality" | "shipping" | "delivered" | "system";

interface Notif {
  id: number; type: NType; title: string; body: string; time: string; read: boolean; orderId?: string;
}

const allNotifs: Notif[] = [
  { id: 1,  type: "quote",      title: "Quote ready — #FL-2045",       body: "₹57,700 for Heavy Denim (1000 pcs). Tap to review & approve.",         time: "2 min ago",  read: false, orderId: "#FL-2045" },
  { id: 2,  type: "production", title: "In production — #FL-2041",      body: "Cotton Twill batch started weaving. ~40% complete, on track for Jul 14.", time: "3 hrs ago",  read: false, orderId: "#FL-2041" },
  { id: 4,  type: "quality",    title: "Quality check — #FL-2038",      body: "Linen Blend Fabric entered quality inspection. Est. complete Jul 8.",    time: "Yesterday",  read: true,  orderId: "#FL-2038" },
  { id: 5,  type: "delivered",  title: "Delivered — #FL-2035",          body: "Your Cotton Jersey order was delivered successfully. Rate your order.",   time: "Jun 10",     read: true  },
  { id: 6,  type: "system",     title: "2FA reminder",                  body: "Secure your account with two-factor authentication. Takes 30 seconds.",  time: "Jun 8",      read: true  },
  { id: 7,  type: "shipping",   title: "Shipped — #FL-2033",            body: "Your order is on the way! Tracking ID: DTDC-9823441.",                   time: "Jun 5",      read: true  },
  { id: 8,  type: "quote",      title: "Quote updated — #FL-2045",      body: "OEKO-TEX cost added: ₹1,200. Tap to review the latest quote.",           time: "Jun 4",      read: true,  orderId: "#FL-2045" },
];

const typeIcon: Record<NType, { icon: React.ReactNode; bg: string; color: string }> = {
  quote:      { icon: <AlertCircle  size={14} strokeWidth={1.5}/>, bg: "rgba(200,169,126,0.15)", color: ACCENT },
  production: { icon: <Scissors     size={14} strokeWidth={1.5}/>, bg: "#e8f5e9",                color: "#2e7d32" },
  quality:    { icon: <Microscope   size={14} strokeWidth={1.5}/>, bg: "#fff8e1",                color: "#e65100" },
  shipping:   { icon: <Truck        size={14} strokeWidth={1.5}/>, bg: "#e3f2fd",                color: "#1565c0" },
  delivered:  { icon: <Package      size={14} strokeWidth={1.5}/>, bg: "#e8f5e9",                color: "#2e7d32" },
  system:     { icon: <Shield       size={14} strokeWidth={1.5}/>, bg: "#f3f4f6",                color: "#374151" },
};

type Filter = "all" | "unread" | "updates";

export function NotificationsScreen({ onClose, onNavigate }: { onClose: () => void; onNavigate?: (tab: string, orderId?: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [notifs, setNotifs] = useState<Notif[]>(allNotifs);

  function markRead(id: number) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }
  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  const filtered = notifs.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "updates") return n.type !== "system";
    return true;
  });

  const unreadCount = notifs.filter(n => !n.read).length;

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
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center px-8">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Check size={20} className="text-muted-foreground" strokeWidth={1.5}/>
            </div>
            <p className="text-foreground text-sm" style={{ fontWeight: 500 }}>All caught up</p>
            <p className="text-muted-foreground text-xs mt-1">No {filter === "unread" ? "unread" : ""} notifications</p>
          </div>
        )}

        {/* Group today vs earlier */}
        {["Today", "Earlier"].map(group => {
          const items = filtered.filter(n =>
            group === "Today"
              ? n.time.includes("min") || n.time.includes("hrs") || n.time === "Yesterday"
              : !n.time.includes("min") && !n.time.includes("hrs") && n.time !== "Yesterday"
          );
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="px-5 pb-2 pt-1 text-muted-foreground" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {group}
              </p>
              {items.map(n => {
                const vis = typeIcon[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      if (n.type === "system") onNavigate?.("account");
                      else if (n.orderId)      onNavigate?.("track", n.orderId);
                      else                     onNavigate?.("track");
                    }}
                    className="w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors"
                    style={{ background: n.read ? "transparent" : "rgba(200,169,126,0.05)", border: "none", cursor: "pointer" }}
                  >
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: vis.bg, color: vis.color }}>
                      {vis.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-foreground text-sm leading-snug" style={{ fontWeight: n.read ? 400 : 600 }}>
                          {n.title}
                        </p>
                        <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: 10, marginTop: 1 }}>{n.time}</span>
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">{n.body}</p>
                      {n.orderId && (
                        <span className="text-xs mt-1 inline-block" style={{ color: ACCENT, fontWeight: 500 }}>{n.orderId}</span>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
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
