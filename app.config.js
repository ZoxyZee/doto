const forbiddenPublicNames = /(SECRET|SERVICE_ROLE|DATABASE_PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|REFRESH_TOKEN)/i;

module.exports = ({ config }) => {
  for (const name of Object.keys(process.env)) {
    if (name.startsWith('EXPO_PUBLIC_') && forbiddenPublicNames.test(name)) {
      throw new Error(`${name} must never be embedded in the mobile app.`);
    }
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !key) return config; // An unconfigured build remains offline.
  if (!url || !key) throw new Error('Set both Supabase public variables for a cloud build.');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) || key.includes('YOUR_')) {
    throw new Error('Use a Supabase publishable key (sb_publishable_...), never a secret or service_role key.');
  }
  let endpoint;
  try { endpoint = new URL(url); }
  catch { throw new Error('EXPO_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search
      || endpoint.hash || endpoint.pathname !== '/' || url.includes('YOUR_')) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must be a bare HTTPS project origin.');
  }
  return config;
};
