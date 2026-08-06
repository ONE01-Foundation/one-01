"use client";

/**
 * /admin — a private operations console for ONE, gated to the owner's Google
 * account. Everything here reads the shared marketplace with the public anon
 * key (RLS-safe); backend-wide totals come from the admin-gated `admin_stats`
 * RPC. The email allow-list below is the UI gate — real enforcement lives in
 * that RPC (it checks auth.jwt() email server-side).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSessionUser,
  onAuthChange,
  signInWithGoogle,
  signOut,
  fetchAllProviders,
  fetchIncomingBookings,
  fetchFollowers,
  fetchCustomers,
  adminStats,
  type AuthUser,
  type ProviderRow,
  type CloudBooking,
  type CloudFollower,
  type CloudCustomer,
} from "@/lib/cloud";

const ADMINS = ["arielbar18@gmail.com"];
const isAdmin = (u: AuthUser | null) =>
  !!u?.email && ADMINS.includes(u.email.toLowerCase());

/* ── enriched provider row (business + its marketplace activity) ── */
interface BizRow extends ProviderRow {
  bookings: CloudBooking[];
  followers: CloudFollower[];
  customers: CloudCustomer[];
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 1.9-1.6 4.9-4.6 6.9l6.6 5.1c3.9-3.6 6-8.9 6-15.3z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.6-5.1c-1.8 1.2-4.2 2.1-7.9 2.1-6 0-11.1-4-12.9-9.5l-6.8 5.3C7.5 40.9 15.1 46 24 46z" />
      <path fill="#FBBC05" d="M11.1 28.2c-.5-1.4-.8-2.9-.8-4.2s.3-2.9.7-4.2l-6.8-5.3C2.6 17.3 2 20.5 2 24s.6 6.7 2.2 9.5l6.9-5.3z" />
      <path fill="#EA4335" d="M24 10.5c3.3 0 5.6 1.4 6.9 2.6l5.8-5.7C33.1 4.1 28.9 2 24 2 15.1 2 7.5 7.1 4.2 14.5l6.8 5.3C12.9 14.5 18 10.5 24 10.5z" />
    </svg>
  );
}

/* Shell wraps every state in the product theme tokens (--p-*). */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="product-root admin-root" dir="rtl">
      {children}
    </div>
  );
}

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let alive = true;
    getSessionUser().then((u) => {
      if (!alive) return;
      setUser(u);
      setReady(true);
    });
    const off = onAuthChange((u) => {
      setUser(u);
      setReady(true);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  if (!ready) {
    return (
      <Shell>
        <div className="admin-gate">
          <div className="admin-spinner" aria-label="טוען" />
        </div>
      </Shell>
    );
  }

  if (!user) return <SignInGate />;
  if (!isAdmin(user)) return <DeniedGate user={user} />;
  return <Dashboard user={user} />;
}

/* ─────────────────────────── Gates ─────────────────────────── */

function SignInGate() {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    setErr(null);
    const r = await signInWithGoogle("/admin");
    if (!r.ok) {
      setErr(r.error ?? "ההתחברות נכשלה");
      setBusy(false);
    }
    // On success the browser redirects to Google, so nothing more to do here.
  };
  return (
    <Shell>
      <div className="admin-gate">
        <div className="admin-gate-card">
          <div className="admin-mark">◐</div>
          <h1>ONE · אדמין</h1>
          <p>הכניסה למסך הניהול מוגבלת לחשבון הבעלים.</p>
          <button className="admin-gbtn" onClick={go} disabled={busy}>
            <GoogleG />
            {busy ? "מעביר לגוגל…" : "התחברות עם Google"}
          </button>
          {err && <div className="admin-gate-err">{err}</div>}
          <div className="admin-gate-hint">רק {ADMINS[0]} מורשה.</div>
        </div>
      </div>
    </Shell>
  );
}

function DeniedGate({ user }: { user: AuthUser }) {
  return (
    <Shell>
      <div className="admin-gate">
        <div className="admin-gate-card">
          <div className="admin-mark denied">✕</div>
          <h1>אין הרשאה</h1>
          <p>
            מחובר כ־<b dir="ltr">{user.email ?? user.id}</b>, אבל לחשבון הזה אין
            גישת ניהול.
          </p>
          <button className="admin-gbtn ghost" onClick={() => signOut()}>
            התנתקות
          </button>
        </div>
      </div>
    </Shell>
  );
}

/* ─────────────────────────── Dashboard ─────────────────────────── */

function Dashboard({ user }: { user: AuthUser }) {
  const [rows, setRows] = useState<BizRow[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [providers, backend] = await Promise.all([
      fetchAllProviders(),
      adminStats(),
    ]);
    const enriched = await Promise.all(
      providers.map(async (p): Promise<BizRow> => {
        const [bookings, followers, customers] = await Promise.all([
          fetchIncomingBookings(p.id),
          fetchFollowers(p.id),
          fetchCustomers(p.id),
        ]);
        return { ...p, bookings, followers, customers };
      }),
    );
    enriched.sort((a, b) => b.bookings.length - a.bookings.length);
    setRows(enriched);
    setStats(backend);
    setUpdatedAt(new Date().toLocaleString("he-IL"));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* Aggregates across the whole marketplace. */
  const agg = useMemo(() => {
    const bookings = rows.flatMap((r) =>
      r.bookings.map((b) => ({ ...b, providerName: r.name })),
    );
    bookings.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return {
      businesses: rows.length,
      bookings: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      followers: rows.reduce((n, r) => n + r.followers.length, 0),
      customers: rows.reduce((n, r) => n + r.customers.length, 0),
      recent: bookings.slice(0, 40),
    };
  }, [rows]);

  return (
    <Shell>
      <div className="admin-shell">
        <header className="admin-top">
          <div className="admin-brand">
            <span className="admin-mark sm">◐</span>
            <div>
              <div className="admin-brand-title">ONE · לוח ניהול</div>
              <div className="admin-brand-sub">
                {updatedAt ? `עודכן ${updatedAt}` : "טוען נתונים…"}
              </div>
            </div>
          </div>
          <div className="admin-user">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt="" className="admin-avatar" />
            ) : (
              <span className="admin-avatar fallback">
                {(user.name ?? user.email ?? "A").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="admin-user-mail" dir="ltr">
              {user.email}
            </span>
            <button className="admin-btn" onClick={load} disabled={loading}>
              {loading ? "מרענן…" : "רענון"}
            </button>
            <button className="admin-btn ghost" onClick={() => signOut()}>
              יציאה
            </button>
          </div>
        </header>

        {/* KPIs */}
        <section className="admin-kpis">
          <Kpi label="עסקים" value={agg.businesses} accent="var(--p-blue)" />
          <Kpi label="הזמנות" value={agg.bookings} sub={`${agg.pending} ממתינות`} accent="var(--p-ok)" />
          <Kpi label="עוקבים" value={agg.followers} accent="#8b5cf6" />
          <Kpi label="לקוחות" value={agg.customers} accent="#f59e0b" />
          <Kpi
            label="משתמשים"
            value={stats?.profiles ?? null}
            accent="#0ea5e9"
            hint="admin_stats"
          />
          <Kpi
            label="תהליכים"
            value={stats?.units ?? null}
            accent="#ec4899"
            hint="admin_stats"
          />
        </section>

        {loading && rows.length === 0 ? (
          <div className="admin-panel admin-empty">טוען נתונים מהענן…</div>
        ) : (
          <>
            {/* Recent bookings */}
            <section className="admin-panel">
              <div className="admin-panel-head">
                <h2>הזמנות אחרונות</h2>
                <span className="admin-count">{agg.recent.length}</span>
              </div>
              {agg.recent.length === 0 ? (
                <div className="admin-empty">אין עדיין הזמנות.</div>
              ) : (
                <div className="admin-tablewrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>לקוח</th>
                        <th>עסק</th>
                        <th>שירות</th>
                        <th>מועד</th>
                        <th>סטטוס</th>
                        <th>נוצר</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agg.recent.map((b) => (
                        <tr key={b.id}>
                          <td>{b.customer_name}</td>
                          <td>{b.providerName}</td>
                          <td>{b.service || "—"}</td>
                          <td dir="ltr">{b.slot}</td>
                          <td>
                            <span className={`admin-badge ${b.status}`}>
                              {b.status === "pending"
                                ? "ממתין"
                                : b.status === "confirmed"
                                  ? "אושר"
                                  : "נדחה"}
                            </span>
                          </td>
                          <td dir="ltr">{shortDate(b.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Businesses */}
            <section className="admin-panel">
              <div className="admin-panel-head">
                <h2>עסקים במרקטפלייס</h2>
                <span className="admin-count">{rows.length}</span>
              </div>
              {rows.length === 0 ? (
                <div className="admin-empty">אין עדיין עסקים.</div>
              ) : (
                <div className="admin-tablewrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>עסק</th>
                        <th>סוג</th>
                        <th>מיקום</th>
                        <th>דירוג</th>
                        <th>עוקבים</th>
                        <th>לקוחות</th>
                        <th>הזמנות</th>
                        <th>בעלים</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <span className="admin-biz">
                              <span aria-hidden="true">
                                {(r.metadata?.emoji as string) ?? "🏢"}
                              </span>
                              {r.name}
                            </span>
                          </td>
                          <td>{prettyType(r.type)}</td>
                          <td>{r.location || "—"}</td>
                          <td dir="ltr">{r.rating ? r.rating.toFixed(1) : "—"}</td>
                          <td>{r.followers.length}</td>
                          <td>{r.customers.length}</td>
                          <td>{r.bookings.length}</td>
                          <td className="admin-mono" dir="ltr">
                            {ownerShort(r.metadata)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* System / backend */}
            <section className="admin-panel">
              <div className="admin-panel-head">
                <h2>מערכת</h2>
              </div>
              <div className="admin-sys">
                <SysRow k="פרויקט Supabase" v="dkkxecnfqkcpjjapbesy" mono />
                <SysRow
                  k="admin_stats RPC"
                  v={stats ? "פעיל ✓" : "לא מותקן — ראה הערה למטה"}
                  ok={!!stats}
                />
                <SysRow k="מחובר כ־" v={user.email ?? user.id} mono />
              </div>
              {!stats && (
                <div className="admin-note">
                  כדי להציג <b>משתמשים ותהליכים</b> — הרץ את המיגרציה{" "}
                  <span className="admin-mono">admin_stats</span> ב־Supabase
                  (הקובץ נוצר תחת <span className="admin-mono">supabase/migrations</span>),
                  והוסף את <span className="admin-mono" dir="ltr">/admin</span> ל־Redirect
                  URLs ב־Auth. עד אז שאר הלוח עובד על הנתונים הזמינים לאנון.
                </div>
              )}
            </section>
          </>
        )}

        <footer className="admin-foot">
          ONE admin · לצפייה בלבד · הנתונים נטענים עם מפתח האנון הציבורי (RLS)
        </footer>
      </div>
    </Shell>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
  hint,
}: {
  label: string;
  value: number | null;
  sub?: string;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="admin-kpi" style={{ ["--accent" as string]: accent }}>
      <div className="admin-kpi-label">{label}</div>
      <div className="admin-kpi-value">
        {value === null || value === undefined ? "—" : value.toLocaleString("he-IL")}
      </div>
      <div className="admin-kpi-sub">{sub ?? (hint ? "" : "")}</div>
    </div>
  );
}

function SysRow({
  k,
  v,
  mono,
  ok,
}: {
  k: string;
  v: string;
  mono?: boolean;
  ok?: boolean;
}) {
  return (
    <div className="admin-sys-row">
      <span className="admin-sys-k">{k}</span>
      <span
        className={`admin-sys-v${mono ? " admin-mono" : ""}${ok ? " ok" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {v}
      </span>
    </div>
  );
}

/* ── helpers ── */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function ownerShort(meta: Record<string, unknown> | null): string {
  const o = (meta?.owner_key as string) ?? (meta?.ownerKey as string) ?? "";
  if (!o) return "—";
  return o.length > 12 ? `${o.slice(0, 6)}…${o.slice(-4)}` : o;
}
function prettyType(t: string): string {
  return (t || "—").replace(/_/g, " ");
}
