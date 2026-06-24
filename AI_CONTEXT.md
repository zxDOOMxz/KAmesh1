# SofiLink (ex sOFi / KAmesh) — AI Context File

## Project Goal

Кроссплатформенное (iOS/Android) офлайн-мессенджер на основе mesh-сети. Полная работа без интернета (BLE mesh), с fallback-цепочкой GSM → WiFi → BLE когда доступно. E2E-шифрование, VoIP, APK-шаринг, конференции.

## Core Principles

- **Полный офлайн** — BLE mesh работает без интернета, WiFi, GSM
- **Цепочка доставки** — приоритеты: GSM(2) → WiFi(1) → BLE(0). Выбирается наивысший доступный транспорт
- **Без сервера** — PIN на устройстве, крипто-привязка ника Ed25519, нет бэкенда
- **AGENTIC работа** — пошагово с коммитами, без гаданий, production-ready

---

## Tech Stack

| Component | Technology |
|---|---|
| Framework | React Native 0.76.9 via Expo SDK 52 |
| Language | TypeScript 5.3 (strict) |
| Navigation | react-native-screens (native) |
| Storage | MMKV (`react-native-mmkv`) |
| BLE | `react-native-ble-manager` v12 |
| WiFi P2P | `react-native-tcp-socket`, `react-native-udp` |
| GSM Relay | WebSocket (`wss://26b070c9308730.lhr.life`) |
| Crypto | `@noble/curves` (X25519, Ed25519), `@noble/hashes` (SHA-256, HKDF), `react-native-simple-crypto` (AES-256-GCM) |
| VoIP | `react-native-webrtc` (WebRTC) |
| Intercom/Conference | Opus via `react-native-audio-recorder-player` + mesh relay |
| Build | Expo EAS + GitHub Actions (self-hosted APK) |
| UI | `react-native-paper` (Material Design 3), `react-native-gesture-handler`, `react-native-reanimated` |
| Notifications | expo-av (sound) |

---

## File Map

```
src/
├── constants/index.ts          # Все константы (таймауты, цвета, relay URL)
├── types/index.ts              # Все типы (MessageType, MeshPacket, KeyBundle, ConferenceInfo, etc.)
├── utils/
│   ├── timeout.ts              # promiseWithTimeout
│   └── icqSound.ts             # ICQ-style WAV sound generator
├── components/
│   ├── MessageBubble.tsx       # Chat message bubble
│   ├── VoiceCallUI.tsx         # In-call UI overlay
│   └── VoiceRecorder.tsx       # Voice mail recorder button
├── screens/
│   ├── ChatScreen.tsx          # Main screen: menu/contacts/chat/conference/share
│   ├── NicknameRegistrationScreen.tsx
│   ├── PinSetupScreen.tsx      # PIN create → confirm
│   ├── PinUnlockScreen.tsx     # PIN unlock (5 attempts)
│   └── UpdateNotificationScreen.tsx  # Changelog modal
├── services/
│   ├── AuthService.ts          # PIN hashing (SHA-256+salt), AES-GCM key bundle storage, session lock
│   ├── BackgroundService.ts    # Foreground service via react-native-background-actions
│   ├── BleService.ts           # BLE GATT central+peripheral, fragment reassembly
│   ├── ChannelService.ts       # Channel-based mesh grouping
│   ├── ConferenceService.ts    # Voice conference rooms (custom audio relay)
│   ├── ContactService.ts       # Ed25519-signed nickname registration, contact list
│   ├── CryptoService.ts        # X25519+Ed25519 key exchange, AES-GCM, Double Ratchet sessions
│   ├── IntercomService.ts      # Walkie-talkie (PTT + VOX), Opus audio chunks over mesh
│   ├── MeshService.ts          # Core routing: TTL, DTN store-and-forward, route table, send/broadcast
│   ├── ShareService.ts         # APK transfer: chunked file send/receive over mesh
│   ├── SoundService.ts         # ICQ notification sound via expo-av
│   ├── StorageService.ts       # MMKV wrapper: keys, messages, routes, sessions
│   ├── TransportManager.ts     # Transport abstraction: selects best transport by priority
│   ├── UpdateService.ts        # OTA APK update over mesh (manifest → chunks → install)
│   ├── VoiceCallService.ts     # WebRTC voice call with mesh SDP/ICE relay
│   └── VoiceMailService.ts     # Record → chunk → send / receive → assemble → play
│   └── transports/
│       ├── ITransport.ts       # Interface: init/send/broadcast/onData/onConnection
│       ├── BleTransport.ts     # Priority 0 — BLE GATT wrapper
│       ├── WifiTransport.ts    # Priority 1 — TCP+UDP (port 4404/4405)
│       └── GsmTransport.ts     # Priority 2 — WebSocket relay
```

---

## Transport Chain (delivery order)

`TransportManager.send(peerId, data)`:
1. Sorts transports by **priority descending**: GSM(2) → WiFi(1) → BLE(0)
2. Tries each transport in order; first one `isAvailable()` wins
3. `broadcast()` fires **all transports in parallel**

### BLE Transport (priority 0)
- `react-native-ble-manager`
- Central + Peripheral modes
- Custom service: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- TX char: `6e400002`, RX char: `6e400003`
- Data fragmentation if > MTU
- RSSI tracking

### WiFi Transport (priority 1)
- UDP broadcast discovery on port 4405
- TCP data channel on port 4404
- `react-native-tcp-socket` + `react-native-udp`
- Reconnection logic

### GSM Transport (priority 2)
- WebSocket client → `wss://26b070c9308730.lhr.life`
- Connectivity check via `@react-native-community/netinfo`
- Acts as long-range relay

---

## Mesh Routing (MeshService)

- **MeshPacket**: packetId, type, sourceId, targetId, relayId, ttl (max 7), payload, timestamp, isBroadcast, fragment fields
- **TTL decrement** on each hop; drop at 0
- **Deduplication**: `processedPackets` Set (packetId, capped at 10k)
- **Route table**: `RouteEntry[]` — nodeId, nextHop, rssi, hops, lastSeen (stored in MMKV)
- **DTN (Store-and-Forward)**: eligible types: TEXT, VOICE_MAIL, VOICE_MAIL_CHUNK, UPDATE_MANIFEST. Stored as pending messages, retried on connection events. TTL: 7 days.
- **Control packets**: ping/pong, key exchange, nickname, conference create/leave/audio → processed but NOT forwarded
- **Direct-only**: UPDATE_CHUNK, UPDATE_CHUNK_REQUEST → only direct delivery, no relay
- **Fragmentation**: large payloads split by fragmentIndex/fragmentTotal/fragmentSessionId

### DTN Bundle
- Stored in MMKV: pending messages + relay bundles
- `DTN_CHECK_INTERVAL_MS = 30s` — retry delivery
- `DTN_BUNDLE_TTL_MS = 7 days`
- On peer connect: deliver pending bundles for that peer

---

## PIN Authentication (AuthService)

- PIN: 4-8 digits
- Hash: SHA-256(pin + random salt) — stored in MMKV
- Key bundle (Ed25519 private key, X25519 keys) encrypted with AES-256-GCM using key derived from PIN via HKDF
- 5 attempts before... (lock mechanism)
- Session unlock: keeps bundle in memory; lock encrypts again
- Flow: Setup → Lock → Unlock → Nickname → Chat

---

## E2E Encryption (CryptoService)

- **Key exchange**: X25519 + Ed25519 (via `@noble/curves`)
- **Cipher**: AES-256-GCM (via `react-native-simple-crypto`)
- **Key derivation**: HKDF (via `@noble/hashes`)
- **Sessions**: Double Ratchet-style with send/recv counters
- **Packet signing**: `signData()` / `verifySignature()` — Ed25519
- **Nickname binding**: registration includes `pubKey` + Ed25519 `signature` (prevents nickname theft)
- **Key bundle stored encrypted** at rest via PIN-derived key

---

## Voice Call (VoiceCallService)

- `react-native-webrtc`
- SDP offer/answer + ICE candidates relayed over **mesh packets** (no internet STUN/TURN)
- Call states: IDLE → CALLING → RINGING → CONNECTING → CONNECTED → ENDED
- RTP timeout: 30s
- No ICE servers (peer-to-peer only over WiFi/BLE)

## Intercom / Walkie-Talkie (IntercomService)

- Opus audio via `react-native-audio-recorder-player`
- Chunk relay over mesh `INTERCOM_AUDIO` packets
- **PTT** (push-to-talk) + **VOX** (voice-activated, threshold = 20 bytes)
- Frame duration: 60ms, chunk size: 200 bytes
- Temp file: `cacheDirectory/intercom_temp.opus`
- Broadcast-based: all peers in range hear

## Conference (ConferenceService)

- Custom rooms (not WebRTC): audio relayed as `CONFERENCE_AUDIO` packets over mesh
- Participants tracked per conference
- `isSpeaking` flag for visual indicator
- **Invite system**: `CONFERENCE_INVITE` message type + contact picker in ChatScreen
- Password-protected rooms supported
- Discover open conferences via `CONFERENCE_CREATE` broadcasts

---

## OTA Updates (UpdateService + ShareService)

### Update flow
1. **New version installed** → `UPDATE_MANIFEST` broadcast: version, size, chunk count, file hash
2. Peer requests chunks via `UPDATE_CHUNK_REQUEST`
3. Chunks delivered via `UPDATE_CHUNK` (direct-only, no relay, max 16KB each)
4. Recipient assembles, verifies hash, saves to `cacheDirectory/sofilink-update.apk`
5. `ready_for_install` event → user triggers `installReceivedApk()` via content URI intent

### Share flow
1. `SHARE_APK_REQUEST` (with sessionId, totalSize, totalChunks)
2. Recipient accepts/rejects (`SHARE_APK_ACCEPT` / `SHARE_APK_REJECT`)
3. Chunks sent as `SHARE_APK_CHUNK` (batch of 5 at a time, no relay)
4. `SHARE_APK_DONE` → recipient assembles → `transfer_complete` + `ready_for_install`

### APK source priority (registerLocalApk):
1. `cacheDirectory + sofilink-update.apk` (received via OTA)
2. `cacheDirectory + sofilink-share.apk` (received via Share)
3. `bundleDirectory + sofilink-share.apk` (bundled in APK assets)

---

## App Bootstrap Flow (App.tsx)

```
Start
  → startBackgroundTask()
  → MeshService.initialize()
  → ChannelService.initialize()
  → UpdateService.initialize()
  → ShareService.initialize()
  → Check pending changelog
  → Check PIN state:
       Not set → PinSetupScreen → PinUnlockScreen → ready
       Set, locked → PinUnlockScreen → ready
       Set, unlocked → ready
  → Nickname registered? No → NicknameRegistrationScreen
  → All set → ChatScreen
```

---

## Project Constraints

- **Full offline**: BLE mesh works without internet, GSM fallback for connected peers
- **Fallback chain**: GSM→WiFi→BLE with adaptive priority. For conferences: GSM boost to priority 5 (voice doesn't drop when BLE/WiFi lost)
- **Conference priority boost**: `TransportManager.setTransportPriority('gsm', 5)` on conference join, reset to default on leave
- **PIN lock**: 4-8 digits, SHA-256+salt, AES-GCM encrypted key bundle. 5 attempts then lock
- **Crypto nickname binding**: Ed25519 keypair, registration signed with pubKey, prevents nickname theft
- **No server**: Everything peer-to-peer, no backend
- **AGENTIC work**: Step-by-step with commits, no guessing, production-ready
- **Private repo**: `zxDOOMxz/KAmesh1`, CI only on push to master, logs copied manually
- **App rename history**: KAmesh → sOFi → SofiLink (all identifiers, schemes, package names agreed)

---

## Build System

### CI (`build-android.yml`)
- Trigger: push to master/main + PR + manual
- Steps:
  1. Checkout + Java 17 + Node 20
  2. Cache Gradle
  3. `npm ci`
  4. `chmod +x gradlew`
  5. `./gradlew assembleRelease` (first pass)
  6. Copy APK to `android/app/src/main/assets/sofilink-share.apk`
  7. `./gradlew assembleRelease` (second pass — includes APK in bundle)
  8. Upload `app-release.apk` as artifact

### Known Build Issue
- **Duplicate `actionBarSize`** in material 1.6.1 (transitive from `react-native-screens`)
- Cause: AAPT2 merges resources from ALL transitive deps — `configurations.exclude` doesn't help
- Fix (current): Gradle task `patch{Release/Debug}Resources` in `android/app/build.gradle` runs after `mergeResources`, removes duplicate `actionBarSize` entries from merged `values.xml`
- Previous attempts (all failed): `mavenLocal()` injection, `libs/` patching, Gradle cache injection
- `actionBarSize` in: `node_modules/react-native-screens/android/build.gradle` → `com.google.android.material:material:1.6.1`

### Package
- `com.mash.offline`
- minSdk 24, targetSdk 34, compileSdk 35
- Android Gradle Plugin version managed by `com.facebook.react:react-native-gradle-plugin`

---

## Nickname System (ContactService)

- Ed25519 key pair generated on first launch (stored encrypted via PIN)
- Registration: `NICKNAME_REGISTER` with `{ nickname, nodeId, pubKey, signature, timestamp }`
- Network verifies signature against pubKey → `NICKNAME_ACCEPT` or `NICKNAME_REJECT`
- `NICKNAME_ANNOUNCE` every 60s for presence
- Offline detection: `CONTACT_OFFLINE_TIMEOUT_MS = 180s`
- DOOM nickname reserved for special mode
- Reserved nicknames: администратор, админ, admin, moderator, etc.

---

## What We Can Learn from Bridgefy

Bridgefy (12.5M+ users) — ближайший коммерческий аналог. Ключевые фишки:

### 1. Transmission modes (3 уровня)
| Bridgefy | Our equivalent |
|---|---|
| `P2P(direct)` — когда получатель в радиусе | Direct send (TransportManager) |
| `Mesh(receiver)` — mesh-доставка конкретному получателю | MeshService.sendMessage() with DTN |
| `Broadcast` — всем вокруг | MeshService.broadcast() |

Bridgefy **меняет P2P на Mesh автоматически** если получатель не в радиусе. У нас этого нет — мы всегда используем mesh, что избыточно для ближних пиров. **Надо добавить: сначала пробовать direct, fallback на mesh.**

### 2. Среда-зависимые параметры
Bridgefy имеет 4 профиля маршрутизации:

| Environment | Hops Limit | TTL | Sharing Time | Max Propagation | Track List |
|---|---|---|---|---|---|
| High Density | 50 | 1h | 10000s | 50 | 50 |
| Sparse | 100 | 3.5d | 10000s | 250 | 50 |
| Long Reach | 250 | 7d | 15000s | 1000 | 50 |
| Short Reach | 50 | 1800s | 10000s | 50 | 50 |

У нас жёсткий TTL=7 для всех. **Надо адаптировать параметры под окружение.**

### 3. Hybrid Mesh
Bridgefy позволяет устройствам с интернетом получать данные извне и распространять их офлайн. У нас GSM-транспорт для этого подходит, но нет механизма «интернет-шлюз».

### 4. Smart Distribution
Bridgefy гарантирует near-100% доставку. У нас DTN + retry, но без подтверждения получения на каждом шаге (кроме DELIVERY_ACK).

### 5. Broadcast-чат
Bridgefy имеет Public Chat — все в радиусе видят сообщения. У нас нет общего канала. **Можно реализовать через isBroadcast=true в MeshService.**

### 6. Dashboard/Analytics
Bridgefy SDK умеет собирать метрики использования в офлайн-режиме. Для нас неактуально (AGENTIC — не продукт).

### 7. Простота входа
Bridgefy требует интернет только при первом запуске (логин). У нас тоже — но через PIN, а не через сервер.

### Внедрено:
1. **Direct → Mesh fallback** — `MeshService.sendMessage()` сначала проверяет direct-соединение с получателем (P2P). Если его нет — flood + DTN. Аналог Bridgefy P2P → Mesh.
2. **Environment-aware routing** — `getAdaptiveTtl()` выбирает TTL по плотности пиров: dense (>20) = 3, normal = 7, sparse (≤5) = 15. Адаптивный DTN TTL от 1ч (dense) до 14д (sparse). Аналог Bridgefy environment profiles.
3. **Public broadcast channel (Lobby)** — новый `MessageType.LOBBY_MESSAGE`, отправляется `isBroadcast=true`. Вкладка "📢 Lobby" в ChatScreen. Все в mesh видят сообщения без добавления в контакты. Аналог Bridgefy Broadcast/Public Chat.

---

## Current State (as of June 2026)

### Fully Implemented
- [x] BLE transport (scan, connect, fragment, broadcast)
- [x] WiFi transport (UDP discovery, TCP data)
- [x] GSM transport (WebSocket relay)
- [x] TransportManager with priority fallback
- [x] Conference priority boost (GSM→5 on join, restore on leave)
- [x] Mesh routing (TTL, dedup, route table)
- [x] DTN store-and-forward
- [x] E2E encryption (X25519+Ed25519+AES-GCM+Double Ratchet)
- [x] PIN auth (4-8 digits, SHA-256+salt, AES-GCM bundle)
- [x] Nickname registration (Ed25519-signed)
- [x] Text messaging with delivery status
- [x] Voice mail (record → chunk → send)
- [x] WebRTC voice calls (mesh SDP/ICE relay)
- [x] Intercom/PTT/VOX (Opus over mesh)
- [x] Conference rooms (custom audio relay)
- [x] Conference invites (contact picker)
- [x] OTA APK updates over mesh
- [x] APK sharing over mesh
- [x] ICQ notification sound
- [x] Background BLE service
- [x] CI/CD: GitHub Actions APK build (two-pass)
- [x] Bridgefy-inspired: Direct→Mesh fallback
- [x] Bridgefy-inspired: Environment-aware routing (dense/sparse TTL)
- [x] Bridgefy-inspired: Lobby (Public Broadcast)
- [x] Managed Flooding (jittered SNR-based backoff 50-350ms)
- [x] Build fix: Gradle task patch merged resources (remove duplicate actionBarSize)

### In Progress / Known Issues
- [ ] APK sharing: bootstrap (first build includes APK in assets for next build — chicken-and-egg)
- [ ] CI build verification (waiting for log from commit `1e7bb35`)
- [ ] Proper iOS support (BLE background modes configured but untested)

### Key Decisions
- No server — everything is peer-to-peer
- PIN + crypto binding вместо пароля/сервера
- CI на master (не main)
- GitHub репо приватный — логи CI копируются вручную
- Two-pass build: APK → assets → rebuild для встраивания APK
- `<configurations.implementation { exclude }>` не влияет на AAPT2 resource merge — ресурсы мержатся из всех transitive dependencies
- Подмена AAR в Gradle module cache или Gradle task post-merge (текущий подход) — единственные рабочие способы
- Managed Flooding без CSMA/CA: BLE не имеет общего канала → jittered backoff без skip-if-heard
- GSM boost до priority=5 при конференции: голос не рвётся при потере BLE/WiFi
- Rename KAmesh → sOFi → SofiLink: все идентификаторы, схемы, package names согласованы

---

## Critical Configuration

### Relay WebSocket (GSM fallback)
```
RELAY_URL = 'wss://26b070c9308730.lhr.life'
```
Используется когда BLE/WiFi недоступны, но есть интернет. LHR Tunnel — долгоживущий туннель.

### Build: Duplicate actionBarSize Fix
- **Root cause**: `react-native-screens` pulls `com.google.android.material:material:1.6.1` transitively.
  `expo-dev-menu` also pulls `material:1.2.1`. Both have `<public type="attr" name="actionBarSize" />` in their values.xml
  which conflicts with appcompat's `actionBarSize` attr definition. AAPT2 sees the duplicate and fails.
  Error: `Duplicate value for resource 'attr/actionBarSize' with config 'DEFAULT'`.
- **Current fix (works)**: Force material version 1.12.0 across ALL modules:
  1. Root `android/build.gradle`: `allprojects { configurations.configureEach { resolutionStrategy.eachDependency { ... } } }`
  2. App `android/app/build.gradle`: `implementation 'com.google.android.material:material:1.12.0'` + `configurations.configureEach { ... }`
- **Why it works**: Material 1.9.0+ no longer has the `<public type="attr" name="actionBarSize" />` declaration that
  conflicted with appcompat. Older versions (1.2.1, 1.6.1) all had this issue.
- **Why not `configurations.exclude`**: AAPT2 doesn't check classpath — resources merge from ALL transitive deps regardless.
- **Previous failed attempts**:
  1. `mavenLocal()` injection — Gradle ignores local repo when module is already in cache
  2. `libs/` fileTree — exclude doesn't affect AAPT2 resource merge
  3. Post-merge `patchReleaseResources` via `finalizedBy` — too late, merge already failed
  4. CI cache injection — fragile across environments
  5. `aarPreBuild` (patch AAR in modules-2 cache) — regex didn't match actual XML format, transform re-extracted original

### Constants to know
| Constant | Value | Purpose |
|---|---|---|
| `MESH_TTL_MAX` | 7 | Max hops |
| `UPDATE_CHUNK_SIZE` | 16384 | OTA chunk size |
| `BLE_MTU` | 512 | BLE packet size |
| `INTERCOM_FRAME_DURATION_MS` | 60 | Walkie-talkie frame |
| `CONTACT_OFFLINE_TIMEOUT_MS` | 180000 | 3 min offline threshold |
| `WIFI_TCP_PORT` | 4404 | WiFi data port |
| `WIFI_UDP_PORT` | 4405 | WiFi discovery port |
