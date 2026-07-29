/**
 * Error returned by the Heurist public API client.
 */
export class HeuristApiError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'HeuristApiError';
    this.status = options.status ?? null;
    this.statusText = options.statusText ?? null;
    this.url = options.url ?? null;
    this.method = options.method ?? null;
    this.code = options.code ?? null;
    this.details = options.details ?? null;
  }
}
