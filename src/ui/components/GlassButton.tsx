import {
  TouchableOpacity,
  StyleSheet,
  Text,
  type ViewStyle,
  ActivityIndicator,
} from 'react-native'
import { colors, spacing, radii } from '../theme'

interface GlassButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}

export function GlassButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: GlassButtonProps) {
  const isPrimary = variant === 'primary'
  const neonColor = variant === 'danger' ? colors.neonPink : colors.neonCyan
  const dimColor = variant === 'danger' ? colors.neonPinkDim : colors.neonCyanDim

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          borderColor: isPrimary ? neonColor : colors.border,
          backgroundColor: isPrimary ? dimColor : colors.bgCard,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={neonColor} size="small" />
      ) : (
        <LocalNeonText
          text={title.toUpperCase()}
          color={neonColor}
        />
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
})

function LocalNeonText({
  text,
  color,
}: {
  text: string
  color: string
}) {
  return (
    <Text
      style={{
        color,
        textShadowColor: color,
        textShadowRadius: 8,
      }}
    >
      {text}
    </Text>
  )
}
