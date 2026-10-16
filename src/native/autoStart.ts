import { NativeModules } from 'react-native';

// Native side: android/.../AutoStartModule.kt. Opening after a restart needs "display over other apps".
const { AutoStart } = NativeModules as {
  AutoStart: { isEnabled(): Promise<boolean>; openSettings(): void };
};

export const autoStart = {
  isEnabled: () => AutoStart.isEnabled(),
  openSettings: () => AutoStart.openSettings(),
};
