import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { isAuthError, extractApiName, extractStatusCode, buildAlertMessage } from './api-alerts.js';

describe('isAuthError', () => {
  test('returns true for 401 in error message', () => {
    expect(isAuthError('[Perplexity API] 401: Unauthorized')).toBe(true);
  });

  test('returns true for 402 in error message', () => {
    expect(isAuthError('[Financial Datasets API] request failed: 402 Payment Required')).toBe(true);
  });

  test('returns true for 403 in error message', () => {
    expect(isAuthError('[Exa API] 403 Forbidden')).toBe(true);
  });

  test('returns false for 404', () => {
    expect(isAuthError('[Financial Datasets API] request failed: 404 Not Found')).toBe(false);
  });

  test('returns false for 500', () => {
    expect(isAuthError('Internal Server Error 500')).toBe(false);
  });

  test('returns false for message without status code', () => {
    expect(isAuthError('Network timeout')).toBe(false);
  });
});

describe('extractApiName', () => {
  test('extracts from bracket prefix', () => {
    expect(extractApiName('[Financial Datasets API] request failed: 402')).toBe('Financial Datasets API');
  });

  test('extracts Perplexity API', () => {
    expect(extractApiName('[Perplexity API] 401: Unauthorized')).toBe('Perplexity API');
  });

  test('extracts Exa API', () => {
    expect(extractApiName('[Exa API] 403 Forbidden')).toBe('Exa API');
  });

  test('returns Unknown API when no brackets', () => {
    expect(extractApiName('Something went wrong')).toBe('Unknown API');
  });
});

describe('extractStatusCode', () => {
  test('extracts 401', () => {
    expect(extractStatusCode('[Perplexity API] 401: Unauthorized')).toBe('401');
  });

  test('extracts 402', () => {
    expect(extractStatusCode('[Financial Datasets API] request failed: 402 Payment Required')).toBe('402');
  });

  test('extracts 403', () => {
    expect(extractStatusCode('[Exa API] 403 Forbidden')).toBe('403');
  });

  test('returns unknown when no auth code', () => {
    expect(extractStatusCode('Network error')).toBe('unknown');
  });
});

describe('buildAlertMessage', () => {
  test('includes API name, status, and tool name', () => {
    const msg = buildAlertMessage('Financial Datasets API', '402', 'get_insider_trades');
    expect(msg).toContain('Financial Datasets API');
    expect(msg).toContain('402');
    expect(msg).toContain('get_insider_trades');
  });

  test('includes action link for Financial Datasets', () => {
    const msg = buildAlertMessage('Financial Datasets API', '402', 'get_prices');
    expect(msg).toContain('https://financialdatasets.ai');
  });

  test('includes action link for Perplexity', () => {
    const msg = buildAlertMessage('Perplexity API', '401', 'web_search');
    expect(msg).toContain('https://perplexity.ai');
  });

  test('includes action link for Exa', () => {
    const msg = buildAlertMessage('Exa API', '403', 'web_search');
    expect(msg).toContain('https://exa.ai');
  });

  test('includes action link for Tavily', () => {
    const msg = buildAlertMessage('Tavily API', '401', 'web_search');
    expect(msg).toContain('https://tavily.com');
  });

  test('includes generic action for unknown API', () => {
    const msg = buildAlertMessage('Unknown API', '402', 'some_tool');
    expect(msg).toContain('Check API credentials');
  });

  test('starts with warning emoji header', () => {
    const msg = buildAlertMessage('Financial Datasets API', '402', 'get_prices');
    expect(msg.startsWith('\u26a0\ufe0f Dexter API Credit Alert')).toBe(true);
  });
});
