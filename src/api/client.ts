import { he } from '../i18n/he';
import { AgentConfig, BackendPrinter, JobStatus, PrintJob } from '../types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export function authHeaders(config: AgentConfig): Record<string, string> {
  return { Authorization: `Bearer ${config.agentToken.trim()}` };
}

const tenantRoute = (config: AgentConfig) =>
  `/printers/tenant/${encodeURIComponent(config.tenantId.trim())}`;

async function request<T>(
  config: AgentConfig,
  method: string,
  route: string,
  body?: unknown,
  timeoutMs = 8000,
): Promise<T> {
  const url = `${normalizeBaseUrl(config.baseUrl)}${route}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { ...authHeaders(config), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(he.errors.cannotConnect, 0);
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }
  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? he.errors.badKey
        : he.errors.server(response.status, data?.message);
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export const api = {
  health: (config: AgentConfig) => request<{ status: string }>(config, 'GET', '/health'),

  agentSync: (
    config: AgentConfig,
    body: { activePrinterNames: string[]; cashDrawerPrinterNames?: string[]; mainPrinterName?: string | null },
  ) => request<BackendPrinter[]>(config, 'POST', `${tenantRoute(config)}/agent-sync`, body),

  activePrinters: (config: AgentConfig) =>
    request<BackendPrinter[]>(config, 'GET', `${tenantRoute(config)}/active`),

  agentQueue: (config: AgentConfig, printerIds: number[], limit = 25) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (printerIds.length) {
      query.set('printerIds', printerIds.join(','));
    }
    return request<PrintJob[]>(config, 'GET', `${tenantRoute(config)}/print-jobs/agent-queue?${query}`);
  },

  setJobStatus: (config: AgentConfig, jobId: number, status: JobStatus, errorMessage?: string) =>
    request<PrintJob>(config, 'PATCH', `${tenantRoute(config)}/print-jobs/${jobId}/status`, {
      status,
      ...(errorMessage ? { errorMessage: errorMessage.slice(0, 500) } : {}),
    }),

  streamUrl: (config: AgentConfig) =>
    `${normalizeBaseUrl(config.baseUrl)}${tenantRoute(config)}/print-jobs/agent-stream`,
};
