// Gemeinsam genutzte Logik zur Erzeugung von Masken (Name, Icon, Farbe).
// Wird sowohl vom Background-Service-Worker als auch vom Content-Script
// und vom Popup/Options geladen (kein ES-Modul, um in allen Kontexten
// (Service Worker via importScripts, Content-Script, Popup) gleich zu
// funktionieren).
(function (global) {
  var COLORS = [
    "#4f46e5", "#0ea5e9", "#059669", "#d97706", "#dc2626",
    "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#ea580c",
    "#0284c7", "#16a34a", "#c026d3", "#475569", "#b45309"
  ];

  // Vorlagen: Tarnnamen, die wie bekannte Webseiten/Dienste aussehen.
  // "url": echte Seite – deren Favicon wird aus dem Favicon-Cache des Browsers
  //        übernommen, sofern die Seite dort schon einmal besucht wurde.
  // "color"/"fg": Markenfarben für Hintergrund/Logo-Form, falls kein
  //        gecachtes Favicon vorhanden ist (siehe LOGO_SHAPES).
  var PRESETS = [
    { name: "Google", emoji: "🔍", color: "#4285f4", url: "https://www.google.com/" },
    { name: "google.de", emoji: "🔍", color: "#4285f4", url: "https://www.google.de/" },
    { name: "Google Mail", emoji: "✉️", color: "#ea4335", url: "https://mail.google.com/" },
    { name: "Google Docs", emoji: "📄", color: "#4285f4", url: "https://docs.google.com/" },
    { name: "Wikipedia", emoji: "📖", color: "#ffffff", fg: "#000000", url: "https://de.wikipedia.org/" },
    { name: "YouTube", emoji: "▶️", color: "#ff0000", url: "https://www.youtube.com/" },
    { name: "heise.de", emoji: "📰", color: "#ffffff", url: "https://www.heise.de/" },
    { name: "Heise Online", emoji: "📰", color: "#ffffff", url: "https://www.heise.de/" },
    { name: "Tagesschau", emoji: "📺", color: "#0a3a6b", url: "https://www.tagesschau.de/" },
    { name: "Spiegel Online", emoji: "🗞️", color: "#e64415", url: "https://www.spiegel.de/" },
    { name: "GitHub", emoji: "🐙", color: "#24292e", url: "https://github.com/" },
    { name: "GitLab", emoji: "🦊", color: "#fc6d26", url: "https://gitlab.com/" },
    { name: "Stack Overflow", emoji: "📚", color: "#ffffff", fg: "#f48024", url: "https://stackoverflow.com/" },
    { name: "Amazon", emoji: "📦", color: "#232f3e", fg: "#ff9900", url: "https://www.amazon.de/" },
    { name: "Outlook", emoji: "📧", color: "#0072c6", url: "https://outlook.live.com/" },
    { name: "OneDrive", emoji: "☁️", color: "#0078d4", url: "https://onedrive.live.com/" },
    { name: "LinkedIn", emoji: "💼", color: "#0a66c2", url: "https://www.linkedin.com/" },
    { name: "Steam", emoji: "🎮", color: "#171a21", url: "https://store.steampowered.com/" },
    { name: "Claude", emoji: "✳️", color: "#f0eee6", fg: "#d97757", url: "https://claude.ai/" },
    { name: "IKEA", emoji: "🛋️", color: "#0058a3", fg: "#ffda1a", url: "https://www.ikea.com/de/de/" },
    { name: "Online-Banking", emoji: "🏦", color: "#1e3a8a" },
    { name: "Wetter", emoji: "⛅", color: "#38bdf8" }
  ];

  // Stark vereinfachte, selbst gezeichnete Icon-Formen (keine Kopien der
  // echten Logos), die an die jeweilige Seite erinnern. Sie werden in den
  // Markenfarben der Vorlage gezeichnet und dienen als Ersatz, wenn der
  // Browser kein echtes Favicon der Seite im Cache hat.
  var LOGO_SHAPES = {
    "YouTube": { kind: "triangle" },
    "LinkedIn": { kind: "text", text: "in" },
    "GitHub": { kind: "github" },
    "GitLab": { kind: "fox" },
    "Stack Overflow": { kind: "stackedBars" },
    "Wikipedia": { kind: "globe" },
    "Amazon": { kind: "smile" },
    "Google Mail": { kind: "envelope" },
    "Outlook": { kind: "envelope" },
    "Google Docs": { kind: "document" },
    "OneDrive": { kind: "cloud" },
    "Steam": { kind: "steam" },
    "Claude": { kind: "burst" },
    "IKEA": { kind: "ikea", textColor: "#0058a3" },
    "Online-Banking": { kind: "bank" }
  };

  function hashString(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function pick(list, seed, salt) {
    var idx = Math.abs((seed ^ salt) % list.length);
    return list[idx];
  }

  function findPreset(name) {
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].name === name) return PRESETS[i];
    }
    return null;
  }

  // --- Farb-Hilfsfunktionen ---

  function hexToRgb(hex) {
    hex = String(hex || "#888888").replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    var num = parseInt(hex, 16) || 0;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function luminance(hex) {
    var rgb = hexToRgb(hex);
    return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  }

  function contrastFg(bgHex) {
    return luminance(bgHex) > 0.55 ? "#111111" : "#ffffff";
  }

  // --- Zeichnen der vereinfachten Logo-Formen auf einen Canvas-Kontext ---

  function drawLogoShape(ctx, size, shape, fg) {
    ctx.save();
    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;
    ctx.lineWidth = Math.max(1.5, size * 0.045);
    var c = size / 2;

    switch (shape.kind) {
      case "text": {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold " + Math.floor(size * 0.5) + 'px Arial, sans-serif';
        ctx.fillText(shape.text, c, c + size * 0.02);
        break;
      }
      case "triangle": {
        var s = size * 0.26;
        ctx.beginPath();
        ctx.moveTo(c - s * 0.55, c - s);
        ctx.lineTo(c - s * 0.55, c + s);
        ctx.lineTo(c + s * 0.95, c);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "github": {
        var r = size * 0.16;
        ctx.beginPath();
        ctx.arc(c, c - size * 0.02, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(c - r * 0.9, c - r * 0.9);
        ctx.lineTo(c - r * 1.8, c - r * 2.0);
        ctx.lineTo(c - r * 0.2, c - r * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(c + r * 0.9, c - r * 0.9);
        ctx.lineTo(c + r * 1.8, c - r * 2.0);
        ctx.lineTo(c + r * 0.2, c - r * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(c - r * 1.35, c + r * 0.85, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(c + r * 1.35, c + r * 0.85, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "fox": {
        var s2 = size * 0.28;
        ctx.beginPath();
        ctx.moveTo(c, c - s2);
        ctx.lineTo(c - s2, c + s2 * 0.7);
        ctx.lineTo(c + s2, c + s2 * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(c - s2 * 1.15, c - s2 * 0.1);
        ctx.lineTo(c - s2 * 1.7, c + s2 * 0.55);
        ctx.lineTo(c - s2 * 0.55, c + s2 * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(c + s2 * 1.15, c - s2 * 0.1);
        ctx.lineTo(c + s2 * 1.7, c + s2 * 0.55);
        ctx.lineTo(c + s2 * 0.55, c + s2 * 0.55);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "stackedBars": {
        var barH = size * 0.11;
        var gap = size * 0.06;
        var widths = [size * 0.4, size * 0.55, size * 0.7];
        var y = c - (barH * 3 + gap * 2) / 2;
        for (var i = 0; i < widths.length; i++) {
          var w = widths[i];
          ctx.fillRect(c - w / 2, y, w, barH);
          y += barH + gap;
        }
        break;
      }
      case "globe": {
        ctx.beginPath();
        ctx.arc(c, c, size * 0.32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(c, c, size * 0.15, size * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c - size * 0.32, c);
        ctx.lineTo(c + size * 0.32, c);
        ctx.stroke();
        break;
      }
      case "smile": {
        ctx.beginPath();
        ctx.arc(c, c - size * 0.06, size * 0.26, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c + size * 0.22, c + size * 0.12);
        ctx.lineTo(c + size * 0.33, c + size * 0.09);
        ctx.lineTo(c + size * 0.27, c + size * 0.21);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "envelope": {
        var w = size * 0.6, h = size * 0.42;
        var x = c - w / 2, y2 = c - h / 2;
        ctx.strokeRect(x, y2, w, h);
        ctx.beginPath();
        ctx.moveTo(x, y2);
        ctx.lineTo(c, y2 + h * 0.6);
        ctx.lineTo(x + w, y2);
        ctx.stroke();
        break;
      }
      case "document": {
        var dw = size * 0.44, dh = size * 0.58;
        var dx = c - dw / 2, dy = c - dh / 2;
        var fold = dw * 0.32;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx + dw - fold, dy);
        ctx.lineTo(dx + dw, dy + fold);
        ctx.lineTo(dx + dw, dy + dh);
        ctx.lineTo(dx, dy + dh);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx + dw * 0.18, dy + dh * 0.42);
        ctx.lineTo(dx + dw * 0.82, dy + dh * 0.42);
        ctx.moveTo(dx + dw * 0.18, dy + dh * 0.62);
        ctx.lineTo(dx + dw * 0.82, dy + dh * 0.62);
        ctx.moveTo(dx + dw * 0.18, dy + dh * 0.82);
        ctx.lineTo(dx + dw * 0.6, dy + dh * 0.82);
        ctx.stroke();
        break;
      }
      case "cloud": {
        var by = c + size * 0.1;
        ctx.beginPath();
        ctx.arc(c - size * 0.14, by, size * 0.15, 0, Math.PI * 2);
        ctx.arc(c + size * 0.06, by - size * 0.06, size * 0.19, 0, Math.PI * 2);
        ctx.arc(c + size * 0.26, by, size * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(c - size * 0.28, by, size * 0.62, size * 0.12);
        break;
      }
      case "steam": {
        var hx = c + size * 0.1, hy = c - size * 0.08;
        ctx.lineCap = "round";
        ctx.lineWidth = size * 0.07;
        ctx.beginPath();
        ctx.arc(hx, hy, size * 0.19, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hx, hy, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = size * 0.09;
        ctx.beginPath();
        ctx.moveTo(hx - size * 0.12, hy + size * 0.12);
        ctx.lineTo(c - size * 0.24, c + size * 0.22);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c - size * 0.22, c + size * 0.2, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "burst": {
        ctx.lineCap = "round";
        ctx.lineWidth = size * 0.075;
        var rays = 12;
        for (var k = 0; k < rays; k++) {
          var ang = (Math.PI * 2 * k) / rays + 0.2;
          var len = size * (k % 2 === 0 ? 0.34 : 0.26);
          ctx.beginPath();
          ctx.moveTo(c + Math.cos(ang) * size * 0.05, c + Math.sin(ang) * size * 0.05);
          ctx.lineTo(c + Math.cos(ang) * len, c + Math.sin(ang) * len);
          ctx.stroke();
        }
        break;
      }
      case "ikea": {
        ctx.beginPath();
        ctx.ellipse(c, c, size * 0.42, size * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shape.textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold " + Math.floor(size * 0.24) + "px Verdana, Arial, sans-serif";
        ctx.fillText("IKEA", c, c + size * 0.01);
        break;
      }
      case "bank": {
        var bw = size * 0.6;
        var bx = c - bw / 2;
        var topY = c - size * 0.22;
        ctx.beginPath();
        ctx.moveTo(c, topY - size * 0.14);
        ctx.lineTo(bx, topY);
        ctx.lineTo(bx + bw, topY);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(bx, topY + size * 0.02, bw, size * 0.06);
        var cols = 4;
        var colW = size * 0.05;
        for (var j = 0; j < cols; j++) {
          var cx = bx + (bw * (j + 0.5)) / cols - colW / 2;
          ctx.fillRect(cx, topY + size * 0.1, colW, size * 0.26);
        }
        ctx.fillRect(bx - size * 0.02, topY + size * 0.38, bw + size * 0.04, size * 0.05);
        break;
      }
    }
    ctx.restore();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Zeichnet das komplette Icon (abgerundeter Hintergrund + Logo-Form oder
  // Emoji-Fallback) auf einen bestehenden Canvas-Kontext. Wird von
  // content.js (Favicon), popup.js und options.js (Vorschau) gemeinsam
  // genutzt, damit alle drei exakt gleich aussehen.
  function renderIcon(ctx, mask, size) {
    roundRectPath(ctx, 0, 0, size, size, size * 0.22);
    ctx.fillStyle = mask.color;
    ctx.fill();
    if (mask.logoShape) {
      drawLogoShape(ctx, size, mask.logoShape, mask.fgColor || contrastFg(mask.color));
    } else {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font =
        Math.floor(size * 0.62) +
        'px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
      ctx.fillText(mask.emoji || "🎭", size / 2, size * 0.56);
    }
  }

  // override: { seed?, name?, emoji?, color?, disabled? }
  function computeMask(hostname, override) {
    override = override || {};
    var baseSeed = hashString(hostname || "");
    var seed = typeof override.seed === "number" ? (override.seed >>> 0) : baseSeed;

    // Ohne eigenen Namen wird deterministisch (je Hostname) eine echte,
    // bekannte Webseite als Tarnname gewählt statt eines Fantasienamens.
    var autoPreset = pick(PRESETS, seed, 0x9e3779b1);

    var name = override.name && override.name.trim() ? override.name.trim() : autoPreset.name;
    var matched = findPreset(name);
    var shape = LOGO_SHAPES[name] || null;

    var emoji = override.emoji && override.emoji.trim()
      ? override.emoji.trim()
      : (matched ? matched.emoji : autoPreset.emoji);

    // Markenfarben der Vorlage; eigene Namen ohne Vorlage bekommen eine
    // (je Hostname feste) Farbe aus COLORS.
    var preset = matched;
    var color = override.color || (preset ? preset.color : pick(COLORS, seed, 0x27d4eb2f));
    var fgColor = shape ? ((preset && preset.fg) || contrastFg(color)) : null;

    // Echtes Favicon nur, wenn die Maske einer Vorlage entspricht und kein
    // eigenes Emoji gesetzt wurde.
    var customEmoji = !!(override.emoji && override.emoji.trim());
    var faviconUrl = preset && preset.url && !customEmoji ? preset.url : null;

    return {
      name: name,
      emoji: emoji,
      color: color,
      logoShape: shape,
      fgColor: fgColor,
      faviconUrl: faviconUrl
    };
  }

  // Match-Pattern für genau einen Hostnamen (z. B. "*://example.com/*").
  // Wird für die Berechtigungsanfrage und die Content-Script-Registrierung
  // genutzt, damit die Erweiterung nur auf gelisteten Domains läuft.
  // Gibt null zurück, wenn der Hostname kein gültiges Muster ergibt.
  function hostPattern(hostname) {
    if (!hostname || !/^[a-z0-9.-]+$/i.test(hostname)) return null;
    return "*://" + hostname.toLowerCase() + "/*";
  }

  global.TabMaskerCore = {
    computeMask: computeMask,
    hostPattern: hostPattern,
    renderIcon: renderIcon,
    drawLogoShape: drawLogoShape,
    hashString: hashString,
    COLORS: COLORS,
    PRESETS: PRESETS,
    LOGO_SHAPES: LOGO_SHAPES
  };
})(typeof self !== "undefined" ? self : this);
