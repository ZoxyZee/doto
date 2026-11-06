import { createRequire } from 'node:module';
import { afterEach, expect, test, vi } from 'vitest';

const configure = createRequire(import.meta.url)('../app.config.js') as (input: { config: { name: string } }) => { name: string };
const base = { config: { name: 'DOTO' } };

afterEach(() => vi.unstubAllEnvs());

test('offline configuration needs no cloud variables', () => {
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  expect(configure(base)).toEqual(base.config);
});

test('cloud configuration requires an HTTPS origin and publishable key together', () => {
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  expect(() => configure(base)).toThrow('both Supabase public variables');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_publicExample');
  expect(configure(base)).toEqual(base.config);
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'http://project.supabase.co');
  expect(() => configure(base)).toThrow('HTTPS project origin');
});

test('secret credentials are rejected before bundling', () => {
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_fake');
  expect(() => configure(base)).toThrow('publishable key');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_publicExample');
  vi.stubEnv('EXPO_PUBLIC_SERVICE_ROLE_KEY', 'fake');
  expect(() => configure(base)).toThrow('must never be embedded');
});
