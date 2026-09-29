/* CompMails — free temp mail, in the browser.
   ---------------------------------------------------------------------
   The inbox is a random address created against a public temporary-mail
   API (Mail.tm through its CORS proxy), read here in the page. There is
   no backend of our own: the address and its session live in this
   browser's storage, and every message is fetched straight from the API.

   The ad network follows the same rule as the rest of base31.org:
   nothing is requested from it until the visitor answers the cookie
   notice, and changing that answer takes the script back out. */

(function () {
  "use strict";

  // Mail.tm does not send a CORS origin header, so production talks to the
  // verified Cloudflare Worker proxy. Opening the file locally still works
  // against the API directly.
  var API_BASE = window.location.protocol === "file:"
    ? "https://api.mail.tm"
    : "https://compmails-mail-proxy.sawyerbobk563.workers.dev";

  var KEY_SESSION = "compmails.session";
  var KEY_SAVED = "compmails.saved";
  var KEY_CONSENT = "base31-consent";
  var KEY_SOUND = "compmails.sound";
  var KEY_THEME = "compmails.theme";
  var READ_PREFIX = "compmails.read.";
  var ACCOUNT_DAYS = 7;

  // The same 160x300 banner the base31.org support hub runs, behind the
  // same consent gate.
  var AD_KEY = "d1495d5e568642fb60c4f1232a9af565";
  var AD_WIDTH = 160;
  var AD_HEIGHT = 300;
  var AD_SCRIPT_ID = "compmails-banner-loader";
  var AD_SCRIPT_URL = "https://www.highrevenueformat.com/" + AD_KEY + "/invoke.js";

  var QR_SRC = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    address: $("address"),
    domainBadge: $("domainBadge"),
    expiryText: $("expiryText"),
    statusPill: $("statusPill"),
    statusText: $("statusText"),
    btnCopy: $("btnCopy"),
    btnQr: $("btnQr"),
    btnRefresh: $("btnRefresh"),
    btnNew: $("btnNew"),
    btnRetry: $("btnRetry"),
    refreshIcon: $("refreshIcon"),
    btnCustom: $("btnCustom"),
    btnSaved: $("btnSaved"),
    savedCount: $("savedCount"),
    intervalSelect: $("intervalSelect"),
    btnSound: $("btnSound"),
    themeBtn: $("themeBtn"),
    search: $("search"),
    unreadOnly: $("unreadOnly"),
    msgCount: $("msgCount"),
    msgList: $("msgList"),
    loadingState: $("loadingState"),
    emptyState: $("emptyState"),
    errorState: $("errorState"),
    errorText: $("errorText"),
    noResults: $("noResults"),
    readerPanel: $("readerPanel"),
    readerEmpty: $("readerEmpty"),
    readerSkeleton: $("readerSkeleton"),
    readerBody: $("readerBody"),
    btnBack: $("btnBack"),
    msgSubject: $("msgSubject"),
    msgFrom: $("msgFrom"),
    msgTo: $("msgTo"),
    msgDate: $("msgDate"),
    btnRaw: $("btnRaw"),
    btnSave: $("btnSave"),
    btnCopyMsg: $("btnCopyMsg"),
    btnDelete: $("btnDelete"),
    rawPanel: $("rawPanel"),
    attachments: $("attachments"),
    attList: $("attList"),
    msgFrame: $("msgFrame"),
    adSlot: $("adSlot"),
    adNote: $("adNote"),
    consent: $("consent"),
    btnAccept: $("btnAccept"),
    btnDeny: $("btnDeny"),
    toast: $("toast"),
    toastText: $("toastText"),
    toastIcon: $("toastIcon"),
    customModal: $("customModal"),
    customForm: $("customForm"),
    customUser: $("customUser"),
    customDomain: $("customDomain"),
    customPass: $("customPass"),
    customSubmit: $("customSubmit"),
    qrModal: $("qrModal"),
    qrHolder: $("qrHolder"),
    qrAddress: $("qrAddress"),
    savedModal: $("savedModal"),
    savedList: $("savedList")
  };

  var BASE_TITLE = document.title;

  var state = {
    domains: [],
    account: null,
    token: null,
    messages: [],
    selectedId: null,
    readIds: {},
    loaded: false,
    filter: "",
    unreadOnly: false,
    interval: 10000,
    timer: null,
    sound: true,
    current: null,
    booted: false,
    consent: null
  };

  /* Helpers ------------------------------------------------------------ */

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function haptic(pattern) {
    if (!("vibrate" in navigator)) return;
    var map = { light: 8, medium: 16, success: [10, 34, 10], warning: [18, 44, 18] };
    try { navigator.vibrate(map[pattern] || map.light); } catch (e) { /* no-op */ }
  }

  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function readStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  function dropStore(key) {
    try { localStorage.removeItem(key); } catch (e) { /* no-op */ }
  }

  function randomString(length) {
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    if (window.crypto && window.crypto.getRandomValues) {
      var buf = new Uint8Array(length);
      window.crypto.getRandomValues(buf);
      for (var i = 0; i < length; i++) out += chars[buf[i] % chars.length];
      return out;
    }
    for (var j = 0; j < length; j++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function timeAgo(iso) {
    var then = new Date(iso).getTime();
    if (!then) return "";
    var mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return mins + "m ago";
    var hours = Math.round(mins / 60);
    if (hours < 24) return hours + "h ago";
    return Math.round(hours / 24) + "d ago";
  }

  function clockTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }

  /* Toast + status ----------------------------------------------------- */

  var toastTimer = null;
  function toast(message, kind) {
    el.toastText.textContent = message;
    el.toast.classList.toggle("is-error", kind === "error");
    el.toastIcon.firstElementChild.setAttribute("href", kind === "error" ? "#i-alert" : "#i-check");
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 3400);
  }

  function status(mode, text) {
    el.statusPill.classList.toggle("is-busy", mode === "busy");
    el.statusPill.classList.toggle("is-down", mode === "down");
    el.statusText.textContent = text;
  }

  function beep() {
    if (!state.sound) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(990, ctx.currentTime + 0.11);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
      setTimeout(function () { ctx.close(); }, 600);
    } catch (e) { /* audio is a nicety, never a requirement */ }
  }

  /* The mail API ------------------------------------------------------- */

  var Mail = {
    request: function (url, options, retries, backoff) {
      options = options || {};
      retries = retries === undefined ? 3 : retries;
      backoff = backoff || 700;
      var authRetry = options.authRetry || false;
      var fetchOptions = {};
      for (var k in options) if (k !== "authRetry") fetchOptions[k] = options[k];

      return fetch(url, fetchOptions).then(function (res) {
        if (res.status === 429 && retries > 0) {
          var after = parseInt(res.headers.get("Retry-After") || "0", 10);
          return sleep(after > 0 ? after * 1000 : backoff)
            .then(function () { return Mail.request(url, options, retries - 1, backoff * 2); });
        }
        // A mailbox token expires; re-authenticate once, but never while
        // asking for a token in the first place.
        if (res.status === 401 && !authRetry && url.indexOf("/token") === -1 &&
            state.account && state.account.address && state.account.password) {
          return Mail.token(state.account.address, state.account.password).then(function (token) {
            state.token = token;
            var headers = new Headers(options.headers || {});
            headers.set("Authorization", "Bearer " + token);
            var next = {};
            for (var k2 in options) next[k2] = options[k2];
            next.headers = headers;
            next.authRetry = true;
            return Mail.request(url, next, retries, backoff);
          });
        }
        return res;
      }).catch(function (err) {
        if (retries > 0) {
          return sleep(backoff).then(function () { return Mail.request(url, options, retries - 1, backoff * 2); });
        }
        throw new Error(err && err.message ? err.message : "The mail service is unreachable");
      });
    },

    domains: function () {
      return Mail.request(API_BASE + "/domains").then(function (res) {
        if (!res.ok) throw new Error("Could not load the domain list (" + res.status + ")");
        return res.json();
      }).then(function (data) {
        var list = Array.isArray(data["hydra:member"]) ? data["hydra:member"] : (Array.isArray(data) ? data : []);
        return list.filter(function (d) { return d.isActive !== false; });
      });
    },

    create: function (address, password) {
      return Mail.request(API_BASE + "/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address: address, password: password })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) {
            throw new Error(data.message || data["hydra:description"] || data.detail || "Could not create the inbox (" + res.status + ")");
          }
          if (!data.id) throw new Error("The mail service returned an unexpected answer");
          return data;
        });
      });
    },

    token: function (address, password) {
      return Mail.request(API_BASE + "/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address, password: password })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.token) {
            throw new Error(data.message || data["hydra:description"] || "Could not open that inbox (" + res.status + ")");
          }
          return data.token;
        });
      });
    },

    messages: function () {
      return Mail.request(API_BASE + "/messages", {
        headers: { Authorization: "Bearer " + state.token }
      }).then(function (res) {
        if (!res.ok) throw new Error("Could not read the inbox (" + res.status + ")");
        return res.json();
      }).then(function (data) {
        return Array.isArray(data["hydra:member"]) ? data["hydra:member"] : (Array.isArray(data) ? data : []);
      });
    },

    message: function (id) {
      return Mail.request(API_BASE + "/messages/" + id, {
        headers: { Authorization: "Bearer " + state.token }
      }).then(function (res) {
        if (!res.ok) throw new Error("Could not open that message (" + res.status + ")");
        return res.json();
      });
    },

    remove: function (id) {
      return Mail.request(API_BASE + "/messages/" + id, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + state.token }
      }).then(function (res) {
        if (!res.ok && res.status !== 204) throw new Error("Could not delete that message (" + res.status + ")");
        return true;
      });
    },

    attachment: function (path) {
      return Mail.request(API_BASE + path, {
        headers: { Authorization: "Bearer " + state.token }
      });
    }
  };

  /* Sessions in this browser ------------------------------------------- */

  function remember(account) {
    var list = readStore(KEY_SAVED, []) || [];
    list = list.filter(function (item) { return item.address !== account.address; });
    list.unshift({ address: account.address, password: account.password, createdAt: account.createdAt || Date.now() });
    writeStore(KEY_SAVED, list.slice(0, 6));
    renderSaved();
  }

  function forget(address) {
    var list = readStore(KEY_SAVED, []) || [];
    writeStore(KEY_SAVED, list.filter(function (item) { return item.address !== address; }));
    renderSaved();
  }

  function readIdsFor(address) {
    return readStore(READ_PREFIX + address, {}) || {};
  }

  function markRead(id) {
    if (!state.account) return;
    state.readIds[id] = Date.now();
    var ids = Object.keys(state.readIds);
    if (ids.length > 300) {
      ids.sort(function (a, b) { return state.readIds[a] - state.readIds[b]; });
      ids.slice(0, ids.length - 300).forEach(function (k) { delete state.readIds[k]; });
    }
    writeStore(READ_PREFIX + state.account.address, state.readIds);
  }

  function unreadCount() {
    return state.messages.filter(function (m) { return !state.readIds[m.id] && !m.seen; }).length;
  }

  function paintTitle() {
    var n = unreadCount();
    document.title = n > 0 ? "(" + n + ") " + BASE_TITLE : BASE_TITLE;
  }

  /* Rendering ---------------------------------------------------------- */

  function showListState(name) {
    el.loadingState.hidden = name !== "loading";
    el.emptyState.hidden = name !== "empty";
    el.errorState.hidden = name !== "error";
    el.noResults.hidden = name !== "none";
  }

  function matches(msg) {
    if (state.unreadOnly && (state.readIds[msg.id] || msg.seen)) return false;
    if (!state.filter) return true;
    var needle = state.filter.toLowerCase();
    var from = msg.from || {};
    return (msg.subject || "").toLowerCase().indexOf(needle) !== -1 ||
      (from.address || "").toLowerCase().indexOf(needle) !== -1 ||
      (from.name || "").toLowerCase().indexOf(needle) !== -1 ||
      (msg.intro || "").toLowerCase().indexOf(needle) !== -1;
  }

  function renderMessages() {
    var scroll = el.msgList.scrollTop;
    var previous = el.msgList.querySelectorAll(".msg");
    for (var i = 0; i < previous.length; i++) previous[i].remove();

    el.msgCount.textContent = state.messages.length + (state.messages.length === 1 ? " message" : " messages");
    if (!state.messages.length) { showListState("empty"); return; }

    var shown = state.messages.filter(matches);
    if (!shown.length) { showListState("none"); return; }
    showListState(null);

    var frag = document.createDocumentFragment();
    shown.forEach(function (msg) {
      var from = msg.from || {};
      var read = state.readIds[msg.id] || msg.seen;
      var node = document.createElement("button");
      node.type = "button";
      node.className = "msg" + (read ? "" : " is-unread") + (state.selectedId === msg.id ? " is-active" : "");
      node.setAttribute("data-id", msg.id);
      node.innerHTML =
        '<span class="msg-top"><span class="msg-from">' + esc(from.name || from.address || "Unknown sender") +
        '</span><span class="msg-time">' + esc(clockTime(msg.createdAt)) + '</span></span>' +
        '<span class="msg-subject">' + esc(msg.subject || "(no subject)") + '</span>' +
        '<span class="msg-intro">' + esc(msg.intro || "…") + '</span>';
      node.addEventListener("click", function () { openMessage(msg.id); });
      frag.appendChild(node);
    });
    el.msgList.appendChild(frag);
    el.msgList.scrollTop = scroll;
  }

  function selectInList(id) {
    var nodes = el.msgList.querySelectorAll(".msg");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle("is-active", nodes[i].getAttribute("data-id") === id);
    }
  }

  function showReader(which) {
    el.readerEmpty.hidden = which !== "empty";
    el.readerSkeleton.hidden = which !== "loading";
    el.readerBody.hidden = which !== "message";
    el.readerPanel.classList.toggle("is-idle", which === "empty");
  }

  function openMessage(id) {
    haptic("light");
    state.selectedId = id;
    var requested = id;
    markRead(id);
    renderMessages();
    selectInList(id);
    paintTitle();
    showReader("loading");
    el.rawPanel.hidden = true;
    el.btnRaw.classList.remove("is-on");

    Mail.message(id).then(function (msg) {
      // A second click while the first fetch is still in flight wins.
      if (state.selectedId !== requested) return;
      state.current = msg;
      el.msgSubject.textContent = msg.subject || "(no subject)";
      el.msgFrom.textContent = (msg.from && (msg.from.name ? msg.from.name + " <" + msg.from.address + ">" : msg.from.address)) || "unknown";
      el.msgTo.textContent = (msg.to || []).map(function (t) { return t.address; }).join(", ") || "—";
      el.msgDate.textContent = new Date(msg.createdAt).toLocaleString() + " · " + timeAgo(msg.createdAt);

      var body = "";
      var html = Array.isArray(msg.html) ? msg.html.join("") : msg.html;
      if (html) {
        body = html;
      } else if (msg.text) {
        body = '<pre style="margin:0;padding:18px;font:13px/1.65 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word">' +
          esc(msg.text) + "</pre>";
      } else {
        body = '<p style="margin:0;padding:18px;font:13px/1.6 system-ui,sans-serif;color:#666">This message has no readable body.</p>';
      }
      el.msgFrame.setAttribute("srcdoc",
        '<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0">' +
        body + "</body></html>");

      el.rawPanel.textContent = (msg.headerLines || []).map(function (h) { return h.line; }).join("");

      var files = (msg.hasAttachments && msg.attachments) ? msg.attachments : [];
      el.attachments.hidden = files.length === 0;
      el.attList.innerHTML = "";
      files.forEach(function (att) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "att";
        b.innerHTML = '<svg><use href="#i-clip"></use></svg><span>' + esc(att.filename || "attachment") + '</span>' +
          (att.size ? "<em>" + Math.max(1, Math.round(att.size / 1024)) + " KB</em>" : "");
        b.addEventListener("click", function () { downloadAttachment(att); });
        el.attList.appendChild(b);
      });

      showReader("message");
    }).catch(function (err) {
      showReader("empty");
      toast(err.message || "Could not open that message", "error");
    });
  }

  function downloadAttachment(att) {
    haptic("medium");
    toast("Downloading " + (att.filename || "attachment") + "…");
    Mail.attachment(att.downloadUrl).then(function (res) {
      if (!res.ok) throw new Error("Download failed (" + res.status + ")");
      return res.blob();
    }).then(function (blob) {
      saveBlob(blob, att.filename || "attachment");
    }).catch(function (err) {
      toast(err.message || "That attachment could not be downloaded", "error");
    });
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function saveEml() {
    var msg = state.current;
    if (!msg) return;
    haptic("medium");
    var headers = (msg.headerLines || []).map(function (h) { return h.line.trim(); }).filter(Boolean);
    var body = msg.text || (Array.isArray(msg.html) ? msg.html.join("") : msg.html) || "";
    var head = headers.length ? headers.join("\r\n")
      : ["From: " + ((msg.from && msg.from.address) || ""),
         "To: " + (msg.to || []).map(function (t) { return t.address; }).join(", "),
         "Subject: " + (msg.subject || ""),
         "Date: " + msg.createdAt].join("\r\n");
    var eml = head + "\r\n\r\n" + String(body).replace(/<[^>]+>/g, " ").replace(/\s+\n/g, "\n");
    saveBlob(new Blob([eml], { type: "message/rfc822" }), "message-" + msg.id + ".eml");
  }

  function copyMessage() {
    var msg = state.current;
    if (!msg) return;
    haptic("success");
    copyText(JSON.stringify(msg, null, 2)).then(function () {
      toast("Message copied as JSON");
    }).catch(function () {
      toast("Copying is blocked in this browser", "error");
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
        resolve();
      } catch (e) { reject(e); }
    });
  }

  /* The inbox itself ---------------------------------------------------- */

  function setAddress(address, domain) {
    el.address.textContent = address;
    el.domainBadge.textContent = "@" + domain;
    el.address.classList.add("is-flash");
    setTimeout(function () { el.address.classList.remove("is-flash"); }, 700);
  }

  function paintExpiry() {
    if (!state.account) return;
    var created = state.account.createdAt || Date.now();
    var left = created + ACCOUNT_DAYS * 86400000 - Date.now();
    if (left <= 0) { el.expiryText.textContent = "Expiring now"; return; }
    var days = Math.floor(left / 86400000);
    var hours = Math.floor((left % 86400000) / 3600000);
    var mins = Math.floor((left % 3600000) / 60000);
    el.expiryText.textContent = "About " + (days > 0 ? days + "d " + hours + "h" : (hours > 0 ? hours + "h " + mins + "m" : mins + "m")) + " left";
  }

  function adopt(account, token) {
    state.account = account;
    state.token = token;
    state.readIds = readIdsFor(account.address);
    state.selectedId = null;
    state.messages = [];
    state.current = null;
    // The next read is this inbox's first, so it should not announce itself.
    state.loaded = false;
    writeStore(KEY_SESSION, account);
    remember(account);
    var domain = account.address.split("@")[1] || "";
    setAddress(account.address, domain);
    paintExpiry();
    showReader("empty");
  }

  function createRandom() {
    if (!state.domains.length) return Promise.reject(new Error("No temporary-mail domain is available"));
    el.address.textContent = "Creating your inbox…";
    status("busy", "Creating inbox");

    var attempt = function (n) {
      var domain = state.domains[Math.floor(Math.random() * state.domains.length)].domain;
      var address = randomString(10) + "@" + domain;
      var password = randomString(20);
      return Mail.create(address, password).then(function (account) {
        return Mail.token(address, password).then(function (token) {
          adopt({ address: address, password: password, id: account.id, createdAt: Date.now() }, token);
          return true;
        });
      }).catch(function (err) {
        if (n > 1 && /exist|already|taken|duplicate|invalid/i.test(err.message || "")) return attempt(n - 1);
        throw err;
      });
    };

    return attempt(5);
  }

  function restore(account) {
    return Mail.token(account.address, account.password).then(function (token) {
      adopt(account, token);
      return true;
    });
  }

  function refresh(silent) {
    if (!state.token) return Promise.resolve();
    if (!silent) {
      status("busy", "Checking for mail");
      el.refreshIcon.classList.add("spin");
    }
    var first = !state.loaded;
    var before = state.messages.map(function (m) { return m.id; }).join(",");

    return Mail.messages().then(function (messages) {
      state.messages = messages;
      var after = messages.map(function (m) { return m.id; }).join(",");
      state.loaded = true;
      renderMessages();
      paintTitle();
      status("ok", messages.length ? "Connected" : "Listening");
      if (!first && after !== before && messages.length) {
        var newest = messages[0];
        if (!state.readIds[newest.id] && !newest.seen) {
          toast("New mail from " + ((newest.from && (newest.from.name || newest.from.address)) || "someone"));
          beep();
        }
      }
      return messages;
    }).catch(function (err) {
      status("down", "Disconnected");
      if (!silent) toast(err.message || "Could not read the inbox", "error");
      throw err;
    }).then(function (v) {
      if (!silent) el.refreshIcon.classList.remove("spin");
      return v;
    }, function (e) {
      if (!silent) el.refreshIcon.classList.remove("spin");
      throw e;
    });
  }

  function startTimer() {
    clearTimeout(state.timer);
    if (!state.interval) return;
    state.timer = setTimeout(tick, state.interval);
  }

  function tick() {
    if (document.hidden) { startTimer(); return; }
    refresh(true).catch(function () {}).then(startTimer);
  }

  function boot() {
    showListState("loading");
    showReader("empty");
    status("busy", "Connecting");

    Mail.domains().then(function (domains) {
      state.domains = domains;
      if (!domains.length) throw new Error("No temporary-mail domain is available right now");
      el.customDomain.innerHTML = domains.map(function (d) {
        return '<option value="' + esc(d.domain) + '">@' + esc(d.domain) + "</option>";
      }).join("");

      var saved = readStore(KEY_SESSION, null);
      var start = saved && saved.address && saved.password
        ? restore(saved).catch(function () {
            dropStore(KEY_SESSION);
            return createRandom();
          })
        : createRandom();

      return start.then(function () {
        state.booted = true;
        return refresh(true).catch(function () {});
      }).then(function () {
        status("ok", "Listening");
        startTimer();
      });
    }).catch(function (err) {
      status("down", "Disconnected");
      el.address.textContent = "No inbox yet";
      el.domainBadge.textContent = "@—";
      el.expiryText.textContent = "—";
      el.errorText.textContent = /fetch|load|network|failed/i.test(err.message || "")
        ? "The mail service could not be reached. Check your connection, or a content blocker may be blocking it."
        : err.message;
      showListState("error");
      toast("Could not open an inbox", "error");
      throw err;
    });
  }

  /* Modals -------------------------------------------------------------- */

  function openModal(node) {
    node.hidden = false;
    var focusable = node.querySelector("input, select, button:not([data-close])");
    if (focusable) setTimeout(function () { focusable.focus(); }, 40);
  }

  function closeModal(node) { node.hidden = true; }

  function renderSaved() {
    var list = readStore(KEY_SAVED, []) || [];
    el.savedCount.textContent = list.length;
    el.savedList.innerHTML = "";
    if (!list.length) {
      el.savedList.innerHTML = '<li class="s-empty">No inboxes are kept in this browser yet.</li>';
      return;
    }
    list.forEach(function (item) {
      var li = document.createElement("li");
      var current = state.account && state.account.address === item.address;
      li.innerHTML = '<span class="s-main"><span class="s-addr">' + esc(item.address) +
        '</span><span class="s-when">' + (current ? "in use now" : timeAgo(new Date(item.createdAt).toISOString())) +
        "</span></span>";
      var use = document.createElement("button");
      use.type = "button";
      use.className = "btn btn-quiet";
      use.textContent = current ? "Reload" : "Use";
      use.addEventListener("click", function () { switchInbox(item); });
      var drop = document.createElement("button");
      drop.type = "button";
      drop.className = "tool danger";
      drop.setAttribute("aria-label", "Forget " + item.address);
      drop.innerHTML = '<svg><use href="#i-trash"></use></svg>';
      drop.addEventListener("click", function () { forget(item.address); });
      li.appendChild(use);
      li.appendChild(drop);
      el.savedList.appendChild(li);
    });
  }

  function switchInbox(item) {
    haptic("light");
    status("busy", "Opening " + item.address);
    restore(item).then(function () {
      closeModal(el.savedModal);
      showListState("loading");
      return refresh(true);
    }).then(function () {
      status("ok", "Listening");
      toast("Switched to " + item.address);
    }).catch(function (err) {
      status("down", "Disconnected");
      forget(item.address);
      toast(/expired|invalid|401/i.test(err.message || "") ? "That inbox has expired — it has been forgotten" : (err.message || "Could not open that inbox"), "error");
    });
  }

  /* The ad network ------------------------------------------------------ */

  function syncAd() {
    var accepted = state.consent === "accepted";
    var existing = document.getElementById(AD_SCRIPT_ID);
    document.documentElement.classList.toggle("has-consent", accepted);
    el.adNote.hidden = accepted;

    if (accepted) {
      if (existing) return;
      window.atOptions = { key: AD_KEY, format: "iframe", height: AD_HEIGHT, width: AD_WIDTH, params: {} };
      var script = document.createElement("script");
      script.id = AD_SCRIPT_ID;
      script.async = true;
      script.src = AD_SCRIPT_URL;
      el.adSlot.appendChild(script);
    } else if (existing) {
      existing.remove();
      el.adSlot.replaceChildren();
      try { delete window.atOptions; } catch (e) { window.atOptions = undefined; }
    }
  }

  function setConsent(choice) {
    state.consent = choice;
    try { localStorage.setItem(KEY_CONSENT, choice); } catch (e) { /* no-op */ }
    el.consent.hidden = true;
    syncAd();
    toast(choice === "accepted" ? "Thank you — ads are on" : "Ads stay off");
  }

  function initConsent() {
    var stored = null;
    try { stored = localStorage.getItem(KEY_CONSENT); } catch (e) { /* no-op */ }
    state.consent = stored === "accepted" || stored === "denied" ? stored : null;
    el.consent.hidden = state.consent !== null;
    syncAd();
  }

  /* Theme --------------------------------------------------------------- */

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    el.themeBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    try { localStorage.setItem(KEY_THEME, theme); } catch (e) { /* no-op */ }
  }

  /* QR ------------------------------------------------------------------ */

  function loadQr() {
    return new Promise(function (resolve, reject) {
      if (window.qrcode) { resolve(); return; }
      var s = document.createElement("script");
      s.src = QR_SRC;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("The QR library could not be loaded")); };
      document.head.appendChild(s);
    });
  }

  function showQr() {
    if (!state.account) return;
    haptic("light");
    el.qrAddress.textContent = state.account.address;
    el.qrHolder.innerHTML = '<span class="qr-error">Building the code…</span>';
    openModal(el.qrModal);
    loadQr().then(function () {
      var qr = window.qrcode(0, "L");
      qr.addData("mailto:" + state.account.address);
      qr.make();
      el.qrHolder.innerHTML = qr.createImgTag(4, 8);
      var img = el.qrHolder.querySelector("img");
      if (img) img.alt = "QR code for " + state.account.address;
    }).catch(function () {
      el.qrHolder.innerHTML = '<span class="qr-error">The QR code could not be generated here — the address is above.</span>';
    });
  }

  /* Wire it up ---------------------------------------------------------- */

  function bind() {
    el.btnCopy.addEventListener("click", function () {
      if (!state.account) return;
      haptic("success");
      copyText(state.account.address).then(function () { toast("Address copied"); })
        .catch(function () { toast("Copying is blocked — select the address instead", "error"); });
    });

    el.btnRefresh.addEventListener("click", function () {
      haptic("light");
      refresh(false).then(function () { toast("Inbox up to date"); }).catch(function () {});
    });

    el.btnRetry.addEventListener("click", function () {
      haptic("light");
      showListState("loading");
      boot().catch(function () {});
    });

    el.btnNew.addEventListener("click", function () {
      if (!window.confirm("Start a fresh inbox? The address you have now stays in “My inboxes”, but this page's messages go away.")) return;
      haptic("medium");
      showListState("loading");
      showReader("empty");
      createRandom().then(function () {
        return refresh(true);
      }).then(function () {
        status("ok", "Listening");
        toast("Fresh inbox ready");
      }).catch(function (err) {
        showListState("error");
        el.errorText.textContent = err.message || "Could not create a new inbox";
        toast("Could not create a new inbox", "error");
      });
    });

    el.btnCustom.addEventListener("click", function () { haptic("light"); openModal(el.customModal); });
    el.btnSaved.addEventListener("click", function () { haptic("light"); renderSaved(); openModal(el.savedModal); });
    el.btnQr.addEventListener("click", showQr);

    el.customForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var user = el.customUser.value.trim().toLowerCase();
      var domain = el.customDomain.value;
      var password = el.customPass.value;
      if (!user || !domain || password.length < 6) {
        toast("Check the address and use a password of at least 6 characters", "error");
        return;
      }
      var address = user + "@" + domain;
      el.customSubmit.disabled = true;
      Mail.create(address, password).then(function (account) {
        return Mail.token(address, password).then(function (token) {
          adopt({ address: address, password: password, id: account.id, createdAt: Date.now() }, token);
        });
      }).then(function () {
        closeModal(el.customModal);
        el.customForm.reset();
        showListState("loading");
        return refresh(true);
      }).then(function () {
        status("ok", "Listening");
        toast("Inbox ready: " + address);
      }).catch(function (err) {
        toast(err.message || "That address is not available", "error");
      }).then(function () {
        el.customSubmit.disabled = false;
      });
    });

    el.btnRaw.addEventListener("click", function () {
      haptic("light");
      var open = !el.rawPanel.hidden;
      el.rawPanel.hidden = open;
      el.btnRaw.classList.toggle("is-on", !open);
    });

    el.btnSave.addEventListener("click", saveEml);
    el.btnCopyMsg.addEventListener("click", copyMessage);

    el.btnDelete.addEventListener("click", function () {
      if (!state.selectedId || !window.confirm("Delete this message for good?")) return;
      haptic("warning");
      Mail.remove(state.selectedId).then(function () {
        state.messages = state.messages.filter(function (m) { return m.id !== state.selectedId; });
        state.selectedId = null;
        state.current = null;
        showReader("empty");
        renderMessages();
        paintTitle();
        toast("Message deleted");
      }).catch(function (err) { toast(err.message || "Could not delete that message", "error"); });
    });

    el.btnBack.addEventListener("click", function () {
      haptic("light");
      state.selectedId = null;
      showReader("empty");
      selectInList(null);
    });

    el.search.addEventListener("input", function () {
      state.filter = el.search.value.trim();
      renderMessages();
    });

    el.unreadOnly.addEventListener("change", function () {
      state.unreadOnly = el.unreadOnly.checked;
      renderMessages();
    });

    el.intervalSelect.addEventListener("change", function () {
      state.interval = parseInt(el.intervalSelect.value, 10) || 0;
      startTimer();
      toast(state.interval ? "Auto-refresh every " + state.interval / 1000 + "s" : "Auto-refresh off");
    });

    el.btnSound.addEventListener("click", function () {
      state.sound = !state.sound;
      writeStore(KEY_SOUND, state.sound);
      el.btnSound.setAttribute("aria-pressed", state.sound ? "false" : "true");
      el.btnSound.querySelector(".when-on").hidden = !state.sound;
      el.btnSound.querySelector(".when-off").hidden = state.sound;
      toast(state.sound ? "New-mail sound on" : "New-mail sound off");
    });

    el.themeBtn.addEventListener("click", function () {
      setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });

    el.btnAccept.addEventListener("click", function () { haptic("light"); setConsent("accepted"); });
    el.btnDeny.addEventListener("click", function () { haptic("light"); setConsent("denied"); });

    document.querySelectorAll("[data-close]").forEach(function (button) {
      button.addEventListener("click", function () { closeModal(button.closest(".modal")); });
    });

    document.querySelectorAll(".modal").forEach(function (modal) {
      modal.addEventListener("click", function (event) { if (event.target === modal) closeModal(modal); });
    });

    document.addEventListener("keydown", function (event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") {
        var open = document.querySelector(".modal:not([hidden])");
        if (open) { closeModal(open); return; }
        if (state.selectedId) { state.selectedId = null; showReader("empty"); selectInList(null); }
        return;
      }
      var typing = /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName);
      if (typing && event.key !== "/") return;

      var key = event.key.toLowerCase();
      if (key === "/") { event.preventDefault(); el.search.focus(); return; }
      if (key === "c") { el.btnCopy.click(); return; }
      if (key === "r") { el.btnRefresh.click(); return; }
      if (key === "n") { el.btnNew.click(); return; }
      if (key === "j" || key === "k") {
        var nodes = Array.prototype.slice.call(el.msgList.querySelectorAll(".msg"));
        if (!nodes.length) return;
        var index = nodes.findIndex(function (n) { return n.getAttribute("data-id") === state.selectedId; });
        var next = key === "j" ? Math.min(nodes.length - 1, index + 1) : Math.max(0, index - 1);
        if (index === -1) next = 0;
        event.preventDefault();
        openMessage(nodes[next].getAttribute("data-id"));
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.booted) {
        refresh(true).catch(function () {});
        startTimer();
      }
    });
  }

  function restorePreferences() {
    var theme = document.documentElement.getAttribute("data-theme");
    setTheme(theme === "light" ? "light" : "dark");

    var sound = readStore(KEY_SOUND, true);
    state.sound = sound !== false;
    el.btnSound.setAttribute("aria-pressed", state.sound ? "false" : "true");
    el.btnSound.querySelector(".when-on").hidden = !state.sound;
    el.btnSound.querySelector(".when-off").hidden = state.sound;

    state.interval = 10000;
  }

  function start() {
    restorePreferences();
    initConsent();
    bind();
    renderSaved();
    paintExpiry();
    boot().catch(function () {});
    setInterval(paintExpiry, 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
