import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCloud } from '@/cloud/CloudProvider';
import { type, usePalette } from '@/theme/colors';

export function CloudAccount() {
  const palette = usePalette();
  const cloud = useCloud();
  const connected = !!cloud.userId;
  const indicator = !cloud.configured ? { label: 'LOCAL', color: palette.muted }
    : cloud.lastError ? { label: 'SYNC ISSUE', color: palette.danger }
    : cloud.status === 'syncing' ? { label: 'SYNCING', color: palette.accent }
    : !connected ? { label: 'CONNECTING', color: palette.accent }
    : cloud.pending > 0 ? { label: 'PENDING', color: palette.accent }
    : cloud.lastSync ? { label: 'SYNCED', color: '#318568' }
    : { label: 'CONNECTING', color: palette.accent };
  const status = cloud.status === 'syncing' ? 'Syncing now…' : cloud.status === 'waiting'
    ? 'Waiting to sync' : connected && cloud.lastSync && cloud.pending === 0
      ? 'Saved on this phone and in Cloudflare' : 'Saved on this phone';
  return <View style={[styles.group, { borderColor: palette.line }]}>
    <View style={styles.row}><Text style={[styles.title, { color: palette.ink }]}>{connected ? 'Your private space' : 'Your data'}</Text>
      <View accessibilityLabel={`Cloud status: ${indicator.label.toLowerCase()}`} style={styles.indicator}>
        <View style={[styles.dot, { backgroundColor: indicator.color }]} />
        <Text style={[styles.badge, { color: indicator.color }]}>{indicator.label}</Text>
      </View></View>
    <Text style={[styles.note, { color: palette.muted }]}>{status}</Text>
    <Text style={[styles.note, { color: palette.muted }]}>{cloud.configured
      ? 'Your habits save locally first and sync when online. This test account is tied to this installation; uninstalling or changing phones will not restore it.'
      : 'Cloud sync is off in this build. Your name and habits stay on this phone.'}</Text>
    {connected && <><Text style={[styles.note, { color: palette.muted }]}>{cloud.pending} pending {cloud.pending === 1 ? 'change' : 'changes'}
      {cloud.lastSync ? ` · Last synced ${new Date(cloud.lastSync).toLocaleString()}` : ''}</Text>
      <Pressable accessibilityRole="button" onPress={() => void cloud.syncNow(true)} style={[styles.button, { backgroundColor: palette.purpleSoft }]}>
        <Text style={[styles.buttonText, { color: palette.purple }]}>Sync now</Text></Pressable></>}
    {cloud.lastError && <Text style={[styles.note, { color: palette.danger }]}>{cloud.lastError}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  group: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  indicator: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontFamily: type.bold, fontSize: 15 }, badge: { fontFamily: type.bold, fontSize: 11 },
  note: { fontFamily: type.body, fontSize: 13, lineHeight: 19, marginTop: 9 },
  button: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start', marginTop: 14 },
  buttonText: { fontFamily: type.medium, fontSize: 13 },
});
