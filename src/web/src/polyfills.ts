/**
 * This file includes polyfills needed by Angular and is loaded before the app initialization
 * Ensures support for:
 * - Chrome >=70
 * - Firefox >=63
 * - Edge >=79
 * - Safari >=13
 * - iOS >=13
 * @version Angular 17.x
 * @requires zone.js 0.14.x
 */

/***************************************************************************************************
 * Zone JS is required by default for Angular itself
 * Must be loaded before any Angular code
 */
import 'zone.js'; // version: 0.14.x

/***************************************************************************************************
 * APPLICATION ENVIRONMENT
 * Add any custom global environment polyfills here
 */

/**
 * Ensure global is defined in the browser context
 * This provides Node.js compatibility in the browser environment
 */
(window as any).global = window;

/**
 * Performance monitoring setup for polyfills
 * Tracks load time and execution impact
 */
if (process.env['NODE_ENV'] !== 'production') {
    const polyfillsLoadStart = performance.now();
    
    window.addEventListener('load', () => {
        const polyfillsLoadTime = performance.now() - polyfillsLoadStart;
        console.debug(`Polyfills load time: ${polyfillsLoadTime}ms`);
    });
}

/***************************************************************************************************
 * BROWSER POLYFILLS
 * Automatically included by Angular CLI.
 */

/**
 * By default, zone.js will patch all possible macroTask and DomEvents
 * user can disable parts of macroTask/DomEvents patch by setting following flags
 */
// (window as any).__Zone_disable_requestAnimationFrame = true; // disable patch requestAnimationFrame
// (window as any).__Zone_disable_on_property = true; // disable patch onProperty such as onclick
// (window as any).__zone_symbol__BLACK_LISTED_EVENTS = ['scroll', 'mousemove']; // disable patch specified eventNames

/**
 * Flag to prevent Angular from patching specific browser features
 * Enable only if you encounter specific issues
 */
// (window as any).__Zone_enable_cross_context_check = true;

/***************************************************************************************************
 * Zone JS LOAD FLAGS
 * Customize zone.js load behavior if needed
 */
// window.__Zone_disable_timers = true; // disable patching of timer APIs
// window.__Zone_disable_XHR = true; // disable patching of XHR
// window.__Zone_disable_IE_check = true; // disable IE check if not needed

/**
 * Load zone.js patches for browser compatibility
 * These are automatically included based on browserslist configuration
 */