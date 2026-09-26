(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Config & refs
     ------------------------------------------------------------------ */
  var API = "https://api.github.com";
  var RAW = "https://raw.githubusercontent.com/";
  var TOKEN_KEY = "ghe:token";
  var RECENT_KEY = "ghe:recent";
  var THEME_KEY = "ghe:theme";
  var MAX_FILE_BYTES = 200000;

  var form = document.getElementById("checkForm");
  var input = document.getElementById("queryInput");
  var submitBtn = document.getElementById("submitBtn");
  var btnLabel = document.getElementById("btnLabel");
  var kbdHint = document.getElementById("kbdHint");
  var messageSlot = document.getElementById("messageSlot");
  var resultSlot = document.getElementById("resultSlot");
  var recentSection = document.getElementById("recentSection");
  var recentList = document.getElementById("recentList");
  var clearRecentBtn = document.getElementById("clearRecent");
  var themeBtn = document.getElementById("themeBtn");
  var settingsBtn = document.getElementById("settingsBtn");
  var settingsDlg = document.getElementById("settingsDlg");
  var tokenInput = document.getElementById("tokenInput");
  var tokenSave = document.getElementById("tokenSave");
  var tokenClear = document.getElementById("tokenClear");

  var state = {
    busy: false,
    view: null,
    owner: null,
    repo: null,
    branch: null,
    meta: null,
    tree: [],
    truncated: false,
    file: null,
    fileText: null,
    aiText: null,
    aiTab: "preview"
  };

  /* ------------------------------------------------------------------
     Icons
     ------------------------------------------------------------------ */
  function svg(body) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  }
  var ICON = {
    star: svg('<path d="M12 2l3 6.5 7 .9-5 4.8 1.2 7L12 18l-6.2 3.2L7 14.2 2 9.4l7-.9z"/>'),
    fork: svg('<circle cx="6" cy="5" r="2.5"/><circle cx="18" cy="5" r="2.5"/><circle cx="12" cy="19" r="2.5"/><path d="M6 7.5v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-3"/><path d="M12 13.5V17"/>'),
    issue: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'),
    link: svg('<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>'),
    folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    file: svg('<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/>'),
    copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    download: svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'),
    spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'),
    book: svg('<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h7M8 11h7"/>'),
    map: svg('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
    ask: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    warn: svg('<path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    key: svg('<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M17 6l2 2M14 9l2 2"/>')
  };

  /* ------------------------------------------------------------------
     Theme
     ------------------------------------------------------------------ */
  function applyTheme() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var light = document.getElementById("hljsLight");
    var darkCss = document.getElementById("hljsDark");
    if (light) light.disabled = dark;
    if (darkCss) darkCss.disabled = !dark;
    themeBtn.innerHTML = dark
      ? svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')
      : svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>');
    themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  themeBtn.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme();
  });
  applyTheme();

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function bytes(n) {
    if (typeof n !== "number" || n < 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }
  function timeAgo(ts) {
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.round(s / 60) + "m ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago";
    return Math.round(s / 86400) + "d ago";
  }
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function notice(kind, text) {
    return '<div class="notice ' + kind + '">' + (kind === "err" ? ICON.warn : ICON.info) + "<span>" + text + "</span></div>";
  }
  function showMessage(kind, text) {
    messageSlot.innerHTML = text ? notice(kind, text) : "";
  }

  /* ------------------------------------------------------------------
     Input parsing
     ------------------------------------------------------------------ */
  function parseInput(raw) {
    var v = (raw || "").trim();
    if (!v) return null;
    v = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/^github\.com\//i, "");
    v = v.replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
    v = v.split("?")[0].split("#")[0];
    var parts = v.split("/").filter(Boolean);
    if (parts.length >= 2) {
      if (!/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1])) return null;
      return { mode: "repo", owner: parts[0], repo: parts[1] };
    }
    if (parts.length === 1 && /^[\w.-]+$/.test(parts[0])) return { mode: "user", user: parts[0] };
    return null;
  }

  /* ------------------------------------------------------------------
     GitHub API
     ------------------------------------------------------------------ */
  function ghError(props) {
    var e = new Error("github request failed");
    for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) e[k] = props[k];
    return e;
  }
  function ghFetch(path) {
    var headers = { Accept: "application/vnd.github+json" };
    var token = getToken();
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(API + path, { headers: headers }).then(function (res) {
      if (res.status === 403 || res.status === 429) {
        var remaining = res.headers.get("x-ratelimit-remaining");
        if (remaining === "0") throw ghError({ rateLimit: true, reset: res.headers.get("x-ratelimit-reset") });
      }
      if (res.status === 404) throw ghError({ notFound: true });
      if (res.status === 401) throw ghError({ badToken: true });
      if (!res.ok) throw ghError({ status: res.status });
      return res.json();
    });
  }
  function rateLimitMessage(err) {
    var when = "";
    if (err && err.reset) {
      var mins = Math.max(1, Math.round((Number(err.reset) * 1000 - Date.now()) / 60000));
      when = " Resets in about " + mins + " minute" + (mins === 1 ? "" : "s") + ".";
    }
    return notice("warn", "GitHub's unauthenticated limit (60 requests an hour) has been reached." + when + " Open <b>Settings</b> to add a personal access token for 5,000 an hour.");
  }
  function errorMessage(err, what) {
    if (err && err.rateLimit) return rateLimitMessage(err);
    if (err && err.badToken) return notice("err", "GitHub rejected the personal token in Settings. Check it, or remove it to browse public repositories again.");
    if (err && err.notFound) return notice("err", "That " + what + " was not found. Check the spelling, and remember that private repositories need a token in Settings.");
    return notice("err", "Something went wrong talking to GitHub. Please try again.");
  }

  /* ------------------------------------------------------------------
     Loaders
     ------------------------------------------------------------------ */
  function setBusy(b) {
    state.busy = b;
    submitBtn.disabled = b;
    if (b) {
      kbdHint.style.display = "none";
      btnLabel.innerHTML = '<span class="spinner" aria-hidden="true"></span>Loading';
    } else {
      kbdHint.style.display = "";
      btnLabel.textContent = "Explore";
    }
  }

  function loadRepo(owner, repo) {
    showMessage("", "");
    resultSlot.innerHTML = "";
    setBusy(true);
    return ghFetch("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo))
      .then(function (meta) {
        state.owner = owner;
        state.repo = repo;
        state.meta = meta;
        state.branch = meta.default_branch || "main";
        return ghFetch(
          "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) +
          "/git/trees/" + encodeURIComponent(state.branch) + "?recursive=1"
        );
      })
      .then(function (tree) {
        state.tree = Array.isArray(tree.tree) ? tree.tree : [];
        state.truncated = !!tree.truncated;
        state.view = "repo";
        state.file = null;
        state.fileText = null;
        renderRepo();
        pushRecent(owner + "/" + repo);
      })
      .catch(function (err) {
        state.view = null;
        showMessage("", errorMessage(err, "repository"));
      })
      .then(function () { setBusy(false); });
  }

  function loadUser(user) {
    showMessage("", "");
    resultSlot.innerHTML = "";
    setBusy(true);
    var profile = null;
    return ghFetch("/users/" + encodeURIComponent(user))
      .then(function (p) { profile = p; return ghFetch("/users/" + encodeURIComponent(user) + "/repos?per_page=100&sort=updated"); })
      .then(function (repos) {
        state.view = "user";
        renderUser(profile, Array.isArray(repos) ? repos : []);
        pushRecent(user);
      })
      .catch(function (err) {
        state.view = null;
        showMessage("", errorMessage(err, "user"));
      })
      .then(function () { setBusy(false); });
  }

  function run(raw) {
    if (state.busy) return;
    var parsed = parseInput(raw);
    if (!parsed) {
      showMessage("warn", "Enter a repository like <b class=\"mono\">owner/repo</b> or a GitHub username.");
      resultSlot.innerHTML = "";
      state.view = null;
      return;
    }
    input.value = parsed.mode === "repo" ? parsed.owner + "/" + parsed.repo : parsed.user;
    if (parsed.mode === "repo") loadRepo(parsed.owner, parsed.repo);
    else loadUser(parsed.user);
  }

  /* ------------------------------------------------------------------
     Repo rendering
     ------------------------------------------------------------------ */
  function renderRepo() {
    var m = state.meta;
    var owner = state.owner, repo = state.repo;
    var stats =
      '<div class="stats">' +
        '<span>' + ICON.star + (m.stargazers_count || 0).toLocaleString() + "</span>" +
        '<span>' + ICON.fork + (m.forks_count || 0).toLocaleString() + "</span>" +
        '<span>' + ICON.issue + (m.open_issues_count || 0).toLocaleString() + " open issues</span>" +
        (m.language ? '<span><span class="lang-dot"></span>' + esc(m.language) + "</span>" : "") +
        (m.license ? "<span>" + esc(m.license.spdx_id || m.license.name || "") + "</span>" : "") +
        (m.updated_at ? "<span>" + ICON.eye + "updated " + timeAgo(Date.parse(m.updated_at)) + "</span>" : "") +
      "</div>";

    var topics = (m.topics || []).slice(0, 8).map(function (t) { return '<span class="topic">' + esc(t) + "</span>"; }).join(" ");

    var head =
      '<div class="card"><div class="repo-head">' +
        '<img class="avatar" alt="" src="https://avatars.githubusercontent.com/u/' + (m.owner && m.owner.id ? m.owner.id : 0) + '?s=92" onerror="this.style.visibility=\'hidden\'" />' +
        '<div class="rh-meta">' +
          '<div class="rh-title"><h2>' + esc(owner) + "/" + esc(repo) + "</h2>" +
            '<a href="' + esc(m.html_url || ("https://github.com/" + owner + "/" + repo)) + '" target="_blank" rel="noopener noreferrer" aria-label="Open on GitHub">' + ICON.link + "</a></div>" +
          '<p class="rh-desc">' + (m.description ? esc(m.description) : "No description.") + "</p>" +
          stats +
          (topics ? '<div class="rh-links">' + topics + "</div>" : "") +
          '<div class="rh-links">' +
            (m.homepage ? '<a class="topic" href="' + esc(m.homepage) + '" target="_blank" rel="noopener noreferrer">homepage</a>' : "") +
            '<span class="topic mono">' + esc(state.branch) + "</span>" +
            '<span class="topic mono">' + state.tree.filter(function (t) { return t.type === "blob"; }).length + " files</span>" +
          "</div>" +
        "</div>" +
      "</div></div>";

    var truncatedNote = state.truncated ? notice("warn", "This repository is large, so GitHub returned a truncated file tree. Some files may be missing.") : "";

    var body =
      '<div class="explorer">' +
        '<aside class="pane">' +
          '<div class="pane-head"><h3>Files</h3></div>' +
          '<div class="tree-filter"><label for="treeFilter" class="sr-only">Filter files</label><input id="treeFilter" type="text" placeholder="Filter files…" autocomplete="off" spellcheck="false" /></div>' +
          '<div class="tree" id="tree">' + renderTree(buildTree(state.tree)) + "</div>" +
        "</aside>" +
        '<section class="pane">' +
          '<div class="view-head"><span class="path mono" id="viewPath">Select a file to read its code</span><span class="meta" id="viewMeta"></span></div>' +
          '<div class="code-wrap" id="codeWrap"><div class="placeholder">Pick a file from the tree on the left to view it here, or choose an AI task below to draft docs from the repository.</div></div>' +
        "</section>" +
      "</div>" +
      aiPanel() +
      (truncatedNote ? '<div style="margin-top:14px">' + truncatedNote + "</div>" : "");

    resultSlot.innerHTML = head + body;
    wireTree();
    wireAi();
  }

  function buildTree(items) {
    var root = { dirs: {}, files: [] };
    items.forEach(function (item) {
      if (!item || typeof item.path !== "string") return;
      var parts = item.path.split("/");
      var node = root;
      for (var i = 0; i < parts.length - 1; i++) {
        if (!node.dirs[parts[i]]) node.dirs[parts[i]] = { dirs: {}, files: [] };
        node = node.dirs[parts[i]];
      }
      node.files.push({ name: parts[parts.length - 1], path: item.path, size: item.size, type: item.type });
    });
    return root;
  }

  function renderTree(node) {
    var html = "";
    Object.keys(node.dirs).sort().forEach(function (name) {
      html += '<details><summary><span class="tw">▶</span>' + '<span class="tico">' + ICON.folder + "</span>" + esc(name) + "</summary>" + renderTree(node.dirs[name]) + "</details>";
    });
    node.files.sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (f) {
      html += '<button class="fnode" type="button" data-path="' + esc(f.path) + '"><span class="tico">' + ICON.file + '</span><span class="fn">' + esc(f.name) + "</span></button>";
    });
    return html;
  }

  function wireTree() {
    var tree = document.getElementById("tree");
    if (!tree) return;
    tree.addEventListener("click", function (e) {
      var btn = e.target.closest(".fnode");
      if (btn) openFile(btn.getAttribute("data-path"));
    });
    var filter = document.getElementById("treeFilter");
    if (filter) {
      filter.addEventListener("input", function () {
        var q = filter.value.trim().toLowerCase();
        if (!q) {
          tree.innerHTML = renderTree(buildTree(state.tree));
          return;
        }
        var matches = state.tree.filter(function (t) {
          return t.type === "blob" && t.path.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 200);
        tree.innerHTML = matches.length
          ? '<div class="flat-list">' + matches.map(function (f) {
              return '<button class="fnode" type="button" data-path="' + esc(f.path) + '"><span class="tico">' + ICON.file + '</span><span class="fn">' + esc(f.path) + "</span></button>";
            }).join("") + "</div>"
          : '<div class="placeholder">No files match that filter.</div>';
      });
    }
  }

  /* ------------------------------------------------------------------
     User rendering
     ------------------------------------------------------------------ */
  function renderUser(profile, repos) {
    var head =
      '<div class="card"><div class="repo-head">' +
        '<img class="avatar" alt="" src="' + esc(profile.avatar_url || "") + '" onerror="this.style.visibility=\'hidden\'" />' +
        '<div class="rh-meta">' +
          '<div class="rh-title"><h2>' + esc(profile.login) + "</h2>" +
            '<a href="' + esc(profile.html_url || "") + '" target="_blank" rel="noopener noreferrer" aria-label="Open on GitHub">' + ICON.link + "</a></div>" +
          '<p class="rh-desc">' + (profile.bio ? esc(profile.bio) : "No bio.") + "</p>" +
          '<div class="stats">' +
            "<span>" + (profile.public_repos || 0).toLocaleString() + " public repos</span>" +
            "<span>" + (profile.followers || 0).toLocaleString() + " followers</span>" +
            (profile.location ? "<span>" + esc(profile.location) + "</span>" : "") +
          "</div>" +
        "</div>" +
      "</div></div>";

    var cards = repos.length
      ? repos.map(function (r) {
          var desc = r.description || "No description.";
          return '<button class="repo-card" type="button" data-repo="' + esc(r.full_name) + '">' +
            '<span class="rc-name">' + esc(r.name) + "</span>" +
            '<span class="rc-desc">' + esc(desc) + "</span>" +
            '<span class="rc-foot">' +
              (r.language ? "<span>" + esc(r.language) + "</span>" : "") +
              "<span>" + ICON.star + (r.stargazers_count || 0).toLocaleString() + "</span>" +
              "<span>" + ICON.fork + (r.forks_count || 0).toLocaleString() + "</span>" +
              "<span>" + timeAgo(Date.parse(r.pushed_at || r.updated_at)) + "</span>" +
            "</span></button>";
        }).join("")
      : '<div class="placeholder">This user has no public repositories.</div>';

    resultSlot.innerHTML = head + '<div class="grid-repos">' + cards + "</div>";
  }

  /* ------------------------------------------------------------------
     File viewer
     ------------------------------------------------------------------ */
  var BINARY = ["png","jpg","jpeg","gif","webp","avif","ico","bmp","pdf","zip","gz","tar","rar","7z","woff","woff2","ttf","otf","eot","mp3","mp4","wav","ogg","mov","avi","webm","exe","dll","so","dylib","class","jar","wasm","lock"];
  var LANGS = { js:"javascript",mjs:"javascript",cjs:"javascript",jsx:"javascript",ts:"typescript",tsx:"typescript",json:"json",md:"markdown",css:"css",scss:"scss",less:"less",html:"xml",htm:"xml",xml:"xml",svg:"xml",vue:"xml",py:"python",rb:"ruby",go:"go",rs:"rust",java:"java",kt:"kotlin",php:"php",c:"c",h:"c",cpp:"cpp",cc:"cpp",hpp:"cpp",cs:"csharp",sh:"bash",bash:"bash",zsh:"bash",yml:"yaml",yaml:"yaml",toml:"ini",ini:"ini",sql:"sql",swift:"swift",dart:"dart",lua:"lua",pl:"perl",ex:"elixir",exs:"elixir",r:"r",yml2:"yaml" };
  ICON.check = svg('<polyline points="20 6 9 17 4 12"/>');

  function extOf(path) { var i = path.lastIndexOf("."); return i === -1 ? "" : path.slice(i + 1).toLowerCase(); }
  function isBinary(path) { return BINARY.indexOf(extOf(path)) !== -1; }
  function langFor(path) { return LANGS[extOf(path)] || "plaintext"; }
  function rawUrl(path) {
    var branch = String(state.branch || "main").split("/").map(encodeURIComponent).join("/");
    return RAW + encodeURIComponent(state.owner) + "/" + encodeURIComponent(state.repo) + "/" + branch + "/" + path.split("/").map(encodeURIComponent).join("/");
  }
  function rawText(path) {
    return fetch(rawUrl(path)).then(function (res) { return res.ok ? res.text() : null; }).catch(function () { return null; });
  }

  function openFile(path) {
    state.file = path;
    state.fileText = null;
    Array.prototype.forEach.call(document.querySelectorAll(".tree .fnode"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-path") === path);
    });
    var wrap = document.getElementById("codeWrap");
    if (!wrap) return;
    var node = state.tree.filter(function (t) { return t.path === path; })[0];
    var size = node ? node.size : null;
    setViewHead(path, size);
    if (isBinary(path)) {
      wrap.innerHTML = '<div class="placeholder">This looks like a binary or media file, so it is not shown here.</div>';
      return;
    }
    if (size && size > MAX_FILE_BYTES) {
      wrap.innerHTML = '<div class="placeholder">This file is ' + bytes(size) + ' — large files are opened on demand.<br><br><button class="btn btn-primary" type="button" id="loadBig" style="height:38px;padding:0 16px">Load anyway</button></div>';
      var lb = document.getElementById("loadBig");
      if (lb) lb.addEventListener("click", function () { fetchFile(path); });
      return;
    }
    fetchFile(path);
  }

  function setViewHead(path, size) {
    var vh = document.querySelector(".view-head");
    if (!vh) return;
    var gh = "https://github.com/" + state.owner + "/" + state.repo + "/blob/" + state.branch + "/" + path;
    var raw = rawUrl(path);
    vh.innerHTML = '<span class="path mono" title="' + esc(path) + '">' + esc(path) + '</span>' +
      '<span class="meta">' + (size != null ? bytes(size) : "") + '</span>' +
      '<button class="icon-link" type="button" id="actCopy" aria-label="Copy raw URL">' + ICON.copy + '</button>' +
      '<a class="icon-link" href="' + esc(raw) + '" download aria-label="Download file">' + ICON.download + '</a>' +
      '<a class="icon-link" href="' + esc(gh) + '" target="_blank" rel="noopener noreferrer" aria-label="Open on GitHub">' + ICON.link + '</a>';
    var copy = document.getElementById("actCopy");
    if (copy) copy.addEventListener("click", function () { copyText(raw, copy); });
  }

  function fetchFile(path) {
    var wrap = document.getElementById("codeWrap");
    if (!wrap) return;
    wrap.innerHTML = '<div class="placeholder"><span class="mini-spinner" style="display:inline-block;vertical-align:middle"></span> Loading…</div>';
    rawText(path).then(function (text) {
      if (text == null) {
        wrap.innerHTML = '<div class="placeholder">Could not load this file. It may be private (add a token in Settings) or unavailable.</div>';
        return;
      }
      state.fileText = text;
      var lines = text.split("\n").length;
      wrap.innerHTML = '<pre><code class="hljs" id="codeBlock"></code></pre>';
      var code = document.getElementById("codeBlock");
      code.textContent = text;
      code.className = "hljs language-" + langFor(path);
      try { if (window.hljs) window.hljs.highlightElement(code); } catch (e) {}
      var meta = document.querySelector(".view-head .meta");
      if (meta) meta.textContent = lines.toLocaleString() + " lines";
    });
  }

  function copyText(text, btn) {
    var done = function () {
      var old = btn.getAttribute("aria-label");
      btn.innerHTML = ICON.check || ICON.copy;
      setTimeout(function () { btn.innerHTML = ICON.copy; btn.setAttribute("aria-label", old); }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, cb) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); cb(); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ------------------------------------------------------------------
     AI panel
     ------------------------------------------------------------------ */
  function aiPanel() {
    return '<section class="card ai-pane">' +
      '<div class="pane-head"><h3>AI assistant</h3><span class="badge-ai">' + ICON.spark + 'AI</span></div>' +
      '<div class="ai-actions">' +
        '<button class="ai-btn" type="button" data-task="readme">' + ICON.book + 'Generate README</button>' +
        '<button class="ai-btn" type="button" data-task="docs">' + ICON.file + 'Write documentation</button>' +
        '<button class="ai-btn" type="button" data-task="roadmap">' + ICON.map + 'What to add next</button>' +
        '<button class="ai-btn" type="button" data-task="explain">' + ICON.ask + 'Explain current file</button>' +
      '</div>' +
      '<div class="ai-ask">' +
        '<label for="aiQuestion" class="sr-only">Ask about this repository</label>' +
        '<input id="aiQuestion" type="text" placeholder="Ask anything about this repo…" autocomplete="off" />' +
        '<button id="aiAskBtn" class="btn btn-primary" type="button">Ask</button>' +
      '</div>' +
      '<div id="aiOutput"></div>' +
    '</section>';
  }

  function setAiButtons(disabled) {
    Array.prototype.forEach.call(document.querySelectorAll(".ai-btn, #aiAskBtn"), function (b) { b.disabled = disabled; });
  }

  function wireAi() {
    var pane = document.querySelector(".ai-pane");
    if (!pane) return;
    pane.addEventListener("click", function (e) {
      var task = e.target.closest(".ai-btn");
      if (task) { runAi(task.getAttribute("data-task")); return; }
      if (e.target.closest("#aiAskBtn")) {
        var q = document.getElementById("aiQuestion");
        if (q && q.value.trim().length >= 3) runAi("ask", q.value.trim());
        return;
      }
      var tab = e.target.closest(".ai-tab");
      if (tab) {
        var t = tab.getAttribute("data-tab");
        var act = tab.getAttribute("data-act");
        if (t) { state.aiTab = t; renderAiOutput(); }
        else if (act === "copy") copyText(state.aiText || "", tab);
        else if (act === "download") downloadText(state.aiText || "", (state.repo || "repository") + ".md");
      }
    });
  }

  function downloadText(text, filename) {
    var blob = new Blob([text], { type: "text/markdown" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function buildContext(includeFile) {
    var parts = [];
    var m = state.meta || {};
    parts.push("Repository: " + state.owner + "/" + state.repo);
    if (m.description) parts.push("Description: " + m.description);
    if (m.language) parts.push("Primary language: " + m.language);
    if (m.topics && m.topics.length) parts.push("Topics: " + m.topics.join(", "));
    if (m.license) parts.push("License: " + (m.license.spdx_id || m.license.name || ""));
    parts.push("Default branch: " + state.branch);
    var paths = state.tree.filter(function (t) { return t.type === "blob"; }).map(function (t) { return t.path; });
    parts.push("\nFile tree (" + paths.length + " files):\n" + paths.slice(0, 300).join("\n"));

    var wanted = ["README.md", "readme.md", "package.json", "pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod", "Gemfile", "composer.json", "Makefile", "tsconfig.json", "next.config.js", "vite.config.ts", "docker-compose.yml", "setup.py", "pom.xml"];
    var budget = 14000;
    var loaded = [];
    var jobs = wanted.filter(function (w) { return paths.indexOf(w) !== -1; }).slice(0, 6).map(function (w) {
      return rawText(w).then(function (text) {
        if (!text) return;
        var slice = text.slice(0, 4000);
        if (slice.length > budget) slice = slice.slice(0, budget);
        budget -= slice.length;
        loaded.push("--- " + w + " ---\n" + slice);
      });
    });
    return Promise.all(jobs).then(function () {
      if (includeFile && state.file && state.fileText) {
        loaded.push("--- current file: " + state.file + " ---\n" + state.fileText.slice(0, 6000));
      }
      if (loaded.length) parts.push("\nKey files:\n" + loaded.join("\n\n"));
      return parts.join("\n");
    });
  }

  function runAi(task, question) {
    var out = document.getElementById("aiOutput");
    if (!out) return;
    if (task === "explain" && !state.fileText) {
      out.innerHTML = '<div class="ai-out">' + notice("warn", "Open a file in the viewer first, then ask AI to explain it.") + "</div>";
      return;
    }
    out.innerHTML = '<div class="ai-out"><div class="ai-out-head"><h3>Working…</h3><span class="mini-spinner"></span></div></div>';
    setAiButtons(true);
    buildContext(task === "explain").then(function (context) {
      return fetch("/api/github-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task, context: context, question: question || "" })
      });
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (result) {
      setAiButtons(false);
      if (!result.ok) {
        var msg = (result.data && result.data.error) || "The AI request failed.";
        if (result.data && result.data.code === "no-key") msg = "AI is not switched on yet. Add <b>GROQ_API_KEY</b> to the site's environment to enable it.";
        out.innerHTML = '<div class="ai-out">' + notice("err", msg) + "</div>";
        return;
      }
      state.aiText = result.data.text || "";
      state.aiTab = "preview";
      renderAiOutput();
    }).catch(function () {
      setAiButtons(false);
      out.innerHTML = '<div class="ai-out">' + notice("err", "Could not reach the AI service. Please try again.") + "</div>";
    });
  }

  function renderAiOutput() {
    var out = document.getElementById("aiOutput");
    if (!out) return;
    var text = state.aiText || "";
    var body = state.aiTab === "raw" ? '<pre class="raw-md">' + esc(text) + "</pre>" : '<div class="md">' + mdToHtml(text) + "</div>";
    out.innerHTML = '<div class="ai-out"><div class="ai-out-head"><h3>AI result</h3><div class="ai-tabs">' +
      '<button class="ai-tab' + (state.aiTab === "preview" ? " on" : "") + '" type="button" data-tab="preview">Preview</button>' +
      '<button class="ai-tab' + (state.aiTab === "raw" ? " on" : "") + '" type="button" data-tab="raw">Markdown</button>' +
      '<button class="ai-tab" type="button" data-act="copy">Copy</button>' +
      '<button class="ai-tab" type="button" data-act="download">Download</button>' +
      "</div></div>" + body + "</div>";
  }

  function mdToHtml(md) {
    var lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
    var out = [];
    var inCode = false, codeBuf = [], listOpen = false;
    function inline(s) {
      s = esc(s);
      s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return s;
    }
    function closeList() { if (listOpen) { out.push("</ul>"); listOpen = false; } }
    lines.forEach(function (line) {
      if (/^```/.test(line)) {
        if (inCode) { out.push("<pre><code>" + esc(codeBuf.join("\n")) + "</code></pre>"); codeBuf = []; inCode = false; }
        else { closeList(); inCode = true; }
        return;
      }
      if (inCode) { codeBuf.push(line); return; }
      if (/^\s*$/.test(line)) { closeList(); return; }
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { closeList(); out.push("<h" + h[1].length + ">" + inline(h[2]) + "</h" + h[1].length + ">"); return; }
      if (/^\s*([-*])\s+/.test(line)) { if (!listOpen) { out.push("<ul>"); listOpen = true; } out.push("<li>" + inline(line.replace(/^\s*[-*]\s+/, "")) + "</li>"); return; }
      if (/^\s*>\s?/.test(line)) { closeList(); out.push("<blockquote>" + inline(line.replace(/^\s*>\s?/, "")) + "</blockquote>"); return; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { closeList(); out.push("<hr>"); return; }
      closeList();
      out.push("<p>" + inline(line) + "</p>");
    });
    if (inCode && codeBuf.length) out.push("<pre><code>" + esc(codeBuf.join("\n")) + "</code></pre>");
    closeList();
    return out.join("\n");
  }

  /* ------------------------------------------------------------------
     Recent & settings
     ------------------------------------------------------------------ */
  function readRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) { return []; } }
  function pushRecent(entry) {
    var list = readRecent().filter(function (r) { return r !== entry; });
    list.unshift(entry);
    list = list.slice(0, 10);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) {}
    renderRecent();
  }
  function renderRecent() {
    var list = readRecent();
    if (!list.length) { recentSection.hidden = true; return; }
    recentSection.hidden = false;
    recentList.innerHTML = list.map(function (r) {
      return '<button class="recent-item" type="button" data-r="' + esc(r) + '">' + esc(r) + "</button>";
    }).join("");
  }
  recentList.addEventListener("click", function (e) {
    var b = e.target.closest(".recent-item");
    if (b) run(b.getAttribute("data-r"));
  });
  clearRecentBtn.addEventListener("click", function () {
    try { localStorage.removeItem(RECENT_KEY); } catch (e) {}
    renderRecent();
  });

  function openSettings() {
    tokenInput.value = getToken();
    if (typeof settingsDlg.showModal === "function") settingsDlg.showModal();
    else settingsDlg.setAttribute("open", "");
  }
  settingsBtn.addEventListener("click", openSettings);
  tokenSave.addEventListener("click", function () {
    try { localStorage.setItem(TOKEN_KEY, tokenInput.value.trim()); } catch (e) {}
    if (typeof settingsDlg.close === "function") settingsDlg.close();
  });
  tokenClear.addEventListener("click", function () {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    tokenInput.value = "";
    if (typeof settingsDlg.close === "function") settingsDlg.close();
  });

  /* ------------------------------------------------------------------
     Events & init
     ------------------------------------------------------------------ */
  form.addEventListener("submit", function (e) { e.preventDefault(); run(input.value); });
  resultSlot.addEventListener("click", function (e) {
    var card = e.target.closest(".repo-card");
    if (!card) return;
    var full = card.getAttribute("data-repo").split("/");
    input.value = full[0] + "/" + full[1];
    loadRepo(full[0], full[1]);
  });
  window.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
      e.preventDefault(); input.focus(); input.select();
    }
    if (e.key === "Escape" && document.activeElement === input) input.blur();
  });

  renderRecent();
})();
