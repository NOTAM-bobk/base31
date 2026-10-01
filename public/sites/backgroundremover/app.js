/* ============================================================
   Background Remover — everything happens in this file, in the
   browser. The image is read with createImageBitmap, edited on a
   canvas, and re-encoded locally, so no photograph is ever
   uploaded. Background detection samples the colours along the
   image edges, then clears the connected pixels that match that
   backdrop. A click-to-erase tool cleans up whatever is left.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    themeBtn: $("themeBtn"),
    dz: $("dz"),
    fileInput: $("fileInput"),
    pickBtn: $("pickBtn"),
    studio: $("studio"),
    boardShell: $("boardShell"),
    boardWrap: $("boardWrap"),
    board: $("board"),
    sizeBadge: $("sizeBadge"),
    status: $("status"),
    removeBtn: $("removeBtn"),
    magicBtn: $("magicBtn"),
    undoBtn: $("undoBtn"),
    resetBtn: $("resetBtn"),
    softBtn: $("softenBtn"),
    tolerance: $("tolerance"),
    toleranceOut: $("toleranceOut"),
    softness: $("softness"),
    softnessOut: $("softnessOut"),
    bgButtons: Array.prototype.slice.call(document.querySelectorAll("[data-bg]")),
    colorFields: $("colorFields"),
    swatches: Array.prototype.slice.call(document.querySelectorAll(".swatch")),
    bg1: $("bg1"),
    bg2: $("bg2"),
    bg1Label: $("bg1Label"),
    shadow: $("shadow"),
    padding: $("padding"),
    paddingOut: $("paddingOut"),
    trimBtn: $("trimBtn"),
    format: $("format"),
    quality: $("quality"),
    qualityOut: $("qualityOut"),
    downloadBtn: $("downloadBtn"),
    copyBtn: $("copyBtn"),
  };

  var ctx = els.board.getContext("2d", { willReadFrequently: true });
  // Working size cap: beyond this, decode and per-pixel passes get slow on
  // phones and the undo snapshots get heavy, so large photos are downscaled.
  var MAX_DIM = 3600;

  var state = {
    ready: false,
    original: null,
    bg: "transparent",
    color: "#eef4ff",
    color2: "#22d3ee",
    shadow: false,
    padding: 0,
    softness: 1,
    quality: 92,
    magic: false,
  };
  var history = [];
  var busy = false;

  /* ---------- small helpers ---------- */

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.className = "status" + (kind ? " is-" + kind : "");
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function toleranceValue() {
    // 6..100 on the slider becomes a forgiving RGB distance.
    return 10 + (Number(els.tolerance.value) / 100) * 118;
  }

  function updateRangeOutputs() {
    els.toleranceOut.textContent = els.tolerance.value;
    els.softnessOut.textContent = els.softness.value + " px";
    els.paddingOut.textContent = els.padding.value + "%";
    els.qualityOut.textContent = els.quality.value;
  }

  function themeButton() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    els.themeBtn.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z"/></svg>';
    els.themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  els.themeBtn.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("bgremover:theme", next); } catch (e) {}
    themeButton();
  });

  /* ---------- loading an image ---------- */

  function loadBitmap(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file).catch(function () { return loadViaImage(file); });
    }
    return loadViaImage(file);
  }
  function loadViaImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("That file could not be read as an image.")); };
      img.src = URL.createObjectURL(file);
    });
  }

  function acceptFile(file) {
    if (!file || busy) return;
    if (!/^image\//.test(file.type)) { setStatus("That file is not an image — try a PNG, JPEG or WebP.", "error"); return; }
    busy = true;
    setStatus("Reading your image…");
    loadBitmap(file).then(function (bitmap) {
      var width = bitmap.width || bitmap.naturalWidth;
      var height = bitmap.height || bitmap.naturalHeight;
      var scale = Math.min(1, MAX_DIM / Math.max(width, height));
      els.board.width = Math.max(1, Math.round(width * scale));
      els.board.height = Math.max(1, Math.round(height * scale));
      ctx.clearRect(0, 0, els.board.width, els.board.height);
      ctx.drawImage(bitmap, 0, 0, els.board.width, els.board.height);
      state.original = bitmap;
      state.ready = true;
      history = [];
      els.dz.hidden = true;
      els.studio.classList.add("is-active");
      els.sizeBadge.hidden = false;
      els.sizeBadge.textContent = els.board.width + " × " + els.board.height;
      paintBackgroundState();
      syncBoardChrome();
      setStatus("Ready. Press “Remove background” to clear the backdrop.", "ok");
    }).catch(function (error) {
      setStatus(error instanceof Error ? error.message : "That image could not be opened.", "error");
    }).then(function () {
      busy = false;
      els.fileInput.value = "";
    });
  }

  /* ---------- background detection ---------- */

  // A small palette of the colours that dominate the image border. Sampling a
  // few clusters instead of one average lets a gently graded backdrop clear
  // without dragging the subject with it.
  function borderPalette(data, w, h) {
    var counts = new Map();
    var total = 0;
    function add(p) {
      if (data[p + 3] < 16) return;
      var key = (data[p] >> 4 << 8) | (data[p + 1] >> 4 << 4) | (data[p + 2] >> 4);
      counts.set(key, (counts.get(key) || 0) + 1);
      total++;
    }
    var x, y;
    for (x = 0; x < w; x++) { add((0 * w + x) * 4); add(((h - 1) * w + x) * 4); }
    for (y = 0; y < h; y++) { add((y * w + 0) * 4); add((y * w + (w - 1)) * 4); }
    var sorted = Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; });
    var palette = [];
    var covered = 0;
    for (var i = 0; i < sorted.length; i++) {
      var key = sorted[i][0];
      palette.push([((key >> 8) & 15) * 17, ((key >> 4) & 15) * 17, (key & 15) * 17]);
      covered += sorted[i][1];
      if (palette.length >= 4 || covered / total > 0.62) break;
    }
    return palette;
  }

  function matchesPalette(data, p, palette, tol) {
    var r = data[p], g = data[p + 1], b = data[p + 2];
    var t2 = tol * tol;
    for (var i = 0; i < palette.length; i++) {
      var dr = r - palette[i][0], dg = g - palette[i][1], db = b - palette[i][2];
      if (dr * dr + dg * dg + db * db <= t2) return true;
    }
    return false;
  }

  // Iterative flood fill. `accept(p)` decides whether a pixel belongs to the
  // region; matched pixels get their alpha cleared. A Uint32Array stack is used
  // so a full-image region cannot blow the JS call stack or heap.
  function floodClear(data, w, h, seeds, accept) {
    var visited = new Uint8Array(w * h);
    var stack = new Uint32Array(w * h);
    var sp = 0;
    function seed(x, y) {
      var idx = y * w + x;
      if (visited[idx]) return;
      var p = idx * 4;
      if (data[p + 3] === 0 || !accept(data, p)) return;
      visited[idx] = 1;
      stack[sp++] = idx;
    }
    for (var i = 0; i < seeds.length; i++) seed(seeds[i][0], seeds[i][1]);
    while (sp > 0) {
      var idx = stack[--sp];
      var x = idx % w, y = (idx / w) | 0;
      data[idx * 4 + 3] = 0;
      if (x + 1 < w && !visited[idx + 1] && data[(idx + 1) * 4 + 3] !== 0 && accept(data, (idx + 1) * 4)) { visited[idx + 1] = 1; stack[sp++] = idx + 1; }
      if (x > 0 && !visited[idx - 1] && data[(idx - 1) * 4 + 3] !== 0 && accept(data, (idx - 1) * 4)) { visited[idx - 1] = 1; stack[sp++] = idx - 1; }
      if (y + 1 < h && !visited[idx + w] && data[(idx + w) * 4 + 3] !== 0 && accept(data, (idx + w) * 4)) { visited[idx + w] = 1; stack[sp++] = idx + w; }
      if (y > 0 && !visited[idx - w] && data[(idx - w) * 4 + 3] !== 0 && accept(data, (idx - w) * 4)) { visited[idx - w] = 1; stack[sp++] = idx - w; }
    }
  }

  function autoRemove() {
    if (!state.ready) return;
    var w = els.board.width, h = els.board.height;
    var img = ctx.getImageData(0, 0, w, h);
    var data = img.data;
    var palette = borderPalette(data, w, h);
    var tol = toleranceValue();
    var seeds = [];
    for (var x = 0; x < w; x++) { seeds.push([x, 0], [x, h - 1]); }
    for (var y = 0; y < h; y++) { seeds.push([0, y], [w - 1, y]); }
    floodClear(data, w, h, seeds, function (d, p) { return matchesPalette(d, p, palette, tol); });
    if (state.softness > 0) featherData(data, w, h, state.softness);
    ctx.putImageData(img, 0, 0);
  }

  // Click-to-erase: clears the connected patch that shares the clicked colour,
  // so a leftover spot or a stray background sliver can be removed by hand.
  function magicRemove(x, y) {
    if (!state.ready) return false;
    var w = els.board.width, h = els.board.height;
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    var img = ctx.getImageData(0, 0, w, h);
    var data = img.data;
    var p = (y * w + x) * 4;
    if (data[p + 3] === 0) return false;
    var ref = [data[p], data[p + 1], data[p + 2]];
    var tol = toleranceValue();
    floodClear(data, w, h, [[x, y]], function (d, q) {
      var dr = d[q] - ref[0], dg = d[q + 1] - ref[1], db = d[q + 2] - ref[2];
      return dr * dr + dg * dg + db * db <= tol * tol;
    });
    ctx.putImageData(img, 0, 0);
    return true;
  }

  // Softens the alpha edge with a separable box blur so the cut does not look
  // like a staircase. Only new pixels near a boundary change; solid interior
  // and cleared background are left alone.
  function featherData(data, w, h, radius) {
    var r = Math.round(radius);
    if (r <= 0) return;
    var n = w * h;
    var a = new Float32Array(n);
    var tmp = new Float32Array(n);
    var i, x, y, sum;
    for (i = 0; i < n; i++) a[i] = data[i * 4 + 3];
    function idx(v, max) { return v < 0 ? 0 : v > max ? max : v; }
    for (y = 0; y < h; y++) {
      var row = y * w;
      sum = 0;
      for (x = -r; x <= r; x++) sum += a[row + idx(x, w - 1)];
      for (x = 0; x < w; x++) {
        tmp[row + x] = sum / (2 * r + 1);
        sum += a[row + idx(x + r + 1, w - 1)] - a[row + idx(x - r, w - 1)];
      }
    }
    for (x = 0; x < w; x++) {
      sum = 0;
      for (y = -r; y <= r; y++) sum += tmp[idx(y, h - 1) * w + x];
      for (y = 0; y < h; y++) {
        a[y * w + x] = sum / (2 * r + 1);
        sum += tmp[idx(y + r + 1, h - 1) * w + x] - tmp[idx(y - r, h - 1) * w + x];
      }
    }
    for (i = 0; i < n; i++) data[i * 4 + 3] = a[i];
  }

  function softenNow() {
    if (!state.ready) return;
    pushHistory();
    var w = els.board.width, h = els.board.height;
    var img = ctx.getImageData(0, 0, w, h);
    featherData(img.data, w, h, state.softness);
    ctx.putImageData(img, 0, 0);
    setStatus("Edges softened.", "ok");
  }

  function trim() {
    if (!state.ready) return;
    var w = els.board.width, h = els.board.height;
    var data = ctx.getImageData(0, 0, w, h).data;
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) { setStatus("Everything is transparent — there is nothing to trim.", "error"); return; }
    if (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1) { setStatus("There is no empty edge to trim.", "ok"); return; }
    var cw = maxX - minX + 1, ch = maxY - minY + 1;
    var copy = document.createElement("canvas");
    copy.width = cw; copy.height = ch;
    copy.getContext("2d").drawImage(els.board, minX, minY, cw, ch, 0, 0, cw, ch);
    els.board.width = cw;
    els.board.height = ch;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(copy, 0, 0);
    // A crop cannot be undone against the old RGB, so the stack restarts here.
    history = [];
    updateUndo();
    els.sizeBadge.textContent = cw + " × " + ch;
    syncBoardChrome();
    setStatus("Trimmed to the subject.", "ok");
  }

  /* ---------- history ---------- */

  function pushHistory() {
    var w = els.board.width, h = els.board.height;
    var data = ctx.getImageData(0, 0, w, h).data;
    var alpha = new Uint8ClampedArray(w * h);
    for (var i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    history.push({ w: w, h: h, alpha: alpha });
    if (history.length > 12) history.shift();
    updateUndo();
  }
  function updateUndo() { els.undoBtn.disabled = history.length === 0; }
  function undo() {
    var snap = history.pop();
    updateUndo();
    if (!snap || snap.w !== els.board.width || snap.h !== els.board.height) return;
    var img = ctx.getImageData(0, 0, snap.w, snap.h);
    for (var i = 0; i < snap.alpha.length; i++) img.data[i * 4 + 3] = snap.alpha[i];
    ctx.putImageData(img, 0, 0);
    setStatus("Undone.", "ok");
  }

  /* ---------- preview chrome ---------- */

  function paintBackgroundState() {
    var wrap = els.boardWrap;
    wrap.classList.toggle("bg-color", state.bg === "color");
    wrap.classList.toggle("bg-gradient", state.bg === "gradient");
    wrap.classList.toggle("shadow", state.shadow);
    wrap.classList.toggle("mode-magic", state.magic);
    if (state.bg === "color") wrap.style.background = state.color;
    else if (state.bg === "gradient") wrap.style.background = "linear-gradient(135deg, " + state.color + ", " + state.color2 + ")";
    else wrap.style.background = "";
    els.colorFields.hidden = state.bg === "transparent";
    els.bg2.hidden = state.bg !== "gradient";
    els.bg1Label.textContent = state.bg === "gradient" ? "From" : "Colour";
    els.magicBtn.setAttribute("aria-pressed", state.magic ? "true" : "false");
    els.magicBtn.classList.toggle("btn-primary", state.magic);
  }

  function syncBoardChrome() {
    // The preview padding is a share of the subject's rendered width, so it
    // matches the proportion the exported file will get. It is derived from the
    // stable board shell rather than from the padded board itself, which keeps
    // padding from feeding back into its own measurement.
    var style = window.getComputedStyle(els.boardShell);
    var available = els.boardShell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    var scale = available > 0 ? Math.min(1, available / els.board.width) : 1;
    var padPx = Math.round((state.padding / 100) * els.board.width * scale);
    els.boardWrap.style.padding = padPx + "px";
  }

  window.addEventListener("resize", syncBoardChrome);

  /* ---------- controls ---------- */

  els.pickBtn.addEventListener("click", function () { els.fileInput.click(); });
  els.fileInput.addEventListener("change", function () { if (els.fileInput.files[0]) acceptFile(els.fileInput.files[0]); });
  els.dz.addEventListener("click", function (event) { if (event.target !== els.pickBtn) els.fileInput.click(); });
  els.dz.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); els.fileInput.click(); } });
  ["dragenter", "dragover"].forEach(function (type) {
    els.dz.addEventListener(type, function (event) { event.preventDefault(); els.dz.classList.add("is-over"); });
  });
  ["dragleave", "drop"].forEach(function (type) {
    els.dz.addEventListener(type, function (event) { event.preventDefault(); els.dz.classList.remove("is-over"); });
  });
  els.dz.addEventListener("drop", function (event) {
    var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) acceptFile(file);
  });
  document.addEventListener("paste", function (event) {
    var items = event.clipboardData && event.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") === 0) { acceptFile(items[i].getAsFile()); break; }
    }
  });

  els.removeBtn.addEventListener("click", function () {
    if (!state.ready || busy) return;
    busy = true;
    els.boardShell.classList.add("is-busy");
    setStatus("Detecting the background…");
    // Let the spinner paint before the synchronous pixel pass.
    setTimeout(function () {
      pushHistory();
      autoRemove();
      els.boardShell.classList.remove("is-busy");
      busy = false;
      syncBoardChrome();
      setStatus("Background cleared. Refine it or choose a new backdrop.", "ok");
    }, 30);
  });

  els.magicBtn.addEventListener("click", function () {
    if (!state.ready) return;
    state.magic = !state.magic;
    paintBackgroundState();
    setStatus(state.magic ? "Click a patch to erase it." : "Click-to-erase off.");
  });

  els.boardWrap.addEventListener("click", function (event) {
    if (!state.magic || !state.ready || busy) return;
    var rect = els.board.getBoundingClientRect();
    var x = Math.floor((event.clientX - rect.left) * (els.board.width / rect.width));
    var y = Math.floor((event.clientY - rect.top) * (els.board.height / rect.height));
    pushHistory();
    if (magicRemove(x, y)) setStatus("Erased that patch. Click again for more.", "ok");
    else { history.pop(); updateUndo(); setStatus("Nothing to erase there.", "ok"); }
  });

  els.softBtn.addEventListener("click", softenNow);
  els.trimBtn.addEventListener("click", trim);
  els.undoBtn.addEventListener("click", undo);

  els.resetBtn.addEventListener("click", function () {
    if (!state.original) return;
    var w = els.board.width, h = els.board.height;
    // Redraw the untouched original so the mask and any tint are gone.
    var width = state.original.width || state.original.naturalWidth;
    var height = state.original.height || state.original.naturalHeight;
    var scale = Math.min(1, MAX_DIM / Math.max(width, height));
    els.board.width = Math.max(1, Math.round(width * scale));
    els.board.height = Math.max(1, Math.round(height * scale));
    ctx.clearRect(0, 0, els.board.width, els.board.height);
    ctx.drawImage(state.original, 0, 0, els.board.width, els.board.height);
    history = [];
    updateUndo();
    els.sizeBadge.textContent = els.board.width + " × " + els.board.height;
    syncBoardChrome();
    setStatus("Back to the original image. Press “Remove background” again.", "ok");
  });

  els.tolerance.addEventListener("input", updateRangeOutputs);
  els.softness.addEventListener("input", function () { state.softness = Number(els.softness.value); updateRangeOutputs(); });
  els.padding.addEventListener("input", function () { state.padding = Number(els.padding.value); updateRangeOutputs(); syncBoardChrome(); });
  els.quality.addEventListener("input", updateRangeOutputs);
  els.shadow.addEventListener("change", function () { state.shadow = els.shadow.checked; paintBackgroundState(); });
  els.bg1.addEventListener("input", function () { if (state.bg === "gradient") state.color2 = els.bg2.value; state.color = state.bg1.value; paintBackgroundState(); });
  els.bg2.addEventListener("input", function () { state.color2 = els.bg2.value; paintBackgroundState(); });
  els.swatches.forEach(function (swatch) {
    swatch.addEventListener("click", function () {
      var color = swatch.getAttribute("data-color");
      state.color = color;
      els.bg1.value = color;
      els.swatches.forEach(function (s) { s.setAttribute("aria-pressed", s === swatch ? "true" : "false"); });
      paintBackgroundState();
    });
  });
  els.bgButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      state.bg = button.getAttribute("data-bg");
      els.bgButtons.forEach(function (b) { b.setAttribute("aria-pressed", b === button ? "true" : "false"); });
      paintBackgroundState();
    });
  });

  /* ---------- export ---------- */

  // Composites the subject onto the chosen backdrop, bakes the drop shadow and
  // padding, and returns a canvas ready to encode. This is the one place the
  // transparent working canvas is flattened.
  function renderOutput() {
    var w = els.board.width, h = els.board.height;
    var longest = Math.max(w, h);
    var pad = Math.round((state.padding / 100) * longest);
    var shadowPad = state.shadow ? Math.round(longest * 0.1) : 0;
    var margin = pad + shadowPad;
    var out = document.createElement("canvas");
    out.width = w + margin * 2;
    out.height = h + margin * 2;
    var octx = out.getContext("2d");
    var flatJpeg = els.format.value === "image/jpeg";
    if (state.bg === "color") { octx.fillStyle = state.color; octx.fillRect(0, 0, out.width, out.height); }
    else if (state.bg === "gradient") {
      var g = octx.createLinearGradient(0, 0, out.width, out.height);
      g.addColorStop(0, state.color); g.addColorStop(1, state.color2);
      octx.fillStyle = g; octx.fillRect(0, 0, out.width, out.height);
    } else if (flatJpeg) { octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, out.width, out.height); }
    if (state.shadow) {
      octx.save();
      octx.shadowColor = "rgba(0, 0, 0, 0.35)";
      octx.shadowBlur = longest * 0.05;
      octx.shadowOffsetY = longest * 0.02;
      octx.drawImage(els.board, margin, margin);
      octx.restore();
    }
    octx.drawImage(els.board, margin, margin);
    return out;
  }

  function baseName() {
    return "background-removed";
  }

  function download() {
    if (!state.ready || busy) return;
    var out = renderOutput();
    var type = els.format.value;
    var quality = Number(els.quality.value) / 100;
    var ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    out.toBlob(function (blob) {
      if (!blob) { setStatus("This browser could not encode that format — try PNG.", "error"); return; }
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = baseName() + "." + ext;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      setStatus("Saved as " + link.download + ".", "ok");
    }, type, quality);
  }

  function copyToClipboard() {
    if (!state.ready || busy) return;
    if (!navigator.clipboard || !window.ClipboardItem) { setStatus("Copying is not supported in this browser — download instead.", "error"); return; }
    // Clipboards want a flattened bitmap, so a transparent background becomes
    // white here rather than arriving as empty pixels.
    var w = els.board.width, h = els.board.height;
    var flat = document.createElement("canvas");
    flat.width = w; flat.height = h;
    var fctx = flat.getContext("2d");
    fctx.fillStyle = state.bg === "transparent" ? "#ffffff" : (state.bg === "color" ? state.color : "#ffffff");
    fctx.fillRect(0, 0, w, h);
    fctx.drawImage(els.board, 0, 0);
    flat.toBlob(function (blob) {
      navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
        .then(function () { setStatus("Copied to the clipboard.", "ok"); })
        .catch(function () { setStatus("The browser blocked the clipboard — download instead.", "error"); });
    }, "image/png");
  }

  els.downloadBtn.addEventListener("click", download);
  els.copyBtn.addEventListener("click", copyToClipboard);
  els.format.addEventListener("change", function () {
    if (els.format.value === "image/jpeg" && state.bg === "transparent") {
      setStatus("JPEG has no transparency, so the cleared area will be filled with white until you pick a colour.", "ok");
    }
  });

  /* ---------- boot ---------- */

  updateRangeOutputs();
  themeButton();
  paintBackgroundState();
  syncBoardChrome();
})();
