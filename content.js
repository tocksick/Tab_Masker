(function () {
  var hostname = location.hostname;
  if (!hostname) return;

  var observer = null;
  var currentMaskName = null;
  var currentFaviconHref = null;

  function ensureHead(cb) {
    if (document.head) {
      cb();
      return;
    }
    var obs = new MutationObserver(function () {
      if (document.head) {
        obs.disconnect();
        cb();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  function buildFaviconDataUrl(mask, size) {
    size = size || 64;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    TabMaskerCore.renderIcon(ctx, mask, size);
    return canvas.toDataURL("image/png");
  }

  // Setzt unser Favicon robust: bestehende Icon-Links werden entweder direkt
  // umgeschrieben (falls die Seite später nur die href ändert, überschreiben
  // wir sie einfach erneut) oder neu angelegt.
  function setFavicon(href) {
    var existing = document.querySelectorAll('link[rel~="icon"]');
    existing.forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    var link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.href = href;
    document.head.appendChild(link);
  }

  function reassert() {
    if (currentMaskName === null) return;
    if (document.title !== currentMaskName) {
      document.title = currentMaskName;
    }
    var icons = document.querySelectorAll('link[rel~="icon"]');
    var hasOurs =
      icons.length > 0 &&
      Array.prototype.every.call(icons, function (el) {
        return el.getAttribute("href") === currentFaviconHref;
      });
    if (!hasOurs) {
      setFavicon(currentFaviconHref);
    }
  }

  function watchForReverts() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(reassert);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href", "rel"]
    });
  }

  function applyMask(mask) {
    ensureHead(function () {
      currentMaskName = mask.name;
      currentFaviconHref = buildFaviconDataUrl(mask, 64);
      reassert();
      watchForReverts();

      // Manche Seiten (v. a. Single-Page-Apps) setzen Titel/Favicon erst
      // nach dem eigentlichen Laden neu (z. B. für Benachrichtigungs-Badges).
      // Deshalb die Maske zusätzlich mehrfach erneut durchsetzen.
      [0, 250, 800, 2000, 5000].forEach(function (delay) {
        setTimeout(reassert, delay);
      });
      window.addEventListener("load", reassert, { once: true });
      document.addEventListener("visibilitychange", reassert);
    });
  }

  try {
    chrome.runtime.sendMessage({ type: "GET_MASK_FOR_HOST", hostname: hostname }, function (response) {
      if (chrome.runtime.lastError || !response || !response.active) return;
      applyMask(response);
    });
  } catch (e) {
    // Erweiterungskontext evtl. nicht verfügbar (z. B. während eines Reloads) – ignorieren.
  }
})();
