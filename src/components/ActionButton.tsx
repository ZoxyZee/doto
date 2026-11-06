import { Pressable, StyleSheet, Text } from 'react-native';
import { type, usePalette } from '@/theme/colors';

export function ActionButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const palette = usePalette();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? palette.purpleSoft : palette.accent }, pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={[styles.text, { color: secondary ? palette.purple : palette.inverse }]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({ button: { borderRadius: 18, minHeight: 54, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' }, text: { fontSize: 15, fontFamily: type.bold }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] }, disabled: { opacity: 0.5 } });
