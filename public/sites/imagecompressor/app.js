/* ============================================================
   Image Compressor & Resizer — everything happens in this file,
   in the browser. No image is ever uploaded: files are decoded
   with createImageBitmap, drawn to a canvas and re-encoded with
   canvas.toBlob, which is also what strips EXIF/GPS metadata.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    themeBtn: $("themeBtn"),
    dz: $("dz"),
    pickBtn: $("pickBtn"),
    clearBtn: $("clearBtn"),
    fileInput: $("fileInput"),
    countBadge: $("countBadge"),
    status: $("status"),
    format: $("format"),
    formatHint: $("formatHint"),
    quality: $("quality"),
    qualityOut: $("qualityOut"),
    qualityHint: $("qualityHint"),
    maxW: $("maxW"),
    maxH: $("maxH"),
    presets: Array.prototype.slice.call(document.querySelectorAll(".preset")),
    runBtn: $("runBtn"),
    downloadAll: $("downloadAll"),
    engineNote: $("engineNote"),
    summary: $("summary"),
    sumBefore: $("sumBefore"),
    sumAfter: $("sumAfter"),
    sumSaved: $("sumSaved"),
    sumCount: $("sumCount"),
    list: $("list"),
    emptyState: $("emptyState"),
  };

  var TYPES = { "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WebP" };
  var EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  // Beyond this, decoding gets slow on phones; still allowed, just flagged.
  var LARGE_FILE = 25 * 1024 * 1024;

  var items = [];
  var nextId = 1;
  var busy = false;
  // Set by feature detection below; PNG is the fallback browsers use when the
  // requested type is unsupported, so this decides whether WebP is offered.
  var webpSupported = false;

  /* ---------- small helpers ---------- */

  function bytes(value) {
    if (!value && value !== 0) return "—";
    if (value < 1024) return value + " B";
    if (value < 1024 * 1024) return (value / 1024).toFixed(value < 10240 ? 1 : 0) + " KB";
    return (value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 2 : 1) + " MB";
  }

  function percent(from, to) {
    if (!from) return 0;
    return Math.round(((from - to) / from) * 100);
  }

  function setStatus(message, isError) {
    els.status.textContent = message || "";
    els.status.classList.toggle("is-error", !!isError);
  }

  function stripExtension(name) {
    return name.replace(/\.[a-z0-9]+$/i, "");
  }

  function outputName(name, type) {
    return stripExtension(name) + "." + (EXTENSIONS[type] || "jpg");
  }

  /* ---------- theme ---------- */

  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';

  function paintThemeButton() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    els.themeBtn.innerHTML = dark ? SUN : MOON;
    els.themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  els.themeBtn.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ic:theme", next); } catch (e) {}
    paintThemeButton();
  });
  paintThemeButton();

  /* ---------- settings ---------- */

  function settings() {
    var width = parseInt(els.maxW.value, 10);
    var height = parseInt(els.maxH.value, 10);
    return {
      format: els.format.value,
      quality: Math.min(100, Math.max(10, parseInt(els.quality.value, 10) || 80)) / 100,
      maxWidth: Number.isFinite(width) && width > 0 ? width : null,
      maxHeight: Number.isFinite(height) && height > 0 ? height : null,
    };
  }

  // Changing a setting or adding files does not silently re-run the batch: the
  // results on screen would no longer match the controls, so say so instead.
  function markDirty() {
    if (items.length === 0) return;
    els.runBtn.textContent = results().length > 0 ? "Compress again" : "Compress & resize";
    if (results().length > 0) setStatus("Settings changed — press Compress again to re-run over the same files.");
  }

  els.quality.addEventListener("input", function () {
    els.qualityOut.textContent = els.quality.value + "%";
    markDirty();
  });
  els.format.addEventListener("change", function () {
    updateFormatHint();
    markDirty();
  });
  els.maxW.addEventListener("input", clearPresets);
  els.maxH.addEventListener("input", clearPresets);

  function updateFormatHint() {
    var format = els.format.value;
    if (format === "image/png") {
      els.formatHint.textContent = "PNG is lossless, so the quality slider will not change its size — pick WebP or JPEG to shrink a photo.";
    } else if (format === "auto") {
      els.formatHint.textContent = "Keeps JPEG, PNG or WebP as-is; anything else comes out as JPEG. WebP usually wins for photos.";
    } else if (format === "image/webp") {
      els.formatHint.textContent = "WebP is the smallest option for the web and is supported by every current browser.";
    } else {
      els.formatHint.textContent = "JPEG opens anywhere, and is the safest choice for forms and older software.";
    }
  }

  function clearPresets() {
    els.presets.forEach(function (button) {
      var matches = button.dataset.w === els.maxW.value.trim() && button.dataset.h === els.maxH.value.trim();
      button.setAttribute("aria-pressed", matches ? "true" : "false");
    });
  }

  els.presets.forEach(function (button) {
    button.addEventListener("click", function () {
      els.maxW.value = button.dataset.w;
      els.maxH.value = button.dataset.h;
      clearPresets();
      markDirty();
    });
  });

  /* ---------- adding files ---------- */

  els.pickBtn.addEventListener("click", function () { els.fileInput.click(); });
  // The picker button is the keyboard path; clicking the surrounding panel is
  // a convenience for everyone else. Clicks that come from the buttons (or from
  // the hidden input's own programmatic click, which bubbles up here) have to
  // be ignored or this would re-open the picker forever.
  els.dz.addEventListener("click", function (event) {
    if (event.target === els.fileInput || event.target.closest(".dz-actions")) return;
    els.fileInput.click();
  });
  els.fileInput.addEventListener("change", function () {
    addFiles(Array.prototype.slice.call(els.fileInput.files || []));
    els.fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach(function (name) {
    els.dz.addEventListener(name, function (event) {
      event.preventDefault();
      els.dz.classList.add("is-drag");
    });
  });
  ["dragleave", "dragend", "drop"].forEach(function (name) {
    els.dz.addEventListener(name, function (event) {
      event.preventDefault();
      els.dz.classList.remove("is-drag");
    });
  });
  els.dz.addEventListener("drop", function (event) {
    var files = Array.prototype.slice.call((event.dataTransfer && event.dataTransfer.files) || []);
    if (files.length) addFiles(files);
  });
  // A stray drop anywhere else would navigate away from the page.
  window.addEventListener("dragover", function (event) { event.preventDefault(); });
  window.addEventListener("drop", function (event) { event.preventDefault(); });

  // Pasting a screenshot is the quickest way in on a desktop.
  window.addEventListener("paste", function (event) {
    var files = Array.prototype.slice.call((event.clipboardData && event.clipboardData.files) || []);
    if (files.length) addFiles(files);
  });

  function addFiles(files) {
    var rejected = 0;
    files.forEach(function (file) {
      if (!file.type || file.type.indexOf("image/") !== 0) { rejected += 1; return; }
      if (items.some(function (item) { return item.file === file; })) return;
      items.push({ id: nextId++, file: file, result: null, error: null });
    });

    els.clearBtn.hidden = items.length === 0;
    els.runBtn.disabled = items.length === 0;
    els.countBadge.hidden = items.length === 0;
    els.countBadge.textContent = items.length + (items.length === 1 ? " file" : " files");
    if (rejected) {
      setStatus(rejected + (rejected === 1 ? " file was skipped" : " files were skipped") + " — only images can be compressed.", true);
    } else {
      setStatus(items.length + (items.length === 1 ? " image ready." : " images ready."));
    }
    markDirty();
  }

  els.clearBtn.addEventListener("click", function () {
    items.forEach(function (item) { if (item.result) URL.revokeObjectURL(item.result.url); });
    items = [];
    els.list.textContent = "";
    els.summary.hidden = true;
    els.emptyState.hidden = false;
    els.clearBtn.hidden = true;
    els.runBtn.disabled = true;
    els.runBtn.textContent = "Compress & resize";
    els.downloadAll.hidden = true;
    els.countBadge.hidden = true;
    setStatus("");
  });

  /* ---------- decoding and encoding ---------- */

  function decode(file) {
    if (typeof window.createImageBitmap === "function") {
      return window.createImageBitmap(file, { imageOrientation: "from-image" })
        .catch(function () { return window.createImageBitmap(file); })
        .catch(function () { return decodeViaElement(file); });
    }
    return decodeViaElement(file);
  }

  // Older browsers (and a couple of exotic formats) still go through an <img>.
  function decodeViaElement(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Could not read this image")); };
      image.src = url;
    });
  }

  function dimensions(source) {
    return {
      width: source.width || source.naturalWidth || 0,
      height: source.height || source.naturalHeight || 0,
    };
  }

  // Only ever scales down, and keeps the aspect ratio by taking the smallest
  // of the scale factors the limits allow.
  function targetSize(width, height, maxWidth, maxHeight) {
    var scale = Math.min(
      1,
      maxWidth ? maxWidth / width : 1,
      maxHeight ? maxHeight / height : 1
    );
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  function resolveType(file, chosen) {
    if (chosen !== "auto") return chosen;
    var type = (file.type || "").toLowerCase();
    return TYPES[type] ? type : "image/jpeg";
  }

  function encode(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) { blob ? resolve(blob) : reject(new Error("Could not encode this image")); },
        type,
        type === "image/png" ? undefined : quality
      );
    });
  }

  async function compress(item) {
    var config = settings();
    var type = resolveType(item.file, config.format);
    var source = await decode(item.file);
    var from = dimensions(source);
    if (!from.width || !from.height) throw new Error("Could not read this image");

    var size = targetSize(from.width, from.height, config.maxWidth, config.maxHeight);
    var canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    var context = canvas.getContext("2d");
    if (!context) throw new Error("This browser blocked canvas rendering");
    // JPEG has no alpha channel, so transparency would otherwise come out black.
    if (type === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size.width, size.height);
    }
    if ("imageSmoothingQuality" in context) context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, size.width, size.height);
    if (typeof source.close === "function") source.close();

    var blob = await encode(canvas, type, config.quality);
    // Browsers silently fall back to PNG when they cannot encode the type asked
    // for; report what actually came back rather than what was requested.
    var actual = blob.type || type;
    return {
      blob: blob,
      url: URL.createObjectURL(blob),
      type: TYPES[actual] ? actual : type,
      width: size.width,
      height: size.height,
      fromWidth: from.width,
      fromHeight: from.height,
      resized: size.width !== from.width || size.height !== from.height,
      bytes: blob.size,
      originalBytes: item.file.size,
    };
  }

  /* ---------- running the batch ---------- */

  els.runBtn.addEventListener("click", run);

  async function run() {
    if (busy || items.length === 0) return;
    busy = true;
    els.runBtn.disabled = true;
    els.runBtn.textContent = "Working…";
    els.downloadAll.hidden = true;

    var failed = 0;
    for (var index = 0; index < items.length; index += 1) {
      var item = items[index];
      setStatus("Compressing " + (index + 1) + " of " + items.length + " — " + item.file.name);
      try {
        if (item.result) URL.revokeObjectURL(item.result.url);
        item.result = await compress(item);
        item.error = null;
      } catch (error) {
        item.result = null;
        item.error = (error && error.message) || "Could not process this image";
        failed += 1;
      }
      render();
      // Yield so the page keeps painting between images.
      await new Promise(function (resolve) { window.setTimeout(resolve, 0); });
    }

    busy = false;
    els.runBtn.disabled = false;
    els.runBtn.textContent = "Compress again";
    var done = results();
    els.downloadAll.hidden = done.length < 2;
    if (done.length === 0) {
      setStatus("None of those files could be processed.", true);
    } else if (failed) {
      setStatus("Done with " + failed + (failed === 1 ? " file that could not" : " files that could not") + " be processed.", true);
    } else {
      var before = total("originalBytes");
      var after = total("bytes");
      setStatus("Done. " + done.length + (done.length === 1 ? " image" : " images") + ", " + bytes(before - after) + " saved (" + percent(before, after) + "%).");
    }
  }

  function results() {
    return items.filter(function (item) { return item.result; });
  }

  function total(field) {
    return results().reduce(function (sum, item) { return sum + item.result[field]; }, 0);
  }

  /* ---------- rendering ---------- */

  function render() {
    els.list.textContent = "";
    els.emptyState.hidden = items.length > 0;

    items.forEach(function (item) {
      els.list.appendChild(row(item));
    });

    var done = results();
    els.summary.hidden = done.length === 0;
    if (done.length) {
      var before = total("originalBytes");
      var after = total("bytes");
      els.sumBefore.textContent = bytes(before);
      els.sumAfter.textContent = bytes(after);
      var saved = percent(before, after);
      els.sumSaved.textContent = saved > 0 ? saved + "%" : "none";
      els.sumCount.textContent = String(done.length);
    }
  }

  function row(item) {
    var wrapper = document.createElement("div");
    wrapper.className = "row" + (item.error ? " is-error" : "");

    var thumb = document.createElement("img");
    thumb.className = "thumb";
    thumb.alt = "";
    thumb.loading = "lazy";
    thumb.src = item.result ? item.result.url : "";
    if (!item.result) thumb.removeAttribute("src");
    wrapper.appendChild(thumb);

    var body = document.createElement("div");
    body.className = "row-body";

    var name = document.createElement("span");
    name.className = "row-name";
    name.textContent = item.result ? outputName(item.file.name, item.result.type) : item.file.name;
    name.title = item.result ? outputName(item.file.name, item.result.type) : item.file.name;
    body.appendChild(name);

    var meta = document.createElement("div");
    meta.className = "row-meta";

    if (item.error) {
      meta.appendChild(text("span", item.error));
    } else if (item.result) {
      var result = item.result;
      meta.appendChild(text("span", bytes(result.originalBytes)));
      meta.appendChild(text("span", "→", "row-arrow"));
      meta.appendChild(text("span", bytes(result.bytes)));
      var saved = percent(result.originalBytes, result.bytes);
      meta.appendChild(text("span", saved > 0 ? saved + "% smaller" : "no saving", saved > 0 ? "row-saved" : ""));
      meta.appendChild(text("span", result.width + " × " + result.height, "mono"));
      if (result.resized) meta.appendChild(text("span", "resized", "mono"));
      meta.appendChild(badge(TYPES[result.type] || "", "is-good"));
      if (item.file.size > LARGE_FILE && saved <= 0) {
        meta.appendChild(badge("try WebP", "is-warn"));
      }
    } else {
      meta.appendChild(text("span", bytes(item.file.size) + " — waiting"));
    }
    body.appendChild(meta);
    wrapper.appendChild(body);

    var actions = document.createElement("div");
    actions.className = "row-actions";
    if (item.result) {
      var link = document.createElement("a");
      link.className = "btn btn-ghost btn-sm";
      link.href = item.result.url;
      link.download = outputName(item.file.name, item.result.type);
      link.textContent = "Download";
      actions.appendChild(link);
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-ghost btn-sm";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + item.file.name);
      remove.addEventListener("click", function () {
        URL.revokeObjectURL(item.result.url);
        items = items.filter(function (entry) { return entry.id !== item.id; });
        els.countBadge.textContent = items.length + (items.length === 1 ? " file" : " files");
        els.countBadge.hidden = items.length === 0;
        els.clearBtn.hidden = items.length === 0;
        els.runBtn.disabled = items.length === 0;
        els.downloadAll.hidden = results().length < 2;
        render();
      });
      actions.appendChild(remove);
    }
    wrapper.appendChild(actions);

    return wrapper;
  }

  function text(tag, value, className) {
    var node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }

  function badge(label, className) {
    var node = document.createElement("span");
    node.className = "badge mono " + (className || "");
    node.textContent = label;
    return node;
  }

  els.downloadAll.addEventListener("click", async function () {
    var done = results();
    for (var index = 0; index < done.length; index += 1) {
      var item = done[index];
      var link = document.createElement("a");
      link.href = item.result.url;
      link.download = outputName(item.file.name, item.result.type);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Firing them all at once makes browsers drop some of them.
      await new Promise(function (resolve) { window.setTimeout(resolve, 400); });
    }
    setStatus("Saved " + done.length + " files to your downloads.");
  });

  /* ---------- capability check ---------- */

  (function detectWebp() {
    try {
      var probe = document.createElement("canvas");
      probe.width = 2;
      probe.height = 2;
      webpSupported = probe.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch (error) {
      webpSupported = false;
    }
    if (!webpSupported) {
      var option = els.format.querySelector('option[value="image/webp"]');
      if (option) {
        option.disabled = true;
        option.textContent = "WebP — not supported by this browser";
      }
      els.engineNote.textContent = "This browser will fall back to JPEG for WebP output";
    } else {
      els.engineNote.textContent = "WebP output available";
    }
  })();

  updateFormatHint();
  clearPresets();
})();
