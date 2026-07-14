import { NativeModules } from 'react-native';

const { SofiLinkWebRTC, SofiLinkP2P, SofiLinkCrypto, SofiLinkStorage } = NativeModules;

export const WebRTCModule = SofiLinkWebRTC;
export const P2PModule = SofiLinkP2P;
export const CryptoModule = SofiLinkCrypto;
export const StorageModule = SofiLinkStorage;
