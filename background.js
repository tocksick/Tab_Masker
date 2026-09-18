importScripts("common/mask.js");

var DEFAULT_STATE = { globalEnabled: true, domainOverrides: {} };

// --- Update-Check: benachrichtigt, wenn auf GitHub neue Commits liegen ---

var GITHUB_REPO = "tocksick/Tab_Masker";
var UPDATE_CHECK_ALARM = "tabmasker-update-check";
var UPDATE_CHECK_INTERVAL_MINUTES = 360; // alle 6 Stunden
var UPDATE_NOTIFICATION_ID = "tabmasker-update";

var DEFAULT_UPDATE_STATE = {
  lastSeenSha: null, // zuletzt vom Nutzer bestätigter Stand
  latestSha: null, // zuletzt auf GitHub gesehener Stand
  changelog: [], // Commits zwischen lastSeenSha und latestSha
  lastChecked: null
};

async function getUpdateState() {
  var data = await chrome.storage.local.get(DEFAULT_UPDATE_STATE);
  return Object.assign({}, DEFAULT_UPDATE_STATE, data);
}

function setUpdateState(partial) {
  return chrome.storage.local.set(partial);
}

async function fetchLatestSha() {
  var res = await fetch("https://api.github.com/repos/" + GITHUB_REPO + "/commits?per_page=1");
  if (!res.ok) throw new Error("GitHub API " + res.status);
  var data = await res.json();
  return data && data[0] ? data[0].sha : null;
}

async function fetchChangelog(baseSha, headSha) {
  var res = await fetch(
    "https://api.github.com/repos/" + GITHUB_REPO + "/compare/" + baseSha + "..." + headSha
  );
  if (!res.ok) throw new Error("GitHub API " + res.status);
  var data = await res.json();
  var commits = data.commits || [];
  return commits
    .map(function (c) {
      var fullMessage = (c.commit && c.commit.message) || "";
      return {
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: fullMessage.split("\n")[0],
        date: c.commit && c.commit.author ? c.commit.author.date : null,
        url: c.html_url
      };
    })
    .reverse(); // älteste zuerst
}

async function checkForUpdate() {
  var state = await getUpdateState();
  try {
    var latestSha = await fetchLatestSha();
    await setUpdateState({ lastChecked: Date.now() });
    if (!latestSha) return getUpdateState();

    if (!state.lastSeenSha) {
      // Erster Lauf: nur Ausgangsstand merken, noch nicht benachrichtigen.
      await setUpdateState({ lastSeenSha: latestSha, latestSha: latestSha, changelog: [] });
      return getUpdateState();
    }

    if (latestSha === state.latestSha) {
      return getUpdateState();
    }

    var changelog = await fetchChangelog(state.lastSeenSha, latestSha);
    await setUpdateState({ latestSha: latestSha, changelog: changelog });

    if (changelog.length > 0) {
      await chrome.action.setBadgeText({ text: String(changelog.length) });
      await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
      chrome.notifications.create(UPDATE_NOTIFICATION_ID, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Tab Masker: Update verfügbar",
        message:
          changelog.length + " neue Änderung" + (changelog.length === 1 ? "" : "en") +
          " auf GitHub. Klicken für das Änderungsprotokoll.",
        priority: 1
      });
    }
    return getUpdateState();
  } catch (e) {
    console.warn("Tab Masker Update-Check fehlgeschlagen:", e);
    return state;
  }
}

async function dismissUpdate() {
  var state = await getUpdateState();
  await setUpdateState({ lastSeenSha: state.latestSha, changelog: [] });
  await chrome.action.setBadgeText({ text: "" });
  return getUpdateState();
}

chrome.notifications.onClicked.addListener(function (notificationId) {
  if (notificationId === UPDATE_NOTIFICATION_ID) {
    chrome.runtime.openOptionsPage();
    chrome.notifications.clear(notificationId);
  }
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === UPDATE_CHECK_ALARM) {
    checkForUpdate();
  }
});

chrome.runtime.onStartup.addListener(function () {
  checkForUpdate();
});

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
}

async function getState() {
  var data = await chrome.storage.local.get(DEFAULT_STATE);
  return {
    globalEnabled: data.globalEnabled !== undefined ? data.globalEnabled : true,
    domainOverrides: data.domainOverrides || {}
  };
}

function setState(partial) {
  return chrome.storage.local.set(partial);
}

// Es wird ausschließlich maskiert, wenn die Domain explizit in
// domainOverrides eingetragen wurde (Allowlist) UND nicht pausiert ist.
function isActiveEntry(globalEnabled, override) {
  return !!(globalEnabled && override && override.disabled !== true);
}

async function computeMaskForHost(hostname) {
  var state = await getState();
  var override = state.domainOverrides[hostname];
  if (!hostname || !isActiveEntry(state.globalEnabled, override)) return { active: false };
  var mask = TabMaskerCore.computeMask(hostname, override);
  return {
    active: true,
    name: mask.name,
    emoji: mask.emoji,
    color: mask.color,
    logoShape: mask.logoShape,
    fgColor: mask.fgColor
  };
}

async function reloadTabsForHost(hostname) {
  var tabs = await chrome.tabs.query({});
  tabs.forEach(function (tab) {
    if (!tab.id || !tab.url) return;
    if (getHostname(tab.url) === hostname) {
      chrome.tabs.reload(tab.id).catch(function () {});
    }
  });
}

async function reloadAllTabs() {
  var tabs = await chrome.tabs.query({});
  tabs.forEach(function (tab) {
    if (tab.id && tab.url && /^https?:/.test(tab.url)) {
      chrome.tabs.reload(tab.id).catch(function () {});
    }
  });
}

chrome.runtime.onInstalled.addListener(async function () {
  var data = await chrome.storage.local.get(null);
  if (data.globalEnabled === undefined) {
    await setState(DEFAULT_STATE);
  }
  chrome.alarms.create(UPDATE_CHECK_ALARM, { periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES });
  checkForUpdate();
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(function (err) {
      console.error("Tab Masker Fehler:", err);
      sendResponse({ error: String(err) });
    });
  return true; // asynchrone Antwort
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case "GET_MASK_FOR_HOST": {
      return computeMaskForHost(message.hostname);
    }

    case "GET_STATE": {
      var state = await getState();
      var hostname = message.hostname;
      if (!hostname && sender.tab && sender.tab.url) {
        hostname = getHostname(sender.tab.url);
      }
      var override = hostname ? (state.domainOverrides[hostname] || null) : null;
      var preview = hostname ? TabMaskerCore.computeMask(hostname, override || {}) : null;
      return {
        globalEnabled: state.globalEnabled,
        hostname: hostname,
        override: override,
        inList: !!override,
        masked: isActiveEntry(state.globalEnabled, override),
        preview: preview
      };
    }

    case "SET_GLOBAL_ENABLED": {
      await setState({ globalEnabled: !!message.enabled });
      await reloadAllTabs();
      return { ok: true };
    }

    case "TOGGLE_DOMAIN": {
      var s1 = await getState();
      var overrides1 = Object.assign({}, s1.domainOverrides);
      var current1 = overrides1[message.hostname] || {};
      overrides1[message.hostname] = Object.assign({}, current1, { disabled: !!message.disabled });
      await setState({ domainOverrides: overrides1 });
      await reloadTabsForHost(message.hostname);
      return { ok: true };
    }

    case "RANDOMIZE_DOMAIN": {
      var s2 = await getState();
      var overrides2 = Object.assign({}, s2.domainOverrides);
      var current2 = overrides2[message.hostname] || {};
      var newSeed = (Math.random() * 0xffffffff) >>> 0;
      overrides2[message.hostname] = Object.assign({}, current2, {
        seed: newSeed,
        name: "",
        emoji: ""
      });
      await setState({ domainOverrides: overrides2 });
      await reloadTabsForHost(message.hostname);
      return { ok: true };
    }

    case "SET_CUSTOM": {
      var s3 = await getState();
      var overrides3 = Object.assign({}, s3.domainOverrides);
      var current3 = overrides3[message.hostname] || {};
      overrides3[message.hostname] = Object.assign({}, current3, {
        name: message.name !== undefined ? message.name : current3.name,
        emoji: message.emoji !== undefined ? message.emoji : current3.emoji
      });
      await setState({ domainOverrides: overrides3 });
      await reloadTabsForHost(message.hostname);
      return { ok: true };
    }

    case "CLEAR_CUSTOM": {
      // Setzt Name/Icon/Seed einer bereits gelisteten Domain auf den
      // automatisch generierten Standard zurück, ohne sie von der
      // Maskierungsliste zu entfernen.
      var s4 = await getState();
      var overrides4 = Object.assign({}, s4.domainOverrides);
      var current4 = overrides4[message.hostname];
      if (current4) {
        overrides4[message.hostname] = { disabled: current4.disabled };
        await setState({ domainOverrides: overrides4 });
        await reloadTabsForHost(message.hostname);
      }
      return { ok: true };
    }

    case "RESET_DOMAIN": {
      // Entfernt die Domain vollständig aus der Maskierungsliste
      // (Allowlist) – sie wird danach nicht mehr maskiert.
      var s5 = await getState();
      var overrides5 = Object.assign({}, s5.domainOverrides);
      delete overrides5[message.hostname];
      await setState({ domainOverrides: overrides5 });
      await reloadTabsForHost(message.hostname);
      return { ok: true };
    }

    case "LIST_DOMAINS": {
      var s6 = await getState();
      return { globalEnabled: s6.globalEnabled, domainOverrides: s6.domainOverrides };
    }

    case "GET_UPDATE_STATE": {
      var u1 = await getUpdateState();
      return {
        hasUpdate: u1.changelog.length > 0,
        changelog: u1.changelog,
        lastChecked: u1.lastChecked,
        repo: GITHUB_REPO
      };
    }

    case "CHECK_UPDATE_NOW": {
      var u2 = await checkForUpdate();
      return {
        hasUpdate: u2.changelog.length > 0,
        changelog: u2.changelog,
        lastChecked: u2.lastChecked,
        repo: GITHUB_REPO
      };
    }

    case "DISMISS_UPDATE": {
      await dismissUpdate();
      return { ok: true };
    }

    default:
      return { error: "Unbekannter Nachrichtentyp: " + message.type };
  }
}
