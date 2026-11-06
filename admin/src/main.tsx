import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type UserRow = {
  user_id: string; email: string | null; display_name: string | null;
  joined_at: string; last_sign_in_at: string | null;
  last_active_at: string | null; active_days: number; habit_count: number;
  completion_count: number; completed_in_period: number;
};
type DailyRow = { activity_date: string; active_users: number; completions: number };
type Overview = { users: UserRow[]; daily: DailyRow[]; days: number };

function date(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}
function ago(value: string | null): string {
  if (!value) return 'Never';
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed < 86_400_000) return 'Today';
  if (elapsed < 172_800_000) return 'Yesterday';
  return date(value);
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('doto.admin.token') ?? '');
  const [password, setPassword] = useState('');
  const [days, setDays] = useState(7);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/overview?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const result = await response.json() as Overview & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not load metrics.');
      setOverview(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load metrics.'); }
    finally { setLoading(false); }
  }, [token, days]);

  useEffect(() => { void load(); }, [load]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (busy || password.length < 32) { setError('Enter your Cloudflare admin token (at least 32 characters).'); return; }
    setBusy(true);
    setError('');
    sessionStorage.setItem('doto.admin.token', password);
    setToken(password);
    setPassword('');
    setBusy(false);
  }

  const users = overview?.users ?? [];
  const active = users.filter((user) => user.active_days > 0).length;
  const completions = users.reduce((total, user) => total + Number(user.completed_in_period), 0);
  const habits = users.reduce((total, user) => total + Number(user.habit_count), 0);
  const chart = overview?.daily ?? [];
  const max = Math.max(1, ...chart.map((row) => Number(row.active_users)));

  if (!token) return <main className="login-shell">
    <div className="login-brand"><span className="brand-mark">✳</span><span>DOTO<span className="brand-dot">.</span></span></div>
    <section className="login-card">
      <div className="eyebrow">PRIVATE WORKSPACE</div>
      <h1>A clearer view of<br /><em>consistency.</em></h1>
      <p>Enter your private Cloudflare admin token to view app usage.</p>
      <form onSubmit={(event) => void signIn(event)}>
        <label>Admin token<input type="password" autoComplete="off" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Private admin token" /></label>
        <button type="submit" disabled={busy}>{busy ? 'Opening…' : 'Open dashboard'} <span>↗</span></button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="login-foot">Keep this token private. It is stored only for this browser tab.</div>
    </section>
    <div className="login-orbit" aria-hidden="true" />
  </main>;

  return <div className="layout">
    <aside className="sidebar">
      <div className="side-brand"><span className="brand-mark">✳</span><span>DOTO<span className="brand-dot">.</span></span><small>ADMIN</small></div>
      <div className="side-section">WORKSPACE</div>
      <div className="side-link active"><span>▦</span> Overview</div>
      <div className="side-note"><span className="live-dot" /> Private analytics<br /><small>Only your account can access metrics.</small></div>
      <div className="side-bottom"><div className="avatar">A</div><div className="identity"><strong>Administrator</strong><small>Cloudflare private access</small></div><button className="signout" onClick={() => { sessionStorage.removeItem('doto.admin.token'); setToken(''); setOverview(null); }} aria-label="Sign out">↗</button></div>
    </aside>
    <main className="content">
      <header className="topbar"><span>Dashboard <span className="slash">/</span> Overview</span><span className="secure"><span className="live-dot" /> Secure view</span></header>
      <div className="page">
        <div className="heading"><div><div className="eyebrow">DOTO / OVERVIEW</div><h1>Good to see you<span className="heading-dot">.</span></h1><p>See the people and progress behind every small step.</p></div><div className="heading-actions"><select aria-label="Date range" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select><button onClick={() => void load()} disabled={loading}>↻ <span>Refresh</span></button></div></div>
        {error && <div className="alert" role="alert">{error}</div>}
        <div className="stats">
          <article className="stat"><div className="stat-top"><span>Total users</span><span className="stat-icon">♙</span></div><strong>{users.length}</strong><small>Registered accounts</small></article>
          <article className="stat"><div className="stat-top"><span>Active users</span><span className="stat-icon peach">↗</span></div><strong>{active}</strong><small>Synced in this period</small></article>
          <article className="stat"><div className="stat-top"><span>Completions</span><span className="stat-icon green">✓</span></div><strong>{completions}</strong><small>Habit days completed in this period</small></article>
          <article className="stat"><div className="stat-top"><span>Live habits</span><span className="stat-icon yellow">✳</span></div><strong>{habits}</strong><small>Across all accounts</small></article>
        </div>
        <section className="chart-card"><div className="section-head"><div><div className="eyebrow">ACTIVITY</div><h2>People showing up</h2><p>Daily active users, recorded when an online app syncs.</p></div><div className="legend"><span className="legend-dot" /> Active users</div></div><div className="chart" role="img" aria-label="Daily active users chart">{chart.map((row, index) => <div className="bar-group" key={row.activity_date}><div className="bar-track"><div className="bar" style={{ height: Number(row.active_users) ? `${Math.max(5, Number(row.active_users) / max * 100)}%` : '0%' }} title={`${row.active_users} active on ${row.activity_date}`} /></div><span>{index % (days > 30 ? 14 : days > 7 ? 5 : 1) === 0 ? new Date(`${row.activity_date}T00:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''}</span></div>)}</div></section>
        <section className="people-card">
          <div className="section-head"><div><div className="eyebrow">COMMUNITY</div><h2>Your people <span className="count-pill">{users.length}</span></h2><p>Account activity and progress at a glance.</p></div></div>
          <div className="table-wrap"><table>
            <thead><tr><th>USER</th><th>JOINED</th><th>LAST ACTIVE</th><th>ACTIVE DAYS</th><th>HABITS</th><th>COMPLETED</th></tr></thead>
            <tbody>{users.map((user) => <tr key={user.user_id}>
              <td><div className="person"><span className="person-avatar">{(user.display_name ?? user.email ?? '?').slice(0, 1).toUpperCase()}</span><div><strong>{user.display_name ?? user.email ?? 'Guest'}</strong><small>{user.email ?? `Guest · ${user.user_id.slice(0, 8)}`}</small></div></div></td>
              <td>{date(user.joined_at)}</td><td><span className={user.active_days ? 'activity-pill' : 'muted-pill'}>{ago(user.last_active_at)}</span></td>
              <td>{user.active_days}</td><td>{user.habit_count}</td><td>{user.completed_in_period}</td>
            </tr>)}</tbody>
          </table>{users.length === 0 && <div className="empty">No accounts yet. Invite a friend to try DOTO and their activity will appear here.</div>}</div>
        </section>
        <footer>Only synced activity appears here. Offline activity updates after the device reconnects. <span>DOTO · Private analytics</span></footer>
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
