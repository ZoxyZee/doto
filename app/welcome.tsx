import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfile } from '@/profile/ProfileProvider';
import { type, usePalette } from '@/theme/colors';

export default function Welcome() {
  const palette = usePalette();
  const profile = useProfile();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function continueToApp() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await profile.setName(name);
      router.replace('/(tabs)/home');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your name.');
    } finally { setSaving(false); }
  }

  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.brandRow}><Text style={[styles.brand, { color: palette.ink }]}>doto<Text style={{ color: palette.accent }}>.</Text></Text><Text style={[styles.step, { color: palette.muted }]}>01 / 01</Text></View>
      <View style={styles.content}>
        <View style={[styles.art, { backgroundColor: palette.surface }]}><View style={[styles.orbit, { borderColor: palette.line }]} /><View style={[styles.orbitSmall, { borderColor: palette.accent }]} /><Text style={[styles.artMark, { color: palette.accent }]}>✳</Text></View>
        <Text style={[styles.overline, { color: palette.purple }]}>LET'S BEGIN</Text>
        <Text style={[styles.title, { color: palette.ink }]}>What should we{`\n`}call you?</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>A little more personal from the very first step.</Text>
        <Text style={[styles.label, { color: palette.ink }]}>YOUR NAME</Text>
        <TextInput accessibilityLabel="Your name" autoCapitalize="words" autoComplete="name" maxLength={32} value={name} onChangeText={setName} onSubmitEditing={() => void continueToApp()} returnKeyType="done" placeholder="Type your name" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.ink, backgroundColor: palette.surface, borderColor: palette.line }]} />
        {error && <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>{error}</Text>}
      </View>
      <View style={styles.bottom}><Pressable accessibilityRole="button" disabled={saving || name.trim().length < 2} onPress={() => void continueToApp()} style={({ pressed }) => [styles.button, { backgroundColor: palette.accent, opacity: saving || name.trim().length < 2 ? .5 : pressed ? .8 : 1 }]}><Text style={[styles.buttonText, { color: palette.inverse }]}>{saving ? 'Saving…' : 'Start my journey'}</Text><Text style={[styles.arrow, { color: palette.inverse }]}>→</Text></Pressable><Text style={[styles.privacy, { color: palette.muted }]}>No email needed to start. Your habits save on this device.</Text></View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, container: { flex: 1, paddingHorizontal: 28, paddingTop: 22, paddingBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: type.bold, fontSize: 28, letterSpacing: -1.3 }, step: { fontFamily: type.medium, fontSize: 12 },
  content: { flex: 1, justifyContent: 'center' },
  art: { width: 132, height: 132, borderRadius: 38, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 36 },
  orbit: { width: 144, height: 144, borderRadius: 72, borderWidth: 1, position: 'absolute', top: 20, left: 24 },
  orbitSmall: { width: 74, height: 74, borderRadius: 37, borderWidth: 2, position: 'absolute', top: -12, left: -17 },
  artMark: { fontSize: 52, lineHeight: 72 }, overline: { fontFamily: type.bold, fontSize: 11, letterSpacing: 2 },
  title: { fontFamily: type.display, fontSize: 42, lineHeight: 48, letterSpacing: -1.4, marginTop: 15 },
  subtitle: { fontFamily: type.body, fontSize: 15, lineHeight: 22, marginTop: 15, marginBottom: 42 },
  label: { fontFamily: type.bold, fontSize: 11, letterSpacing: 1.6, marginBottom: 11 },
  input: { borderWidth: 1, borderRadius: 17, minHeight: 59, paddingHorizontal: 18, fontFamily: type.medium, fontSize: 16 },
  error: { fontFamily: type.medium, fontSize: 13, marginTop: 10 }, bottom: { gap: 16 },
  button: { minHeight: 59, borderRadius: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttonText: { fontFamily: type.bold, fontSize: 15 }, arrow: { fontFamily: type.bold, fontSize: 22 },
  privacy: { textAlign: 'center', fontFamily: type.body, fontSize: 12, lineHeight: 17 },
});
