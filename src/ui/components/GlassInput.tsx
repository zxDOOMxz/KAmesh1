import { TextInput, type ViewStyle, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radii } from '../theme';

interface GlassInputProps extends TextInputProps {
  style?: ViewStyle;
  containerStyle?: ViewStyle;
}

export function GlassInput({ style, ...props }: GlassInputProps) {
  const { colors } = useTheme();

  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[{
        backgroundColor: colors.bgCard,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        minHeight: 52,
        color: colors.text,
        fontFamily: 'monospace',
        fontSize: 16,
        fontWeight: '400',
        letterSpacing: 0.2,
      }, style]}
    />
  );
}
