import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { localDate } from '@/domain/habitRules';
import type { Habit } from '@/types/habit';
import { type, usePalette } from '@/theme/colors';

export function HabitCard({ habit, completed, onToggle }: { habit: Habit; completed?: boolean; onToggle?: () => Promise<void> }) {
  const palette = usePalette();
  const [busy, setBusy] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  async function toggle() {
    if (!onToggle || busy) return;
    setBusy(true);
    try {
      await onToggle();
      if (!reduceMotion) {
        scale.setValue(0.8);
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 8 }).start();
      }
      void Haptics.selectionAsync().catch(() => undefined);
    } finally { setBusy(false); }
  }
  return <View style={[styles.row, { borderBottomColor: palette.line }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${habit.name}`} onPress={() => router.push({ pathname: '/habits/[id]', params: { id: habit.id } })} style={styles.details}>
      <View style={[styles.icon, { backgroundColor: `${habit.color}24` }]}><Ionicons name={habit.icon as keyof typeof Ionicons.glyphMap} size={22} color={habit.color} /></View>
      <View style={styles.copy}><Text style={[styles.name, { color: palette.ink }, completed && { opacity: 0.6 }]} numberOfLines={1}>{habit.name}</Text>
        <Text style={[styles.hint, { color: palette.muted }]} numberOfLines={1}>{habit.created_date > localDate(new Date()) ? `Starts ${habit.created_date}` : completed ? 'Done for today' : habit.description || 'A small step today'}</Text></View>
    </Pressable>
    {onToggle ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!completed, disabled: busy }} accessibilityLabel={`${completed ? 'Undo' : 'Complete'} ${habit.name}`} onPress={() => void toggle()} disabled={busy} style={styles.hit}>
      <Animated.View style={[styles.check, { borderColor: completed ? palette.accent : palette.line, backgroundColor: completed ? palette.accent : 'transparent', transform: [{ scale }] }]}>
        {completed ? <Ionicons name="checkmark" size={19} color={palette.inverse} /> : null}
      </Animated.View>
    </Pressable> : <Ionicons name="chevron-forward" size={18} color={palette.muted} />}
  </View>;
}
const styles = StyleSheet.create({ row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 }, details: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 76 }, icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 }, copy: { flex: 1, paddingRight: 4 }, name: { fontSize: 16, fontFamily: type.bold }, hint: { fontSize: 13, fontFamily: type.body, marginTop: 3 }, hit: { width: 52, height: 56, justifyContent: 'center', alignItems: 'flex-end' }, check: { width: 30, height: 30, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' } });
