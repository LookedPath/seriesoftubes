// Loads the game page in jsdom with the animation loop disabled, so tests can drive the simulation
// directly through the game's globals (ACT, S, R, dayTick…). The page is assembled from src/ once per
// test process (scripts/lib/page.js), so tests always run what is in src/, never a stale build.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { assemble } = require('../scripts/lib/page');

let PAGE = null;
const page = () => PAGE || (PAGE = assemble().html);

// opts.file: a built or older page to load instead (the perf bench, the release build test).
function load(opts = {}) {
  const html = opts.file ? fs.readFileSync(opts.file, 'utf8') : page();
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    // jsdom has no canvas; drawing calls are expected to be unimplemented.
    if (!/getContext|Not implemented/.test(e.message)) errors.push(e.message);
  });
  const dom = new JSDOM(html, {
    url: 'https://tests.invalid/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.__TUBES_TEST__ = true;
      // Seed before the game script runs, so nothing random happens at load time either.
      if (opts.seed !== false) { let r = opts.seed || 12345; window.Math.random = () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; window.__reseed = (n) => { r = n; }; }
      for (const [k, v] of Object.entries(opts.storage || {})) window.localStorage.setItem(k, v);
      if (opts.navigatorLanguage) Object.defineProperty(window.navigator, 'language', { value: opts.navigatorLanguage });
      // A non-English game: jsdom does not fetch the dictionary script, so register it up front.
      // (opts.dir: the folder the dictionary comes from, e.g. a build's _site/i18n.)
      if (opts.lang) { window.localStorage.setItem('sot-lang', opts.lang); window.eval(fs.readFileSync(path.join(opts.dir || path.join(__dirname, '..', 'site', 'i18n'), opts.lang + '.js'), 'utf8')); }
      // jsdom has no CompressionStream; {gzip:true} lends the page Node's, the same API browsers have (#176).
      if (opts.gzip) for (const k of ['CompressionStream', 'DecompressionStream', 'TextEncoder', 'TextDecoder']) window[k] = globalThis[k];
      window.Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} bezierCurveTo() {} arc() {} rect() {} closePath() {} };
      // A recording 2D context, so draw code really runs under test (jsdom has no canvas).
      const fake = () => { const calls = { n: 0 };
        const grad = { addColorStop() {} };
        return new Proxy({ calls }, { get(t, k) {
          if (k in t) return t[k];
          if (k === 'measureText') return (s) => ({ width: String(s).length * 7 });
          if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => grad;
          if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
          if (k === 'canvas') return null;
          return (...a) => { calls.n++; };
        }, set(t, k, v) { t[k] = v; return true; } }); };
      window.HTMLCanvasElement.prototype.getContext = function () { return this.__ctx || (this.__ctx = fake()); };
      window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
      window.HTMLCanvasElement.prototype.toBlob = (cb) => cb(null);
    },
  });
  const ev = (src) => dom.window.eval(src);
  // Deterministic by default so a test never passes or fails by luck; pass {seed:false} to opt out.
  // (Seeded in beforeParse, so the game's own seeded-games wrapper around Math.random stays in place.)
  return { dom, ev, errors };
}

// Deterministic Math.random so failures are reproducible.
function seed(ev, n) {
  ev(`if(window.__reseed)__reseed(${n});else Math.random=(()=>{let s=${n};return()=>{s=(s*16807)%2147483647;return s/2147483647;};})();`);
}

module.exports = { load, seed };
