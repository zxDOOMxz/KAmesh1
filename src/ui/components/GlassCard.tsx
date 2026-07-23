import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radii } from '../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  borderColor?: string;
  glowColor?: string;
}

export function GlassCard({ children, style, borderColor, glowColor }: GlassCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[{
        backgroundColor: colors.bgCard,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: borderColor ?? colors.border,
        overflow: 'hidden',
        padding: spacing.lg,
      },
        glowColor ? {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 8,
        } : undefined,
        style,
      ]}
    >
      {children}
    </View>
  );
}
