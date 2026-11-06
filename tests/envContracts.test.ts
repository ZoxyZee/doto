import { createRequire } from 'node:module';
import { afterEach, expect, test, vi } from 'vitest';

const configure = createRequire(import.meta.url)('../app.config.js') as (input: { config: { name: string; android?: { blockedPermissions: string[] } } }) => unknown;
const base = { config: { name: 'DOTO', android: { blockedPermissions: ['android.permission.INTERNET'] } } };
afterEach(() => vi.unstubAllEnvs());

test('offline build keeps internet blocked', () => {
  vi.stubEnv('EXPO_PUBLIC_DOTO_CLOUD_ENABLED', 'false');
  expect(configure(base)).toEqual(base.config);
});

test('cloud build needs an HTTPS Cloudflare origin and enables internet', () => {
  vi.stubEnv('EXPO_PUBLIC_DOTO_CLOUD_ENABLED', 'true');
  vi.stubEnv('EXPO_PUBLIC_DOTO_API_URL', '');
  expect(() => configure(base)).toThrow('Cloudflare Worker URL');
  vi.stubEnv('EXPO_PUBLIC_DOTO_API_URL', 'http://doto.example.workers.dev/');
  expect(() => configure(base)).toThrow('HTTPS Worker origin');
  vi.stubEnv('EXPO_PUBLIC_DOTO_API_URL', 'https://doto.example.workers.dev/');
  expect(configure(base)).toEqual({ name: 'DOTO', android: { blockedPermissions: [] } });
});

test('secret credentials are rejected before bundling', () => {
  vi.stubEnv('EXPO_PUBLIC_ADMIN_TOKEN', 'never-public');
  expect(() => configure(base)).toThrow('must never be embedded');
});
