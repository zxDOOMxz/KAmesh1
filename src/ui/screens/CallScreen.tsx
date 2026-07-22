import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing } from '../theme';
import type { CallState } from '../../core/call/types';

interface CallScreenProps {
  call: CallState
  onAccept: () => void
  onReject: () => void
  onEnd: () => void
  onToggleMute: () => void
}

export function CallScreen({ call, onAccept, onReject, onEnd, onToggleMute }: CallScreenProps) {
  const { width, height } = useWindowDimensions();

  const statusLabel = () => {
    switch (call.status) {
      case 'calling': return call.direction === 'outgoing' ? 'Calling...' : 'Connecting...';
      case 'ringing': return 'Incoming call...';
      case 'connected': return `Connected ${call.mute ? '(muted)' : ''}`;
      case 'ended': return 'Call ended';
      default: return '';
    }
  };

  const statusColor = () => {
    switch (call.status) {
      case 'connected': return colors.neonGreen;
      case 'ringing': return colors.neonCyan;
      case 'calling': return colors.neonBlue;
      default: return colors.textMuted;
    }
  };

  return (
    <View style={[styles.overlay, { width, height }]}>
      <View style={[styles.bgGlow, { left: width * 0.3, top: height * 0.15 }]} />

      <View style={styles.content}>
        <NeonText size="h2" color={statusColor()}>
          {statusLabel()}
        </NeonText>

        <NeonText size="caption" color={colors.textSecondary} glow={false} style={{ marginTop: spacing.sm }}>
          {call.peerId ? call.peerId.slice(0, 24) : ''}...
        </NeonText>

        {call.status === 'ringing' && (
          <View style={styles.actions}>
            <GlassButton
              title="Accept"
              onPress={onAccept}
              variant="primary"
              style={styles.actionBtn}
            />
            <GlassButton
              title="Decline"
              onPress={onReject}
              variant="danger"
              style={styles.actionBtn}
            />
          </View>
        )}

        {call.status === 'connected' && (
          <View style={styles.actions}>
            <GlassButton
              title={call.mute ? 'Unmute' : 'Mute'}
              onPress={onToggleMute}
              variant="secondary"
              style={styles.actionBtn}
            />
            <GlassButton
              title="Hang up"
              onPress={onEnd}
              variant="danger"
              style={styles.actionBtn}
            />
          </View>
        )}

        {(call.status === 'calling' || call.status === 'ended') && (
          <View style={styles.actions}>
            <GlassButton
              title="Hang up"
              onPress={onEnd}
              variant="danger"
              style={styles.actionBtn}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  actionBtn: {
    minWidth: 120,
  },
  bgGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.neonCyanDim,
    opacity: 0.3,
  },
});
