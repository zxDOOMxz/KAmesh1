import { TouchableOpacity, Text, type ViewStyle, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radii } from '../theme';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function GlassButton({ title, onPress, variant = 'primary', loading = false, disabled = false, style }: GlassButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary' || variant === 'danger';
  const neonColor = variant === 'danger' ? colors.neonPink : colors.neonCyan;
  const dimColor = variant === 'danger' ? colors.neonPinkDim : colors.neonCyanDim;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} disabled={disabled || loading}
      style={[{
        paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
        borderRadius: radii.md, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center', minHeight: 52,
        borderColor: isPrimary ? neonColor : colors.border,
        backgroundColor: isPrimary ? dimColor : colors.bgCard,
        opacity: disabled ? 0.4 : 1,
      }, style]}>
      {loading ? (
        <ActivityIndicator color={neonColor} size="small" />
      ) : (
        <Text style={{ color: neonColor, textShadowColor: neonColor, textShadowRadius: 8, fontWeight: 'bold', letterSpacing: 1 }}>
          {title.toUpperCase()}
        </Text>
      )}
    </TouchableOpacity>
  );
}
