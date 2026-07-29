import { StandaloneHostAdapter } from './StandaloneHostAdapter.js';

export function createHostAdapter(host) {
  if (host) {
    return host;
  }

  return new StandaloneHostAdapter();
}
