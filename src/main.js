/**
 * @file main.js
 * @brief Entry point for the standalone Heurist Map application.
 *
 * @project     Standalone and embeddable mapping application for Heurist.
 * @link https://HeuristNetwork.org
 * @copyright (C) 2024 onwards Heurist Network
 * @license https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */
import 'leaflet/dist/leaflet.css';
import './style.css';

import { getHeuristMapConfig } from './mapConfig.js';
import { initHeuristMap } from './initHeuristMap.js';

const config = getHeuristMapConfig();

initHeuristMap(config).catch(async (error) => {
  console.error('Cannot initialize Heurist Map', error);

  // initHeuristMap exposes the facade before initialization so a partially
  // created engine can always be cleaned up after a startup failure.
  try {
    await window.heuristMap?.destroy();
  } catch (destroyError) {
    console.error('Cannot clean up Heurist Map after initialization failure', destroyError);
  }

  const container = document.getElementById(config.containerId);
  if (container) {
    container.textContent = 'Unable to initialize the map.';
    container.classList.add('heurist-map-error');
  }
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.heuristMap?.destroy();
    delete window.heuristMap;
  });
}
