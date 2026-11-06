import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

type Profile = { name: string | null; loading: boolean; setName: (value: string) => Promise<void>; forgetName: () => void };
const ProfileContext = createContext<Profile | null>(null);

export function cleanName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('Use a name between 2 and 32 characters.');
  }
  return name;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [name, setNameState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'profile_name'")
      .then((row) => { if (active) setNameState(row?.value ?? null); })
      .catch(() => { if (active) setNameState(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db]);
  async function setName(value: string) {
    const next = cleanName(value);
    await db.runAsync("INSERT INTO sync_metadata (key, value) VALUES ('profile_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", next);
    setNameState(next);
  }
  return <ProfileContext.Provider value={{ name, loading, setName, forgetName: () => setNameState(null) }}>{children}</ProfileContext.Provider>;
}

export function useProfile(): Profile {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error('ProfileProvider is missing.');
  return profile;
}
