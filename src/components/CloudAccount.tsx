import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCloud } from '@/cloud/CloudProvider';
import { type, usePalette } from '@/theme/colors';

export function CloudAccount() {
  const palette = usePalette();
  const cloud = useCloud();
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(mode: 'in' | 'up') {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'in') await cloud.signIn(address, password);
      else if (await cloud.signUp(address, password)) {
        Alert.alert('Check your email', 'Confirm your address, then sign in to sync your habits.');
      }
      setPassword('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not connect your account.'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await cloud.signOut(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign out.'); }
    finally { setBusy(false); }
  }

  const status = cloud.status === 'syncing' ? 'Syncing now…' : cloud.status === 'waiting'
    ? 'Waiting to sync' : cloud.email ? 'Up to date when online' : 'Saved on this device';
  return <View style={[styles.group, { borderColor: palette.line }]}>
    {cloud.email ? <>
      <View style={styles.row}><Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>{cloud.email}</Text><Text style={[styles.badge, { color: palette.purple }]}>CLOUD</Text></View>
      <Text style={[styles.note, { color: palette.muted }]}>{status}</Text>
      <Text style={[styles.note, { color: palette.muted }]}>{cloud.pending} pending {cloud.pending === 1 ? 'change' : 'changes'}{cloud.lastSync ? ` · Last synced ${new Date(cloud.lastSync).toLocaleString()}` : ''}</Text>
      <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => void cloud.syncNow(true)} style={[styles.button, { backgroundColor: palette.purpleSoft }]}><Text style={[styles.buttonText, { color: palette.purple }]}>Sync now</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void signOut()} style={[styles.button, { backgroundColor: palette.surfaceMuted }]}><Text style={[styles.buttonText, { color: palette.ink }]}>Sign out</Text></Pressable></View>
    </> : <>
      <View style={styles.row}><Text style={[styles.title, { color: palette.ink }]}>Guest on this device</Text><Text style={[styles.badge, { color: palette.purple }]}>LOCAL</Text></View>
      <Text style={[styles.note, { color: palette.muted }]}>{cloud.configured ? 'Sign in to back up your habits. Offline changes will upload when you reconnect.' : 'Your habits work offline. Cloud setup is needed before sign-in is available.'}</Text>
      {cloud.configured && <>
        {cloud.linkedOwner && <Text style={[styles.note, { color: palette.danger }]}>Sign in with the account already linked to this device.</Text>}
        <TextInput accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={address} onChangeText={setAddress} placeholder="Email address" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.ink, backgroundColor: palette.surface, borderColor: palette.line }]} />
        <TextInput accessibilityLabel="Password" autoCapitalize="none" autoComplete="password" secureTextEntry value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.ink, backgroundColor: palette.surface, borderColor: palette.line }]} />
        <View style={styles.actions}><Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit('in')} style={[styles.button, { backgroundColor: palette.accent }]}><Text style={[styles.buttonText, { color: palette.inverse }]}>Sign in</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit('up')} style={[styles.button, { backgroundColor: palette.purpleSoft }]}><Text style={[styles.buttonText, { color: palette.purple }]}>Create account</Text></Pressable></View>
      </>}
    </>}
    {(error || cloud.lastError) && <Text style={[styles.note, { color: palette.danger }]}>{error || cloud.lastError}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  group: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontFamily: type.bold, fontSize: 15 },
  badge: { fontFamily: type.bold, fontSize: 11 },
  note: { fontFamily: type.body, fontSize: 13, lineHeight: 19, marginTop: 9 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontFamily: type.body, fontSize: 14, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  button: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontFamily: type.medium, fontSize: 13 },
});
