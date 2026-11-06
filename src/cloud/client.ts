import 'react-native-url-polyfill/auto';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let instance: SupabaseClient | null = null;

export function cloudConfigured(): boolean {
  if (!url || !key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
      || url.includes('YOUR_') || key.includes('YOUR_')) return false;
  try {
    const endpoint = new URL(url);
    return endpoint.protocol === 'https:' && !endpoint.username && !endpoint.password
      && !endpoint.search && !endpoint.hash && endpoint.pathname === '/';
  } catch { return false; }
}

type Pointer = { id: string; parts: number };
const storagePrefix = 'doto.auth';

async function pointer(keyName: string): Promise<Pointer | null> {
  const raw = await SecureStore.getItemAsync(`${storagePrefix}.${keyName}.pointer`);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Pointer;
  if (!parsed.id || !Number.isInteger(parsed.parts) || parsed.parts < 1 || parsed.parts > 100) {
    throw new Error('Stored session is damaged.');
  }
  return parsed;
}

async function removeChunks(keyName: string, old: Pointer | null): Promise<void> {
  if (!old) return;
  await Promise.all(Array.from({ length: old.parts }, (_, index) =>
    SecureStore.deleteItemAsync(`${storagePrefix}.${keyName}.${old.id}.${index}`)));
}

const authStorage = {
  async getItem(keyName: string): Promise<string | null> {
    const current = await pointer(keyName);
    if (!current) return null;
    const chunks = await Promise.all(Array.from({ length: current.parts }, (_, index) =>
      SecureStore.getItemAsync(`${storagePrefix}.${keyName}.${current.id}.${index}`)));
    if (chunks.some((chunk) => chunk === null)) throw new Error('Stored session is incomplete.');
    return chunks.join('');
  },
  async setItem(keyName: string, value: string): Promise<void> {
    const old = await pointer(keyName);
    const id = Crypto.randomUUID();
    const chunks = value.match(/[\s\S]{1,1500}/g) ?? [''];
    await Promise.all(chunks.map((chunk, index) =>
      SecureStore.setItemAsync(`${storagePrefix}.${keyName}.${id}.${index}`, chunk)));
    await SecureStore.setItemAsync(`${storagePrefix}.${keyName}.pointer`, JSON.stringify({ id, parts: chunks.length }));
    await removeChunks(keyName, old);
  },
  async removeItem(keyName: string): Promise<void> {
    const old = await pointer(keyName);
    await SecureStore.deleteItemAsync(`${storagePrefix}.${keyName}.pointer`);
    await removeChunks(keyName, old);
  },
};

export function getCloudClient(): SupabaseClient | null {
  if (!cloudConfigured()) return null;
  instance ??= createClient(url!, key!, {
    auth: {
      storage: authStorage,
      storageKey: 'doto-session',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return instance;
}
