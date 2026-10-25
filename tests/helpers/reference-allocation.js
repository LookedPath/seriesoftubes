// The pre-index allocation loop. Keep this deliberately simple as a correctness
// reference: scan all exits for every flow, and do not enable compute caches.
module.exports = `const Er=TR?E:E.filter(e=>base(e)===rank);if(!Er.length)continue;const sorted={};
    for(const f of flows){
      if(f.rem<=1e-6||(rank===0&&!f.cache))continue;
      const sp=SP[f.c];
      const srt=sorted[f.c]||(sorted[f.c]=Er.filter(e=>sp.dist[e.city]!==undefined).sort((a,b)=>(a.pref==='high'?0:1)-(b.pref==='high'?0:1)||sp.dist[a.city]-sp.dist[b.city]));
      const cands=srt.filter(e=>e.used<e.cap&&e.ok(f.n)&&(!TR||eff(e,f.n)===rank));
      `;
