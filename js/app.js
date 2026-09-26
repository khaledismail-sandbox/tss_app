/* app.js — The Secret Society demo · boot.
   Order (ARCHITECTURE §1/§6): TSS.analytics.resolveAttribution() → TSS.analytics.init() → TSS.router.start().
   Each step is isolated so a failing SDK never blanks the app: the router always starts. */
window.TSS = window.TSS || {};
(function () {
  'use strict';
  function boot() {
    var TSS = window.TSS;
    try { TSS.analytics.resolveAttribution(); }
    catch (e) { if (window.console) console.error('[TSS] resolveAttribution failed', e); }
    try { TSS.analytics.init(); }
    catch (e) { if (window.console) console.error('[TSS] analytics.init failed', e); }
    try { TSS.router.start(); }
    catch (e) { if (window.console) console.error('[TSS] router.start failed', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
