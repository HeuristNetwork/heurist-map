/**
 * Host integration contract. Standalone mode uses the no-op implementation.
 */
export class HostAdapter {
  async initialize() {}

  supportsEditing() {
    return false;
  }

  async destroy() {}
}
