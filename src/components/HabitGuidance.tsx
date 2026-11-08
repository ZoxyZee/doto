import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { workerRequest } from '@/cloud/api';
import { getCloudClient } from '@/cloud/client';
import { getHabitGuidance, type HabitGuidance as Guidance } from '@/domain/habitGuidance';
import { habitCategory } from '@/domain/habitRules';
import { type, usePalette } from '@/theme/colors';

export function HabitGuidance({ name }: { name: string }) {
  const palette = usePalette();
  const db = useSQLiteContext();
  const key = name.trim().replace(/\s+/g, ' ').toLowerCase();
  const canTailor = key.length >= 3 && habitCategory(name) === 'general';
  const [cached, setCached] = useState<{ key: string; value: Guidance } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!canTailor) return;
    let active = true;
    void db.getFirstAsync<{ tip: string; benefit_one: string; benefit_two: string }>(
      'SELECT tip, benefit_one, benefit_two FROM habit_guidance_cache WHERE name_key = ?', key,
    ).then((row) => {
      if (active && row) setCached({ key, value: { tip: row.tip, benefits: [row.benefit_one, row.benefit_two] } });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [canTailor, db, key]);
  const tailored = cached?.key === key ? cached.value : null;
  const guidance = tailored ?? getHabitGuidance(name);
  async function tailor() {
    if (busy || !canTailor) return;
    const cloud = getCloudClient();
    if (!cloud) { setError('Tailored tips need a connection.'); return; }
    setBusy(true); setError(null);
    try {
      const value = await workerRequest<Guidance>(cloud, 'api/tips', { name: name.trim() });
      if (!value || typeof value.tip !== 'string' || !Array.isArray(value.benefits) || value.benefits.length !== 2
          || value.benefits.some((item) => typeof item !== 'string')) throw new Error('Could not read the tip.');
      await db.runAsync(`INSERT INTO habit_guidance_cache(name_key, tip, benefit_one, benefit_two, updated_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(name_key) DO UPDATE SET tip = excluded.tip,
        benefit_one = excluded.benefit_one, benefit_two = excluded.benefit_two, updated_at = excluded.updated_at`,
      key, value.tip, value.benefits[0], value.benefits[1], new Date().toISOString());
      setCached({ key, value });
    } catch { setError('Could not get a tailored tip. Try later.'); }
    finally { setBusy(false); }
  }
  if (!guidance) return null;
  return <View style={[styles.card, { backgroundColor: palette.surfaceMuted, borderColor: palette.line }]}>
    <View style={styles.heading}><Ionicons name="bulb-outline" size={17} color={palette.purple} /><Text style={[styles.eyebrow, { color: palette.purple }]}>{tailored ? 'A TIP FOR YOU' : 'A LITTLE TIP'}</Text></View>
    <Text style={[styles.tip, { color: palette.ink }]}>{guidance.tip}</Text>
    <Text style={[styles.benefitsLabel, { color: palette.muted }]}>WHAT IT CAN HELP WITH</Text>
    <View style={styles.benefits}>{guidance.benefits.map((benefit) => <View key={benefit} style={styles.benefit}><Ionicons name="checkmark-circle-outline" size={16} color={palette.purple} /><Text style={[styles.benefitText, { color: palette.muted }]}>{benefit}</Text></View>)}</View>
    {canTailor && !tailored && <Pressable accessibilityRole="button" accessibilityLabel="Get a tailored habit tip" disabled={busy} onPress={() => void tailor()} style={styles.tailorButton}><Ionicons name="sparkles-outline" size={16} color={palette.purple} /><Text style={[styles.tailorText, { color: palette.purple }]}>{busy ? 'Making your tip…' : 'Get a tailored tip'}</Text></Pressable>}
    {error && <Text style={[styles.error, { color: palette.muted }]}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, marginTop: 16, padding: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: { fontFamily: type.bold, fontSize: 11, letterSpacing: 1.1 },
  tip: { fontFamily: type.medium, fontSize: 14, lineHeight: 21, marginTop: 9 },
  benefitsLabel: { fontFamily: type.bold, fontSize: 10, letterSpacing: 1, marginTop: 15 },
  benefits: { gap: 7, marginTop: 9 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitText: { fontFamily: type.body, fontSize: 12, flex: 1 },
  tailorButton: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', minHeight: 40, marginTop: 12 },
  tailorText: { fontFamily: type.bold, fontSize: 13 },
  error: { fontFamily: type.body, fontSize: 12, marginTop: 4 },
});
