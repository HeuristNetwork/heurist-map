/**
 * HostAdapter.js - Host integration contract
 *
 * @fileOverview Defines optional services supplied by a host application, including lifecycle handling and future editing capabilities.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

/**
 * Host integration contract. Standalone mode uses the no-op implementation.
 */
export class HostAdapter {
  /**
   * Initialize the component and its required resources.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async initialize() {}

  /**
   * Return whether the host provides editing facilities.
   * @returns {boolean} Operation result.
   */
  supportsEditing() {
    return false;
  }

  /** Return optional host capabilities. */
  getCapabilities() {
    return { mapPreferences: false, mapPublishing: false };
  }

  async loadMapPreferences() { return null; }

  async saveMapPreferences() {
    throw new Error('Map preferences are not supported by this host');
  }

  async publishMap() {
    throw new Error('Map publishing is not supported by this host');
  }

  async loadPublishedMap() {
    throw new Error('Published maps are not supported by this host');
  }

  async deletePublishedMap() {
    throw new Error('Published maps are not supported by this host');
  }

  /**
   * Release resources, handlers, requests, layers, and host integrations.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async destroy() {}
}
