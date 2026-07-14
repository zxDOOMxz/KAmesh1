import {
  TextInput,
  StyleSheet,
  type ViewStyle,
  type TextInputProps,
} from 'react-native'
import { colors, spacing, radii, typography } from '../theme'

interface GlassInputProps extends TextInputProps {
  style?: ViewStyle
  containerStyle?: ViewStyle
}

export function GlassInput({ style, ...props }: GlassInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        styles.input,
        typography.body as any,
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 52,
    color: colors.text,
  },
})
