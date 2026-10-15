import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgentConfig, emptyConfig } from '../types';

const KEY = 'printer-agent/config/v1';

export async function loadConfig(): Promise<AgentConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...emptyConfig, ...JSON.parse(raw) } : emptyConfig;
  } catch {
    return emptyConfig;
  }
}

export async function saveConfig(config: AgentConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(config));
}

export function isConfigUsable(config: AgentConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.agentToken.trim() && config.tenantId.trim());
}
