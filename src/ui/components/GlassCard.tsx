import { View, StyleSheet, type ViewStyle } from 'react-native'
import { colors, spacing, radii } from '../theme'

interface GlassCardProps {
  children: React.ReactNode
  style?: ViewStyle
  borderColor?: string
  glowColor?: string
}

export function GlassCard({
  children,
  style,
  borderColor,
  glowColor,
}: GlassCardProps) {
  return (
    <View
      style={[
        styles.card,
        borderColor ? { borderColor } : undefined,
        glowColor
          ? {
              shadowColor: glowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }
          : undefined,
        style,
      ]}
    >
      <View style={styles.inner}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  inner: {
    padding: spacing.lg,
  },
})
