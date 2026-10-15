import { api, ApiError } from '../api/client';
import { SseHandle, startJobStream } from '../api/sse';
import { ltr, timeStamp } from '../utils/he';
import { buildDrawerKick, buildTextReceipt, CASH_DRAWER_COMMAND } from '../printers/escpos';
import { sendRaw } from '../printers/transport';
import { AgentConfig, LocalPrinter, PrintJob } from '../types';

// Same cadence rules as printer-agent-exe: poll slowly while SSE is healthy, fast when it is not.
const SSE_HEALTHY_IDLE_POLL_MS = 30_000;
const SSE_DOWN_IDLE_POLL_MS = 3000;
const ERROR_BACKOFF_MS = 5000;

export interface AgentStatus {
  running: boolean;
  backendConnected: boolean;
  sseHealthy: boolean;
  lastError: string;
  printed: number;
  failed: number;
}

type Listener = (status: AgentStatus, logLine?: string) => void;

export class PrintAgent {
  private status: AgentStatus = {
    running: false,
    backendConnected: false,
    sseHealthy: false,
    lastError: '',
    printed: 0,
    failed: 0,
  };
  private sse: SseHandle | null = null;
  private wake: (() => void) | null = null;
  private wakeRequested = false;
  private inFlight = new Set<number>();
  /** One promise chain per printer: jobs on a printer stay ordered, printers run in parallel. */
  private printerQueues = new Map<string, Promise<void>>();
  private listeners = new Set<Listener>();

  constructor(private config: AgentConfig) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private emit(logLine?: string) {
    this.status.sseHealthy = this.sse?.isHealthy() ?? false;
    this.listeners.forEach((l) => l({ ...this.status }, logLine));
  }

  private log = (msg: string) => this.emit(`[${timeStamp()}] ${msg}`);

  start() {
    if (this.status.running) {
      return;
    }
    this.status.running = true;
    this.sse = startJobStream(
      this.config,
      (job) => {
        if (this.isInScope(job)) {
          this.requestWake();
        }
      },
      this.log,
    );
    this.loop().catch((e) => this.log(`הסוכן קרס: ${e}`));
    this.log('הסוכן הופעל');
  }

  stop() {
    this.status.running = false;
    this.sse?.stop();
    this.sse = null;
    this.requestWake();
    this.log('הסוכן נעצר');
  }

  private requestWake() {
    this.wakeRequested = true;
    this.wake?.();
  }

  private sleep(ms: number): Promise<void> {
    if (this.wakeRequested) {
      this.wakeRequested = false;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.wake = null;
        this.wakeRequested = false;
        resolve();
      };
      const timer = setTimeout(done, ms);
      this.wake = done;
    });
  }

  private activeBackendIds(): number[] {
    return Object.keys(this.config.backendPrinterMap).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  }

  private isInScope(job: PrintJob): boolean {
    return this.activeBackendIds().includes(Number(job.printerId));
  }

  private async loop() {
    while (this.status.running) {
      let waitMs: number;
      try {
        await this.pollOnce();
        this.status.backendConnected = true;
        this.status.lastError = '';
        waitMs = this.sse?.isHealthy() ? SSE_HEALTHY_IDLE_POLL_MS : SSE_DOWN_IDLE_POLL_MS;
      } catch (error) {
        this.status.backendConnected = false;
        this.status.lastError = (error as Error).message;
        this.log(`בדיקת התור נכשלה: ${this.status.lastError}`);
        waitMs = ERROR_BACKOFF_MS;
      }
      this.emit();
      await this.sleep(waitMs);
    }
  }

  private async pollOnce() {
    const ids = this.activeBackendIds();
    if (!ids.length) {
      return;
    }
    const jobs = await api.agentQueue(this.config, ids);
    for (const job of jobs) {
      if (job.status !== 'queued' || this.inFlight.has(job.id) || !this.isInScope(job)) {
        continue;
      }
      const printer = this.resolvePrinter(job);
      if (!printer) {
        await this.reportFailed(job, `אין מדפסת מקומית שמשויכת ל-'${job.printerName}'`);
        continue;
      }
      this.enqueue(printer, job);
    }
  }

  private resolvePrinter(job: PrintJob): LocalPrinter | undefined {
    const mapped = this.config.backendPrinterMap[String(job.printerId)];
    const byName = (name?: string) =>
      name ? this.config.printers.find((p) => p.name.toLowerCase() === name.toLowerCase()) : undefined;
    return byName(mapped) ?? byName(job.printerName);
  }

  private enqueue(printer: LocalPrinter, job: PrintJob) {
    this.inFlight.add(job.id);
    const prev = this.printerQueues.get(printer.name) ?? Promise.resolve();
    const next = prev
      .then(() => this.claimAndPrint(printer, job))
      .finally(() => this.inFlight.delete(job.id));
    this.printerQueues.set(printer.name, next);
  }

  private async claimAndPrint(printer: LocalPrinter, job: PrintJob) {
    const started = Date.now();
    try {
      await api.setJobStatus(this.config, job.id, 'claimed');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        this.log(`עבודה ${ltr(`#${job.id}`)} כבר נלקחה על ידי סוכן אחר`);
        return;
      }
      this.log(`לקיחת עבודה ${ltr(`#${job.id}`)} נכשלה: ${(error as Error).message}`);
      return;
    }

    try {
      const payload =
        job.printableText === CASH_DRAWER_COMMAND ? buildDrawerKick() : buildTextReceipt(job.printableText);
      await sendRaw(printer.ip, printer.port, payload);
      await api.setJobStatus(this.config, job.id, 'printed');
      this.status.printed++;
      this.log(`עבודה ${ltr(`#${job.id}`)} הודפסה ב-${printer.name} (${ltr(printer.ip)}) תוך ${ltr(`${Date.now() - started}ms`)}`);
    } catch (error) {
      await this.reportFailed(job, (error as Error).message);
    }
  }

  private async reportFailed(job: PrintJob, reason: string) {
    this.status.failed++;
    this.log(`עבודה ${ltr(`#${job.id}`)} נכשלה: ${reason}`);
    try {
      await api.setJobStatus(this.config, job.id, 'failed', reason);
    } catch (error) {
      this.log(`לא ניתן לדווח על כישלון עבודה ${ltr(`#${job.id}`)}: ${(error as Error).message}`);
    }
  }
}

/** agent-sync then rebuild backend id -> local name map (exe: buildBackendPrinterMap). */
export async function syncPrinters(config: AgentConfig): Promise<Record<string, string>> {
  const names = config.printers.map((p) => p.name);
  const synced = await api.agentSync(config, {
    activePrinterNames: names,
    cashDrawerPrinterNames: [],
    mainPrinterName: names[0] ?? null,
  });
  const map: Record<string, string> = {};
  for (const bp of synced) {
    if (bp.active && names.includes(bp.name)) {
      map[String(bp.id)] = bp.name;
    }
  }
  return map;
}
