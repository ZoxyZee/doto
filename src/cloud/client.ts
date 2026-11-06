import * as SecureStore from 'expo-secure-store';
import { apiConfigured } from './api';

const url = process.env.EXPO_PUBLIC_DOTO_API_URL;
const storageKey = 'doto.worker.session';
export type CloudSession = { userId: string; token: string };
export type CloudClient = {
  getSession: () => Promise<CloudSession | null>;
  createSession: (name: string) => Promise<CloudSession>;
  updateName: (name: string) => Promise<void>;
};
let instance: CloudClient | null = null;

export function cloudConfigured(): boolean {
  return process.env.EXPO_PUBLIC_DOTO_CLOUD_ENABLED === 'true' && apiConfigured();
}

export function getCloudClient(): CloudClient | null {
  if (!cloudConfigured()) return null;
  instance ??= {
    async getSession() {
      const raw = await SecureStore.getItemAsync(storageKey);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object' || !('userId' in value) || !('token' in value)
          || typeof value.userId !== 'string' || typeof value.token !== 'string') throw new Error('Stored cloud session is damaged.');
      return value as CloudSession;
    },
    async createSession(name) {
      const existing = await this.getSession();
      if (existing) return existing;
      const response = await fetch(new URL('api/session', url).toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name }),
      });
      const result = await response.json() as { user_id?: string; token?: string; error?: string };
      if (!response.ok || !result.user_id || !result.token) throw new Error(result.error ?? 'Could not create cloud session.');
      const session = { userId: result.user_id, token: result.token };
      await SecureStore.setItemAsync(storageKey, JSON.stringify(session));
      return session;
    },
    async updateName(name) {
      const session = await this.getSession();
      if (!session) throw new Error('Cloud session is missing.');
      const response = await fetch(new URL('api/profile', url).toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ display_name: name }),
      });
      if (!response.ok) throw new Error('Could not update cloud profile.');
    },
  };
  return instance;
}
