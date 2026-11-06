import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { getCloudClient } from '@/cloud/client';
import { pendingChanges, syncDatabase } from '@/cloud/sync';
import { registerSyncHandler } from '@/cloud/syncEvents';
import { useHabitStore } from '@/store/useHabitStore';
import { useProfile } from '@/profile/ProfileProvider';

type CloudStatus = 'setup-needed' | 'guest' | 'ready' | 'syncing' | 'waiting';
type CloudContextValue = {
  status: CloudStatus; userId: string | null; linkedOwner: string | null;
  pending: number; lastSync: string | null; lastError: string | null;
  configured: boolean; syncNow: (force?: boolean) => Promise<void>;
};
const CloudContext = createContext<CloudContextValue | null>(null);
const cloud = getCloudClient();
const message = (error: unknown) => error instanceof Error ? error.message : 'Cloud connection failed.';

export function CloudProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const profile = useProfile();
  const refresh = useHabitStore((state) => state.refresh);
  const [status, setStatus] = useState<CloudStatus>(cloud ? 'guest' : 'setup-needed');
  const [userId, setUserId] = useState<string | null>(null);
  const [linkedOwner, setLinkedOwner] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const connecting = useRef<Promise<void> | null>(null);

  const acceptUser = useCallback(async (id: string) => {
    await db.runAsync("INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('cloud_owner', ?)", id);
    const owner = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'cloud_owner'");
    if (owner?.value !== id) throw new Error('This phone is linked to a different cloud account.');
    setLinkedOwner(id);
    setUserId(id);
    setStatus('ready');
  }, [db]);

  const syncNow = useCallback(async (force = false) => {
    if (!cloud || !userId) return;
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
      const session = await cloud.getSession();
      if (active && session) await acceptUser(session.userId);
    }).catch((cause) => { if (active) setLastError(message(cause)); });
    return () => { active = false; };
  }, [acceptUser, db]);

  const ensureConnected = useCallback(async () => {
    if (!cloud || userId || !profile.name) return;
    if (connecting.current) return connecting.current;
    const task = (async () => {
      const session = await cloud.getSession();
      if (session) { await acceptUser(session.userId); return; }
      const owner = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'cloud_owner'");
      if (owner) throw new Error('Cloud session is missing. Local habits are safe, but this account cannot be recovered.');
      const created = await cloud.createSession(profile.name!);
      await acceptUser(created.userId);
    })();
    connecting.current = task;
    try { await task; } finally { connecting.current = null; }
  }, [acceptUser, db, profile.name, userId]);

  useEffect(() => {
    if (!cloud || userId || !profile.name) return;
    const connect = () => { void ensureConnected().catch((cause) => { setLastError(message(cause)); setStatus('waiting'); }); };
    connect();
    const timer = setInterval(connect, 30_000);
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') connect(); });
    return () => { clearInterval(timer); appState.remove(); };
  }, [ensureConnected, profile.name, userId]);

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

  return <CloudContext.Provider value={{ status, userId, linkedOwner, pending, lastSync, lastError,
    configured: !!cloud, syncNow }}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudContextValue {
  const context = useContext(CloudContext);
  if (!context) throw new Error('CloudProvider is missing.');
  return context;
}
