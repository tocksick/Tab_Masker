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

    var tr = document.createElement("tr");

    var iconTd = document.createElement("td");
    iconTd.className = "icon-cell";
    iconTd.textContent = override.disabled ? "🚫" : mask.emoji;
    tr.appendChild(iconTd);

    var hostTd = document.createElement("td");
    hostTd.textContent = hostname;
    tr.appendChild(hostTd);

    var nameTd = document.createElement("td");
    nameTd.textContent = override.disabled ? "–" : mask.name;
    tr.appendChild(nameTd);

    var statusTd = document.createElement("td");
    var badge = document.createElement("span");
    badge.className = "status-badge " + (override.disabled ? "disabled" : "active");
    badge.textContent = override.disabled ? "Ausgeschlossen" : "Maskiert";
    statusTd.appendChild(badge);
    tr.appendChild(statusTd);

    var actionsTd = document.createElement("td");
    var actions = document.createElement("div");
    actions.className = "row-actions";

    var toggleBtn = document.createElement("button");
    toggleBtn.textContent = override.disabled ? "Wieder aktivieren" : "Ausschließen";
    toggleBtn.addEventListener("click", function () {
      sendMessage({ type: "TOGGLE_DOMAIN", hostname: hostname, disabled: !override.disabled }).then(refresh);
    });
    actions.appendChild(toggleBtn);

    var resetBtn = document.createElement("button");
    resetBtn.textContent = "Entfernen";
    resetBtn.addEventListener("click", function () {
      sendMessage({ type: "RESET_DOMAIN", hostname: hostname }).then(refresh);
    });
    actions.appendChild(resetBtn);

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

qs("excludeBtn").addEventListener("click", function () {
  var raw = qs("excludeInput").value.trim();
  if (!raw) return;

  var hostname = raw;
  if (raw.indexOf("://") !== -1) {
    try {
      hostname = new URL(raw).hostname;
    } catch (e) {
      hostname = raw;
    }
  }
  hostname = hostname.replace(/^www\./, "").split("/")[0];
  if (!hostname) return;

  sendMessage({ type: "TOGGLE_DOMAIN", hostname: hostname, disabled: true }).then(function () {
    qs("excludeInput").value = "";
    refresh();
  });
});

refresh();
