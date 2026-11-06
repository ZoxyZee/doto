import type { CloudClient } from './client';

const apiUrl = process.env.EXPO_PUBLIC_DOTO_API_URL;

export function apiConfigured(): boolean {
  if (!apiUrl || apiUrl.includes('YOUR_')) return false;
  try {
    const endpoint = new URL(apiUrl);
    return endpoint.protocol === 'https:' && !endpoint.username && !endpoint.password
      && !endpoint.search && !endpoint.hash && endpoint.pathname === '/';
  } catch { return false; }
}

export async function workerRequest<T>(cloud: CloudClient, path: string, payload: Record<string, unknown>): Promise<T> {
  if (!apiConfigured()) throw new Error('Cloudflare backend is not configured.');
  const session = await cloud.getSession();
  if (!session) throw new Error('Cloud session is missing.');
  const response = await fetch(new URL(path, apiUrl).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(payload),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const detail = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
      ? result.error : 'Cloud request failed.';
    throw new Error(detail);
  }
  return result as T;
}
