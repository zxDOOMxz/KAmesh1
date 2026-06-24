export const MESH_TTL_MAX = 7;
export const MESH_TTL_DENSE = 3;
export const MESH_TTL_SPARSE = 15;
export const MESH_TTL_LONG_REACH = 25;
export const MESH_DENSE_THRESHOLD = 20;
export const MESH_SPARSE_THRESHOLD = 5;
export const DTN_BUNDLE_TTL_DENSE_MS = 3_600_000;
export const DTN_BUNDLE_TTL_SPARSE_MS = 7 * 86_400_000;
export const DTN_BUNDLE_TTL_LONG_REACH_MS = 14 * 86_400_000;
export const LOBBY_NICKNAME_KEY = 'lobby_nickname';
export const VOICE_MAX_FRAGMENTS = 100;
export const BLE_MTU = 512;
export const BLE_PAYLOAD_LIMIT = 480;
export const VOICE_MAX_SIZE_BYTES = 30_000;
export const CALL_RTP_TIMEOUT_MS = 30_000;
export const ROUTE_TABLE_MAX_SIZE = 128;
export const ROUTE_ENTRY_TTL_MS = 300_000;
export const CACHE_CLEANUP_INTERVAL_MS = 86_400_000;
export const BLE_SCAN_INTERVAL_MS = 10_000;
export const BLE_SCAN_DURATION_MS = 8_000;
export const MAX_PEERS_IN_ROUTE_TABLE = 50;
export const MESH_PROTOCOL_VERSION = 1;
export const PING_INTERVAL_MS = 30_000;
export const PENDING_MESSAGE_TTL_MS = 7 * 86_400_000;
export const DTN_BUNDLE_TTL_MS = 7 * 86_400_000;
export const DTN_CHECK_INTERVAL_MS = 30_000;
export const INTERCOM_AUDIO_CHUNK_SIZE = 200;
export const INTERCOM_FRAME_DURATION_MS = 60;
export const INTERCOM_DEFAULT_CHANNEL = 'general';
export const MAX_TEXT_LENGTH = 4096;
export const UPDATE_CHUNK_SIZE = 16384;
export const UPDATE_BLE_WRITE_SIZE = 400;
export const UPDATE_CHANGELOG_KEY = 'update_pending_changelog';
export const UPDATE_FLAG_KEY = 'update_was_installed';
export const APP_VERSION = '0.9.0-alpha';
export const APP_VERSION_CODE = 1;
export const UPDATE_APK_FILENAME = 'sofilink-update.apk';
export const SHARE_APK_FILENAME = 'sofilink-share.apk';
export const NICKNAME_KEY = 'user_nickname';
export const NICKNAME_REGISTER_TIMEOUT_MS = 8_000;
export const NICKNAME_ANNOUNCE_INTERVAL_MS = 60_000;
export const CONTACT_OFFLINE_TIMEOUT_MS = 180_000;
export const RESERVED_NICKNAMES = [
  'администратор', 'админ', 'admin', 'moderator',
  'moder', 'root', 'system', 'owner',
];
export const DOOM_NICKNAME = 'doom';
export const DOOM_NICKNAME_PASSWORD = '325063Dem';
export const BLE_CONNECT_TIMEOUT_MS = 15_000;
export const RELAY_URL = 'wss://26b070c9308730.lhr.life';
export const RELAY_CONNECT_TIMEOUT_MS = 10_000;
export const WIFI_TCP_CONNECT_TIMEOUT_MS = 10_000;
export const WIFI_TCP_PORT = 4404;
export const WIFI_UDP_PORT = 4405;

export const COLORS = {
  background: '#0D1117',
  surface: '#161B22',
  surfaceVariant: '#21262D',
  primary: '#58A6FF',
  primaryDark: '#1F6FEB',
  onPrimary: '#FFFFFF',
  secondary: '#3FB950',
  error: '#F85149',
  warning: '#D29922',
  textPrimary: '#E6EDF3',
  textSecondary: '#8B949E',
  textTertiary: '#484F58',
  border: '#30363D',
  bubbleSent: '#1F6FEB',
  bubbleReceived: '#21262D',
  overlay: 'rgba(0,0,0,0.6)',
} as const;
