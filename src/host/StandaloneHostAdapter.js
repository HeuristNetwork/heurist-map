/**
 * StandaloneHostAdapter.js - Standalone host adapter
 *
 * @fileOverview Provides the no-op host integration used when the mapping application runs independently of the main Heurist interface.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { HostAdapter } from './HostAdapter.js';

/**
 * No-op host integration used by the standalone mapping application.
 */
export class StandaloneHostAdapter extends HostAdapter {}
