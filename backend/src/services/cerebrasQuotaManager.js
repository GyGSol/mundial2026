import { env } from '../config/env.js';

export const CEREBRAS_PRIORITIES = {
  liveAdjustment: 1,
  preMatchOracle: 2,
  postMatchReview: 3,
  shadowReplay: 4,
  backfill: 5,
  humanConsultation: 6,
};

const state = {
  windowStartMs: Date.now(),
  tokensUsed: 0,
  requestsUsed: 0,
  remainingTokensHeader: null,
  resetTokensSec: null,
  waitChain: Promise.resolve(),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetWindowIfNeeded(now = Date.now()) {
  if (now - state.windowStartMs >= 60_000) {
    state.windowStartMs = now;
    state.tokensUsed = 0;
    state.requestsUsed = 0;
  }
}

function parseResetSeconds(headerValue) {
  const n = Number(headerValue);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Actualiza contadores desde headers de respuesta Cerebras. */
export function noteCerebrasResponse(response) {
  if (!response?.headers) return;
  const remaining = response.headers.get('x-ratelimit-remaining-tokens-minute');
  const resetSec = response.headers.get('x-ratelimit-reset-tokens-minute');
  if (remaining != null) state.remainingTokensHeader = Number(remaining);
  const parsedReset = parseResetSeconds(resetSec);
  if (parsedReset != null) state.resetTokensSec = parsedReset;
}

export function getCerebrasQuotaSnapshot() {
  resetWindowIfNeeded();
  return {
    tokensUsed: state.tokensUsed,
    requestsUsed: state.requestsUsed,
    remainingTokensHeader: state.remainingTokensHeader,
    resetTokensSec: state.resetTokensSec,
    maxTpm: env.cerebrasMaxTpm,
    maxRpm: env.cerebrasMaxRpm,
    minGapMs: env.cerebrasMinGapMs,
  };
}

export function resetCerebrasQuotaStateForTests() {
  state.windowStartMs = Date.now();
  state.tokensUsed = 0;
  state.requestsUsed = 0;
  state.remainingTokensHeader = null;
  state.resetTokensSec = null;
  state.waitChain = Promise.resolve();
}

async function waitForQuota({ estimatedTokens, priority }) {
  resetWindowIfNeeded();
  const maxTpm = env.cerebrasMaxTpm;
  const maxRpm = env.cerebrasMaxRpm;

  while (
    state.requestsUsed >= maxRpm ||
    state.tokensUsed + estimatedTokens > maxTpm
  ) {
    const waitMs =
      state.resetTokensSec != null
        ? Math.min(120_000, state.resetTokensSec * 1000 + 500)
        : Math.max(1000, 60_000 - (Date.now() - state.windowStartMs) + 250);
    console.warn(
      `[cerebras-quota] esperando ${waitMs}ms (priority=${priority}, tokens=${state.tokensUsed}/${maxTpm}, req=${state.requestsUsed}/${maxRpm})`
    );
    await sleep(waitMs);
    resetWindowIfNeeded();
    state.resetTokensSec = null;
  }

  if (env.cerebrasMinGapMs > 0) {
    await sleep(env.cerebrasMinGapMs);
  }
}

/**
 * Serializa llamadas Cerebras y respeta TPM/RPM configurables.
 */
export async function acquireCerebrasSlot({
  estimatedTokens = 4000,
  priority = CEREBRAS_PRIORITIES.backfill,
  label = 'cerebras',
} = {}) {
  if (!env.cerebrasApiKey) return;

  const run = async () => {
    await waitForQuota({ estimatedTokens, priority });
    resetWindowIfNeeded();
    state.requestsUsed += 1;
    state.tokensUsed += estimatedTokens;
  };

  state.waitChain = state.waitChain.then(run, run);
  await state.waitChain;
}

export async function waitAfterCerebras429(response) {
  noteCerebrasResponse(response);
  const resetSec = state.resetTokensSec;
  const waitMs = resetSec != null ? resetSec * 1000 + 1000 : 60_000;
  console.warn(`[cerebras-quota] 429 — pausa ${waitMs}ms`);
  await sleep(waitMs);
  resetWindowIfNeeded();
  state.tokensUsed = 0;
  state.requestsUsed = 0;
  state.windowStartMs = Date.now();
}

export function estimateCerebrasRequestTokens(promptOrMessages, { outputBudget = 800 } = {}) {
  let inputChars = 0;
  if (typeof promptOrMessages === 'string') {
    inputChars = promptOrMessages.length;
  } else if (Array.isArray(promptOrMessages)) {
    inputChars = promptOrMessages.reduce(
      (sum, m) => sum + String(m?.content ?? '').length,
      0
    );
  }
  return Math.ceil(inputChars / 4) + outputBudget;
}
