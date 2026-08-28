// Gemeinsam genutzte Logik zur Erzeugung von Masken (Name, Icon, Farbe).
// Wird sowohl vom Background-Service-Worker als auch vom Content-Script
// und vom Popup/Options geladen (kein ES-Modul, um in allen Kontexten
// (Service Worker via importScripts, Content-Script, Popup) gleich zu
// funktionieren).
(function (global) {
  var ADJECTIVES = [
    "Stiller", "Wilder", "Mutiger", "Schneller", "Ruhiger", "Heimlicher",
    "Neugieriger", "Tapferer", "Kluger", "Verträumter", "Frecher", "Geheimer",
    "Flinker", "Gelassener", "Listiger", "Sanfter", "Wacher", "Verborgener",
    "Freier", "Stolzer", "Leiser", "Nebliger", "Funkelnder", "Eisiger",
    "Sonniger", "Windiger", "Bunter", "Dunkler", "Heller", "Weiser",
    "Alter", "Junger", "Ferner", "Naher", "Rascher", "Zäher", "Milder",
    "Wehrhafter", "Treuer", "Wandernder"
  ];

  var NOUNS = [
    "Fuchs", "Falke", "Otter", "Wolf", "Bär", "Luchs", "Adler", "Delfin",
    "Panda", "Tiger", "Rabe", "Eule", "Hase", "Igel", "Biber", "Reiher",
    "Marder", "Dachs", "Puma", "Kolibri", "Waschbär", "Pinguin", "Koala",
    "Hirsch", "Schwan", "Frosch", "Salamander", "Yeti", "Drache", "Phönix",
    "Löwe", "Elch", "Kranich", "Wal", "Falter", "Kater", "Greif", "Widder",
    "Kobold", "Wanderer"
  ];

  var EMOJIS = [
    "🦊", "🦅", "🦦", "🐺", "🐻", "🐱", "🦉", "🐇", "🦔", "🦫",
    "🐦", "🦡", "🐆", "🦆", "🦝", "🐧", "🐼", "🦌", "🦢", "🐸",
    "🦎", "🐉", "🔥", "🍀", "🌙", "⭐", "🎯", "🎲", "🧩", "🚀",
    "🦁", "🐋", "🦋", "🐈", "🦅", "🐏", "🧙", "🥾", "🌊", "🍁"
  ];

  var COLORS = [
    "#4f46e5", "#0ea5e9", "#059669", "#d97706", "#dc2626",
    "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#ea580c",
    "#0284c7", "#16a34a", "#c026d3", "#475569", "#b45309"
  ];

  // Vorlagen: Tarnnamen, die wie bekannte Webseiten/Dienste aussehen
  // (rein textuell, keine echten Logos/Favicons – dient nur der schnellen
  // Auswahl eines unauffälligen Namens im Popup/den Einstellungen).
  var PRESETS = [
    { name: "Google", emoji: "🔍", color: "#ffffff" },
    { name: "google.de", emoji: "🔍", color: "#ffffff" },
    { name: "Google Mail", emoji: "✉️", color: "#ea4335" },
    { name: "Google Docs", emoji: "📄", color: "#4285f4" },
    { name: "Wikipedia", emoji: "📖", color: "#f8f9fa" },
    { name: "YouTube", emoji: "▶️", color: "#ff0000" },
    { name: "heise.de", emoji: "📰", color: "#ffffff" },
    { name: "Heise Online", emoji: "📰", color: "#ffffff" },
    { name: "Tagesschau", emoji: "📺", color: "#0a3a6b" },
    { name: "Spiegel Online", emoji: "🗞️", color: "#e64415" },
    { name: "GitHub", emoji: "🐙", color: "#24292e" },
    { name: "GitLab", emoji: "🦊", color: "#fc6d26" },
    { name: "Stack Overflow", emoji: "📚", color: "#f48024" },
    { name: "Amazon", emoji: "📦", color: "#ff9900" },
    { name: "Microsoft Teams", emoji: "👥", color: "#4b53bc" },
    { name: "Outlook", emoji: "📧", color: "#0072c6" },
    { name: "OneDrive", emoji: "☁️", color: "#0078d4" },
    { name: "LinkedIn", emoji: "💼", color: "#0a66c2" },
    { name: "Online-Banking", emoji: "🏦", color: "#1e3a8a" },
    { name: "Wetter", emoji: "⛅", color: "#38bdf8" },
    { name: "Intranet", emoji: "🗄️", color: "#475569" },
    { name: "Dokumente", emoji: "📄", color: "#64748b" },
    { name: "Notizen", emoji: "📝", color: "#eab308" },
    { name: "Kalender", emoji: "📅", color: "#dc2626" },
    { name: "Nachrichten", emoji: "📰", color: "#334155" }
  ];

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

  // override: { seed?, name?, emoji?, color?, disabled? }
  function computeMask(hostname, override) {
    override = override || {};
    var baseSeed = hashString(hostname || "");
    var seed = typeof override.seed === "number" ? (override.seed >>> 0) : baseSeed;

    var adjective = pick(ADJECTIVES, seed, 0x9e3779b1);
    var noun = pick(NOUNS, seed, 0x85ebca6b);
    var autoName = adjective + " " + noun;
    var autoEmoji = pick(EMOJIS, seed, 0xc2b2ae35);
    var autoColor = pick(COLORS, seed, 0x27d4eb2f);

    var name = override.name && override.name.trim() ? override.name.trim() : autoName;
    var emoji = override.emoji && override.emoji.trim() ? override.emoji.trim() : autoEmoji;
    var color = override.color || autoColor;

    return { name: name, emoji: emoji, color: color };
  }

  global.TabMaskerCore = {
    computeMask: computeMask,
    hashString: hashString,
    ADJECTIVES: ADJECTIVES,
    NOUNS: NOUNS,
    EMOJIS: EMOJIS,
    COLORS: COLORS,
    PRESETS: PRESETS
  };
})(typeof self !== "undefined" ? self : this);
