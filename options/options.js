function qs(id) {
  return document.getElementById(id);
}

function sendMessage(message) {
  return new Promise(function (resolve) {
    chrome.runtime.sendMessage(message, function (response) {
      resolve(response);
    });
  });
}

// Hosts ohne Zugriffsfreigabe aus dem letzten render() – wird synchron im
// Klick-Handler gebraucht, weil permissions.request eine Nutzeraktion verlangt.
var missingHosts = [];

function requestHostAccess(hostnames) {
  var origins = hostnames
    .map(function (h) { return TabMaskerCore.hostPattern(h); })
    .filter(Boolean);
  if (origins.length === 0) return Promise.resolve(false);
  return chrome.permissions.request({ origins: origins }).catch(function () {
    return false;
  });
}

function render(state) {
  qs("globalToggle").checked = !!state.globalEnabled;

  missingHosts = state.missingPermissions || [];
  qs("permissionBanner").hidden = missingHosts.length === 0;
  qs("missingCount").textContent = missingHosts.length;

  var body = qs("domainTableBody");
  body.innerHTML = "";

  var hostnames = Object.keys(state.domainOverrides || {}).sort();
  qs("emptyState").hidden = hostnames.length > 0;

  hostnames.forEach(function (hostname) {
    var override = state.domainOverrides[hostname] || {};
    var mask = TabMaskerCore.computeMask(hostname, override);
    var paused = override.disabled === true;
    var noAccess = missingHosts.indexOf(hostname) !== -1;

    var tr = document.createElement("tr");

    var iconTd = document.createElement("td");
    iconTd.className = "icon-cell";
    if (paused) {
      iconTd.textContent = "⏸";
    } else {
      var iconCanvas = document.createElement("canvas");
      iconCanvas.width = 24;
      iconCanvas.height = 24;
      TabMaskerCore.renderIcon(iconCanvas.getContext("2d"), mask, 24);
      iconTd.appendChild(iconCanvas);
    }
    tr.appendChild(iconTd);

    var hostTd = document.createElement("td");
    hostTd.textContent = hostname;
    tr.appendChild(hostTd);

    var nameTd = document.createElement("td");
    nameTd.textContent = mask.name;
    tr.appendChild(nameTd);

    var statusTd = document.createElement("td");
    var badge = document.createElement("span");
    badge.className = "status-badge " + (paused || noAccess ? "disabled" : "active");
    badge.textContent = noAccess ? "Kein Zugriff" : paused ? "Pausiert" : "Maskiert";
    statusTd.appendChild(badge);
    tr.appendChild(statusTd);

    var actionsTd = document.createElement("td");
    var actions = document.createElement("div");
    actions.className = "row-actions";

    if (noAccess) {
      var grantBtn = document.createElement("button");
      grantBtn.textContent = "Zugriff erteilen";
      grantBtn.addEventListener("click", function () {
        requestHostAccess([hostname]).then(refresh);
      });
      actions.appendChild(grantBtn);
    }

    var toggleBtn = document.createElement("button");
    toggleBtn.textContent = paused ? "Aktivieren" : "Pausieren";
    toggleBtn.addEventListener("click", function () {
      sendMessage({ type: "TOGGLE_DOMAIN", hostname: hostname, disabled: !paused }).then(refresh);
    });
    actions.appendChild(toggleBtn);

    var removeBtn = document.createElement("button");
    removeBtn.textContent = "Entfernen";
    removeBtn.addEventListener("click", function () {
      sendMessage({ type: "RESET_DOMAIN", hostname: hostname }).then(refresh);
    });
    actions.appendChild(removeBtn);

    actionsTd.appendChild(actions);
    tr.appendChild(actionsTd);

    body.appendChild(tr);
  });
}

function refresh() {
  return sendMessage({ type: "LIST_DOMAINS" }).then(render);
}

qs("globalToggle").addEventListener("change", function (e) {
  sendMessage({ type: "SET_GLOBAL_ENABLED", enabled: e.target.checked }).then(refresh);
});

function normalizeHostname(raw) {
  var hostname = raw.trim();
  if (!hostname) return "";
  if (hostname.indexOf("://") !== -1) {
    try {
      hostname = new URL(hostname).hostname;
    } catch (e) {
      // Eingabe war keine gültige URL – als reinen Hostnamen weiterverwenden.
    }
  }
  return hostname.replace(/^www\./, "").split("/")[0].split(":")[0].toLowerCase();
}

function populatePresets() {
  var select = qs("addPresetSelect");
  TabMaskerCore.PRESETS.forEach(function (preset) {
    var opt = document.createElement("option");
    opt.value = preset.name;
    opt.textContent = preset.emoji + " " + preset.name;
    select.appendChild(opt);
  });
}

qs("addBtn").addEventListener("click", function () {
  var hostname = normalizeHostname(qs("addInput").value);
  if (!hostname) return;

  var presetName = qs("addPresetSelect").value;
  var preset = TabMaskerCore.PRESETS.filter(function (p) {
    return p.name === presetName;
  })[0];

  var granted = requestHostAccess([hostname]);
  var chain = sendMessage({ type: "TOGGLE_DOMAIN", hostname: hostname, disabled: false });
  if (preset) {
    chain = chain.then(function () {
      return sendMessage({ type: "SET_CUSTOM", hostname: hostname, name: preset.name, emoji: preset.emoji });
    });
  }

  Promise.all([granted, chain]).then(function () {
    qs("addInput").value = "";
    qs("addPresetSelect").value = "";
    refresh();
  });
});

qs("grantAllBtn").addEventListener("click", function () {
  requestHostAccess(missingHosts).then(refresh);
});

qs("addInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    qs("addBtn").click();
  }
});

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("de-DE");
  } catch (e) {
    return "";
  }
}

function renderUpdateState(update) {
  var list = qs("changelogList");
  var statusText = qs("updateStatusText");
  var markSeenBtn = qs("markSeenBtn");
  var installHint = qs("installUpdateHint");

  list.innerHTML = "";

  if (update && update.changelog && update.changelog.length > 0) {
    update.changelog.forEach(function (commit) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = commit.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = commit.message;
      li.appendChild(link);
      var meta = document.createElement("span");
      meta.className = "changelog-meta";
      meta.textContent = " (" + commit.shortSha + (commit.date ? ", " + formatDate(commit.date) : "") + ")";
      li.appendChild(meta);
      list.appendChild(li);
    });
    list.hidden = false;
    markSeenBtn.hidden = false;
    installHint.hidden = false;
    var count = update.changelog.length;
    statusText.textContent = count === 1
      ? "1 neue Änderung seit deinem letzten Blick."
      : count + " neue Änderungen seit deinem letzten Blick.";
  } else {
    list.hidden = true;
    markSeenBtn.hidden = true;
    installHint.hidden = true;
    statusText.textContent = update.lastChecked
      ? "Auf dem neuesten Stand (zuletzt geprüft: " + formatDate(new Date(update.lastChecked).toISOString()) + ")."
      : "Noch nicht geprüft.";
  }
}

function refreshUpdateState() {
  return sendMessage({ type: "GET_UPDATE_STATE" }).then(renderUpdateState);
}

qs("checkUpdateBtn").addEventListener("click", function () {
  qs("updateStatusText").textContent = "Prüfe …";
  sendMessage({ type: "CHECK_UPDATE_NOW" }).then(renderUpdateState);
});

qs("markSeenBtn").addEventListener("click", function () {
  sendMessage({ type: "DISMISS_UPDATE" }).then(refreshUpdateState);
});

qs("openExtensionsPageBtn").addEventListener("click", function () {
  chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id });
});

populatePresets();
refresh();
refreshUpdateState();
