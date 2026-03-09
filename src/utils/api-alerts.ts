/**
 * Auth error detection and Telegram alerting for Dexter MCP server.
 *
 * Detects 401/402/403 status codes in API error messages and sends
 * a Telegram notification so the user can top up credits.
 */

import { spawn } from 'bun';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const AUTH_ERROR_PATTERN = /\b(401|402|403)\b/;

const API_ACTION_LINKS: Record<string, string> = {
  'Financial Datasets': 'https://financialdatasets.ai',
  Perplexity: 'https://perplexity.ai',
  Exa: 'https://exa.ai',
  Tavily: 'https://tavily.com',
};

/**
 * Check if an error message indicates an auth/payment error (401/402/403).
 */
export function isAuthError(errorMessage: string): boolean {
  return AUTH_ERROR_PATTERN.test(errorMessage);
}

/**
 * Extract the API name from a bracketed prefix like "[Financial Datasets API]".
 */
export function extractApiName(errorMessage: string): string {
  const match = errorMessage.match(/\[([^\]]+)\]/);
  return match ? match[1] : 'Unknown API';
}

/**
 * Extract the auth-related HTTP status code from an error message.
 */
export function extractStatusCode(errorMessage: string): string {
  const match = errorMessage.match(/\b(401|402|403)\b/);
  return match ? match[1] : 'unknown';
}

/**
 * Build a Telegram alert message for an auth/payment API error.
 */
export function buildAlertMessage(apiName: string, statusCode: string, toolName: string): string {
  let actionLine = 'Action: Check API credentials';
  for (const [prefix, url] of Object.entries(API_ACTION_LINKS)) {
    if (apiName.includes(prefix)) {
      actionLine = `Action: Top up at ${url}`;
      break;
    }
  }

  return [
    '\u26a0\ufe0f Dexter API Credit Alert',
    '',
    `API: ${apiName}`,
    `Status: ${statusCode}`,
    `Tool: ${toolName}`,
    '',
    actionLine,
  ].join('\n');
}

/**
 * Send a Telegram alert for an auth/payment API error.
 * Uses the existing Python send_telegram.py script.
 * Fire-and-forget — never throws.
 */
export async function sendAuthErrorAlert(
  apiName: string,
  statusCode: string,
  toolName: string,
): Promise<void> {
  const message = buildAlertMessage(apiName, statusCode, toolName);

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const scriptPath = join(__dirname, '../../../scripts/send_telegram.py');
    const proc = spawn(['python3', scriptPath, '--message', message]);
    await proc.exited;
  } catch {
    // Best-effort — don't crash the MCP server over a notification failure
    console.error('[api-alerts] Failed to send Telegram alert');
  }
}
