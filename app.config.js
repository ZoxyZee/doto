const forbiddenPublicNames = /(SECRET|SERVICE_ROLE|DATABASE_PASSWORD|PRIVATE_KEY|TOKEN)/i;

module.exports = ({ config }) => {
  for (const name of Object.keys(process.env)) {
    if (name.startsWith('EXPO_PUBLIC_') && forbiddenPublicNames.test(name)) {
      throw new Error(`${name} must never be embedded in the mobile app.`);
    }
  }
  if (process.env.EXPO_PUBLIC_DOTO_CLOUD_ENABLED !== 'true') return config;
  const apiUrl = process.env.EXPO_PUBLIC_DOTO_API_URL?.trim();
  if (!apiUrl) throw new Error('Set the Cloudflare Worker URL for a cloud build.');
  let endpoint;
  try { endpoint = new URL(apiUrl); }
  catch { throw new Error('EXPO_PUBLIC_DOTO_API_URL must be a valid HTTPS URL.'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search
      || endpoint.hash || endpoint.pathname !== '/' || apiUrl.includes('YOUR_')) {
    throw new Error('EXPO_PUBLIC_DOTO_API_URL must be a bare HTTPS Worker origin.');
  }
  if (!config.android) return config;
  return { ...config, android: { ...config.android,
    blockedPermissions: (config.android.blockedPermissions || []).filter(
      (permission) => permission !== 'android.permission.INTERNET'),
  } };
};
