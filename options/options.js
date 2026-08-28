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

function render(state) {
  qs("globalToggle").checked = !!state.globalEnabled;

  var body = qs("domainTableBody");
  body.innerHTML = "";

  var hostnames = Object.keys(state.domainOverrides || {}).sort();
  qs("emptyState").hidden = hostnames.length > 0;

  hostnames.forEach(function (hostname) {
    var override = state.domainOverrides[hostname] || {};
    var mask = TabMaskerCore.computeMask(hostname, override);
    var paused = override.disabled === true;

    var tr = document.createElement("tr");

    var iconTd = document.createElement("td");
    iconTd.className = "icon-cell";
    iconTd.textContent = paused ? "⏸" : mask.emoji;
    tr.appendChild(iconTd);

    var hostTd = document.createElement("td");
    hostTd.textContent = hostname;
    tr.appendChild(hostTd);

    var nameTd = document.createElement("td");
    nameTd.textContent = mask.name;
    tr.appendChild(nameTd);

    var statusTd = document.createElement("td");
    var badge = document.createElement("span");
    badge.className = "status-badge " + (paused ? "disabled" : "active");
    badge.textContent = paused ? "Pausiert" : "Maskiert";
    statusTd.appendChild(badge);
    tr.appendChild(statusTd);

    var actionsTd = document.createElement("td");
    var actions = document.createElement("div");
    actions.className = "row-actions";

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
  return hostname.replace(/^www\./, "").split("/")[0];
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

  var chain = sendMessage({ type: "TOGGLE_DOMAIN", hostname: hostname, disabled: false });
  if (preset) {
    chain = chain.then(function () {
      return sendMessage({ type: "SET_CUSTOM", hostname: hostname, name: preset.name, emoji: preset.emoji });
    });
  }

  chain.then(function () {
    qs("addInput").value = "";
    qs("addPresetSelect").value = "";
    refresh();
  });
});

qs("addInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    qs("addBtn").click();
  }
});

populatePresets();
refresh();
