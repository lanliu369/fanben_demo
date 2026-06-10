(function () {
  function qs(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || '';
    } catch {
      return '';
    }
  }

  const docId = qs('docId');
  const apiBase = (qs('apiBase') || window.location.origin).replace(/\/$/, '');
  let timer = null;
  let busy = false;

  function tryInsert(item) {
    if (!window.Asc || !window.Asc.plugin || !item) {
      return;
    }
    const text = String(item.text || '').trim();
    const html = typeof item.html === 'string' ? item.html : '';
    if (!text) {
      return;
    }
    try {
      if (html) {
        try {
          window.Asc.plugin.executeMethod('PasteHtml', [html]);
          return;
        } catch {
          // ignore
        }
        try {
          window.Asc.plugin.executeMethod('pasteHtml', [html]);
          return;
        } catch {
          // ignore
        }
      }
      window.Asc.plugin.executeMethod('PasteText', [text]);
    } catch {
      // ignore
    }
  }

  async function pollQueue() {
    if (!docId || busy) {
      return;
    }
    busy = true;
    try {
      const resp = await fetch(
        `${apiBase}/api/documents/${encodeURIComponent(docId)}/insert-queue?take=1`,
        { cache: 'no-store' }
      );
      if (!resp.ok) {
        return;
      }
      const data = await resp.json();
      if (data && data.item) {
        tryInsert(data.item);
      }
    } catch {
      // ignore polling errors
    } finally {
      busy = false;
    }
  }

  window.Asc.plugin.init = function () {
    if (!docId) {
      return;
    }
    void pollQueue();
    timer = window.setInterval(pollQueue, 1200);
  };

  window.Asc.plugin.button = function () {
    // no visual buttons in background mode
  };

  window.addEventListener('beforeunload', function () {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  });
})();
