import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import { he } from '../i18n/he';

/**
 * Sends raw bytes to a network printer (JetDirect / port 9100). Resolves once the bytes are
 * flushed and the socket closed; rejects on connect error or timeout, which the agent reports
 * back to the backend as a failed job.
 */
export function sendRaw(ip: string, port: number, data: Uint8Array, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      error ? reject(error) : resolve();
    };

    const timer = setTimeout(() => finish(new Error(he.errors.printerTimeout(`${ip}:${port}`))), timeoutMs);
    const socket = TcpSocket.createConnection({ host: ip, port }, () => {
      socket.write(Buffer.from(data), undefined, (err) => {
        if (err) {
          finish(err instanceof Error ? err : new Error(String(err)));
        } else {
          socket.end();
        }
      });
    });
    socket.on('error', (err) => finish(err instanceof Error ? err : new Error(String(err))));
    socket.on('close', () => finish());
  });
}

/** True if something accepts TCP on ip:port within timeoutMs. Used by discovery and static-IP checks. */
export function probe(ip: string, port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const socket = TcpSocket.createConnection({ host: ip, port }, () => finish(true));
    socket.on('error', () => finish(false));
  });
}
