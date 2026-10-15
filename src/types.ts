// Shapes mirror printer-spooler-kit/server (store.js, index.js).

export type JobStatus = 'queued' | 'claimed' | 'printed' | 'failed';

export type PrintJob = {
  id: number;
  tenantId: string;
  orderId: number | null;
  printerId: number;
  printerName: string;
  status: JobStatus;
  printableText: string;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export type BackendPrinter = {
  id: number;
  tenantId: string;
  name: string;
  customName: string | null;
  cashDrawer: boolean;
  mainPrinter: boolean;
  active: boolean;
  humanDisabled: boolean;
}

/** A network (ESC/POS over TCP 9100) printer found on the LAN. */
export type LocalPrinter = {
  /** Name reported to the backend via agent-sync; jobs are routed back by this name. */
  name: string;
  ip: string;
  port: number;
  /** Manufacturer and model as the printer reports them (ESC/POS GS I); null if it didn't answer. */
  model?: string | null;
  /** Whether the user says they pinned this IP in the printer's own settings page. */
  staticIp: StaticIpStatus;
}

/** unchecked: not asked yet; notPinned: user answered "no"; pinned: user answered "yes". */
export type StaticIpStatus = 'unchecked' | 'notPinned' | 'pinned';

export type AgentConfig = {
  baseUrl: string;
  agentToken: string;
  tenantId: string;
  printers: LocalPrinter[];
  /** backend printer id -> local printer name, rebuilt after every agent-sync. */
  backendPrinterMap: Record<string, string>;
}

export const emptyConfig: AgentConfig = {
  baseUrl: '',
  agentToken: '',
  tenantId: '',
  printers: [],
  backendPrinterMap: {},
};
