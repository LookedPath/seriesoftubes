const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');
const referenceAllocation = require('./helpers/reference-allocation');

function network(ev) {
  ev(`ACT.start({});S.cash=1e10;S.lvl=4;S.day=500;S.biz=[];S.links=[];S.pops={};S.pni=[];S.caches=[];S.transit=[];S.ixp={};
    const cities=['fra','ams','lon','par','nyc','ash','sin','hkg','mos','pek'];
    for(const c of cities){S.pops[c]={routers:6,rgen:3,gen:true,bb:{d:700},down:0};
      for(const n of NETS.filter(n=>!n.tail).slice(0,35))S.pni.push({id:n.id+'@'+c,city:c,net:n.id,tier:0});
      for(const n of NETS.filter(n=>n.cache).slice(0,3))S.caches.push({id:'cache-'+n.id+'@'+c,net:n.id,city:c});
    }
    for(let i=0;i<cities.length;i++){
      S.links.push({id:'df'+i,a:cities[i],b:cities[(i+1)%cities.length],kind:'df',own:true,sys:'roadm',ch:Array(32).fill('tp16'),km:800,ready:0,cut:0,mo:100});
      S.links.push({id:'w'+i,a:cities[i],b:cities[(i+2)%cities.length],kind:'wave',tier:2,km:1200,cut:0,mo:100});
      S.transit.push({id:'transit'+i,net:'cog',city:cities[i],tier:1,down:0});
      S.biz.push({id:'l2-'+i,name:'Circuit '+i,city:cities[i],city2:cities[(i+4)%cities.length],type:'l2vpn',bw:50,rate:100,reqs:['diverse'],route:i%3===0?'scenic':i%3===1?'fast':'normal'});
    }
    compute();`);
  // All other model logic is shared; the independent reference retains the old
  // allocation algorithm and runs with uncached optics and capacity calculations.
  ev(`window.referenceCompute=eval('('+computeState.toString().replace(/const Er=TR\\?E:E\\.filter[\\s\\S]*?(?=\\/\\/ Exits with)/,${JSON.stringify(referenceAllocation)})+')')`);
}

test('indexed allocation and pass-local caches preserve full simulation output', () => {
  const { ev, dom, errors } = load();
  try {
    network(ev);
    const changes = [
      '',
      "S.te={on:true,script:''}",
      "S.te.script='prefer pni for goggle\\nspill at 80%\\navoid transit for netchill'",
      "S.ev.rpki={nets:['ggl','nfx'],until:S.day+3};S.ev.depeer=S.day+3",
      "S.ev.ddos={city:'fra',until:S.day+3,gbps:300,vec:'syn',entry:{k:'edge'}}",
      "S.links[0].eqDown=S.day+2;S.links[1].cut=S.day+2;S.links[2].loss={until:S.day+2,f:0.5}",
      "S.links[4].chFail={until:S.day+2,o:'tp16'};S.links[6].ch.push('zr4');S.links[8].regen=2",
      "S.day+=4;S.pni.splice(0,20);S.caches.splice(0,10);S.transit[0].pref='high'",
    ];
    for (const change of changes) {
      ev(change);
      // Both implementations receive exactly the same prior load (scenic routing).
      ev('window.priorR=JSON.stringify(R);referenceCompute();window.expectedR=JSON.stringify(R);R=JSON.parse(priorR);compute()');
      assert.deepEqual(JSON.parse(ev('JSON.stringify(R)')), JSON.parse(ev('expectedR')), change || 'baseline');
      assert.equal(ev('COMPUTE_CACHE'), null);
    }
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('failed calculations discard caches, and later actions see new optical capacity', () => {
  const { ev, dom } = load();
  try {
    network(ev);
    ev("window.originalMode=optMode;optMode=()=>{throw Error('probe')}");
    assert.throws(() => ev('compute()'), /probe/);
    assert.equal(ev('COMPUTE_CACHE'), null);
    ev('optMode=originalMode;S.links[0].ch=[];compute()');
    assert.equal(ev('capOf(S.links[0])'), 0);
    ev("S.links[0].ch=['tp16'];compute()");
    assert.equal(ev('capOf(S.links[0])'), 1600);
    ev('S.links[0].eqDown=S.day+1;compute()');
    assert.equal(ev('capOf(S.links[0])'), 0);
    ev('S.day++;compute()');
    assert.equal(ev('capOf(S.links[0])'), 1600);
  } finally { dom.window.close(); }
});

test('closed mobile sheets defer content generation until reopened', () => {
  for (const width of [390, 1024, 1440]) {
    const { ev, dom } = load();
    try {
      ev(`ACT.start({});innerWidth=${width};UI.left='nets';UI.leftOpen=true;renderLeft();window.calls=0;window.originalWhere=netWhere;netWhere=(n)=>{calls++;return originalWhere(n)};UI.sel={type:'city',id:'fra'};UI.leftOpen=false;renderLeft()`);
      assert.equal(ev('calls>0'), width === 1440, 'desktop sidebar remains visible');
      ev('UI.leftOpen=true;renderLeft()');
      assert.ok(ev('calls') > 0, 'opening builds fresh content');
      assert.equal(ev("$('left').classList.contains('closed')"), false);
    } finally { dom.window.close(); }
  }
});

test('Connections pages retain all totals, filters, ordering and navigation', () => {
  for (const width of [390, 1440]) {
    const { ev, dom } = load();
    try {
      ev(`ACT.start({});innerWidth=${width};S.pni=[];for(let i=0;i<123;i++)S.pni.push({id:'p'+i,city:i<60?'fra':'ams',net:'nfx',tier:0});compute();ACT.connOpen()`);
      const buttons = () => [...dom.window.document.querySelectorAll('#connSec [data-act=connCancel]')];
      const ids = () => buttons().map(b => JSON.parse(b.dataset.args).id);
      assert.equal(ids().length, 50);
      const totals = ev("fmt$(conns().reduce((sum,r)=>sum+r.mo,0))");
      assert.ok(dom.window.document.getElementById('connSec').textContent.includes(totals), 'totals include connections on other pages');
      const expectedOrder = JSON.parse(ev("JSON.stringify(conns().sort((a,b)=>CITY[a.city].name.localeCompare(CITY[b.city].name)||a.name.localeCompare(b.name)).map(r=>r.id))"));
      const seen = ids();
      ev('ACT.connPage({d:1})');seen.push(...ids());
      ev('ACT.connPage({d:1})');seen.push(...ids());
      assert.equal(ids().length, 23);
      assert.equal(new Set(seen).size, 123, 'each connection is reachable once');
      assert.deepEqual(seen, expectedOrder, 'pagination preserves the global sort order');
      assert.match(dom.window.document.getElementById('connSec').textContent, /123 connections/);
      ev("ACT.connCity({v:'fra'})");assert.equal(ev('UI.connPage'), 0);assert.equal(ids().length, 50);
      ev('ACT.connPage({d:1})');assert.equal(ids().length, 10);
      ev("ACT.connSort({k:'mo'})");assert.equal(ev('UI.connPage'), 0);
      ev("ACT.connCity({v:'ams'});ACT.connPage({d:1});S.pni=S.pni.slice(0,61);renderDash()");
      assert.equal(ev('UI.connPage'), 0, 'page clamps after connections disappear');
      assert.equal(ids().length, 1);
      ev("document.querySelector('#connSec [data-act=goConn]').click()");
      assert.equal(ev('UI.sel.id'), 'ams');assert.equal(ev("$('dash').hidden"), true);
    } finally { dom.window.close(); }
  }
});
