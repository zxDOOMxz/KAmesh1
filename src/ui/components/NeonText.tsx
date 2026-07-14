import { Text, type TextStyle, type StyleProp } from 'react-native'
import { colors } from '../theme'

interface NeonTextProps {
  children: React.ReactNode
  color?: string
  size?: 'display' | 'h1' | 'h2' | 'body' | 'caption'
  style?: StyleProp<TextStyle>
  glow?: boolean
}

export function NeonText({
  children,
  color = colors.neonCyan,
  size = 'body',
  style,
  glow = true,
}: NeonTextProps) {
  const sizes: Record<string, TextStyle> = {
    display: { fontSize: 48, fontWeight: '300', letterSpacing: -2 },
    h1: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
    h2: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },
    body: { fontSize: 16, fontWeight: '400', letterSpacing: 0.2 },
    caption: { fontSize: 13, fontWeight: '400', letterSpacing: 0.3 },
  }

  return (
    <Text
      style={[
        { color, fontFamily: 'monospace' },
        sizes[size],
        glow && {
          textShadowColor: color,
          textShadowRadius: 8,
        },
        style,
      ]}
    >
      {children}
    </Text>
  )
}
