/* ============================================================
   Password Generator — strong random passwords and passphrases,
   plus a vault encrypted with a master passphrase (PBKDF2 + AES-GCM).
   Everything runs locally; nothing is ever uploaded.
   ============================================================ */
(function () {
  "use strict";

  var el = function (id) { return document.getElementById(id); };
  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var VAULT_STORE = "pwgen:vault";
  var PBKDF2_ITERATIONS = 210000;

  /* ---------- character sets ---------- */
  var CHARS = {
    lower: "abcdefghijklmnopqrstuvwxyz",
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    digits: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.?/"
  };
  var AMBIGUOUS = /[Il1O0o]/g;

  /* ---------- passphrase word list ---------- */
  var WORDS = ("able acid acorn actor adopt agent alarm album alert alkali amber anchor angle animal answer apple apron archer argue arrow ash atom attic august aurora autumn avenue bacon badge bagel balance bamboo banana banner barrel basket beacon beaver bench berry bicycle birch biscuit blanket blast bloom blossom board bolt bonfire border bottle boulder bouquet bracket brave bread breeze brick bridge bright bronze brook broom bubble bucket buffalo bugle bundle butter button cabbage cactus candle canoe canvas canyon carbon carpet carrot castle cedar cement chalk cherry chess chief cinder circle citrus clay clever cliff cloak cloud clover cobalt cocoa coffee comet compass concert copper coral cosmos cotton county cove crane crater crayon cream creek crest crimson crisp crystal cube curtain cyclone dahlia daisy dancer dawn decoy delta denim desert diamond digital dingo dinner dolphin domino donut dragon drift dune dusk eagle early easel east echo eclipse edge ember emerald engine envoy epic equator essence estate ethic evening exact fable fabric factor fairy falcon fang fantasy farm feather fern fiddle figure filter final finch fjord flame flint flock flute foggy forest forge fossil fountain foxglove frame freedom frontier frost galaxy garden garnet gateway gentle geyser ginger glacier glade glimpse globe glory glowing gold granite grape gravel green grove guardian guitar gulf gust habit hammer harbor harvest haven hazel heather helium helmet heron hickory hollow honey horizon humble hunter iceberg igloo image impact indigo ink inlet island ivory jackal jade jaguar jelly jersey jigsaw jolly journal journey joy judge juggle jumbo jungle juniper kayak kernel kettle keystone kindle kingdom kite kiwi koala lagoon ladder lantern lapis lark laser latch lattice laurel lava lavender leader legacy lemon leopard level liberty lichen lift lighthouse lilac lily limber linen lion lizard llama lobby lodge logic lotus lucid lumber lunar lupine lyric magma magnet magnolia mahogany maize majestic mango manor maple marble margin marina market marlin marsh marvel matador meadow medley melody mentor mercury merge mesa meteor midland midnight migrate mild mint mirror mission mist mitten moccasin modest molten moment monsoon moon mosaic moss motion mottled mound mountain mule mural muscle museum music mustard napkin narrow native nectar needle neon nest nickel nifty nimble noble nomad north notch nova nugget nutmeg oak oasis ocean ocelot odyssey offer offset olive omega onion opal opera orbit orchard orchid origin osprey otter outfit oval oven owl oxide oyster pace packet paddle pagoda palace palm panda panel panther paper papaya parade parcel parka parlor parsnip pasta path patent patio pattern pause pavilion peacock pearl pebble pecan pedal pelican pencil pendant penguin pepper petal phantom phoenix piano pickle picnic pigment pilot pinion pioneer pistachio piston pitch pivot pixel plasma plateau platinum player plaza plume plush pocket polar polish pollen pond poplar poppy portal poster pottery prairie prism prowl prudence puddle puffin pulse pumice pumpkin puzzle pyramid python quartz quasar queen quest quill quilt quince quiver rabbit raccoon radar rafter rail rainbow rally ramble ranch raven ravine reactor realm rebel recall recipe refuge regal relic remedy render renegade revere reverie rhino ribbon ridge riddle rind ripple river robin rocket rodent rogue root rosin roster rotate rover royal rubicon ruby rugged ruler rumor rune rustic saber saddle safari saffron sage sailor salute samba sample sanctuary sandal sapphire satellite satin savanna scarf scarlet scholar scone scooter scout scree scroll sculpt seal secret sedge seek seismic sentry sequel serene sesame settle seven shade shadow shale shanty shape shark sheaf shelter sheriff shimmer shingle shiny ship shore shrub sierra sift silent silica silo silver simmer simple siren sketch sky slate sleek slender sloop slope smith smolder smooth snapshot snowy socket solar soldier solid solstice sonata sonnet sorbet sorter sound source south sower spade spark sparrow spice spike spindle spiral spirit splash spring sprout spruce spur squad square squash squid stable stadium stagger stammer standard starling static station steady steam steel stellar stencil step stern stew stone stork storm stow strand stream stride strike strong studio stump sturdy submit subtle sudden sugar sultan summer summit sunbeam sundial sunrise sunset superb supply surf surge swallow swamp swan sweater swift swing sycamore symbol syrup system table tablet tally talon tandem tangelo tapestry taper target tavern teak teal temple tenure terrace terrain textile thaw theater thermal thicket thimble thistle thorn thunder tidal tiger timber tinder tinsel titan toad toffee token tolerant tomato tonic topaz torch torus totem toucan tower trace tractor trail transit trapper travel treasure treaty trellis trench trestle triangle tribe tribute trident trilogy trinket triton tropic trotter truffle trumpet trust tulip tundra tunnel turbine turquoise turtle tusk tuxedo twilight twig umber umbrella unicorn union unique unite unripe unwind upbeat uphill upward urchin useful utopia vacant valley valor valve vanguard vanilla vapor vault vector velour velvet venture venus verdant verge vermilion vertex vessel vibrant victory viaduct vigil viking village vine vintage violet viper virtue vision vista vital vivid vocal voyage vulture wafer wagon walnut walrus wander warbler ward warm wasabi water wattle wave weaver wedge welcome wester whale wheat wheel whimsy whisker whisper whittle wild willow wind winter wisdom wisp wisteria wolf wolverine wonder woodland wool worth wrangler wreath wrist yarrow yearn yellow yonder young yucca zephyr zeppelin zest zigzag zinc zinnia zodiac").split(" ");

  /* ============================================================
     Small crypto helpers
     ============================================================ */
  function randomBytes(n) {
    var a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
  }
  function randInt(max) {
    // Rejection sampling keeps the distribution uniform.
    var limit = Math.floor(4294967296 / max) * max;
    var buf = new Uint32Array(1);
    var x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % max;
  }
  function bytesToB64(buf) {
    var b = new Uint8Array(buf), s = "";
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function b64ToBytes(str) {
    var bin = atob(str), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function deriveKey(passphrase, salt, iterations) {
    return crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
          base,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
      });
  }

  /* ============================================================
     Generator
     ============================================================ */
  var current = "";

  function genOptions() {
    return {
      passphrase: el("fPassphrase").checked,
      length: parseInt(el("fLength").value, 10),
      lower: el("fLower").checked,
      upper: el("fUpper").checked,
      digits: el("fDigits").checked,
      symbols: el("fSymbols").checked,
      noAmbiguous: el("fNoAmbiguous").checked,
      words: parseInt(el("fWords").value, 10),
      separator: el("fSeparator").value,
      capitalize: el("fCapitalize").checked,
      addNumber: el("fAddNumber").value === "1"
    };
  }

  function buildPassword(o) {
    var classes = [];
    if (o.lower) classes.push(CHARS.lower);
    if (o.upper) classes.push(CHARS.upper);
    if (o.digits) classes.push(CHARS.digits);
    if (o.symbols) classes.push(CHARS.symbols);
    if (!classes.length) return { value: "", entropy: 0, error: "Select at least one character type." };

    var cleaned = classes.map(function (c) {
      return o.noAmbiguous ? c.replace(AMBIGUOUS, "") : c;
    }).filter(function (c) { return c.length > 0; });
    if (!cleaned.length) return { value: "", entropy: 0, error: "All characters were filtered out. Re-enable a type." };

    var seen = {};
    cleaned.forEach(function (c) {
      for (var i = 0; i < c.length; i++) seen[c.charAt(i)] = true;
    });
    var pool = Object.keys(seen);

    var out = [];
    if (o.length >= cleaned.length) {
      cleaned.forEach(function (c) { out.push(c.charAt(randInt(c.length))); });
    }
    while (out.length < o.length) out.push(pool[randInt(pool.length)]);
    for (var j = out.length - 1; j > 0; j--) {
      var k = randInt(j + 1);
      var t = out[j]; out[j] = out[k]; out[k] = t;
    }
    return { value: out.slice(0, o.length).join(""), entropy: o.length * Math.log2(pool.length), error: null };
  }

  function buildPassphrase(o) {
    var parts = [];
    for (var i = 0; i < o.words; i++) {
      var w = WORDS[randInt(WORDS.length)];
      if (o.capitalize) w = w.charAt(0).toUpperCase() + w.slice(1);
      parts.push(w);
    }
    var value = parts.join(o.separator);
    var entropy = o.words * Math.log2(WORDS.length);
    if (o.addNumber) {
      value += o.separator + randInt(100);
      entropy += Math.log2(100);
    }
    return { value: value, entropy: entropy, error: null };
  }

  var STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Excellent"];
  var STRENGTH_COLORS = ["var(--danger)", "var(--warn)", "#eab308", "var(--accent)", "var(--accent-strong)"];
  function strengthLevel(bits) {
    if (bits < 28) return 0;
    if (bits < 45) return 1;
    if (bits < 70) return 2;
    if (bits < 100) return 3;
    return 4;
  }

  function generate() {
    var o = genOptions();
    var r = o.passphrase ? buildPassphrase(o) : buildPassword(o);
    var out = el("pwOut");
    if (r.error) {
      current = "";
      out.textContent = r.error;
      out.classList.add("muted");
      el("meterLabel").textContent = "—";
      el("meterEntropy").textContent = "—";
      el("meterFill").style.width = "0%";
      return;
    }
    current = r.value;
    out.textContent = r.value;
    out.classList.remove("muted");

    var bits = Math.round(r.entropy);
    var level = strengthLevel(bits);
    var label = STRENGTH_LABELS[level];
    if (level < 3) label += " — add length";
    el("meterLabel").textContent = label;
    el("meterEntropy").textContent = bits + " bits";
    el("meterFill").style.width = Math.min(100, Math.round((bits / 128) * 100)) + "%";
    el("meterFill").style.background = STRENGTH_COLORS[level];
  }

  function syncMode() {
    var pass = el("fPassphrase").checked;
    el("charOpts").hidden = pass;
    el("passOpts").hidden = !pass;
    el("lenVal").textContent = el("fLength").value;
    el("wordsVal").textContent = el("fWords").value;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }
  function flash(btn, label) {
    var original = btn.innerHTML;
    btn.textContent = label;
    window.setTimeout(function () { btn.innerHTML = original; }, 1200);
  }

  /* ============================================================
     Vault
     ============================================================ */
  var vaultKey = null;
  var vaultMeta = null;
  var vaultEntries = [];
  var vaultOpen = false;
  var editingId = null;
  var lockTimer = null;

  function storedBlob() {
    try {
      var raw = localStorage.getItem(VAULT_STORE);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function vaultExists() { return !!storedBlob(); }

  function showVaultError(msg, ok) {
    var box = el("vaultError");
    if (!msg) { box.hidden = true; box.textContent = ""; return; }
    box.textContent = msg;
    box.hidden = false;
    box.className = "vault-error" + (ok ? " ok" : "");
    box.style.margin = "16px 18px 0";
  }

  function persist() {
    if (!vaultKey) return Promise.resolve();
    var iv = randomBytes(12);
    return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, vaultKey, enc.encode(JSON.stringify(vaultEntries)))
      .then(function (ct) {
        var blob = {
          v: 1,
          kdf: "PBKDF2-SHA256",
          iterations: vaultMeta.iterations,
          salt: bytesToB64(vaultMeta.salt),
          iv: bytesToB64(iv),
          ct: bytesToB64(ct)
        };
        try { localStorage.setItem(VAULT_STORE, JSON.stringify(blob)); }
        catch (e) { showVaultError("Could not write the vault to browser storage."); }
      });
  }

  function openVault() {
    vaultOpen = true;
    el("vaultLocked").hidden = true;
    el("vaultUnlocked").hidden = false;
    el("vaultLockBadge").hidden = false;
    showVaultError("");
    renderVault();
    scheduleLock();
  }

  function lockVault() {
    vaultKey = null;
    vaultMeta = null;
    vaultEntries = [];
    vaultOpen = false;
    editingId = null;
    closeModal();
    if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
    el("vaultUnlocked").hidden = true;
    el("vaultLocked").hidden = false;
    el("vaultLockBadge").hidden = true;
    el("vaultUnlockPass").value = "";
    el("createForm").hidden = vaultExists();
    el("unlockForm").hidden = !vaultExists();
    var intro = el("vaultIntro");
    if (intro) intro.hidden = vaultExists();
  }

  function refreshLockedForms() {
    var exists = vaultExists();
    el("createForm").hidden = exists;
    el("unlockForm").hidden = !exists;
    var intro = el("vaultIntro");
    if (intro) intro.hidden = exists;
  }

  function scheduleLock() {
    if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
    if (!vaultOpen) return;
    var mins = parseInt(el("autoLock").value, 10) || 0;
    if (mins <= 0) return;
    lockTimer = window.setTimeout(lockVault, mins * 60000);
  }

  function doUnlock() {
    var pass = el("vaultUnlockPass").value;
    var blob = storedBlob();
    if (!blob) { showVaultError("No vault found in this browser."); return; }
    if (!pass) { showVaultError("Enter your master passphrase."); return; }
    showVaultError("");
    var salt = b64ToBytes(blob.salt);
    deriveKey(pass, salt, blob.iterations).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(blob.iv) }, key, b64ToBytes(blob.ct))
        .then(function (pt) {
          var parsed = JSON.parse(dec.decode(new Uint8Array(pt)));
          vaultEntries = Array.isArray(parsed) ? parsed : [];
          vaultKey = key;
          vaultMeta = { iterations: blob.iterations, salt: salt };
          el("vaultUnlockPass").value = "";
          openVault();
        });
    }).catch(function () {
      showVaultError("That passphrase did not unlock the vault. Try again.");
    });
  }

  function doCreate() {
    var pass = el("vaultPass").value;
    var pass2 = el("vaultPass2").value;
    if (pass.length < 8) { showVaultError("Use a master passphrase of at least 8 characters."); return; }
    if (pass !== pass2) { showVaultError("The two passphrases do not match."); return; }
    showVaultError("");
    var salt = randomBytes(16);
    deriveKey(pass, salt, PBKDF2_ITERATIONS).then(function (key) {
      vaultKey = key;
      vaultMeta = { iterations: PBKDF2_ITERATIONS, salt: salt };
      vaultEntries = [];
      el("vaultPass").value = "";
      el("vaultPass2").value = "";
      return persist().then(openVault);
    }).catch(function () {
      showVaultError("Could not create the vault in this browser.");
    });
  }

  function forgetVault() {
    if (!window.confirm("Delete the vault from this browser? If you have not exported a backup, the saved entries are gone for good.")) return;
    try { localStorage.removeItem(VAULT_STORE); } catch (e) {}
    lockVault();
    showVaultError("Vault deleted from this browser.", true);
  }

  function renderVault() {
    var list = el("vaultList");
    var q = (el("vaultSearch").value || "").trim().toLowerCase();
    el("vaultCount").textContent = vaultEntries.length + (vaultEntries.length === 1 ? " entry" : " entries");

    var items = vaultEntries.filter(function (e) {
      if (!q) return true;
      return ((e.label || "") + " " + (e.user || "") + " " + (e.url || "")).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      return String(a.label || "").localeCompare(String(b.label || ""));
    });

    list.textContent = "";
    if (!items.length) {
      var empty = document.createElement("div");
      empty.className = "vault-empty";
      empty.textContent = vaultEntries.length
        ? "No entries match that search."
        : "Your vault is empty. Generate a password above, then use Save to vault — or add an entry by hand.";
      list.appendChild(empty);
      return;
    }
    items.forEach(function (entry) { list.appendChild(buildRow(entry)); });
  }

  function buildRow(entry) {
    var row = document.createElement("div");
    row.className = "vault-row";

    var main = document.createElement("div");
    var label = document.createElement("div");
    label.className = "vr-label";
    label.textContent = entry.label || "Untitled";
    main.appendChild(label);
    if (entry.user) {
      var user = document.createElement("div");
      user.className = "vr-user";
      user.textContent = entry.user;
      main.appendChild(user);
    }

    var pass = document.createElement("div");
    pass.className = "vr-pass";
    var masked = entry.pass ? "•".repeat(Math.min(entry.pass.length, 14)) : "—";
    pass.textContent = masked;

    var actions = document.createElement("div");
    actions.className = "vr-actions";

    var reveal = iconButton("Show password", eyeSvg());
    reveal.addEventListener("click", function () {
      if (pass.textContent === masked) { pass.textContent = entry.pass || "—"; reveal.innerHTML = eyeOffSvg(); }
      else { pass.textContent = masked; reveal.innerHTML = eyeSvg(); }
    });
    actions.appendChild(reveal);

    var copy = iconButton("Copy password", copySvg());
    copy.addEventListener("click", function () {
      copyText(entry.pass || "").then(function (ok) { if (ok) flash(copy, "✓"); });
    });
    actions.appendChild(copy);

    var edit = iconButton("Edit entry", pencilSvg());
    edit.addEventListener("click", function () { openModal(entry); });
    actions.appendChild(edit);

    row.appendChild(main);
    row.appendChild(pass);
    row.appendChild(actions);
    return row;
  }

  function iconButton(label, svg) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn sm";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.innerHTML = svg;
    return b;
  }
  function svgWrap(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>";
  }
  function eyeSvg() { return svgWrap('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'); }
  function eyeOffSvg() { return svgWrap('<path d="M3 3l18 18"/><path d="M10.6 5.2A10.5 10.5 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.2 6.3A17 17 0 0 0 2 12s3.6 7 10 7a10.4 10.4 0 0 0 3.6-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'); }
  function copySvg() { return svgWrap('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'); }
  function pencilSvg() { return svgWrap('<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="m14 6 4 4"/>'); }

  /* ============================================================
     Entry editor modal
     ============================================================ */
  function openModal(entry, presetPass) {
    editingId = entry ? entry.id : null;
    el("entryTitle").textContent = entry ? "Edit entry" : "Add entry";
    el("eLabel").value = entry ? entry.label || "" : "";
    el("eUser").value = entry ? entry.user || "" : "";
    el("ePass").value = entry ? entry.pass || "" : (presetPass || "");
    el("eUrl").value = entry ? entry.url || "" : "";
    el("eNotes").value = entry ? entry.notes || "" : "";
    el("entryDelete").hidden = !entry;
    el("entryModal").hidden = false;
    window.setTimeout(function () { el("eLabel").focus(); }, 0);
  }
  function closeModal() {
    el("entryModal").hidden = true;
    editingId = null;
  }
  function saveEntry() {
    if (!vaultOpen) { closeModal(); return; }
    var label = el("eLabel").value.trim();
    var user = el("eUser").value.trim();
    var pass = el("ePass").value;
    var url = el("eUrl").value.trim();
    var notes = el("eNotes").value.trim();
    if (!label && !user && !pass && !url) return;
    if (!label) label = url || "Untitled";

    if (editingId) {
      var found = false;
      vaultEntries.forEach(function (e) {
        if (e.id === editingId) {
          e.label = label; e.user = user; e.pass = pass; e.url = url; e.notes = notes; e.updated = Date.now();
          found = true;
        }
      });
      if (!found) vaultEntries.push({ id: uid(), label: label, user: user, pass: pass, url: url, notes: notes, updated: Date.now() });
    } else {
      vaultEntries.push({ id: uid(), label: label, user: user, pass: pass, url: url, notes: notes, updated: Date.now() });
    }
    persist().then(function () { renderVault(); closeModal(); });
  }
  function deleteEntry() {
    if (!editingId) return;
    var id = editingId;
    vaultEntries = vaultEntries.filter(function (e) { return e.id !== id; });
    persist().then(function () { renderVault(); closeModal(); });
  }

  /* ============================================================
     Backup import / export
     ============================================================ */
  function download(filename, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportBackup() {
    var blob = storedBlob();
    if (!blob) { showVaultError("There is no vault to export yet."); return; }
    download("base31-password-vault-backup.json", JSON.stringify(blob, null, 2), "application/json");
    showVaultError("Encrypted backup downloaded. Keep it with your master passphrase.", true);
  }
  function importFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try { parsed = JSON.parse(String(reader.result)); }
      catch (e) { showVaultError("That file is not a valid vault backup."); return; }

      if (parsed && parsed.ct && parsed.salt) {
        try { localStorage.setItem(VAULT_STORE, JSON.stringify(parsed)); }
        catch (e) { showVaultError("Could not write the vault to browser storage."); return; }
        lockVault();
        refreshLockedForms();
        showVaultError("Backup restored. Unlock it with that vault's master passphrase.", true);
        return;
      }
      if (Array.isArray(parsed)) {
        if (!vaultOpen) { showVaultError("Unlock your vault before importing a plain list of entries."); return; }
        var added = 0;
        parsed.forEach(function (e) {
          if (!e || typeof e !== "object") return;
          vaultEntries.push({
            id: uid(),
            label: String(e.label || e.name || "Imported"),
            user: String(e.user || e.username || ""),
            pass: String(e.pass || e.password || ""),
            url: String(e.url || e.site || ""),
            notes: String(e.notes || ""),
            updated: Date.now()
          });
          added++;
        });
        persist().then(function () {
          renderVault();
          showVaultError(added + (added === 1 ? " entry imported." : " entries imported."), true);
        });
        return;
      }
      showVaultError("That file is not a recognized vault backup.");
    };
    reader.readAsText(file);
  }

  /* ============================================================
     Theme
     ============================================================ */
  var SUN = svgWrap('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>');
  var MOON = svgWrap('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>');
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("pw:theme", t); } catch (e) {}
    el("themeBtn").innerHTML = t === "dark" ? SUN : MOON;
  }
  function toggleTheme() {
    var t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(t);
  }

  /* ============================================================
     Wiring
     ============================================================ */
  function wire() {
    el("themeBtn").innerHTML = document.documentElement.getAttribute("data-theme") === "dark" ? SUN : MOON;
    el("themeBtn").addEventListener("click", toggleTheme);

    // Generator controls
    ["fPassphrase", "fLength", "fLower", "fUpper", "fDigits", "fSymbols", "fNoAmbiguous",
      "fWords", "fSeparator", "fCapitalize", "fAddNumber"].forEach(function (id) {
      el(id).addEventListener("input", function () { syncMode(); generate(); });
      el(id).addEventListener("change", function () { syncMode(); generate(); });
    });
    el("genBtn").addEventListener("click", generate);
    el("regenBtn").addEventListener("click", generate);
    el("copyPw").addEventListener("click", function () {
      if (!current) return;
      var btn = el("copyPw");
      copyText(current).then(function (ok) { if (ok) flash(btn, "Copied"); });
    });
    el("savePw").addEventListener("click", function () {
      if (!current) return;
      if (!vaultOpen) {
        showVaultError("Unlock your vault below, then press Save to vault again.");
        var v = el("vault");
        if (v && v.scrollIntoView) v.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      openModal(null, current);
    });

    // Vault locking
    el("vaultCreate").addEventListener("click", doCreate);
    el("vaultUnlock").addEventListener("click", doUnlock);
    el("vaultForget").addEventListener("click", forgetVault);
    el("vaultPass2").addEventListener("keydown", function (e) { if (e.key === "Enter") doCreate(); });
    el("vaultUnlockPass").addEventListener("keydown", function (e) { if (e.key === "Enter") doUnlock(); });

    // Vault toolbar
    el("vaultSearch").addEventListener("input", renderVault);
    el("addEntry").addEventListener("click", function () { openModal(null); });
    el("lockBtn").addEventListener("click", function () { lockVault(); showVaultError("Vault locked.", true); });
    el("autoLock").addEventListener("change", scheduleLock);
    el("exportBtn").addEventListener("click", exportBackup);
    el("importBtn").addEventListener("click", function () { el("importFile").click(); });
    el("importFile").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      importFile(file);
      e.target.value = "";
    });

    // Modal
    el("entrySave").addEventListener("click", saveEntry);
    el("entryDelete").addEventListener("click", deleteEntry);
    el("entryCancel").addEventListener("click", closeModal);
    el("entryClose").addEventListener("click", closeModal);
    el("entryModal").addEventListener("click", function (e) { if (e.target === el("entryModal")) closeModal(); });
    el("entryGen").addEventListener("click", function () {
      var o = genOptions();
      o.passphrase = false;
      var r = buildPassword(o);
      if (!r.error) el("ePass").value = r.value;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !el("entryModal").hidden) closeModal();
    });

    // Auto-lock on inactivity
    ["click", "keydown", "pointerdown"].forEach(function (ev) {
      document.addEventListener(ev, function () { if (vaultOpen) scheduleLock(); }, { passive: true });
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      if (vaultOpen) scheduleLock();
    });

    refreshLockedForms();
    syncMode();
    generate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
