import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function mount(file, props, globals = {}, imports = {}) {
  let cursor = 0;
  const slots = [];
  let effects = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn) { cursor++; return fn; },
    useEffect(fn) { cursor++; effects.push(fn); },
  };
  const jsx = (type, props) => ({ type, props });
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  const require = id => {
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id in imports) return imports[id];
    throw new Error(`Unexpected import ${id}`);
  };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(require, module, module.exports, ...Object.values(globals));
  return {
    render() { cursor = 0; effects = []; return module.exports.default(props); },
    effects() { return effects.map(fn => fn()).filter(fn => typeof fn === 'function'); },
  };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

let hold;
const scrolls = [];
const sections = Array.from({ length: 14 }, (_, index) => ({ id: `s${index}`, label: `Section ${index}` }));
const node = { clientHeight: 152, setPointerCapture() {}, hasPointerCapture: () => false, contains: () => true };
const button = { dataset: { index: '3' }, setPointerCapture(id) { assert.equal(id, 1); } };
const rail = mount('components/section-rail.tsx', { sections }, {
  window: { matchMedia: () => ({ matches: false }), scrollY: 0, scrollTo: options => scrolls.push(options) },
  document: { getElementById: id => ({ getBoundingClientRect: () => ({ top: Number(id.slice(1)) * 500 }) }) },
  setTimeout: fn => { hold = fn; return 1; }, clearTimeout: () => { hold = null; },
}, { '@/lib/haptics': { tick() {} } });
let tree = rail.render();
tree.props.ref.current = node;
const event = y => ({ isPrimary: true, button: 0, pointerId: 1, clientY: y, currentTarget: node, target: { closest: () => button } });
// A short tap must still target the button, not the capture container.
tree.props.onPointerDown(event(100));
tree.props.onPointerUp({ ...event(100), type: 'pointerup' });
find(tree, item => item.type === 'button' && item.props['data-index'] === 3).props.onClick({ detail: 1 });
assert.equal(scrolls.at(-1).behavior, 'smooth');
assert.equal(scrolls.at(-1).top, 1416);
// Hold and drag reaches the last and first section, even beyond the clip.
tree.props.onPointerDown(event(100));
hold();
tree.props.onPointerMove(event(300));
assert.equal(scrolls.at(-1).top, 6416);
assert.equal(scrolls.at(-1).behavior, 'instant');
tree.props.onPointerMove(event(-200));
assert.equal(scrolls.at(-1).top, 0);
tree.props.onPointerUp({ ...event(-200), type: 'pointerup' });
const afterDrag = scrolls.length;
find(tree, item => item.type === 'button' && item.props['data-index'] === 3).props.onClick({ detail: 1 });
assert.equal(scrolls.length, afterDrag, 'The synthetic click after a drag must not jump back');
find(tree, item => item.type === 'button' && item.props['data-index'] === 3).props.onClick({ detail: 0 });
assert.equal(scrolls.length, afterDrag + 1, 'Keyboard clicks remain available');
tree.props.onPointerDown(event(100));
tree.props.onPointerCancel({ ...event(100), type: 'pointercancel' });
assert.equal(hold, null, 'Cancelled pointers clear the hold timer');

const intervals = [];
const board = mount('components/discussion-board.tsx', {}, {
  window: { setInterval: (fn, ms) => { intervals.push(ms); return 1; }, clearInterval() {}, clearTimeout() {} },
  document: { hidden: true, addEventListener() {}, removeEventListener() {} },
  localStorage: { getItem: () => null, setItem() {} },
}, { '@/lib/haptics': { tick() {} }, '@/lib/discussion-avatar': { discussionAvatarUrl: () => '' } });
board.render();
board.effects().forEach(cleanup => cleanup());
assert.deepEqual(intervals, [60000], 'The board polls exactly once per minute');

const detail = fs.readFileSync('app/sites/[slug]/page.tsx', 'utf8');
for (const token of ['site-detail-layout', 'site-detail-sidebar', 'site-detail-facts', '<figcaption', 'On this page']) assert.ok(detail.includes(token));
assert.ok(!detail.includes('/#${entry.sectionId}'), 'Collection breadcrumbs must not target absent homepage sections');
const css = fs.readFileSync('app/subsite.css', 'utf8');
const theme = css.match(/html\[data-theme="light"\] \{([\s\S]*?)\}/)[1];
const tokens = Object.fromEntries([...theme.matchAll(/(--[\w-]+): (#[\da-f]{6});/g)].map(match => [match[1], match[2]]));
const luminance = hex => {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
for (const fg of ['--text', '--muted', '--subtle', '--live']) {
  for (const bg of ['--surface', '--page-band', '--background']) {
    const ratio = (luminance(tokens[bg]) + .05) / (luminance(tokens[fg]) + .05);
    assert.ok(ratio >= 4.5, `${fg} on ${bg} must meet AA: ${ratio.toFixed(2)}`);
  }
}

const workflow = fs.readFileSync('.github/workflows/auto-release.yml', 'utf8');
for (const guard of ["conclusion == 'success'", "event == 'push'", "head_branch == 'main'", 'head_repository.full_name == github.repository', 'persist-credentials: false']) assert.ok(workflow.includes(guard));
const script = workflow.split('          script: |\n')[1].split('\n').map(line => line.slice(12)).join('\n');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
async function releaseCase({ exists = false, moved = false, conflict = false, denied = false } = {}) {
  const published = [];
  const github = { rest: {
    repos: {
      getReleaseByTag: async () => { if (exists) return {}; throw Object.assign(new Error('not found'), { status: denied ? 403 : 404 }); },
      getBranch: async () => ({ data: { commit: { sha: moved ? 'new' : 'checked' } } }),
      createRelease: async options => { published.push(options); return { data: { html_url: 'release' } }; },
    },
    git: { getRef: async () => { if (conflict) return { data: { object: { sha: 'other' } } }; throw Object.assign(new Error('not found'), { status: 404 }); } },
  } };
  await new AsyncFunction('require', 'github', 'context', 'core', script)(() => fs, github, {
    repo: { owner: 'test', repo: 'test' }, payload: { workflow_run: { head_sha: 'checked' } },
  }, { info() {} });
  return published;
}
const published = await releaseCase();
assert.equal(published[0].tag_name, `v${version}`);
assert.equal(published[0].target_commitish, 'checked');
// The notes must be the ones that belong to the version being released, not a
// stale entry from an earlier bump: the workflow takes the newest entry, so
// the published name and body carry that entry's own title and summary.
const notes = JSON.parse(fs.readFileSync('config/changelog.json', 'utf8')).find(entry => entry.version === version);
assert.ok(notes, `config/changelog.json must carry notes for ${version}`);
assert.ok(published[0].body.includes(notes.summary), 'The release body carries the matching changelog entry');
assert.equal(published[0].name, `v${version} — ${notes.title}`, 'The release is titled with the matching changelog entry');
assert.deepEqual(await releaseCase({ exists: true }), []);
assert.deepEqual(await releaseCase({ moved: true }), []);
await assert.rejects(() => releaseCase({ conflict: true }), /different commit/);
await assert.rejects(() => releaseCase({ denied: true }), /not found/);
// The theme rule, run against a fake browser. The site has to open in the
// visitor's own colour scheme, keep following the device while no choice is
// stored, and store only an explicit tap on the toggle — so a device that flips
// at sunset is followed, and a visitor who chose light mode is not overruled by
// their phone an hour later. React's hook contract is emulated the way `mount`
// does it: a render registers the effects, they run, and the next pass sees the
// state they set.
function themeHarness({ stored = null, light = true } = {}) {
  const code = ts.transpileModule(fs.readFileSync('lib/theme.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const slots = []; const refs = []; const seen = []; let effects = []; let cursor = 0;
  const react = {
    // A function argument is an updater, exactly as React reads it — the toggle
    // flips the theme that way rather than from a stale closure.
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return refs[i] ??= { current: initial }; },
    useCallback(fn) { cursor++; return fn; },
    // The deps array matters here: React runs a `[]` effect once, and the
    // resolve effect would otherwise put the device's answer back every pass,
    // hiding whatever the toggle did.
    useEffect(fn, deps) {
      const i = cursor++;
      const previous = seen[i];
      const changed = !previous || !deps || !previous.deps || deps.length !== previous.deps.length || deps.some((dep, k) => !Object.is(dep, previous.deps[k]));
      seen[i] = { deps };
      effects.push(changed ? fn : null);
    },
  };
  const store = new Map(stored ? [['base31-theme', stored]] : []);
  const listeners = new Set();
  const attrs = {};
  const html = { setAttribute: (key, value) => { attrs[key] = value; }, removeAttribute: key => { delete attrs[key]; } };
  const globals = {
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => { store.set(key, value); } },
    // `matches` is read live, the way a real MediaQueryList reports it: the
    // query object is asked again when the device flips.
    window: { matchMedia: () => ({ get matches() { return light; }, addEventListener: (_event, fn) => listeners.add(fn), removeEventListener: (_event, fn) => listeners.delete(fn) }) },
    document: { documentElement: html, querySelector: () => ({ setAttribute() {} }) },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(
    id => { if (id === 'react') return react; throw new Error(`Unexpected import ${id}`); },
    module, module.exports, ...Object.values(globals),
  );
  let api = null;
  const pass = () => {
    cursor = 0; effects = [];
    api = module.exports.useSiteTheme();
    const registered = effects;
    for (const fn of registered) if (typeof fn === 'function') fn();
  };
  // Two passes: the resolve effect sets state, and the second render is what
  // the effects that depend on it run against.
  pass(); pass();
  return {
    theme: () => api.theme,
    toggle: () => { api.toggleTheme(); pass(); pass(); },
    flipDevice: value => { light = value; listeners.forEach(fn => fn()); pass(); pass(); },
    stored: () => store.get('base31-theme') ?? null,
    dataTheme: () => attrs['data-theme'] ?? null,
  };
}

const deviceLight = themeHarness({ light: true });
assert.equal(deviceLight.theme(), 'light', 'A light-mode device opens the site in light mode');
assert.equal(deviceLight.dataTheme(), 'light', 'The pre-paint attribute matches the device preference');
assert.equal(deviceLight.stored(), null, 'Following the device is not a stored choice');
assert.equal(themeHarness({ light: false }).theme(), 'dark', 'A device with no light preference stays dark');
assert.equal(themeHarness({ stored: 'dark', light: true }).theme(), 'dark', 'A stored choice beats a light-mode device');
assert.equal(themeHarness({ stored: 'light', light: false }).theme(), 'light', 'A stored choice beats a dark-mode device');
// The device keeps driving the page until the visitor disagrees with it.
const followed = themeHarness({ light: false });
followed.flipDevice(true);
assert.equal(followed.theme(), 'light', 'The site follows the device while nothing is stored');
const chosen = themeHarness({ stored: 'dark', light: true });
chosen.flipDevice(false);
assert.equal(chosen.theme(), 'dark', 'A stored choice is not overruled by the device');
// The toggle is what stores one, and it flips the other way.
const toggled = themeHarness({ light: true });
toggled.toggle();
assert.equal(toggled.theme(), 'dark', 'The toggle flips the theme');
assert.equal(toggled.stored(), 'dark', 'The toggle stores the choice');
assert.equal(toggled.dataTheme(), null, 'Dark mode removes the attribute rather than setting it');
toggled.toggle();
assert.equal(toggled.theme(), 'light', 'The toggle flips back');
assert.equal(toggled.stored(), 'light', 'The stored choice follows the toggle');

console.log('UI tests passed: rail tap/hold/drag/cancel, minute polling, detail structure, AA light tokens, device-default theme rule and auto-release guards.');
