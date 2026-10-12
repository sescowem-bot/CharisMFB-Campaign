/**
 * Time-budgeted delivery loop. Pure and dependency-free so it can be unit tested.
 * It repeatedly runs one delivery step (one recipient) until the queue is idle,
 * a provider or quota limit is hit, or the time budget is nearly spent.
 */
export type StepResult = { result: string };
export type BatchOptions = {
  /** Total wall-clock budget for the invocation. */
  maxMs: number;
  /** Pause after each real provider submission; match the provider minimum interval. */
  spacingMs: number;
  /** Safety cap on recipients processed per invocation. */
  maxItems: number;
  /** Time reserved for the final step to finish before the platform timeout. */
  marginMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};
export type BatchSummary = {
  processed: number;
  submitted: number;
  counts: Record<string, number>;
  stopped: 'idle' | 'limit' | 'deadline' | 'max_items' | 'disabled' | 'paused' | 'error';
  elapsedMs: number;
};

/** Outcomes after which another attempt in this invocation would not help. */
const STOP_REASON: Record<string, BatchSummary['stopped']> = {
  idle: 'idle',
  disabled: 'disabled',
  paused: 'paused',
  provider_limit: 'limit',
  company_limit: 'limit',
  retry: 'limit',
  not_ready: 'paused',
  lease_lost: 'error',
  unavailable: 'error'
};
/** Outcomes that mean an email was actually submitted to the provider. */
const SUBMITTED = new Set(['accepted', 'failed', 'unknown']);

export async function runBatch(step: () => Promise<StepResult>, options: BatchOptions): Promise<BatchSummary> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const margin = options.marginMs ?? 8000;
  const started = now();
  const counts: Record<string, number> = {};
  let processed = 0;
  let submitted = 0;
  let stopped: BatchSummary['stopped'] = 'deadline';
  while (true) {
    if (processed >= options.maxItems) { stopped = 'max_items'; break; }
    if (now() - started + margin >= options.maxMs) { stopped = 'deadline'; break; }
    const { result } = await step();
    counts[result] = (counts[result] ?? 0) + 1;
    if (STOP_REASON[result]) { stopped = STOP_REASON[result]; break; }
    processed += 1;
    if (SUBMITTED.has(result)) {
      submitted += 1;
      if (now() - started + options.spacingMs + margin >= options.maxMs) { stopped = 'deadline'; break; }
      await sleep(options.spacingMs);
    }
  }
  return { processed, submitted, counts, stopped, elapsedMs: now() - started };
}

export function batchOptionsFromEnv(env: Record<string, string | undefined>): BatchOptions {
  const num = (value: string | undefined, fallback: number, min: number, max: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : fallback;
  };
  return {
    maxMs: num(env.EMAIL_WORKER_BUDGET_MS, 100000, 10000, 110000),
    spacingMs: num(env.EMAIL_WORKER_SPACING_MS, 2100, 100, 60000),
    maxItems: num(env.EMAIL_WORKER_MAX_ITEMS, 500, 1, 5000)
  };
}
