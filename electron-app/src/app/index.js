/**
 * @module app
 * @description Application lifecycle and initialization exports.
 */

export { cleanupLeftoverBackendProcesses } from "./cleanup.js";
export { initializeApp } from "./initialization.js";
export { setupLifecycleHandlers, setTransitionMode } from "./lifecycle.js";
export { handleSelectorFallback, showModeSelector } from "./modeSelector.js";
export { setupUpdater } from "./updater.js";

