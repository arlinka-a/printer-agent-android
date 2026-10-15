import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgentConfig, emptyConfig, LocalPrinter } from '../types';

const KEY = 'printer-agent/config/v1';

export async function loadConfig(): Promise<AgentConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return emptyConfig;
    }
    const config: AgentConfig = { ...emptyConfig, ...JSON.parse(raw) };
    return { ...config, printers: config.printers.map(migratePrinter) };
  } catch {
    return emptyConfig;
  }
}

// Configs saved before the three-state tag stored a boolean staticIpConfirmed.
function migratePrinter(printer: LocalPrinter & { staticIpConfirmed?: boolean }): LocalPrinter {
  const { staticIpConfirmed, ...rest } = printer;
  return { ...rest, staticIp: rest.staticIp ?? (staticIpConfirmed ? 'pinned' : 'unchecked') };
}

export async function saveConfig(config: AgentConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(config));
}

export function isConfigUsable(config: AgentConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.agentToken.trim() && config.tenantId.trim());
}
