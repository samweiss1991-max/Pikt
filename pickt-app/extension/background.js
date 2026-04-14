// pickt Chrome Extension — Background Service Worker

var API_BASE = "http://localhost:3000";

// Toggle drawer on toolbar icon click
// Use scripting.executeScript as fallback when content script isn't loaded
chrome.action.onClicked.addListener(function (tab) {
  if (!tab.id) return;

  // Try sending message to existing content script first
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_DRAWER" }, function () {
    // If content script not loaded, inject it
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["content.js"],
        },
        function () {
          chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["drawer.css"],
          });
          // Give it a moment to load, then toggle
          setTimeout(function () {
            chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_DRAWER" });
          }, 200);
        }
      );
    }
  });
});

// Handle messages from content script / drawer
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === "API_REQUEST") {
    handleApiRequest(message).then(sendResponse);
    return true;
  }

  if (message.type === "GET_AUTH") {
    chrome.storage.local.get(["pickt_token", "pickt_user"], function (result) {
      sendResponse({
        token: result.pickt_token || null,
        user: result.pickt_user || null,
      });
    });
    return true;
  }

  if (message.type === "SET_AUTH") {
    chrome.storage.local.set({
      pickt_token: message.token,
      pickt_user: message.user,
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "LOGOUT") {
    chrome.storage.local.remove(["pickt_token", "pickt_user"]);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "OPEN_LOGIN") {
    chrome.tabs.create({ url: API_BASE + "/auth/login?extension=true" });
    sendResponse({ success: true });
    return true;
  }

  return false;
});

function handleApiRequest(msg) {
  return chrome.storage.local.get(["pickt_token"]).then(function (result) {
    var token = result.pickt_token;

    if (!token) {
      return { error: "Not authenticated", status: 401 };
    }

    var options = {
      method: msg.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    };

    if (msg.body && msg.method !== "GET") {
      options.body = JSON.stringify(msg.body);
    }

    var url = msg.path.indexOf("http") === 0 ? msg.path : API_BASE + msg.path;

    return fetch(url, options)
      .then(function (res) {
        return res.json().then(function (data) {
          return { data: data, status: res.status, ok: res.ok };
        });
      })
      .catch(function (err) {
        return { error: err.message, status: 0 };
      });
  });
}
