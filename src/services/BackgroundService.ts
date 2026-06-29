import { BleService } from './BleService';
import { COLORS } from '../constants';

let _BackgroundService: any = null;
function getBackgroundService() {
  if (!_BackgroundService) {
    _BackgroundService = require('react-native-background-actions');
  }
  return _BackgroundService;
}

const backgroundOptions = {
taskName: 'SofiLink',
      taskTitle: 'SofiLink',
  taskDesc: 'Mesh network active. Scanning BLE and receiving messages.',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' },
  color: COLORS.primary.slice(1),
  linkingURI: 'sofilink://',
  parameters: { delay: 1000 },
  progressBar: { max: 100, value: 0, indeterminate: true },
};

let isRunning = false;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;

async function backgroundTask(taskData?: { delay: number }): Promise<void> {
  if (!BleService.isInitialized()) {
    try { await BleService.initialize(); } catch { /* ignore */ }
  }
  if (BleService.isInitialized()) {
    try { await BleService.startScanning(); } catch { /* ignore */ }
  }
  while (getBackgroundService().isRunning()) {
    if (!BleService.isInitialized()) {
      try { await BleService.initialize(); await BleService.startScanning(); } catch { /* ignore */ }
    }
    await new Promise(resolve => setTimeout(resolve, taskData?.delay ?? 1000));
  }
}

function startWatchdog(): void {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(async () => {
    if (!isRunning) return;
    if (!getBackgroundService().isRunning()) {
      isRunning = false;
      try { await startBackgroundTask(); } catch { /* ignore */ }
    }
  }, 15000);
}

function stopWatchdog(): void {
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
}

export async function startBackgroundTask(): Promise<void> {
  if (isRunning) return;
  try {
    await getBackgroundService().start(backgroundTask, { ...backgroundOptions, parameters: { delay: 1000 } });
    isRunning = true;
    startWatchdog();
  } catch { isRunning = false; }
}

export async function stopBackgroundTask(): Promise<void> {
  if (!isRunning) return;
  try { stopWatchdog(); await getBackgroundService().stop(); isRunning = false; } catch { /* ignore */ }
}

export function isBackgroundTaskRunning(): boolean { return isRunning && getBackgroundService().isRunning(); }

export async function updateBackgroundNotification(desc: string): Promise<void> {
  if (!isRunning) return;
  try { await getBackgroundService().updateNotification({ ...backgroundOptions, taskDesc: desc }); } catch { /* ignore */ }
}
