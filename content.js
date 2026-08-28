(function () {
  var hostname = location.hostname;
  if (!hostname) return;

  var observer = null;

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

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function buildFaviconDataUrl(emoji, color, size) {
    size = size || 64;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    roundRect(ctx, 0, 0, size, size, size * 0.22);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = Math.floor(size * 0.62) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, size / 2, size * 0.56);
    return canvas.toDataURL("image/png");
  }

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

  function watchForReverts(maskName, faviconHref) {
    if (observer) observer.disconnect();
    observer = new MutationObserver(function () {
      if (document.title !== maskName) {
        document.title = maskName;
      }
      var icons = document.querySelectorAll('link[rel~="icon"]');
      var hasOurs = Array.prototype.some.call(icons, function (el) {
        return el.href === faviconHref;
      });
      if (!hasOurs) {
        setFavicon(faviconHref);
      }
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  }

  function applyMask(mask) {
    ensureHead(function () {
      document.title = mask.name;
      var dataUrl = buildFaviconDataUrl(mask.emoji, mask.color);
      setFavicon(dataUrl);
      watchForReverts(mask.name, dataUrl);
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
