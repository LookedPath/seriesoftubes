const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');

const choose = (ev, v) => ev(`(()=>{const s=document.getElementById('homeSel');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const onTiles = ev => JSON.parse(ev("JSON.stringify([...document.querySelectorAll('.starts .start.on')].map(b=>b.dataset.city||'own'))"));

test('the title screen offers five homes and a sixth tile for any city, grouped by continent', () => {
  const { ev, errors } = load();
  assert.equal(ev('S'), null, 'before any game exists');
  assert.equal(ev("document.querySelectorAll('.starts .start').length"), 6);
  const opts = JSON.parse(ev("JSON.stringify([...document.querySelectorAll('#homeSel option')].map(o=>o.value).filter(Boolean))"));
  assert.ok(opts.length > 150, `lots of cities (${opts.length})`);
  assert.ok(opts.every(c => ev(`homeOk('${c}')`)), 'only cities that work as a home');
  assert.ok(!opts.some(c => ev(`!!CITY['${c}'].cn||!!CITY['${c}'].off`)), 'no hidden or Chinese cities');
  assert.ok(!opts.includes('stg'), 'no city without transit to buy');
  assert.ok(ev("document.querySelectorAll('#homeSel optgroup').length") >= 5, 'grouped by continent');
  assert.deepEqual(errors, []);
});

test('picking any city starts the network there, and the tiles follow the choice', () => {
  const { ev, errors } = load();
  choose(ev, 'lis');
  assert.equal(ev('UI.startCity'), 'lis');
  assert.deepEqual(onTiles(ev), ['own'], 'the sixth tile lights up');
  assert.equal(ev("document.getElementById('homeWhat').textContent"), 'Lisbon · ' + ev("REG[CITY.lis.reg]"), 'and names the city in full');
  ev("document.querySelector('.start[data-city=nyc]').click()");
  assert.deepEqual(onTiles(ev), ['nyc'], 'a suggested tile takes over again');
  assert.equal(ev("document.getElementById('homeSel').value"), '', 'and the dropdown resets');
  assert.match(ev("document.getElementById('homeWhat').textContent"), /more cities/);
  choose(ev, 'akl');
  ev("ACT.start({});if(UI.pendGame)ACT.pitchSkip()");
  assert.equal(ev('S.home'), 'akl');
  assert.ok(ev("!!S.pops.akl"), 'the first POP is in Auckland');
  assert.ok(ev("NETS.some(n=>sellsAt(n,'akl'))"), 'with transit to buy');
  assert.deepEqual(errors, []);
});

test('a home that cannot work is refused, and the game falls back to Frankfurt', () => {
  const { ev, errors } = load();
  ev("ACT.pickStart({city:'stg'});ACT.pickStart({city:'pek'});ACT.pickStart({city:'nowhere'})");
  assert.equal(ev('UI.startCity'), 'fra');
  ev("UI.startCity='pek';ACT.start({})");
  assert.equal(ev('S.home'), 'fra');
  assert.deepEqual(errors, []);
});

test('the sixth tile works on a phone and in every language', () => {
  for (const lang of ['en', 'it', 'pt', 'fr', 'es']) {
    const { ev, errors } = load(lang === 'en' ? {} : { lang });
    ev('window.innerWidth=360;showTitle()');
    assert.equal(ev("document.querySelector('label.start.own b').textContent"), ev("tr('title.anywhere_else')"), lang);
    if (lang !== 'en') assert.notEqual(ev("tr('title.anywhere_else')"), 'Anywhere else', `${lang}: translated`);
    assert.deepEqual(errors, []);
  }
});
