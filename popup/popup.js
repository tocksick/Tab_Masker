var activeTab = null;
var hostname = "";

function qs(id) {
  return document.getElementById(id);
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

function renderPreview(mask) {
  qs("previewIcon").textContent = mask && mask.emoji ? mask.emoji : "🎭";
  qs("previewName").textContent = mask && mask.name ? mask.name : hostname || "Keine Domain erkannt";
  qs("previewHost").textContent = hostname || "";
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
      qs("resetBtn").disabled = !supported;
      qs("saveCustomBtn").disabled = !supported;

      if (!supported) {
        qs("previewHost").textContent = "Nicht verfügbar auf dieser Seite";
        qs("previewName").textContent = "–";
        qs("previewIcon").textContent = "🚫";
        return;
      }

      var override = state.override || {};
      qs("domainToggle").checked = !override.disabled;
      qs("customName").value = override.name || "";
      qs("customEmoji").value = override.emoji || "";

      renderPreview(state.preview);
    });
}

qs("globalToggle").addEventListener("change", function (e) {
  sendMessage({ type: "SET_GLOBAL_ENABLED", enabled: e.target.checked }).then(refresh);
});

qs("domainToggle").addEventListener("change", function (e) {
  if (!hostname) return;
  sendMessage({ type: "TOGGLE_DOMAIN", hostname: hostname, disabled: !e.target.checked }).then(refresh);
});

qs("randomizeBtn").addEventListener("click", function () {
  if (!hostname) return;
  sendMessage({ type: "RANDOMIZE_DOMAIN", hostname: hostname }).then(refresh);
});

qs("resetBtn").addEventListener("click", function () {
  if (!hostname) return;
  sendMessage({ type: "RESET_DOMAIN", hostname: hostname }).then(refresh);
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

refresh();
