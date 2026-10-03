(() => {
  "use strict";
  const WORDS = [
    ["Serendipity", "/ˌserənˈdɪpɪti/", "noun", "A happy or useful discovery made by chance.", "Finding the perfect book in a forgotten box was pure serendipity.", "chance, discovery"],
    ["Ephemeral", "/ɪˈfemərəl/", "adjective", "Lasting for only a short time.", "The ephemeral glow of sunset faded into blue.", "fleeting, brief"],
    ["Petrichor", "/ˈpetrɪkɔːr/", "noun", "The pleasant earthy smell that follows rain on dry ground.", "Petrichor drifted through the open window after the shower.", "rain scent, earthiness"],
    ["Mellifluous", "/məˈlɪfluəs/", "adjective", "Sweet and smooth to hear.", "Her mellifluous voice made the old poem feel new.", "melodious, dulcet"],
    ["Quixotic", "/kwɪkˈsɒtɪk/", "adjective", "Idealistic in a way that is impractical or unrealistic.", "Their quixotic plan was to plant a forest in one weekend.", "idealistic, impractical"],
    ["Ubiquitous", "/juːˈbɪkwɪtəs/", "adjective", "Present or found almost everywhere.", "Bicycles are ubiquitous along the canal.", "pervasive, widespread"],
    ["Sonorous", "/ˈsɒnərəs/", "adjective", "Producing a deep, full, resonant sound.", "The sonorous bell carried across the valley.", "resonant, rich"],
    ["Inchoate", "/ɪnˈkoʊət/", "adjective", "Only just begun and not yet fully developed.", "An inchoate idea became a sketch in her notebook.", "nascent, unformed"],
    ["Ethereal", "/ɪˈθɪəriəl/", "adjective", "Delicate and light, as if not entirely of this world.", "An ethereal mist hung above the lake.", "delicate, otherworldly"],
    ["Resilient", "/rɪˈzɪliənt/", "adjective", "Able to recover after difficulty or change.", "The resilient garden grew back after the storm.", "adaptable, hardy"],
    ["Luminous", "/ˈluːmɪnəs/", "adjective", "Giving off light or appearing bright.", "Luminous windows lined the winter street.", "radiant, glowing"],
    ["Ineffable", "/ɪnˈefəbəl/", "adjective", "Too great or unusual to express fully in words.", "She felt an ineffable joy at seeing the sea again.", "indescribable, inexpressible"],
    ["Sonder", "/ˈsɒndər/", "noun · modern coinage", "The realization that other people have lives as complex as your own.", "The busy station filled him with a sense of sonder.", "awareness, perspective"],
    ["Halcyon", "/ˈhælsiən/", "adjective", "Peaceful and happy, especially when describing a past time.", "They remembered the halcyon summers at the cabin.", "tranquil, idyllic"],
    ["Lucid", "/ˈluːsɪd/", "adjective", "Clearly expressed or easy to understand.", "A lucid explanation helped everyone solve the puzzle.", "clear, intelligible"],
    ["Tenacious", "/təˈneɪʃəs/", "adjective", "Holding firmly to a goal or refusing to give up easily.", "The tenacious runner kept going through the rain.", "persistent, determined"],
    ["Sanguine", "/ˈsæŋɡwɪn/", "adjective", "Optimistic or hopeful, even in a difficult situation.", "She remained sanguine about the experiment.", "hopeful, confident"],
    ["Eloquent", "/ˈeləkwənt/", "adjective", "Expressing ideas clearly, fluently, and persuasively.", "His eloquent letter brought the neighbors together.", "expressive, articulate"],
    ["Ameliorate", "/əˈmiːliəreɪt/", "verb", "To make a difficult or unpleasant situation better.", "The new shade trees helped ameliorate the summer heat.", "improve, ease"],
    ["Incandescent", "/ˌɪnkænˈdesənt/", "adjective", "Emitting light because of heat; intensely bright.", "An incandescent filament lit the small room.", "glowing, brilliant"],
    ["Solace", "/ˈsɒləs/", "noun", "Comfort during sadness or distress.", "He found solace in tending the garden.", "comfort, consolation"],
    ["Gossamer", "/ˈɡɒsəmər/", "adjective", "Very light, thin, and delicate.", "Gossamer threads caught the morning dew.", "fine, delicate"],
    ["Equanimity", "/ˌekwəˈnɪmɪti/", "noun", "Calmness and composure, especially under pressure.", "She greeted the unexpected delay with equanimity.", "composure, calm"],
    ["Susurrus", "/suːˈsʌrəs/", "noun", "A soft whispering or rustling sound.", "The susurrus of leaves filled the quiet path.", "whisper, rustle"],
    ["Reverie", "/ˈrevəri/", "noun", "A state of pleasant daydreaming.", "The distant music drew him into a reverie.", "daydream, musing"],
    ["Aplomb", "/əˈplɒm/", "noun", "Self-confidence and calm skill in a demanding situation.", "She handled the tricky question with aplomb.", "poise, assurance"],
    ["Verisimilitude", "/ˌverɪsɪˈmɪlɪtjuːd/", "noun", "The appearance of being true or real.", "Small details gave the fictional town verisimilitude.", "realism, plausibility"],
    ["Nimble", "/ˈnɪmbəl/", "adjective", "Able to move or think quickly and easily.", "A nimble fox slipped between the trees.", "agile, quick"],
    ["Nascent", "/ˈnæsənt/", "adjective", "Just beginning to exist or develop.", "Their nascent community met around one kitchen table.", "emerging, budding"],
    ["Convivial", "/kənˈvɪviəl/", "adjective", "Friendly, lively, and enjoyable.", "A convivial dinner turned strangers into friends.", "sociable, welcoming"]
  ].map(([word, phonetic, partOfSpeech, definition, example, synonyms]) => ({ word, phonetic, partOfSpeech, definition, example, synonyms: synonyms.split(", ") }));
  const dayNumber = date => Math.floor(date.getTime() / 86400000);
  const wordForDay = date => WORDS[((dayNumber(date) % WORDS.length) + WORDS.length) % WORDS.length];
  // Export only pure vocabulary helpers for the Node regression harness.
  if (typeof module !== "undefined" && module.exports) { module.exports = { WORDS, wordForDay, dayNumber }; return; }
  const $ = id => document.getElementById(id);
  const STORAGE = "worddev_favorites"; // Keep existing saved words on upgrade.
  let favorites = [];
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE) || "[]");
    if (Array.isArray(data)) favorites = data.filter(item => item && typeof item.word === "string" && typeof item.definition === "string").filter((item, index, all) => all.findIndex(other => other.word.toLowerCase() === item.word.toLowerCase()) === index).slice(0, 300);
  } catch { /* A corrupt or blocked store must not prevent daily words. */ }
  let offset = 0, current = null, randomMode = false, lastDay = dayNumber(new Date());
  let questions = [], questionIndex = 0, score = 0, answered = false;
  const status = text => { $("status").textContent = text; };
  function render(entry, label) {
    current = entry;
    $("date-label").textContent = label;
    $("word-title").textContent = entry.word;
    $("phonetic").textContent = entry.phonetic || "";
    $("part-of-speech").textContent = entry.partOfSpeech || "word";
    $("definition").textContent = entry.definition;
    $("example").textContent = entry.example ? `“${entry.example}”` : "Try writing your own sentence with this word.";
    $("synonyms").replaceChildren();
    for (const synonym of Array.isArray(entry.synonyms) ? entry.synonyms : []) {
      const chip = document.createElement("span"); chip.textContent = synonym; $("synonyms").append(chip);
    }
    updateSave();
  }
  function showDay() {
    randomMode = false;
    const date = new Date((dayNumber(new Date()) + offset) * 86400000);
    render(wordForDay(date), `${offset === 0 ? "TODAY · " : ""}${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} · UTC`);
    $("next").disabled = offset >= 0;
  }
  function updateSave() {
    const saved = favorites.some(item => item.word.toLowerCase() === current.word.toLowerCase());
    $("save").textContent = saved ? "✓ Saved word" : "♡ Save word";
    $("save").setAttribute("aria-pressed", String(saved));
  }
  function persist() {
    try { localStorage.setItem(STORAGE, JSON.stringify(favorites)); }
    catch { status("Your browser blocked saving. This collection will last only while the page stays open."); }
    renderSaved(); updateSave();
  }
  function renderSaved() {
    $("saved-count").textContent = String(favorites.length);
    $("clear-saved").hidden = !favorites.length;
    const query = $("saved-search").value.trim().toLowerCase();
    const matches = favorites.filter(item => `${item.word} ${item.definition}`.toLowerCase().includes(query));
    $("saved-list").replaceChildren();
    if (!matches.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = query ? "No saved words match." : "Your next favorite word belongs here. Save one to begin."; $("saved-list").append(p); }
    for (const item of matches) {
      const row = document.createElement("div"); row.className = "saved-item";
      const view = document.createElement("button"); view.className = "view-saved";
      const title = document.createElement("strong"); title.textContent = item.word;
      const detail = document.createElement("small"); detail.textContent = item.definition;
      view.append(title, detail); view.onclick = () => { randomMode = true; render(item, "FROM YOUR COLLECTION"); $("next").disabled = true; $("word-title").scrollIntoView({ block: "center" }); };
      const remove = document.createElement("button"); remove.className = "remove-saved"; remove.textContent = "×"; remove.setAttribute("aria-label", `Remove ${item.word}`);
      remove.onclick = () => { favorites = favorites.filter(word => word.word !== item.word); persist(); };
      row.append(view, remove); $("saved-list").append(row);
    }
  }
  function shuffle(list) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function quizQuestion() {
    answered = false; $("quiz-options").replaceChildren(); $("quiz-feedback").textContent = ""; $("quiz-next").disabled = true;
    if (questionIndex === questions.length) {
      $("quiz-progress").textContent = "QUIZ COMPLETE"; $("quiz-word").textContent = `${score} out of ${questions.length}`;
      $("quiz-next").hidden = true; $("start-quiz").hidden = false; $("start-quiz").textContent = "Try another quiz →"; return;
    }
    const word = questions[questionIndex];
    $("quiz-progress").textContent = `QUESTION ${questionIndex + 1} / ${questions.length} · SCORE ${score}`;
    $("quiz-word").textContent = word.word; $("quiz-next").hidden = false;
    const options = shuffle([word, ...shuffle(WORDS.filter(item => item.word !== word.word)).slice(0, 2)]);
    for (const option of options) {
      const button = document.createElement("button"); button.textContent = option.definition;
      button.onclick = () => {
        if (answered) return; answered = true;
        const correct = option.word === word.word; if (correct) score++;
        for (const choice of $("quiz-options").children) { choice.disabled = true; if (choice.textContent === word.definition) choice.classList.add("correct"); }
        if (!correct) button.classList.add("incorrect");
        $("quiz-feedback").textContent = correct ? "Exactly right. Keep going!" : `The meaning is: ${word.definition}`;
        $("quiz-next").disabled = false;
      };
      $("quiz-options").append(button);
    }
  }
  $("previous").onclick = () => { offset--; showDay(); };
  $("next").onclick = () => { if (offset < 0) offset++; showDay(); };
  $("today").onclick = () => { offset = 0; showDay(); };
  $("random").onclick = () => { randomMode = true; const pool = WORDS.filter(item => item.word !== current.word); render(pool[Math.floor(Math.random() * pool.length)], "A RANDOM DISCOVERY"); $("next").disabled = true; };
  $("save").onclick = () => {
    const index = favorites.findIndex(item => item.word.toLowerCase() === current.word.toLowerCase());
    if (index >= 0) { favorites.splice(index, 1); status("Word removed from your collection."); }
    else { favorites.unshift({ ...current }); status("Word added to your collection."); }
    persist();
  };
  $("saved-search").oninput = renderSaved;
  $("clear-saved").onclick = () => { if (confirm("Clear all saved words from this browser?")) { favorites = []; persist(); status("Collection cleared."); } };
  $("pronounce").onclick = () => {
    if (!("speechSynthesis" in window)) { status("Pronunciation is not supported by this browser."); return; }
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(current.word); utterance.lang = "en-US"; utterance.rate = .85;
    utterance.onerror = () => status("Pronunciation is unavailable on this device. The phonetic spelling is shown above.");
    speechSynthesis.speak(utterance); status(`Pronouncing ${current.word}.`);
  };
  $("copy").onclick = async () => {
    try { await navigator.clipboard.writeText(`${current.word} (${current.partOfSpeech}): ${current.definition}\n${current.example || ""}`); status("Definition copied."); }
    catch { status("Clipboard access was blocked. Select the definition above to copy it manually."); }
  };
  $("export").onclick = () => {
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 630; const ctx = canvas.getContext("2d");
    if (!ctx) { status("Card export is unavailable in this browser."); return; }
    ctx.fillStyle = "#f5f2e9"; ctx.fillRect(0, 0, 1200, 630); ctx.fillStyle = "#276346"; ctx.font = "20px sans-serif"; ctx.fillText("BASE31 / WORD OF THE DAY", 70, 80);
    ctx.fillStyle = "#252e28"; ctx.font = "58px Georgia"; ctx.fillText(current.word, 70, 190, 1050);
    ctx.font = "28px sans-serif"; let line = "", y = 270;
    for (const word of current.definition.split(" ")) { if (ctx.measureText(`${line}${word} `).width > 1040) { ctx.fillText(line, 70, y); y += 44; line = ""; } line += `${word} `; }
    ctx.fillText(line, 70, y); ctx.font = "20px sans-serif"; ctx.fillText("wordoftheday.base31.org", 70, 560);
    const link = document.createElement("a"); link.download = `${current.word.toLowerCase()}-base31.png`; link.href = canvas.toDataURL("image/png"); link.click(); status("Word card downloaded.");
  };
  $("start-quiz").onclick = () => { questions = shuffle(WORDS).slice(0, 5); questionIndex = 0; score = 0; $("quiz-content").hidden = false; $("start-quiz").hidden = true; quizQuestion(); };
  $("quiz-next").onclick = () => { if (answered) { questionIndex++; quizQuestion(); } };
  function theme(value) { document.documentElement.dataset.theme = value; $("theme").setAttribute("aria-label", `Switch to ${value === "dark" ? "light" : "dark"} theme`); }
  let initialTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  try { const saved = localStorage.getItem("worddev-theme"); if (["light", "dark"].includes(saved)) initialTheme = saved; } catch {}
  theme(initialTheme);
  $("theme").onclick = () => { const value = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; theme(value); try { localStorage.setItem("worddev-theme", value); } catch { status("Theme changed for this visit; browser storage is blocked."); } };
  function checkDay() { const day = dayNumber(new Date()); if (!document.hidden && day !== lastDay) { lastDay = day; if (!randomMode) showDay(); } }
  document.addEventListener("visibilitychange", checkDay);
  window.setInterval(checkDay, 60000);
  showDay(); renderSaved();
})();
