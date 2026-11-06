import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { getCloudClient } from '@/cloud/client';
import { clearAccountData, pendingChanges, syncDatabase } from '@/cloud/sync';
import { registerSyncHandler } from '@/cloud/syncEvents';
import { useHabitStore } from '@/store/useHabitStore';

type CloudStatus = 'setup-needed' | 'guest' | 'ready' | 'syncing' | 'waiting';
type CloudContextValue = {
  status: CloudStatus;
  email: string | null;
  linkedOwner: string | null;
  pending: number;
  lastSync: string | null;
  lastError: string | null;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  syncNow: (force?: boolean) => Promise<void>;
};

const CloudContext = createContext<CloudContextValue | null>(null);
const cloud = getCloudClient();

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Cloud connection failed.';
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<CloudStatus>(cloud ? 'guest' : 'setup-needed');
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [linkedOwner, setLinkedOwner] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const signingOut = useRef(false);
  const refresh = useHabitStore((state) => state.refresh);

  const acceptUser = useCallback(async (id: string, userEmail: string | null) => {
    const owner = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'cloud_owner'");
    if (owner && owner.value !== id) {
      await cloud?.auth.signOut({ scope: 'local' });
      throw new Error('This device has unsynced data from another account. Sign in with the previous account first.');
    }
    if (!owner) {
      await db.runAsync("INSERT INTO sync_metadata (key, value) VALUES ('cloud_owner', ?)", id);
    }
    setLinkedOwner(id);
    setUserId(id);
    setEmail(userEmail);
    setStatus('ready');
  }, [db]);

  const syncNow = useCallback(async (force = false) => {
    if (!cloud || !userId || signingOut.current) return;
    if (running.current) { await running.current; if (force) await syncNow(true); return; }
    const task = (async () => {
      setStatus('syncing');
      setLastError(null);
      try {
        const result = await syncDatabase(db, cloud, userId, force);
        setPending(result.pending);
        await refresh(db);
        if (result.pending === 0) {
          const now = new Date().toISOString();
          await db.runAsync("INSERT INTO sync_metadata (key, value) VALUES ('cloud_last_sync', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", now);
          setLastSync(now);
        }
        setStatus(result.pending ? 'waiting' : 'ready');
      } catch (error) {
        setPending(await pendingChanges(db).catch(() => 0));
        setLastError(message(error));
        setStatus('waiting');
      }
    })();
    running.current = task;
    try { await task; } finally { running.current = null; }
  }, [db, refresh, userId]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'cloud_owner'"),
      db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'cloud_last_sync'"),
      pendingChanges(db),
    ]).then(async ([owner, previous, count]) => {
      if (!active) return;
      setLinkedOwner(owner?.value ?? null);
      setLastSync(previous?.value ?? null);
      setPending(count);
      if (!cloud) return;
      const { data, error } = await cloud.auth.getSession();
      if (!active) return;
      if (error) { setLastError(error.message); setStatus('waiting'); return; }
      if (data.session?.user) {
        try { await acceptUser(data.session.user.id, data.session.user.email ?? null); }
        catch (cause) { setLastError(message(cause)); setStatus('waiting'); }
      }
    }).catch((cause) => { if (active) setLastError(message(cause)); });
    if (!cloud) return () => { active = false; };
    const { data: { subscription } } = cloud.auth.onAuthStateChange((event, session) => {
      if (!active || signingOut.current) return;
      if (session?.user) {
        void acceptUser(session.user.id, session.user.email ?? null).catch((cause) => {
          setLastError(message(cause)); setStatus('waiting');
        });
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
        setEmail(null);
        setStatus('guest');
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') cloud.auth.startAutoRefresh();
      else cloud.auth.stopAutoRefresh();
    });
    cloud.auth.startAutoRefresh();
    return () => { active = false; subscription.unsubscribe(); appState.remove(); cloud.auth.stopAutoRefresh(); };
  }, [acceptUser, db]);

  useEffect(() => {
    if (!userId) return;
    void syncNow();
    const timer = setInterval(() => { void syncNow(); }, 20_000);
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void syncNow(); });
    return () => { clearInterval(timer); appState.remove(); };
  }, [syncNow, userId]);

  useEffect(() => registerSyncHandler(() => {
    void pendingChanges(db).then(setPending);
    void syncNow();
  }), [db, syncNow]);

  async function signIn(address: string, password: string) {
    if (!cloud) throw new Error('Cloud is not configured yet.');
    const { data, error } = await cloud.auth.signInWithPassword({ email: address.trim(), password });
    if (error) throw error;
    if (!data.user) throw new Error('Sign in did not return an account.');
    await acceptUser(data.user.id, data.user.email ?? null);
  }

  async function signUp(address: string, password: string): Promise<boolean> {
    if (!cloud) throw new Error('Cloud is not configured yet.');
    const { data, error } = await cloud.auth.signUp({ email: address.trim(), password });
    if (error) throw error;
    if (data.session?.user) await acceptUser(data.session.user.id, data.session.user.email ?? null);
    return !data.session;
  }

  async function signOut() {
    if (!cloud || !userId) return;
    const owner = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'cloud_owner'");
    if (owner?.value !== userId) throw new Error('Sign in with the account linked to this device.');
    await syncNow(true);
    if (await pendingChanges(db) > 0) throw new Error('Wait for pending changes to sync before signing out.');
    signingOut.current = true;
    try {
      await clearAccountData(db);
      const { error } = await cloud.auth.signOut({ scope: 'local' });
      setUserId(null);
      setLinkedOwner(null);
      setEmail(null);
      setPending(0);
      setLastSync(null);
      setStatus('guest');
      await refresh(db);
      if (error) setLastError(error.message);
    } finally { signingOut.current = false; }
  }

  return <CloudContext.Provider value={{ status, email, linkedOwner, pending, lastSync, lastError,
    configured: !!cloud, signIn, signUp, signOut, syncNow }}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudContextValue {
  const context = useContext(CloudContext);
  if (!context) throw new Error('CloudProvider is missing.');
  return context;
}
