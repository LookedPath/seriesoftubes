const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');

const ISSUES = 'https://github.com/fjaeckel/seriesoftubes/issues/new/choose';

test('bugs and ideas point to GitHub from the menu and How to play, and the chat no longer asks for bug reports', () => {
  for (const lang of ['en', 'it', 'pt', 'fr', 'es']) {
    const { ev, errors } = load(lang === 'en' ? {} : { lang });
    ev('ACT.start({})');
    for (const [where, setup] of [['menu', 'ACT.menu()'], ['help', 'showHelp()']]) {
      const cards = JSON.parse(ev(`(()=>{${setup};return JSON.stringify([...document.querySelectorAll('#modal a[href="${ISSUES}"]')].map(a=>[a.target,a.rel,a.textContent.trim()]));})()`));
      assert.equal(cards.length, 1, `${lang}: one GitHub card in ${where}`);
      assert.deepEqual(cards[0].slice(0, 2), ['_blank', 'noopener'], `${lang}: opens in a new tab`);
      if (lang !== 'en') assert.doesNotMatch(cards[0][2], /Found a bug/, `${lang}: translated`);
      const chat = ev(`[...document.querySelectorAll('#modal a.chat')].map(a=>a.textContent).join(' ')`);
      assert.doesNotMatch(chat, /report bugs|segnala bug|reporte bugs|signale des bugs|informa de fallos/, `${lang}: the chat card is for chatting`);
    }
    assert.deepEqual(errors, []);
  }
});

test('the GitHub card fits a phone', () => {
  const { ev, errors } = load();
  ev("ACT.start({});window.innerWidth=360;ACT.menu()");
  assert.ok(ev('isPhone()'));
  assert.ok(ev(`!!document.querySelector('#modal a.plug[href="${ISSUES}"] .go')`), 'same card layout as the chat card');
  assert.deepEqual(errors, []);
});
