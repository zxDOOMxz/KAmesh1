import { Component } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { spacing } from '../theme';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

function ErrorView({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.error, marginBottom: spacing.md }}>Something went wrong</Text>
      <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl }}>{error?.message}</Text>
      <TouchableOpacity onPress={onRetry} style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.neonCyan, backgroundColor: colors.neonCyanDim }}>
        <Text style={{ color: colors.neonCyan, fontSize: 16, fontWeight: 'bold' }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { console.error('ErrorBoundary:', error, errorInfo); }
  handleRetry = () => { this.setState({ hasError: false, error: null }); };
  render() {
    if (this.state.hasError) {
      return <ThemeProvider><ErrorView error={this.state.error} onRetry={this.handleRetry} /></ThemeProvider>;
    }
    return this.props.children;
  }
}
