jest.mock('@react-native-async-storage/async-storage', () => {
  const storage: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => storage[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => { storage[key] = value; }),
      removeItem: jest.fn(async (key: string) => { delete storage[key]; }),
      getAllKeys: jest.fn(async () => Object.keys(storage)),
      multiRemove: jest.fn(async (keys: string[]) => keys.forEach(k => delete storage[k])),
    },
  };
});

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeModules.SofiLinkP2P = {
    init: jest.fn(() => Promise.resolve('test_peer_id')),
    startServer: jest.fn(() => Promise.resolve({ serverId: 'srv_0', localIp: '127.0.0.1', port: 8080 })),
    connect: jest.fn(() => Promise.resolve('conn_test')),
    sendMessage: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(),
    disconnectAll: jest.fn(),
    stopAll: jest.fn(),
  };
  RN.NativeModules.SofiLinkCrypto = {
    generateKeyPair: jest.fn(() => Promise.resolve({ publicKey: 'aabb', secretKey: 'ccdd' })),
    encrypt: jest.fn(() => Promise.resolve({ ciphertext: 'aabb', nonce: '0011' })),
    decrypt: jest.fn(() => Promise.resolve('hello')),
    generateNonce: jest.fn(() => Promise.resolve('0011223344')),
    deriveKey: jest.fn(() => Promise.resolve('aabbccdd')),
    sha256: jest.fn(() => Promise.resolve('aabbccdd')),
  };
  return RN;
});

import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../App';

test('renders SOFILINK title', () => {
  const { getByText } = render(<App />);
  expect(getByText('SOFILINK')).toBeTruthy();
});
