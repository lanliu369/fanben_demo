(function () {
  function getParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || '';
    } catch {
      return '';
    }
  }

  var ds = (getParam('ds') || '').replace(/\/$/, '');
  var candidates = [];
  if (ds) {
    candidates.push(ds + '/web-apps/apps/api/documents/plugins.js');
    candidates.push(ds + '/sdkjs-plugins/v1/plugins.js');
  }
  candidates.push('https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js');

  var idx = 0;
  function loadPluginJs() {
    var p = document.createElement('script');
    p.src = './plugin.js';
    p.onload = function () {
      try {
        console.info('[WPS plugin bridge] plugin.js loaded');
      } catch {}
    };
    p.onerror = function () {
      try {
        console.error('[WPS plugin bridge] plugin.js load failed');
      } catch {}
    };
    document.body.appendChild(p);
  }

  function loadNextRuntime() {
    if (idx >= candidates.length) {
      try {
        console.error('[WPS plugin bridge] plugins.js all candidates failed');
      } catch {}
      return;
    }
    var src = candidates[idx++];
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () {
      try {
        console.info('[WPS plugin bridge] runtime loaded from', src);
      } catch {}
      loadPluginJs();
    };
    s.onerror = function () {
      loadNextRuntime();
    };
    document.body.appendChild(s);
  }

  loadNextRuntime();
})();
