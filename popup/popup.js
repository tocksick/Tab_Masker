var activeTab = null;
var hostname = "";

function qs(id) {
  return document.getElementById(id);
}

function populatePresets() {
  var select = qs("presetSelect");
  TabMaskerCore.PRESETS.forEach(function (preset) {
    var opt = document.createElement("option");
    opt.value = preset.name;
    opt.textContent = preset.emoji + " " + preset.name;
    select.appendChild(opt);
  });
}

function getActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
    return tabs[0];
  });
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
}

function sendMessage(message) {
  return new Promise(function (resolve) {
    chrome.runtime.sendMessage(message, function (response) {
      resolve(response);
    });
  });
}

// Ersetzt das gezeichnete Logo durch das echte Favicon der Tarnseite,
// falls der Browser es im Cache hat (wie im Tab selbst, siehe content.js).
function showRealFavicon(container, mask, size) {
  if (!mask.faviconUrl) return;
  sendMessage({ type: "GET_FAVICON", pageUrl: mask.faviconUrl }).then(function (response) {
    if (!response || !response.dataUrl) return;
    var img = document.createElement("img");
    img.src = response.dataUrl;
    img.width = size;
    img.height = size;
    img.alt = "";
    container.innerHTML = "";
    container.appendChild(img);
  });
}

function renderPreview(mask) {
  var iconEl = qs("previewIcon");
  iconEl.innerHTML = "";
  if (mask && mask.color) {
    var canvas = document.createElement("canvas");
    canvas.width = 42;
    canvas.height = 42;
    TabMaskerCore.renderIcon(canvas.getContext("2d"), mask, 42);
    iconEl.appendChild(canvas);
    showRealFavicon(iconEl, mask, 42);
  } else {
    iconEl.textContent = "🎭";
  }
  qs("previewName").textContent = mask && mask.name ? mask.name : hostname || "Keine Domain erkannt";
  qs("previewHost").textContent = hostname || "";
}

function refreshUpdateBanner() {
  return sendMessage({ type: "GET_UPDATE_STATE" }).then(function (update) {
    var hasUpdate = !!(update && update.hasUpdate);
    qs("updateBanner").hidden = !hasUpdate;
    if (hasUpdate) {
      qs("updateCount").textContent = update.changelog.length;
    }
  });
}

function refresh() {
  return getActiveTab()
    .then(function (tab) {
      activeTab = tab;
      hostname = activeTab && activeTab.url ? hostnameFromUrl(activeTab.url) : "";
      return sendMessage({ type: "GET_STATE", hostname: hostname });
    })
    .then(function (state) {
      qs("globalToggle").checked = !!state.globalEnabled;

      var supported = !!hostname && /^https?:/.test((activeTab && activeTab.url) || "");
      qs("currentSite").classList.toggle("disabled", !supported);
      qs("domainToggle").disabled = !supported;
      qs("randomizeBtn").disabled = !supported;
      qs("removeBtn").disabled = !supported;
      qs("saveCustomBtn").disabled = !supported;

      if (!supported) {
        qs("previewHost").textContent = "Nicht verfügbar auf dieser Seite";
        qs("previewName").textContent = "–";
        qs("previewIcon").textContent = "🚫";
        qs("domainToggle").checked = false;
        qs("domainControls").hidden = true;
        qs("notListedHint").hidden = true;
        qs("permissionHint").hidden = true;
        return;
      }

      var inList = !!state.inList;
      qs("domainToggle").checked = !!state.masked;
      qs("domainControls").hidden = !inList;
      qs("notListedHint").hidden = inList;
      qs("permissionHint").hidden = !inList || !!state.hasPermission;

      var override = state.override || {};
      qs("customName").value = override.name || "";
      qs("customEmoji").value = override.emoji || "";

      renderPreview(state.preview);
    });
}

qs("globalToggle").addEventListener("change", function (e) {
  sendMessage({ type: "SET_GLOBAL_ENABLED", enabled: e.target.checked }).then(refresh);
});

// Fragt den Zugriff auf die aktuelle Domain an. Muss synchron im
// Klick-Handler aufgerufen werden (Chrome verlangt eine Nutzeraktion).
// Das Popup kann sich dabei schließen – der Background-Worker reagiert
// deshalb selbst auf permissions.onAdded.
function requestHostAccess() {
  var pattern = TabMaskerCore.hostPattern(hostname);
  if (!pattern) return Promise.resolve(false);
  return chrome.permissions.request({ origins: [pattern] }).catch(function () {
    return false;
  });
}

qs("domainToggle").addEventListener("change", function (e) {
  if (!hostname) return;
  var granted = e.target.checked ? requestHostAccess() : Promise.resolve();
  var saved = sendMessage({ type: "TOGGLE_DOMAIN", hostname: hostname, disabled: !e.target.checked });
  Promise.all([granted, saved]).then(refresh);
});

qs("grantAccessBtn").addEventListener("click", function () {
  if (!hostname) return;
  requestHostAccess().then(refresh);
});

qs("randomizeBtn").addEventListener("click", function () {
  if (!hostname) return;
  sendMessage({ type: "RANDOMIZE_DOMAIN", hostname: hostname }).then(refresh);
});

qs("clearCustomBtn").addEventListener("click", function () {
  if (!hostname) return;
  sendMessage({ type: "CLEAR_CUSTOM", hostname: hostname }).then(refresh);
});

qs("removeBtn").addEventListener("click", function () {
  if (!hostname) return;
  sendMessage({ type: "RESET_DOMAIN", hostname: hostname }).then(refresh);
});

qs("presetSelect").addEventListener("change", function (e) {
  var preset = TabMaskerCore.PRESETS.filter(function (p) {
    return p.name === e.target.value;
  })[0];
  if (!preset) return;
  qs("customName").value = preset.name;
  qs("customEmoji").value = preset.emoji;
});

qs("saveCustomBtn").addEventListener("click", function () {
  if (!hostname) return;
  var name = qs("customName").value.trim();
  var emoji = qs("customEmoji").value.trim();
  sendMessage({ type: "SET_CUSTOM", hostname: hostname, name: name, emoji: emoji }).then(refresh);
});

qs("openOptions").addEventListener("click", function (e) {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

qs("viewChangelogLink").addEventListener("click", function (e) {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

qs("dismissUpdateBtn").addEventListener("click", function () {
  sendMessage({ type: "DISMISS_UPDATE" }).then(refreshUpdateBanner);
});

populatePresets();
refresh();
refreshUpdateBanner();
