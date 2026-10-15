import { AgentConfig, PrintJob } from '../types';
import { ltr } from '../utils/he';
import { api, authHeaders } from './client';

// RN's fetch cannot stream a body, but XHR with an onprogress handler gets incremental
// responseText on Android, which is enough to parse Server-Sent Events.

const STALE_AFTER_MS = 60_000; // server pings every 25s

export interface SseHandle {
  stop(): void;
  isHealthy(): boolean;
}

export function startJobStream(
  config: AgentConfig,
  onQueuedJob: (job: PrintJob) => void,
  log: (msg: string) => void,
): SseHandle {
  let stopped = false;
  let connected = false;
  let lastFrameAt = 0;
  let backoffMs = 1000;
  let xhr: XMLHttpRequest | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const handleFrame = (data: string) => {
    let payload: any;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    // The kit publishes 'printjob.upserted'; the Windows agent listens for 'upsert'. Accept both.
    if ((payload?.type === 'printjob.upserted' || payload?.type === 'upsert') && payload.job?.status === 'queued') {
      onQueuedJob(payload.job);
    }
  };

  const connect = () => {
    if (stopped) {
      return;
    }
    let consumed = 0;
    let buffer = '';
    let dataLines: string[] = [];

    xhr = new XMLHttpRequest();
    xhr.open('GET', api.streamUrl(config));
    Object.entries({ ...authHeaders(config), Accept: 'text/event-stream', 'Cache-Control': 'no-cache' }).forEach(
      ([k, v]) => xhr!.setRequestHeader(k, v),
    );

    xhr.onprogress = () => {
      if (!xhr) {
        return;
      }
      if (!connected) {
        connected = true;
        backoffMs = 1000;
        log('עדכונים חיים מחוברים');
      }
      lastFrameAt = Date.now();
      buffer += xhr.responseText.slice(consumed);
      consumed = xhr.responseText.length;

      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (line === '') {
          if (dataLines.length) {
            handleFrame(dataLines.join('\n'));
          }
          dataLines = [];
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''));
        }
      }
    };

    const reconnect = (status?: number) => {
      connected = false;
      xhr = null;
      if (stopped) {
        return;
      }
      log(`עדכונים חיים נותקו${status ? ` (קוד ${ltr(status)})` : ''}. ניסיון חוזר בעוד ${Math.round(backoffMs / 1000)} שניות`);
      retryTimer = setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    };
    // loadend fires after load, error and abort alike, so it is the single reconnect trigger.
    xhr.onloadend = () => reconnect(xhr?.status);
    xhr.send();
  };

  connect();

  return {
    stop() {
      stopped = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      xhr?.abort();
    },
    isHealthy: () => connected && Date.now() - lastFrameAt < STALE_AFTER_MS,
  };
}
