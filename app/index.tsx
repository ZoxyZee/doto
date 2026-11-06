import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useProfile } from '@/profile/ProfileProvider';
import { usePalette } from '@/theme/colors';

export default function Index() {
  const { name, loading } = useProfile();
  const palette = usePalette();
  if (loading) return <ActivityIndicator style={{ flex: 1, backgroundColor: palette.background }} color={palette.accent} />;
  return <Redirect href={name ? '/(tabs)/home' : '/welcome'} />;
}
