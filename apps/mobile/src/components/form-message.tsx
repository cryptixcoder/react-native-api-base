import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** Inline banner for form-level errors or confirmations. Renders nothing without a message. */
export function FormMessage({ message, tone = 'error' }: { message?: string | null; tone?: 'error' | 'info' }) {
  if (!message) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.container} accessibilityRole="alert">
      <ThemedText type="small" themeColor={tone === 'error' ? 'danger' : 'text'}>
        {message}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: Spacing.two, padding: Spacing.three },
});
