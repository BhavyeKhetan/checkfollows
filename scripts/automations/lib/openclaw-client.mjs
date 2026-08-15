const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /(api[_-]?key["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]+/gi,
  /(secret["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]+/gi,
  /(token["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]+/gi,
];

export function redact(value) {
  let output = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (match, prefix = "") => `${prefix}[REDACTED]`);
  }
  return output;
}

const OPENCLAW_RETRY_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);
const OPENCLAW_NON_RETRY_WARNING = "tool actions may have already been executed";
const MAX_BACKOFF_MS = 10000;

function normalizeString(value) {
  return typeof value === "string" ? value : String(value ?? "");
}

function hasNonRetryWarning(text = "") {
  return normalizeString(text).toLowerCase().includes(OPENCLAW_NON_RETRY_WARNING.toLowerCase());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRetryableResponse({ status, text, parsed }) {
  if (parsed?.ok === false) return false;
  if (hasNonRetryWarning(text)) return false;
  if (status >= 500 && status < 600) return true;
  if (OPENCLAW_RETRY_STATUSES.has(status)) return true;
  return false;
}

function createOpenClawError(message, options = {}) {
  const error = new Error(message);
  error.openclawRetryable = options.retriable ?? false;
  error.openclawStatus = options.status;
  error.openclawText = options.text;
  error.openclawParsed = options.parsed;
  return error;
}

async function performRequest({ task, input, output_schema, style, model, timeoutMs, baseUrl, apiKey }) {
  const response = await fetch(`${baseUrl}/v1/llm/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({ task, input, output_schema, style, ...(model ? { model } : {}) }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { response, text, data: null };
  }
  return { response, text, data };
}

export async function callOpenClawComplete({ task, input, output_schema, style, model }) {
  const baseUrl = String(process.env.OPENCLAW_API_URL || "").trim().replace(/\/$/, "");
  const apiKey = String(process.env.OPENCLAW_API_KEY || "").trim();
  const timeoutMs = Math.max(1000, toNumber(process.env.OPENCLAW_COMPLETION_TIMEOUT_MS, 30 * 60 * 1000));
  const maxRetries = Math.max(0, toNumber(process.env.OPENCLAW_COMPLETION_RETRIES, 2));
  const baseDelayMs = Math.max(250, toNumber(process.env.OPENCLAW_COMPLETION_RETRY_BASE_MS, 2000));
  if (!baseUrl) throw new Error("OPENCLAW_API_URL is required");
  if (!apiKey) throw new Error("OPENCLAW_API_KEY is required");

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const attemptNumber = attempt + 1;
    try {
      const { response, text, data } = await performRequest({
        task,
        input,
        output_schema,
        style,
        model,
        timeoutMs,
        baseUrl,
        apiKey,
      });
      const status = response.status;

      if (!data) {
        const retriable = isRetryableResponse({ status, text });
        if (retriable && attempt < maxRetries) {
          const delayMs = Math.min(MAX_BACKOFF_MS, baseDelayMs * 2 ** attempt);
          console.log(`OpenClaw completion returned invalid JSON on attempt ${attemptNumber}; retrying in ${delayMs}ms.`);
          await sleep(delayMs);
          continue;
        }
        throw createOpenClawError(`OpenClaw returned invalid JSON (${status}): ${redact(text)}`, { status, text, retriable });
      }

      if (!response.ok || data.ok === false) {
        const retriable = isRetryableResponse({ status, parsed: data, text });
        if (retriable && attempt < maxRetries) {
          const delayMs = Math.min(MAX_BACKOFF_MS, baseDelayMs * 2 ** attempt);
          console.log(`OpenClaw completion failed on attempt ${attemptNumber}; retrying in ${delayMs}ms.`);
          await sleep(delayMs);
          continue;
        }
        throw createOpenClawError(`OpenClaw completion failed (${status}): ${redact(data)}`, { status, text, parsed: data, retriable });
      }

      if (!data.output || typeof data.output !== "object") {
        throw createOpenClawError("OpenClaw completion response missing output object", { status, text, parsed: data, retriable: false });
      }

      const requiredFields = Array.isArray(output_schema?.required) ? output_schema.required : [];
      const missingFields = requiredFields.filter((field) => !(field in data.output));
      if (missingFields.length > 0) {
        const outputKeys = Object.keys(data.output);
        throw createOpenClawError(
          `OpenClaw completion response missing required output fields: ${missingFields.join(", ")}. ` +
            `Received fields: ${outputKeys.length ? outputKeys.join(", ") : "none"}. ` +
            `Output: ${redact(data.output)}`,
          { status, text, parsed: data, retriable: false },
        );
      }
      return data;
    } catch (error) {
      const hasWarning = hasNonRetryWarning(error?.openclawText || error?.message);
      const hasExplicitRetryFlag = typeof error?.openclawRetryable === "boolean";
      const retryable = hasExplicitRetryFlag ? error.openclawRetryable : true;
      const shouldRetry = attempt < maxRetries && retryable && !hasWarning;

      if (!shouldRetry) {
        if (hasWarning) {
          console.error("OpenClaw returned tool-action-warning response; refusing automatic retry.");
        }
        throw error;
      }

      const delayMs = Math.min(MAX_BACKOFF_MS, baseDelayMs * 2 ** attempt);
      console.log(`OpenClaw request error on attempt ${attemptNumber}; retrying in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }
}
