import NetInfo from '@react-native-community/netinfo';
import { LocalPrinter } from '../types';
import { he } from '../i18n/he';
import { probe } from './transport';

export const RAW_PRINT_PORT = 9100;

export async function getWifiIpv4(): Promise<string | null> {
  const state = await NetInfo.fetch('wifi');
  const details = state.details as { ipAddress?: string } | null;
  return details?.ipAddress ?? null;
}

/**
 * Scans the phone's /24 for anything listening on 9100. Runs in batches so the scan finishes in
 * a few seconds without opening 254 sockets at once.
 */
export async function discoverPrinters(
  onProgress?: (scanned: number, total: number) => void,
  batchSize = 32,
): Promise<LocalPrinter[]> {
  const ip = await getWifiIpv4();
  if (!ip) {
    throw new Error(he.errors.noWifi);
  }
  const prefix = ip.split('.').slice(0, 3).join('.');
  const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`).filter((h) => h !== ip);

  const found: LocalPrinter[] = [];
  for (let i = 0; i < hosts.length; i += batchSize) {
    const batch = hosts.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((h) => probe(h, RAW_PRINT_PORT)));
    results.forEach((ok, j) => {
      if (ok) {
        found.push({
          name: he.defaultPrinterName(batch[j].split('.')[3]),
          ip: batch[j],
          port: RAW_PRINT_PORT,
          staticIpConfirmed: false,
        });
      }
    });
    onProgress?.(Math.min(i + batchSize, hosts.length), hosts.length);
  }
  return found;
}
