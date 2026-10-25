#!/usr/bin/env node
// Headless CPU/DOM benchmark, not a browser frame-rate measurement.
// node scripts/benchmark-performance.js SAVE.json [BASELINE.html]
// git show main:site/index.html > /tmp/tubes-baseline.html
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { load } = require('../tests/harness');

const [saveFile, baseline] = process.argv.slice(2);
if (!saveFile) {
  console.error('Usage: node scripts/benchmark-performance.js SAVE.json [BASELINE.html]');
  process.exit(1);
}
const input = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
const save = input.S || input;
function benchmark(file) {
  const { ev, dom, errors } = load({ file });
  try {
    ev('ACT.start({})');
    dom.window.benchmarkSave = JSON.parse(JSON.stringify(save));
    ev('S=migrate(window.benchmarkSave);UI.speed=0;innerWidth=390;innerHeight=844;compute()');
    const result = JSON.parse(ev('JSON.stringify(R)'));
    const measure = (setup, run, repeats) => {
      ev(setup);
      const samples = JSON.parse(ev(`(()=>{const out=[];for(let i=0;i<${repeats};i++){const start=performance.now();${run};out.push(performance.now()-start);}return JSON.stringify(out);})()`));
      const sorted = [...samples].sort((a, b) => a - b);
      return { medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(1), samplesMs: samples.map(v => +v.toFixed(1)) };
    };
    const timings = {
      compute: measure('', 'compute()', 5),
      closedNetworks: measure("UI.left='nets';UI.leftOpen=false;UI.sel=null", 'renderLeft()', 3),
      openConnections: measure("UI._dh=null;UI.dtab='conn'", 'ACT.connOpen()', 1),
      action: measure("$('dash').hidden=true;UI.leftOpen=false;UI.left='nets'", 'after()', 3),
    };
    assert.deepEqual(errors, []);
    return { result, timings };
  } finally { dom.window.close(); }
}
const original = baseline ? benchmark(path.resolve(baseline)) : null;
const current = benchmark(path.join(__dirname, '..', 'site', 'index.html'));
if (original) assert.deepEqual(current.result, original.result, 'Simulation output must match the baseline');
console.log(JSON.stringify({ baseline: original?.timings, current: current.timings, ...(original && { identicalSimulation: true }) }, null, 2));
