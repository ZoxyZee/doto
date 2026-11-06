import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/colors';

export function Screen({ children, scroll = true, topInset = true }: { children: ReactNode; scroll?: boolean; topInset?: boolean }) {
  const palette = usePalette();
  return <SafeAreaView edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']} style={[styles.safe, { backgroundColor: palette.background }]}>
    {scroll ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      : <View style={styles.content}>{children}</View>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1 }, content: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 48 } });
