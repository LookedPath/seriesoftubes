/* ---------- The peering inbox ----------
   Every exchange port brings mail: peering requests from networks nobody has heard of, and sessions that drop
   because someone's PeeringDB says 50 prefixes and they now send 400 (or a full table). Answer it, or hire an AI. */
const PPOL_N={open:N_('peering_inbox.open_to_all'),selective:N_('common.selective'),closed:N_('common.closed')},PPOL_D={open:N_('peering_inbox.everyone_who_asks_gets_a_session'),selective:N_('peering_inbox.fewer_requests_and_you_answer_them'),closed:N_('peering_inbox.nobody_asks_and_no_route_servers')};
const AI_MO=Math.round(20e6/12),INBOX_MAX=80,IBX_LEAKS=['nfx','ggl','fbk','amz','msf'];
const TINY=['Basement Broadband','Uncle Dave’s WISP','Fibre Fiesta','Raspberry Pi Transit','Vanity ASN Ltd','Moonshot Crypto Hosting','Minecraft Collective','Bob’s Bits','Homelab Heroes','Hackerspace Uplink','Tiny Tower Networks','Pigeon Post IP','Retro BBS Revival','Overkill Home Network','Two Guys and a Rack','Big Dreams Small Prefix','Mesh-y Business','Garden Shed Datacenter','Carrier-Grade NAT Fan Club','LIR in a Box','Yet Another VPN','Grandma’s Fibre Co-op','Seedbox Society','The /24 That Could'];
const REQ_SAY=[N_('peering_inbox.hi_we_would_like_to_peer'),N_('peering_inbox.dear_sir_or_madam_please_peer'),N_('peering_inbox.we_noticed_you_are_at_ix'),N_('peering_inbox.hello_please_find_attached_our'),N_('peering_inbox.peering_request_fifth_attempt_is'),N_('peering_inbox.hey_quick_one_can_you_peer'),N_('peering_inbox.greetings_we_are_a_fast_growing'),N_('peering_inbox.please_configure_sessions_with_us_at')];
const IBX_AI=[N_('peering_inbox.replied_to_a_peering_request_with'),N_('peering_inbox.signed_you_up_for_a_webinar'),N_('peering_inbox.opened_a_ticket_with_itself_to'),N_('peering_inbox.wrote_a_thousand_word_apology_to'),N_('peering_inbox.updated_your_peeringdb_record_your'),N_('peering_inbox.asked_netchill_s_peering_team_to')];
function ibx(){if(!S.inbox||typeof S.inbox!=='object')S.inbox={items:[],down:{},tiny:{},rep:0,bot:false,log:[],seq:0};return S.inbox;}
// Reputation nudges selective networks by up to 10% either way: worth caring about, never a wall.
// Your peering policy. Open: everyone who asks gets a session and the route servers work. Selective: fewer requests,
// you answer them yourself, and no route servers, so you go and ask networks at each exchange. Closed: nobody asks,
// and customers hear that you are hard to reach.
const PPOL=['open','selective','closed'],ppol=()=>(S&&S.inbox&&PPOL.includes(S.inbox.pol))?S.inbox.pol:'open';
const repMul=()=>1-clamp((S.inbox&&S.inbox.rep)||0,-10,5)*0.01;
const repName=r=>r>=1?tr('common.responsive'):r>=-2?tr('common.average'):r>=-6?tr('peering_inbox.mostly_ignores_email'):tr('common.black_hole');
const ibxOpen=()=>S.inbox?S.inbox.items.length:0,ibxUrgent=()=>S.inbox?S.inbox.items.filter(x=>x.k==='mp').length:0;
const mpDown=(id,c)=>{const t=S.inbox&&S.inbox.down[id+'@'+c];return !!t&&t>S.day;};
const ibxWho=x=>x.net?NET[x.net].name:x.nm,ibxAsn=x=>x.net?NET[x.net].asn:x.asn;
function ibxLog(m,a){const I=ibx();I.log.unshift({d:S.day,m,a:a||{}});I.log.length=Math.min(I.log.length,40);}
function inboxDay(d){const I=ibx(),ixs=Object.keys(S.ixp);
  // new peering requests: more exchange ports, more mail
  if(ixs.length&&Math.random()<Math.min(0.9,0.15*ixs.length)*({open:1,selective:0.7,closed:0}[ppol()])){const c=pick(ixs),set=ixSessions(c);
    const real=ixMembers(c).filter(id=>{const n=NET[id];return !set.has(id)&&!merged(id)&&n.type!=='t1'&&n.type!=='cdn'&&n.pol!=='paid'&&n.share<=0.006&&!I.items.some(x=>x.net===id&&x.ix===c);});
    const it={id:++I.seq,k:'req',ix:c,day:d,stale:Math.random()<0.6,yrs:1+Math.floor(Math.random()*9),say:Math.floor(Math.random()*REQ_SAY.length)};
    if(real.length&&Math.random()<0.4)it.net=pick(real);else{it.nm=pick(TINY);it.asn=Math.random()<0.05?64512+Math.floor(Math.random()*1000):200000+Math.floor(Math.random()*200000);}
    I.items.push(it);if(ppol()==='open')ibxAnswer(it.id,'accept',true);}
  if(ppol()==='closed')I.rep=Math.max(-6,I.rep-0.05);
  // max-prefix: someone grew past what their PeeringDB says, or leaked a full table
  const ses=Object.keys(S.peers).filter(k=>{const n=NET[k.split('@')[0]];return n&&n.type!=='cdn'&&n.type!=='t1'&&!mpDown(...k.split('@'));}).map(k=>({key:k,net:k.split('@')[0],ix:k.split('@')[1]}))
    .concat(Object.keys(I.tiny).map(a=>({key:'t'+a,nm:I.tiny[a].nm,asn:+a,ix:I.tiny[a].ix,stale:I.tiny[a].stale})));
  if(ses.length&&Math.random()<Math.min(0.15,0.004*ses.length)){const x=pick(ses);if(!I.items.some(y=>y.k==='mp'&&y.key===x.key)){
    const lim=pick([10,20,50,100,200,500,1000]),leak=Math.random()<0.3,yrs=1+Math.floor(Math.random()*9);
    I.items.push({id:++I.seq,k:'mp',key:x.key,net:x.net,nm:x.nm,asn:x.asn,ix:x.ix,day:d,lim,got:leak?940000+Math.floor(Math.random()*90000):Math.ceil(lim*(1.15+Math.random()*1.6)),leak,yrs});
    // A session that blows its limit is down for at most a few weeks: the other side eventually notices too.
    if(x.net){I.down[x.key]=d+20+Math.floor(Math.random()*20);toast(tr('peering_inbox.max_prefix_limit_hit_who_at',{who:esc(ibxWho(x)),ix:esc(ixName(x.ix))}),'bad',[{l:tr('common.inbox'),act:'inbox',args:{}}]);}}}
  // unanswered mail: requests go stale and people start asking around about you
  for(const x of I.items){if(x.k==='mp')I.rep-=0.05;else if(d-x.day===14)x.bump=1;}
  // A max-prefix alert nobody answers resolves itself in the end: the other side raises it, or gives up.
  I.items=I.items.filter(x=>x.k!=='mp'||(x.net?(I.down[x.key]||0)>d:d-x.day<=30));
  const old=I.items.filter(x=>x.k==='req'&&d-x.day>30);if(old.length){I.rep-=0.25*old.length;I.items=I.items.filter(x=>!old.includes(x));
    if(old.some(x=>x.net))toast(tr('peering_inbox.who_asked_a_mailing_list_whether',{who:esc(ibxWho(old.find(x=>x.net))),me:esc(S.name)}),'bad',[{l:tr('common.inbox'),act:'inbox',args:{}}]);}
  while(I.items.length>INBOX_MAX){const i=I.items.findIndex(x=>x.k==='req');if(i<0)break;I.items.splice(i,1);I.rep-=0.5;}
  I.rep=clamp(I.rep,-10,5);
  if(I.bot)inboxBot();}
// Answer one item. a: accept | decline | raise | keep. Returns false when the item is gone.
function ibxAnswer(id,a,bot){const I=ibx(),i=I.items.findIndex(x=>x.id===id);if(i<0)return false;const x=I.items[i];I.items.splice(i,1);const who=ibxWho(x),ix=ixName(x.ix);
  if(x.k==='req'){if(a==='accept'){if(x.net){if(S.ixp[x.ix]!==undefined)S.peers[x.net+'@'+x.ix]=true;}else if(Object.keys(I.tiny).length<200)I.tiny[x.asn]={nm:x.nm,ix:x.ix,stale:!!x.stale};I.rep+=0.3;}else I.rep+=0.2;}
  else if(a==='raise'){delete I.down[x.key];if(x.leak){const n=pick(IBX_LEAKS);S.ev.leak={net:n,until:S.day+4};
      addInc({type:'leak',ref:n,until:S.day+4,msg:tr('peering_inbox.who_at_ix_was_sending_a',{who,ix,net:NET[n].name}),cost:0});
      if(!bot)toast(tr('peering_inbox.that_was_a_route_leak_who',{who:esc(who),n:x.got.toLocaleString()}),'bad');I.rep-=1;}
    else{I.rep+=0.3;if(!bot)toast(tr('peering_inbox.session_with_who_is_back_up',{who:esc(who),n:Math.ceil(x.got*1.5).toLocaleString()}),'good');}}
  else{const back=S.day+(x.leak?3:10)+Math.floor(Math.random()*(x.leak?8:21));if(x.net)I.down[x.key]=back;I.rep+=x.leak?0.3:0.1;
    if(!bot)toast(x.leak?tr('peering_inbox.good_call_it_was_a_route',{who:esc(who)}):tr('peering_inbox.the_session_stays_down_who_will',{who:esc(who)}),x.leak?'good':'');}
  I.rep=clamp(I.rep,-10,5);return true;}
// The AI agent clears the inbox every day. It is fast, polite and wrong about a third of the time.
function inboxBot(){const I=ibx();let acc=0,dec=0;
  for(const x of I.items.slice()){const oops=Math.random()<0.3;
    if(x.k==='req'){const want=!x.stale||!!x.net;const a=(want!==oops)?'accept':'decline';ibxAnswer(x.id,a,true);a==='accept'?acc++:dec++;if(oops&&a==='decline'&&x.net)ibxLog(N_('peering_inbox.declined_who_at_ix_not_a'),{who:ibxWho(x),ix:ixName(x.ix)});}
    else{const a=(x.leak!==oops)?'keep':'raise';ibxAnswer(x.id,a,true);
      if(a==='raise'&&x.leak)ibxLog(N_('peering_inbox.raised_the_max_prefix_limit_for'),{who:ibxWho(x),ix:ixName(x.ix),n:Math.ceil(x.got*1.5).toLocaleString()});
      else if(a==='keep'&&!x.leak)ibxLog(N_('peering_inbox.kept_who_down_at_ix_for'),{who:ibxWho(x),ix:ixName(x.ix)});
      else ibxLog(a==='raise'?N_('peering_inbox.raised_the_max_prefix_limit_for_7b4b'):N_('peering_inbox.kept_who_down_at_ix_it'),{who:ibxWho(x),ix:ixName(x.ix)});}}
  if(acc||dec)ibxLog(N_('peering_inbox.answered_your_mail_a_accepted_d'),{a:acc,d:dec});
  if(Math.random()<0.01){const ks=Object.keys(S.peers);if(ks.length){const k=pick(ks),[id,c]=k.split('@');delete S.peers[k];ibxLog(N_('peering_inbox.tidied_up_a_session_it_decided'),{who:NET[id].name,ix:ixName(c)});}}
  if(Math.random()<0.08)ibxLog(pick(IBX_AI),{});}
function inboxModal(){const I=ibx(),items=I.items.slice().sort((a,b)=>(b.k==='mp')-(a.k==='mp')||b.day-a.day),reqs=items.filter(x=>x.k==='req').length,mps=items.length-reqs;
  const age=x=>{const n=S.day-x.day;return n?trn('peering_inbox.n_day_ago',n):tr('common.today_4203');};
  const pdb=x=>x.stale?trn('peering_inbox.peeringdb_last_updated_n_year_ago',x.yrs):tr('peering_inbox.peeringdb_updated_last_month');
  const card=x=>x.k==='mp'?`<div class="ibx mp"><div class="nm">⚠️ ${tr('peering_inbox.max_prefix_limit_hit_who_at_5c56',{who:esc(ibxWho(x)),ix:esc(ixName(x.ix))})}</div>
    <div class="meta">AS${ibxAsn(x)} · ${age(x)}</div><p class="note">${tr('peering_inbox.configured_lim_prefixes_received_got',{lim:x.lim.toLocaleString(),got:x.got.toLocaleString()})} ${trn('peering_inbox.their_peeringdb_says_lim_last',x.yrs,{lim:x.lim.toLocaleString()})}</p>
    <div class="btns">${btn(tr('peering_inbox.raise_the_limit'),'inboxAct',{id:x.id,a:'raise'},'sm')}${btn(tr('peering_inbox.keep_it_down'),'inboxAct',{id:x.id,a:'keep'},'ghost sm')}</div></div>`
   :`<div class="ibx"><div class="nm">${esc(ibxWho(x))} <span class="meta">AS${ibxAsn(x)}</span>${x.bump?` <span class="tag">${tr('common.bumped')}</span>`:''}</div><div class="meta">${esc(ixName(x.ix))} · ${age(x)} · ${pdb(x)}</div>
    <p class="note">“${esc(tr(REQ_SAY[x.say]||REQ_SAY[0],{ix:ixName(x.ix)}))}”</p><div class="btns">${btn(tr('common.accept'),'inboxAct',{id:x.id,a:'accept'},'sm')}${btn(tr('common.decline'),'inboxAct',{id:x.id,a:'decline'},'ghost sm')}</div></div>`;
  openModal(`<div style="display:flex;align-items:center"><div><div class="eyebrow">${tr('common.peering_inbox')}</div><h2 style="font-size:26px">📬 ${trn('peering_inbox.n_unanswered',items.length)}</h2></div><button class="x" data-act="closeModal" aria-label="${tr('common.close')}">×</button></div>
  <p class="tagline">${tr('peering_inbox.every_exchange_port_brings_mail')}</p>
  <div class="kv"><span>${tr('common.your_reputation')}</span><b>${repName(I.rep)}</b></div>
  <div class="kv"><span>${tr('common.peering_policy')}</span><b>${tr(PPOL_N[ppol()])}</b></div><div class="seg">${PPOL.map(p=>btn(tr(PPOL_N[p]),'inboxPol',{p},ppol()===p?'sm':'ghost sm')).join('')}</div><p class="meta">${tr(PPOL_D[ppol()])}</p>
  <div class="ibx ai">${I.bot?`<div class="nm">🤖 ${tr('peering_inbox.large_peering_model_is_answering')}</div><div class="meta">${tr('peering_inbox.price_year_it_never_sleeps_never',{price:fmt$(20e6)})}</div>
    ${I.log.length?`<pre class="term">${I.log.slice(0,8).map(e=>esc(tr('peering_inbox.day_d',{d:e.d})+': '+tr(e.m,e.a))).join('\n')}</pre>`:''}<div class="btns">${btn(tr('peering_inbox.fire_the_ai'),'inboxBot',{on:0},'ghost sm')}</div>`
    :`<div class="nm">🤖 ${tr('peering_inbox.large_peering_model')}</div><div class="meta">${tr('peering_inbox.an_ai_agent_that_answers_every',{price:fmt$(20e6)})}</div><div class="btns">${btn(tr('peering_inbox.hire_it_mo_mo',{mo:fmt$(AI_MO)}),'inboxBot',{on:1},'aibtn sm',S.cash<AI_MO)}</div>`}</div>
  ${reqs>1||mps>1?`<div class="btns">${reqs>1?btn(tr('peering_inbox.accept_all_requests'),'inboxAll',{a:'accept'},'sm')+btn(tr('peering_inbox.decline_all_requests'),'inboxAll',{a:'decline'},'ghost sm'):''}${mps>1?btn(tr('peering_inbox.raise_all_max_prefix_limits'),'inboxRaiseAll',{},'sm'):''}</div>`:''}
  ${items.length?items.slice(0,40).map(card).join(''):`<p class="empty">${Object.keys(S.ixp).length?tr('peering_inbox.inbox_zero_enjoy_it_while_it'):tr('peering_inbox.no_mail_yet_buy_an_ix')}</p>`}`);}
