import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCloud } from '@/cloud/CloudProvider';
import { type, usePalette } from '@/theme/colors';

export function CloudAccount() {
  const palette = usePalette();
  const cloud = useCloud();
  const connected = !!cloud.userId;
  const indicator = !cloud.configured ? { label: 'UNAVAILABLE', color: palette.muted }
    : cloud.lastError ? { label: 'SYNC ISSUE', color: palette.danger }
    : cloud.status === 'syncing' ? { label: 'SYNCING', color: palette.accent }
    : !connected ? { label: 'CONNECTING', color: palette.accent }
    : cloud.pending > 0 ? { label: 'PENDING', color: palette.accent }
    : cloud.lastSync ? { label: 'SYNCED', color: '#318568' }
    : { label: 'CONNECTING', color: palette.accent };
  return <View style={[styles.group, { borderColor: palette.line }]}>
    <View style={styles.row}><Text style={[styles.title, { color: palette.ink }]}>Sync status</Text>
      <View accessibilityLabel={`Sync status: ${indicator.label.toLowerCase()}`} style={styles.indicator}>
        <View style={[styles.dot, { backgroundColor: indicator.color }]} />
        <Text style={[styles.badge, { color: indicator.color }]}>{indicator.label}</Text>
      </View></View>
    {connected && <><Text style={[styles.note, { color: palette.muted }]}>{cloud.pending > 0
      ? `${cloud.pending} ${cloud.pending === 1 ? 'change' : 'changes'} waiting`
      : cloud.lastSync ? `Last updated ${new Date(cloud.lastSync).toLocaleString()}` : 'Getting things ready…'}</Text>
      <Pressable accessibilityRole="button" onPress={() => void cloud.syncNow(true)} style={[styles.button, { backgroundColor: palette.purpleSoft }]}>
        <Text style={[styles.buttonText, { color: palette.purple }]}>{cloud.lastError ? 'Try again' : 'Sync now'}</Text></Pressable></>}
    {cloud.lastError && <Text style={[styles.note, { color: palette.danger }]}>Couldn’t update right now. Please try again.</Text>}
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
