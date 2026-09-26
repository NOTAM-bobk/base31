(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Config
     ------------------------------------------------------------------ */
  var THEME_KEY = "qr:theme";
  var RECENT_KEY = "qr:recent";
  var MAX_RECENT = 6;
  var FG_PRESETS = ["#0a0a0a", "#111827", "#1e3a8a", "#065f46", "#7c2d12", "#4c1d95", "#831843", "#0e7490"];

  var TYPE_LABELS = { url: "link", text: "text", wifi: "wifi", vcard: "contact", email: "email", sms: "sms", phone: "phone" };
  var TYPE_FIELDS = {
    url: ["fUrl"], text: ["fText"], wifi: ["fWifiSsid", "fWifiPass", "fWifiEnc", "fWifiHidden"],
    vcard: ["fFirstName", "fLastName", "fOrg", "fTitle", "fVPhone", "fVEmail", "fVUrl"],
    email: ["fMailTo", "fMailSubject", "fMailBody"], sms: ["fSmsTo", "fSmsBody"], phone: ["fPhone"]
  };

  // Encode text as UTF-8 so accented characters, emoji and CJK all work.
  if (typeof qrcode !== "undefined" && typeof TextEncoder !== "undefined") {
    qrcode.stringToBytes = function (s) { return Array.prototype.slice.call(new TextEncoder().encode(s)); };
  }

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("qrCanvas");
  var empty = $("qrEmpty");
  var warnBox = $("warnBox");
  var warnText = $("warnText");

  var state = { type: "url", logoDataUrl: null, logoName: "", value: "", modules: 0, version: 0, bytes: 0 };

  /* ------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function wifiEsc(s) { return String(s || "").replace(/([\\;,:"])/g, "\\$1"); }
  function cleanHex(v, fallback) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || "").trim()) ? String(v).trim() : fallback;
  }
  function timeAgo(ts) {
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.round(s / 60) + "m ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago";
    return Math.round(s / 86400) + "d ago";
  }
  function bytesOf(s) {
    try { return new TextEncoder().encode(s).length; }
    catch (e) { return unescape(encodeURIComponent(s)).length; }
  }
  function hexToRgb(hex) {
    var h = cleanHex(hex, "#000000").slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function relLum(rgb) {
    var a = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(fg, bg) {
    var l1 = relLum(hexToRgb(fg)), l2 = relLum(hexToRgb(bg));
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ------------------------------------------------------------------
     Theme
     ------------------------------------------------------------------ */
  var themeBtn = $("themeBtn");
  function renderThemeIcon() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    themeBtn.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>';
    themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  themeBtn.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    renderThemeIcon();
  });
  renderThemeIcon();

  /* ------------------------------------------------------------------
     Payload builders
     ------------------------------------------------------------------ */
  function normalizeUrl(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
      if (/^\/\//.test(s)) s = "https:" + s;
      else s = "https://" + s;
    }
    return s;
  }
  function buildPayload() {
    switch (state.type) {
      case "url":
        return normalizeUrl($("fUrl").value);
      case "text":
        return $("fText").value;
      case "wifi": {
        var ssid = $("fWifiSsid").value;
        if (!ssid) return "";
        var enc = $("fWifiEnc").value;
        var out = "WIFI:T:" + (enc === "nopass" ? "nopass" : enc) + ";S:" + wifiEsc(ssid) + ";";
        if (enc !== "nopass" && $("fWifiPass").value) out += "P:" + wifiEsc($("fWifiPass").value) + ";";
        if ($("fWifiHidden").value === "true") out += "H:true;";
        return out + ";";
      }
      case "vcard": {
        var fn = $("fFirstName").value.trim(), ln = $("fLastName").value.trim();
        var full = (fn + " " + ln).trim();
        if (!full && !$("fVPhone").value && !$("fVEmail").value) return "";
        var lines = ["BEGIN:VCARD", "VERSION:3.0", "N:" + vcEsc(ln) + ";" + vcEsc(fn) + ";;;", "FN:" + vcEsc(full)];
        if ($("fOrg").value) lines.push("ORG:" + vcEsc($("fOrg").value));
        if ($("fTitle").value) lines.push("TITLE:" + vcEsc($("fTitle").value));
        if ($("fVPhone").value) lines.push("TEL;TYPE=CELL:" + vcEsc($("fVPhone").value));
        if ($("fVEmail").value) lines.push("EMAIL:" + vcEsc($("fVEmail").value));
        if ($("fVUrl").value) lines.push("URL:" + vcEsc(normalizeUrl($("fVUrl").value)));
        lines.push("END:VCARD");
        return lines.join("\n");
      }
      case "email": {
        var to = $("fMailTo").value.trim();
        if (!to) return "";
        var q = [];
        if ($("fMailSubject").value) q.push("subject=" + encodeURIComponent($("fMailSubject").value));
        if ($("fMailBody").value) q.push("body=" + encodeURIComponent($("fMailBody").value));
        return "mailto:" + encodeURIComponent(to) + (q.length ? "?" + q.join("&") : "");
      }
      case "sms": {
        var num = $("fSmsTo").value.trim();
        if (!num) return "";
        var body = $("fSmsBody").value;
        return "SMSTO:" + num + (body ? ":" + body : "");
      }
      case "phone": {
        var p = $("fPhone").value.trim();
        return p ? "tel:" + p : "";
      }
    }
    return "";
  }
  function vcEsc(s) { return String(s || "").replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n"); }

  function recentLabel() {
    switch (state.type) {
      case "url": return normalizeUrl($("fUrl").value);
      case "text": return $("fText").value.trim().slice(0, 60);
      case "wifi": return $("fWifiSsid").value ? "Wi-Fi: " + $("fWifiSsid").value : "";
      case "vcard": return (($("fFirstName").value + " " + $("fLastName").value).trim()) || $("fVPhone").value || $("fVEmail").value || "";
      case "email": return $("fMailTo").value.trim();
      case "sms": return $("fSmsTo").value.trim();
      case "phone": return $("fPhone").value.trim();
    }
    return "";
  }

  /* ------------------------------------------------------------------
     Options
     ------------------------------------------------------------------ */
  function opts() {
    var transparent = $("fTransparent").checked;
    return {
      quiet: Math.max(0, Math.min(8, parseInt($("fQuiet").value, 10) || 0)),
      fg: cleanHex($("fFg").value, "#0a0a0a"),
      bg: cleanHex($("fBg").value, "#ffffff"),
      transparent: transparent,
      style: $("fStyle").value,
      ecc: state.logoDataUrl ? "H" : $("fEcc").value,
      logo: state.logoDataUrl,
      caption: $("fCaptionOn").checked ? ($("fCaption").value.trim() || "Scan me") : ""
    };
  }

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */
  function drawQR(ctx, o, px) {
    var total = state.modules + o.quiet * 2;
    var cell = px / total;
    var r, c;
    ctx.fillStyle = o.fg;
    for (r = 0; r < state.modules; r++) {
      for (c = 0; c < state.modules; c++) {
        if (!qr.isDark(r, c)) continue;
        var x = (c + o.quiet) * cell, y = (r + o.quiet) * cell;
        if (o.style === "dots") {
          ctx.beginPath();
          ctx.arc(x + cell / 2, y + cell / 2, cell * 0.48, 0, Math.PI * 2);
          ctx.fill();
        } else if (o.style === "rounded") {
          roundRect(ctx, x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.3);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
        }
      }
    }
    if (o.logo) {
      var plate = px * 0.24, img = px * 0.2;
      ctx.fillStyle = o.transparent ? "#ffffff" : o.bg;
      roundRect(ctx, px / 2 - plate / 2, px / 2 - plate / 2, plate, plate, plate * 0.2);
      ctx.fill();
      if (logoImg && logoImg.complete) {
        ctx.drawImage(logoImg, px / 2 - img / 2, px / 2 - img / 2, img, img);
      }
    }
  }

  function drawCanvas(o) {
    var px = 320;
    var band = o.caption ? 46 : 0;
    var ctx = canvas.getContext("2d");
    canvas.width = px;
    canvas.height = px + band;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!o.transparent) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, px, px); }
    drawQR(ctx, o, px);
    if (o.caption) {
      ctx.fillStyle = o.fg;
      ctx.font = "600 20px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(o.caption, px / 2, px + band / 2, px * 0.92);
    }
  }

  function buildSvg(o) {
    var px = 1024;
    var total = state.modules + o.quiet * 2;
    var cell = px / total;
    var p = [];
    for (var r = 0; r < state.modules; r++) {
      for (var c = 0; c < state.modules; c++) {
        if (!qr.isDark(r, c)) continue;
        var x = (c + o.quiet) * cell, y = (r + o.quiet) * cell;
        if (o.style === "dots") {
          p.push('<circle cx="' + (x + cell / 2).toFixed(2) + '" cy="' + (y + cell / 2).toFixed(2) + '" r="' + (cell * 0.48).toFixed(2) + '"/>');
        } else if (o.style === "rounded") {
          p.push('<rect x="' + (x + cell * 0.06).toFixed(2) + '" y="' + (y + cell * 0.06).toFixed(2) + '" width="' + (cell * 0.88).toFixed(2) + '" height="' + (cell * 0.88).toFixed(2) + '" rx="' + (cell * 0.3).toFixed(2) + '"/>');
        } else {
          p.push('<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + cell.toFixed(2) + '" height="' + cell.toFixed(2) + '"/>');
        }
      }
    }
    var band = o.caption ? 56 : 0;
    var h = px + band;
    var out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + h + '" viewBox="0 0 ' + px + " " + h + '" role="img" aria-label="QR code">';
    if (!o.transparent) out += '<rect width="' + px + '" height="' + h + '" fill="' + o.bg + '"/>';
    out += '<g fill="' + o.fg + '">' + p.join("") + "</g>";
    if (o.logo) {
      var plate = px * 0.24, img = px * 0.2;
      out += '<rect x="' + ((px - plate) / 2).toFixed(2) + '" y="' + ((px - plate) / 2).toFixed(2) + '" width="' + plate.toFixed(2) + '" height="' + plate.toFixed(2) + '" rx="' + (plate * 0.2).toFixed(2) + '" fill="' + (o.transparent ? "#ffffff" : o.bg) + '"/>';
      out += '<image href="' + o.logo + '" x="' + ((px - img) / 2).toFixed(2) + '" y="' + ((px - img) / 2).toFixed(2) + '" width="' + img.toFixed(2) + '" height="' + img.toFixed(2) + '" preserveAspectRatio="xMidYMid meet"/>';
    }
    if (o.caption) {
      out += '<text x="' + px / 2 + '" y="' + (px + band / 2 + 6) + '" text-anchor="middle" font-family="Inter, sans-serif" font-size="30" font-weight="600" fill="' + o.fg + '">' + esc(o.caption) + "</text>";
    }
    return out + "</svg>";
  }

  var qr = null, logoImg = null;

  var ICON_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5h.01"/></svg>';

  function setWarn(msg) {
    if (!msg) { warnBox.hidden = true; return; }
    warnText.textContent = msg;
    warnBox.hidden = false;
  }

  function render(pushRecent) {
    var payload = buildPayload();
    state.value = payload;
    var o = opts();
    $("qrEccBadge").textContent = o.ecc;

    if (!payload) {
      qr = null;
      empty.hidden = false;
      canvas.hidden = true;
      $("pmModules").textContent = "—";
      $("pmVersion").textContent = "—";
      $("pmBytes").textContent = "—";
      setWarn("");
      updateActions(false);
      return;
    }

    try {
      qr = qrcode(0, o.ecc);
      qr.addData(payload);
      qr.make();
    } catch (e) {
      qr = null;
      empty.hidden = false;
      canvas.hidden = true;
      $("pmModules").textContent = "—";
      $("pmVersion").textContent = "—";
      $("pmBytes").textContent = bytesOf(payload) + " B";
      setWarn("That is too much data for a single QR code. Shorten it — a link shortener works well for very long URLs.");
      updateActions(false);
      return;
    }

    state.modules = qr.getModuleCount();
    state.version = (state.modules - 17) / 4;
    state.bytes = bytesOf(payload);

    empty.hidden = true;
    canvas.hidden = false;
    $("pmModules").textContent = state.modules + "\u00d7" + state.modules;
    $("pmVersion").textContent = String(state.version);
    $("pmBytes").textContent = state.bytes + " B";

    drawCanvas(o);
    updateActions(true);

    var warn = "";
    if (state.bytes > 1200) warn = "This payload is large, so the pattern is dense. Prefer a shorter URL for easier scanning.";
    else if (!o.transparent && contrast(o.fg, o.bg) < 3.5) warn = "Low contrast between foreground and background. Darker modules on a lighter background scan far more reliably.";
    setWarn(warn);

    if (pushRecent) rememberRecent(payload);
  }

  function updateActions(enabled) {
    ["dlPng", "dlSvg", "copyImg", "copyData"].forEach(function (id) { $(id).disabled = !enabled; });
  }

  /* ------------------------------------------------------------------
     Export
     ------------------------------------------------------------------ */
  function filename(ext) {
    var base = (recentLabel() || "qr-code").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "qr-code";
    return base + "." + ext;
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  function exportPng() {
    if (!qr) return;
    var o = opts();
    var px = parseInt($("fSize").value, 10) || 1024;
    var band = o.caption ? Math.round(px * 0.11) : 0;
    var off = document.createElement("canvas");
    off.width = px;
    off.height = px + band;
    var ctx = off.getContext("2d");
    if (!o.transparent) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, px, px); }
    drawQR(ctx, o, px);
    if (o.caption) {
      ctx.fillStyle = o.fg;
      ctx.font = "600 " + Math.round(px * 0.062) + "px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(o.caption, px / 2, px + band / 2, px * 0.92);
    }
    off.toBlob(function (blob) { if (blob) download(blob, filename("png")); }, "image/png");
  }
  function exportSvg() {
    if (!qr) return;
    var svg = buildSvg(opts());
    download(new Blob([svg], { type: "image/svg+xml" }), filename("svg"));
  }
  function copyImage() {
    if (!qr || !navigator.clipboard || !window.ClipboardItem) {
      setWarn("Copying images is not supported in this browser. Use Download PNG instead.");
      return;
    }
    var o = opts();
    var px = 1024;
    var off = document.createElement("canvas");
    off.width = px; off.height = px;
    var ctx = off.getContext("2d");
    if (!o.transparent) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, px, px); }
    drawQR(ctx, o, px);
    off.toBlob(function (blob) {
      if (!blob) return;
      navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(function () {
        setWarn("");
        var btn = $("copyImg");
        btn.textContent = "Copied!";
        setTimeout(function () { btn.textContent = "Copy"; }, 1600);
      }).catch(function () { setWarn("The browser blocked clipboard access. Use Download PNG instead."); });
    }, "image/png");
  }
  function copyContent() {
    if (!state.value) return;
    var btn = $("copyData");
    function done() { btn.textContent = "Copied!"; setTimeout(function () { btn.textContent = "Copy content"; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.value).then(done).catch(function () { setWarn("The browser blocked clipboard access."); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = state.value; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  /* ------------------------------------------------------------------
     Recent codes
     ------------------------------------------------------------------ */
  function readRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") || []; } catch (e) { return []; }
  }
  function rememberRecent(payload) {
    var label = recentLabel();
    if (!label) return;
    var items = readRecent().filter(function (it) { return !(it.type === state.type && it.payload === payload); });
    items.unshift({ type: state.type, payload: payload, label: label, ts: Date.now() });
    items = items.slice(0, MAX_RECENT);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(items)); } catch (e) {}
    renderRecent();
  }
  function renderRecent() {
    var items = readRecent();
    var section = $("recentSection"), list = $("recentList");
    if (!items.length) { section.hidden = true; return; }
    section.hidden = false;
    list.innerHTML = items.map(function (it, i) {
      return '<button class="recent-item" type="button" data-i="' + i + '">' +
        '<span class="tag">' + esc(TYPE_LABELS[it.type] || it.type) + "</span>" +
        '<span class="rtext">' + esc(it.label) + "</span>" +
        '<span class="rt">' + esc(timeAgo(it.ts)) + "</span>" +
        "</button>";
    }).join("");
  }
  $("recentList").addEventListener("click", function (e) {
    var btn = e.target.closest(".recent-item");
    if (!btn) return;
    var item = readRecent()[parseInt(btn.getAttribute("data-i"), 10)];
    if (!item) return;
    selectTab(item.type);
    var f = $(TYPE_FIELDS[item.type][0]);
    if (f) f.value = item.payload;
    render(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("clearRecent").addEventListener("click", function () {
    try { localStorage.removeItem(RECENT_KEY); } catch (e) {}
    renderRecent();
  });

  /* ------------------------------------------------------------------
     Tabs & events
     ------------------------------------------------------------------ */
  function selectTab(type) {
    state.type = type;
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-type") === type ? "true" : "false");
    });
    Array.prototype.forEach.call(document.querySelectorAll(".panel"), function (p) {
      p.hidden = p.getAttribute("data-panel") !== type;
    });
    render(false);
  }

  document.querySelector(".tabs").addEventListener("click", function (e) {
    var tab = e.target.closest(".tab");
    if (tab) selectTab(tab.getAttribute("data-type"));
  });

  var raf = null;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = null; render(false); });
  }

  var inputs = document.querySelectorAll(".card-body input, .card-body textarea, .card-body select");
  Array.prototype.forEach.call(inputs, function (el) {
    el.addEventListener("input", function () {
      if (el === $("fFg")) { $("fFgHex").value = el.value; }
      if (el === $("fBg")) { $("fBgHex").value = el.value; }
      if (el === $("fQuiet")) { $("quietVal").textContent = el.value; }
      if (el === $("fCaptionOn")) { $("captionField").hidden = !el.checked; }
      schedule();
    });
    el.addEventListener("change", schedule);
  });
  $("fFgHex").addEventListener("change", function () { $("fFg").value = cleanHex($("fFgHex").value, "#0a0a0a"); $("fFgHex").value = $("fFg").value; render(false); });
  $("fBgHex").addEventListener("change", function () { $("fBg").value = cleanHex($("fBgHex").value, "#ffffff"); $("fBgHex").value = $("fBg").value; render(false); });

  // Foreground presets.
  $("fgSwatches").innerHTML = FG_PRESETS.map(function (c) {
    return '<button class="swatch" type="button" title="' + c + '" data-c="' + c + '" style="background:' + c + '"></button>';
  }).join("");
  $("fgSwatches").addEventListener("click", function (e) {
    var s = e.target.closest(".swatch");
    if (!s) return;
    var c = s.getAttribute("data-c");
    $("fFg").value = c; $("fFgHex").value = c;
    render(false);
  });

  // Logo upload.
  $("fLogo").addEventListener("change", function () {
    var file = this.files && this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      state.logoDataUrl = reader.result;
      state.logoName = file.name;
      logoImg = new Image();
      logoImg.onload = function () {
        var bumped = false;
        if (!$("fEcc").dataset.touched && $("fEcc").value !== "H") { $("fEcc").value = "H"; bumped = true; }
        $("clearLogo").hidden = false;
        render(false);
        if (bumped) setWarn("Error correction was raised to H so the code still scans with a logo over it.");
      };
      logoImg.onerror = function () { setWarn("That image could not be read. Try a PNG or an SVG."); };
      logoImg.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  $("clearLogo").addEventListener("click", function () {
    state.logoDataUrl = null;
    logoImg = null;
    $("fLogo").value = "";
    this.hidden = true;
    render(false);
  });
  $("fEcc").addEventListener("change", function () { this.dataset.touched = "1"; });

  // Actions.
  $("dlPng").addEventListener("click", exportPng);
  $("dlSvg").addEventListener("click", exportSvg);
  $("copyImg").addEventListener("click", copyImage);
  $("copyData").addEventListener("click", copyContent);

  // Keyboard shortcut: "/" focuses the first field of the active panel.
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      var f = $(TYPE_FIELDS[state.type][0]);
      if (f) { e.preventDefault(); f.focus(); }
    }
  });

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  if (typeof qrcode === "undefined") {
    setWarn("The QR engine could not load. Check your connection and reload the page.");
    updateActions(false);
    empty.hidden = false;
    canvas.hidden = true;
  } else {
    renderRecent();
    render(false);
  }
})();
