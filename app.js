
window.onerror=function(msg,src,line,col,err){var el=document.getElementById('app'); if(el){el.innerHTML='<div class="main"><section class="detailHero"><div class="smallCaps">Dashboard error</div><div class="detailTitle">Something stopped the page from rendering</div><div class="noteBox">'+String(msg)+'<br>Line '+line+'</div></section></div>';}};
if(!Array.prototype.flatMap){Array.prototype.flatMap=function(fn,thisArg){return Array.prototype.concat.apply([], this.map(fn,thisArg));};}
if(!Object.fromEntries){Object.fromEntries=function(iter){var obj={}; for(var i of iter){obj[i[0]]=i[1];} return obj;};}

async function bootTheatreDiary(){
  const app = document.getElementById('app');
  if(!app){ throw new Error('Missing #app container'); }
  app.innerHTML = '<div class="main"><section class="detailHero"><div class="smallCaps">Loading dashboard</div><div class="detailTitle">Theatre Attendance Diary</div><div class="detailMeta"><span>Loading theatre-data.json…</span></div></section></div>';
  const response = await fetch('theatre-data.json', {cache:'no-store'});
  if(!response.ok){ throw new Error('Could not load theatre-data.json. Status: '+response.status); }
  const DB = await response.json();

const people = DB.people, shows = DB.shows, venues = DB.venues, roles = DB.roles, performances = DB.performances;
const appearances = DB.appearances, creativeCredits = DB.creativeCredits;
const byPerf={}, byPerson={}, byShow={}, byVenue={}, byRole={}, creditsByPerf={}, creditsByPerson={};
const allPerfIdsAsc = Object.values(performances).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')) || a.id-b.id).map(p=>p.id);
for (const p of Object.values(performances)){ if(!byShow[p.showId]) byShow[p.showId]=[]; byShow[p.showId].push(p.id); if(!byVenue[p.venueId]) byVenue[p.venueId]=[]; byVenue[p.venueId].push(p.id); }
for (const a of appearances){ if(!byPerf[a.performanceId]) byPerf[a.performanceId]=[]; byPerf[a.performanceId].push(a); if(!byPerson[a.personId]) byPerson[a.personId]=[]; byPerson[a.personId].push(a); if(a.roleId){ if(!byRole[a.roleId]) byRole[a.roleId]=[]; byRole[a.roleId].push(a); } }
for (const c of creativeCredits){ if(!creditsByPerf[c.performanceId]) creditsByPerf[c.performanceId]=[]; creditsByPerf[c.performanceId].push(c); if(!creditsByPerson[c.personId]) creditsByPerson[c.personId]=[]; creditsByPerson[c.personId].push(c); }
for (const k in byPerf) byPerf[k].sort((a,b)=>a.displayOrder-b.displayOrder || a.id-b.id);
let localEdits = loadLocalEdits();
const state = {view:'diary', id:null, q:'', year:'all', type:'all', onlyCovers:false, sort:'dateDesc', drawerPerson:null, toast:'', editPerf:null, history:[], future:[], viewMode:(localStorage.getItem('theatreDiaryViewMode')||'compact')};
const types = [...new Set(Object.values(performances).map(p=>p.type).filter(Boolean))].sort();
const years = [...new Set(Object.values(performances).map(p=>String(p.date||'').slice(0,4)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));

function esc(x){ return String(x == null ? '' : x).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }
function fmtDate(d){ if(!d) return ''; const [y,m,day]=String(d).split('-').map(Number); const dt=new Date(y,(m||1)-1,day||1); return dt.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }
function yearOf(id){ return String(getPerf(id).date||'').slice(0,4); }
function showTitle(id){ return (shows[id] && shows[id].title) || 'Unknown show'; }
function personName(id){ return (people[id] && people[id].name) || 'Unknown person'; }
function roleName(id){ return (roles[id] && roles[id].name) || ''; }
function getEdit(id){ return (localEdits.performances && localEdits.performances[id]) || {}; }
function getPerf(id){ const p=performances[id]; if(!p) return {}; const e=getEdit(id); return {...p, ...e, source:p.source}; }
function perfTitle(id){ const p=getPerf(id), e=getEdit(id); return e.showTitle || showTitle(p.showId); }
function perfVenueParts(id){ const p=getPerf(id), e=getEdit(id), v=venues[p.venueId]||{}; return {name:e.venueName || v.name || 'Unknown venue', city:e.venueCity || v.city || ''}; }
function venueLabel(id){ const p=getPerf(id); const v=perfVenueParts(id); return `${v.name}${v.city ? ' · '+v.city : ''}`; }
function badge(label,t){ return label ? `<span class="badge cover-${esc(t||'')}">${esc(label)}</span>` : ''; }
function personBtn(id,label){ return `<button class="personLink" data-action="open-drawer" data-id="${id}">${esc(label || personName(id))}</button>`; }
function showBtn(id,label){ return `<button class="showLink" data-action="open-show" data-id="${id}">${esc(label || showTitle(id))}</button>`; }
function venueBtn(id,label){ return `<button class="venueLink" data-action="open-venue" data-id="${id}">${esc(label || (venues[id] && venues[id].name) || 'Unknown venue')}</button>`; }
function roleBtn(id,label){ return `<button class="roleLink" data-action="open-role" data-id="${id}">${esc(label || roleName(id))}</button>`; }
function unique(arr){ return [...new Set(arr.filter(Boolean))]; }
function normalizeRoleName(s){
  return String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/^\*(u\/s|s\/b|alt|s\/w|e\/c|t\/r)\s+/,'').replace(/\s*\/\s*ensemble$/,'').replace(/[’']/g,"'").replace(/\bunderstudy\b|\bstandby\b|\balternate\b/g,'').replace(/\s+/g,' ').trim();
}
function productionKeyForPerf(p){ return `${p.showId}|${String(p.type||'').trim().toLowerCase()}|${p.venueId||''}`; }
function productionLabelForPerf(p){ const v=venues[p.venueId]||{}; return `${showTitle(p.showId)} · ${p.type||'Type unknown'} · ${v.name||'Venue unknown'}${v.city?' · '+v.city:''}`; }
function coverPrefix(t){ return ({understudy:'*u/s ',standby:'*s/b ',alternate:'*alt ',swing:'*s/w ',emergency_cover:'*e/c ',temp_replacement:'*t/r ',special_appearance:'*special '})[t] || ''; }
function copyText(text){
  if(navigator.clipboard && window.isSecureContext){ navigator.clipboard.writeText(text).then(()=>toast('Copied.')).catch(()=>legacyCopy(text)); }
  else legacyCopy(text);
}
function legacyCopy(text){ const el=document.createElement('textarea'); el.value=text; el.setAttribute('readonly',''); el.style.cssText='position:fixed;left:-9999px;top:-9999px'; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); toast('Copied.'); }
function toast(msg){ state.toast=msg; render(); setTimeout(()=>{ state.toast=''; render(); },1600); }

const personStats = computePersonStats();
const showStats = computeShowStats();
const venueStats = computeVenueStats();
const cityStats = computeCityStats();
const healthStats = computeHealthStats();
const roleVariety = computeRoleVariety();
const roleVarietyByPerson = {};
for (const rv of roleVariety){ roleVarietyByPerson[rv.personId] = rv; }
function personLineMeta(pid, currentPerformanceId){
  const st = personStats[pid] || {};
  const other = Math.max(0, (st.performances || 0) - (currentPerformanceId ? 1 : 0));
  const rv = roleVarietyByPerson[pid] || {};
  const rolesSeen = rv.count || st.roles || 0;
  const timesText = other === 1 ? '1 other time' : other + ' other times';
  const roleText = rolesSeen === 1 ? '1 role' : rolesSeen + ' roles';
  return timesText + ' / ' + roleText;
}
function firstCastPerfId(pid){ const apps=(byPerson[pid]||[]).slice().sort(sortAppsAsc); return apps.length ? apps[0].performanceId : null; }
function firstShowPerfId(sid){ const ids=(byShow[sid]||[]).slice().sort((a,b)=>(performances[a].date||'').localeCompare(performances[b].date||'') || a-b); return ids[0] || null; }
function isFirstPersonPerf(pid, perfId){ return Number(firstCastPerfId(pid))===Number(perfId); }
function isFirstShowPerf(sid, perfId){ return Number(firstShowPerfId(sid))===Number(perfId); }
function cityKeyFromVenue(v){ return String(((v && v.city)||'Unknown city')).trim() || 'Unknown city'; }
function citySlug(s){ return String(s||'Unknown city').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'unknown-city'; }
function computePersonStats(){
  const out={};
  for (const pid of Object.keys(people).map(Number)){
    const apps=byPerson[pid]||[], perfIds=unique(apps.map(a=>a.performanceId)), showIds=unique(perfIds.map(id=>(performances[id] && performances[id].showId))), roleIds=unique(apps.map(a=>a.roleId));
    const creds=creditsByPerson[pid]||[], creditPerfIds=unique(creds.map(c=>c.performanceId));
    const dates=unique([...perfIds,...creditPerfIds].map(id=>(performances[id] && performances[id].date))).sort();
    out[pid]={performances:perfIds.length, shows:showIds.length, roles:roleIds.length, castAppearances:apps.length, creativeCredits:creds.length, first:dates[0]||'', recent:dates[dates.length-1]||''};
  }
  return out;
}
function computeShowStats(){
  const out={};
  for(const sid of Object.keys(shows).map(Number)){
    const perfIds=byShow[sid]||[], apps=perfIds.flatMap(id=>byPerf[id]||[]), dates=perfIds.map(id=>(performances[id] && performances[id].date)).filter(Boolean).sort();
    out[sid]={performances:perfIds.length, people:unique(apps.map(a=>a.personId)).length, covers:apps.filter(a=>a.coverType).length, first:dates[0]||'', recent:dates[dates.length-1]||''};
  }
  return out;
}
function computeVenueStats(){
  const out={};
  for(const vid of Object.keys(venues).map(Number)){
    const perfIds=byVenue[vid]||[], dates=perfIds.map(id=>(performances[id] && performances[id].date)).filter(Boolean).sort();
    out[vid]={performances:perfIds.length, shows:unique(perfIds.map(id=>(performances[id] && performances[id].showId))).length, first:dates[0]||'', recent:dates[dates.length-1]||''};
  }
  return out;
}
function computeCityStats(){
  const map={};
  for(const perf of Object.values(performances)){
    const v=venues[perf.venueId]||{}, city=cityKeyFromVenue(v), key=citySlug(city);
    if(!map[key]) map[key]={id:key, city:city, perfIds:[], showIds:new Set(), venueIds:new Set(), dates:[]};
    map[key].perfIds.push(perf.id); map[key].showIds.add(perf.showId); if(perf.venueId) map[key].venueIds.add(perf.venueId); if(perf.date) map[key].dates.push(perf.date);
  }
  for(const key in map){ map[key].dates.sort(); map[key].performances=map[key].perfIds.length; map[key].shows=map[key].showIds.size; map[key].venues=map[key].venueIds.size; map[key].first=map[key].dates[0]||''; map[key].recent=map[key].dates[map[key].dates.length-1]||''; }
  return map;
}
function computeHealthStats(){
  const normName={};
  for(const p of Object.values(people)){ const k=String(p.name||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''); if(!normName[k]) normName[k]=[]; normName[k].push(p.id); }
  const dupPeople=Object.values(normName).filter(a=>a.length>1);
  const missingCast=Object.values(performances).filter(p=>(byPerf[p.id]||[]).length===0).map(p=>p.id);
  const missingDate=Object.values(performances).filter(p=>!p.date).map(p=>p.id);
  const missingVenue=Object.values(performances).filter(p=>!p.venueId || !venues[p.venueId] || !(venues[p.venueId].name)).map(p=>p.id);
  const rawOdd=Object.values(performances).filter(p=>{ const raw=String((p.source&&p.source.castNormalized)||''); return raw.includes('???') || raw.includes('TBD') || raw.includes('Unknown') || raw.includes('[') || raw.includes(']'); }).map(p=>p.id);
  const roleNorm={};
  for(const r of Object.values(roles)){ const k=(r.showId||'')+'|'+normalizeRoleName(r.name); if(!roleNorm[k]) roleNorm[k]=[]; roleNorm[k].push(r.id); }
  const roleVariants=Object.values(roleNorm).filter(a=>a.length>1).slice(0,150);
  return {dupPeople, missingCast, missingDate, missingVenue, rawOdd, roleVariants};
}
function computeRoleVariety(){
  const map={};
  for(const a of appearances){
    if(!a.personId) continue;
    const p=performances[a.performanceId], r=roles[a.roleId]; if(!p || !r) continue;
    const norm = normalizeRoleName(r.name || a.roleRaw);
    if(!norm) continue;
    const key = `${productionKeyForPerf(p)}|${norm}`;
    if(!map[a.personId]) map[a.personId] = {personId:a.personId, keys:new Set(), samples:{}, perfIds:new Set()}; const entry = map[a.personId];
    if(!entry.keys.has(key)){
      entry.keys.add(key);
      entry.samples[key] = {role:r.name, showId:p.showId, performanceId:a.performanceId, production:productionLabelForPerf(p)};
    }
    entry.perfIds.add(a.performanceId);
  }
  return Object.values(map).map(x=>({personId:x.personId, count:x.keys.size, samples:Object.values(x.samples), performances:x.perfIds.size})).sort((a,b)=>b.count-a.count || b.performances-a.performances || personName(a.personId).localeCompare(personName(b.personId)));
}
function coStars(pid){
  const perfIds=unique((byPerson[pid]||[]).map(a=>a.performanceId));
  const m={};
  for(const perfId of perfIds){
    const peopleHere=unique((byPerf[perfId]||[]).map(a=>a.personId)).filter(x=>x && x!==Number(pid));
    for(const other of peopleHere){ if(!m[other]) m[other]=new Set(); m[other].add(perfId); }
  }
  return Object.entries(m).map(([other,set])=>({personId:Number(other), count:set.size, perfIds:[...set]})).sort((a,b)=>b.count-a.count || personName(a.personId).localeCompare(personName(b.personId)));
}

function snapshot(){ return {view:state.view,id:state.id}; }
function navigate(view,id=null, push=true){ if(push){ state.history.push(snapshot()); state.future=[]; } state.view=view; state.id=id===null?null:(/^\d+$/.test(String(id))?Number(id):String(id)); state.drawerPerson=null; state.editPerf=null; window.scrollTo({top:0,behavior:'smooth'}); render(); }
function goBack(){ if(!state.history.length) return; state.future.push(snapshot()); const s=state.history.pop(); state.view=s.view; state.id=s.id; state.drawerPerson=null; state.editPerf=null; render(); }
function goForward(){ if(!state.future.length) return; state.history.push(snapshot()); const s=state.future.pop(); state.view=s.view; state.id=s.id; state.drawerPerson=null; state.editPerf=null; render(); }
function navButton(view,label){ return `<button class="${state.view===view?'active':''}" data-action="nav" data-view="${view}">${label}</button>`; }
function hero(){ return `<header class="hero"><div class="heroInner"><nav class="nav">${navButton('diary','Diary')}${navButton('people','People')}${navButton('roleVariety','Role Counts')}${navButton('shows','Shows')}${navButton('venues','Venues')}${navButton('cities','Cities')}${navButton('covers','Covers')}${navButton('health','Data Health')}${navButton('edits','Edits')}</nav><div class="heroTools"><button class="btn" data-action="go-back" ${state.history.length?'':'disabled'}>← Back</button><button class="btn" data-action="go-forward" ${state.future.length?'':'disabled'}>Forward →</button><button class="btn" data-action="toggle-density">${state.viewMode==='compact'?'Comfy view':'Compact view'}</button><button class="btn" data-action="copy-current">Copy page</button><button class="btn" data-action="random">Random show 🎲</button></div></div></header>`; }
function appShell(content, drawer=true){ document.body.classList.toggle('comfy', state.viewMode==='comfy'); return `${hero()}<main class="main">${content}</main>${drawer && state.drawerPerson ? renderPersonDrawer(state.drawerPerson) : ''}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}`; }

function sortAppsAsc(a,b){ const da=(performances[a.performanceId] && performances[a.performanceId].date)||''; const db=(performances[b.performanceId] && performances[b.performanceId].date)||''; return da.localeCompare(db) || perfTitle(a.performanceId).localeCompare(perfTitle(b.performanceId)); }
function firstPerfDateFromSet(set){ const ids=[...set].sort((a,b)=>(performances[a].date||'').localeCompare(performances[b].date||'')); return ids[0] ? performances[ids[0]].date : ''; }
function renderStats(){ return `<div class="stats"><div class="stat"><b>${DB.meta.performanceCount.toLocaleString()}</b><span>Performances</span></div><div class="stat"><b>${DB.meta.showCount.toLocaleString()}</b><span>Shows</span></div><div class="stat"><b>${DB.meta.peopleCount.toLocaleString()}</b><span>People</span></div><div class="stat"><b>${DB.meta.venueCount.toLocaleString()}</b><span>Venues</span></div><div class="stat"><b>${DB.meta.appearanceCount.toLocaleString()}</b><span>Appearances</span></div></div>`; }
function breadcrumb(label){ return `<div class="breadcrumb"><button class="btn" data-action="nav" data-view="diary">Diary</button><span>›</span><span>${esc(label)}</span></div>`; }
function render(){
  let html='';
  if(state.view==='diary') html=renderDiary();
  else if(state.view==='performance') html=renderPerformance(state.id);
  else if(state.view==='people') html=renderPeople();
  else if(state.view==='person') html=renderPerson(state.id);
  else if(state.view==='shows') html=renderShows();
  else if(state.view==='show') html=renderShow(state.id);
  else if(state.view==='venues') html=renderVenues();
  else if(state.view==='venue') html=renderVenue(state.id);
  else if(state.view==='cities') html=renderCities();
  else if(state.view==='city') html=renderCity(state.id);
  else if(state.view==='health') html=renderHealth();
  else if(state.view==='covers') html=renderCovers();
  else if(state.view==='role') html=renderRole(state.id);
  else if(state.view==='roleVariety') html=renderRoleVariety();
  else if(state.view==='edits') html=renderEdits();
  app.innerHTML=html;
}
function toolbar(placeholder='Search show, person, role, venue, note…'){
  return `<div class="toolbar"><input id="q" value="${esc(state.q)}" placeholder="${esc(placeholder)}"/><select id="year"><option value="all">All years</option>${years.map(y=>`<option value="${y}" ${state.year===y?'selected':''}>${y}</option>`).join('')}</select><select id="type"><option value="all">All types</option>${types.map(t=>`<option value="${esc(t)}" ${state.type===t?'selected':''}>${esc(t)}</option>`).join('')}</select><select id="sort"><option value="dateDesc" ${state.sort==='dateDesc'?'selected':''}>Newest first</option><option value="dateAsc" ${state.sort==='dateAsc'?'selected':''}>Oldest first</option><option value="show" ${state.sort==='show'?'selected':''}>Show A-Z</option></select><label class="pillBtn"><input id="onlyCovers" type="checkbox" ${state.onlyCovers?'checked':''}/> covers only</label></div>`;
}
function performanceMatches(id,q){
  const p=getPerf(id), v=perfVenueParts(id), text=[perfTitle(id),p.date,v.name,v.city,p.type,p.time,p.notes,(p.source && p.source.castNormalized)].join(' ').toLowerCase();
  if(text.includes(q)) return true;
  return (byPerf[id]||[]).some(a=>personName(a.personId).toLowerCase().includes(q) || roleName(a.roleId).toLowerCase().includes(q)) || (creditsByPerf[id]||[]).some(c=>personName(c.personId).toLowerCase().includes(q) || String(c.credit).toLowerCase().includes(q));
}
function filteredPerfIds(){
  const q=state.q.trim().toLowerCase();
  let ids=Object.keys(performances).map(Number).filter(id=>{
    const p=getPerf(id);
    if(state.year!=='all' && yearOf(id)!==state.year) return false;
    if(state.type!=='all' && p.type!==state.type) return false;
    if(state.onlyCovers && !(byPerf[id]||[]).some(a=>a.coverType)) return false;
    if(q && !performanceMatches(id,q)) return false;
    return true;
  });
  ids.sort((a,b)=>{
    const pa=getPerf(a), pb=getPerf(b);
    if(state.sort==='dateAsc') return String(pa.date||'').localeCompare(String(pb.date||'')) || a-b;
    if(state.sort==='show') return perfTitle(a).localeCompare(perfTitle(b)) || String(pa.date||'').localeCompare(String(pb.date||''));
    return -String(pa.date||'').localeCompare(String(pb.date||'')) || b-a;
  });
  return ids;
}
function renderDiary(){ const ids=filteredPerfIds(); return appShell(`${renderStats()}${toolbar()}<div class="sectionHeader"><h2>Diary</h2><div class="muted">${ids.length.toLocaleString()} entries</div></div><div class="grid">${ids.map(perfCard).join('') || '<div class="empty">No entries match those filters.</div>'}</div>`); }
function perfCard(id){ const p=getPerf(id), v=perfVenueParts(id), apps=byPerf[id]||[], covers=apps.filter(a=>a.coverType).length, principals=apps.filter(a=>a.appearanceType==='principal').slice(0,3); return `<article class="card click" data-action="open-performance" data-id="${id}"><div class="smallCaps">${esc(p.type||'')} ${p.time?'· '+esc(p.time):''}</div><div class="showTitle">${esc(perfTitle(id))}</div><div class="meta">${fmtDate(p.date)} · ${esc(v.name)}${v.city?' · '+esc(v.city):''}</div><div class="badgeRow">${principals.map(a=>`<span class="badge">${esc(personName(a.personId))} · ${esc(roleName(a.roleId))}</span>`).join('')}${covers?`<span class="badge cover-understudy">${covers} cover/special</span>`:''}${getEdit(id).updatedAt?`<span class="badge cover-alternate">edited</span>`:''}</div></article>`; }
function prevNext(id){ const i=allPerfIdsAsc.indexOf(Number(id)); return {prev: i>0 ? allPerfIdsAsc[i-1] : null, next: i>=0 && i<allPerfIdsAsc.length-1 ? allPerfIdsAsc[i+1] : null}; }
function renderPerformance(id){
  const p=getPerf(id); if(!p.id) return appShell('<div class="empty">Performance not found.</div>');
  const v=perfVenueParts(id), apps=byPerf[id]||[], principals=apps.filter(a=>a.appearanceType==='principal'), ensemble=apps.filter(a=>a.appearanceType==='ensemble'), swings=apps.filter(a=>a.appearanceType==='swing');
  const credits=uniqueCreditsByRaw(creditsByPerf[id]||[]), covers=apps.filter(a=>a.coverType).length, pn=prevNext(id), editing=state.editPerf===Number(id);
  return appShell(`${breadcrumb(perfTitle(id))}<section class="detailHero"><div class="smallCaps">${esc(p.type||'')} ${p.time?'· '+esc(p.time):''}</div><div class="detailTitle">${esc(perfTitle(id))}</div><div class="detailMeta"><span>${fmtDate(p.date)}</span><span>${venueBtn(p.venueId, v.name)}${v.city?' · '+esc(v.city):''}</span>${isFirstShowPerf(p.showId,id)?'<span class="firstBadge">first time seeing this show</span>':''}${covers?`<span>${covers} cover/special appearance${covers>1?'s':''}</span>`:''}${getEdit(id).updatedAt?'<span>local edits saved</span>':''}</div></section><div class="actionBar"><div class="actionLeft"><button class="btn" data-action="open-performance" data-id="${pn.prev||id}" ${pn.prev?'':'disabled'}>← Previous entry</button><button class="btn" data-action="open-performance" data-id="${pn.next||id}" ${pn.next?'':'disabled'}>Next entry →</button></div><div class="actionRight"><button class="btn" data-action="copy-plain" data-id="${id}">Copy info</button><button class="btn" data-action="copy-bold" data-id="${id}">Copy formatted</button><button class="btn" data-action="copy-cast" data-id="${id}">Copy cast</button><button class="btn" data-action="toggle-edit" data-id="${id}">${editing?'Close edit':'Edit / notes'}</button></div></div>${editing?renderEditBox(id):''}<div class="stack"><section class="panel"><div class="sectionHeader"><h2>Principal / Named Roles</h2><span class="muted">${principals.length}</span></div><div class="castList">${principals.map(castRow).join('') || '<div class="empty">No principal roles parsed.</div>'}</div></section>${swings.length?`<section class="panel"><div class="sectionHeader"><h2>Swings / Tracks</h2><span class="muted">${swings.length}</span></div><div class="castList">${swings.map(castRow).join('')}</div></section>`:''}${ensemble.length?`<section class="panel"><div class="sectionHeader"><h2>Ensemble</h2><span class="muted">${ensemble.length}</span></div><div class="ensembleCloud">${ensemble.map(a=>`<button class="chip" data-action="open-drawer" data-id="${a.personId}">${esc(personName(a.personId))}<span class="chipMeta">${esc(personLineMeta(a.personId, a.performanceId))}</span>${isFirstPersonPerf(a.personId,a.performanceId)?'<span class="chipMeta firstInline">first</span>':''}</button>`).join('')}</div></section>`:''}${p.notes?`<section class="panel"><div class="sectionHeader"><h2>Notes</h2></div><div class="noteBox">${esc(p.notes)}</div></section>`:''}<section class="panel"><div class="sectionHeader"><h2>Creative Team</h2><span class="muted">${credits.length}</span></div>${credits.length ? `<div class="castList">${credits.map(creditRow).join('')}</div>` : '<div class="empty">No creative credits listed.</div>'}</section><details class="raw"><summary>Original cast text</summary><pre>${esc((performances[id].source && performances[id].source.castNormalized) || '')}</pre></details></div>`);
}
function castRow(a){ const first=isFirstPersonPerf(a.personId,a.performanceId); return `<div class="castRow"><div class="castRole">${roleBtn(a.roleId, roleName(a.roleId))}${a.alsoEnsemble?` <span class="soft">/ ensemble</span>`:''}</div><div class="castName">${personBtn(a.personId)}<span class="personLineMeta">${esc(personLineMeta(a.personId, a.performanceId))}</span>${first?'<span class="badge firstBadge">first time seen</span>':''}</div><div>${a.coverLabel?badge(a.coverLabel,a.coverType):''}</div></div>`; }
function uniqueCreditsByRaw(list){ const seen=new Set(), out=[]; for(const c of list){ const key=`${c.credit}||${c.raw}`; if(!seen.has(key)){ seen.add(key); out.push(c); } } return out.sort((a,b)=>String(a.credit).localeCompare(String(b.credit))); }
function creditRow(c){ const peopleForRaw=(creditsByPerf[c.performanceId]||[]).filter(x=>x.credit===c.credit && x.raw===c.raw); const chips=peopleForRaw.map(x=>`<button class="chip" data-action="open-drawer" data-id="${x.personId}">${esc(personName(x.personId))}</button>`).join(' '); return `<div class="castRow"><div class="castRole">${esc(c.credit)}</div><div class="castName">${chips || esc(c.raw)}</div><div></div></div>`; }
function renderEditBox(id){ const p=getPerf(id), e=getEdit(id), v=perfVenueParts(id); return `<section class="editBox"><div class="sectionHeader"><h2>Edit / Notes</h2><span class="muted">saved in this browser</span></div><div class="countNote">These edits are retained in localStorage on this device/browser. They do not alter the Excel source, so use Export Edits if you want a backup or want me to fold them into a future build.</div><form id="editForm" data-id="${id}" class="editGrid"><label>Display title<input name="showTitle" value="${esc(e.showTitle || showTitle(performances[id].showId))}" /></label><label>Date<input type="date" name="date" value="${esc(p.date||'')}" /></label><label>Venue<input name="venueName" value="${esc(v.name)}" /></label><label>City<input name="venueCity" value="${esc(v.city)}" /></label><label>Type<input name="type" value="${esc(p.type||'')}" /></label><label>Matinee / Evening<input name="time" value="${esc(p.time||'')}" /></label><label>Notes<textarea name="notes">${esc(p.notes||'')}</textarea></label></form><div class="actionBar" style="margin-top:10px"><div class="actionLeft"><button class="btn" data-action="save-edits" data-id="${id}">Save local edits</button><button class="btn" data-action="clear-perf-edits" data-id="${id}">Clear edits for this entry</button></div><div class="actionRight"><button class="btn" data-action="export-edits">Export edits</button></div></div></section>`; }
function renderPersonDrawer(pid){ const p=people[pid], apps=(byPerson[pid]||[]).slice().sort(sortAppsDesc), creds=creditsByPerson[pid]||[], stats=personStats[pid]||{}, recent=apps.slice(0,8); return `<aside class="drawer"><button class="closeBtn" data-action="close-drawer">×</button><h3>${esc((p && p.name))}</h3><div class="muted">${esc((p && p.kinds ? p.kinds.join(' · ') : '') || 'person')}</div><div class="drawerStats"><div><b>${stats.performances||0}</b><span>perfs</span></div><div><b>${stats.shows||0}</b><span>shows</span></div><div><b>${((roleVarietyByPerson[pid] || {}).count)||stats.roles||0}</b><span>role count</span></div></div><button class="pillBtn" data-action="open-person-page" data-id="${pid}" style="width:100%;margin-bottom:14px">Open full profile</button><div class="smallCaps">Recent cast appearances</div><div class="miniRows" style="margin-top:8px">${recent.map(miniAppearance).join('') || '<div class="empty">No cast appearances.</div>'}</div>${creds.length?`<div class="smallCaps" style="margin-top:14px">Creative credits: ${creds.length}</div>`:''}</aside>`; }
function sortAppsDesc(a,b){ const ad=(performances[a.performanceId] && performances[a.performanceId].date)||'', bd=(performances[b.performanceId] && performances[b.performanceId].date)||''; return -ad.localeCompare(bd) || b.performanceId-a.performanceId; }
function miniAppearance(a){ const p=getPerf(a.performanceId), v=perfVenueParts(a.performanceId); return `<div class="miniRow" data-action="open-performance" data-id="${a.performanceId}"><b>${esc(perfTitle(a.performanceId))} ${a.coverLabel?badge(a.coverLabel,a.coverType):''}</b><span>${esc(roleName(a.roleId)||a.roleRaw||a.appearanceType)} · ${fmtDate(p.date)} · ${esc(v.name)}${v.city?' · '+esc(v.city):''}</span></div>`; }
function renderPerson(pid){ const p=people[pid], apps=(byPerson[pid]||[]).slice().sort(sortAppsDesc), creds=(creditsByPerson[pid]||[]).slice().sort((a,b)=>((performances[b.performanceId] && performances[b.performanceId].date)||'').localeCompare((performances[a.performanceId] && performances[a.performanceId].date)||'')), stats=personStats[pid]||{}, variety=roleVarietyByPerson[pid], together=coStars(pid).slice(0,18); return appShell(`${breadcrumb('Person')}<section class="detailHero"><div class="smallCaps">Person profile</div><div class="detailTitle">${esc((p && p.name))}</div><div class="detailMeta"><span>${stats.performances||0} performances</span><span>${stats.shows||0} shows</span><span>${(variety && variety.count) || 0} production-role counts</span>${stats.creativeCredits?`<span>${stats.creativeCredits} creative credits</span>`:''}${stats.first?`<span>First: ${fmtDate(stats.first)}</span>`:''}${stats.recent?`<span>Recent: ${fmtDate(stats.recent)}</span>`:''}</div></section><div class="twoCol"><section class="panel"><div class="sectionHeader"><h2>Cast Appearances</h2><span class="muted">${apps.length}</span></div><div class="miniRows">${apps.map(miniAppearance).join('') || '<div class="empty">No cast appearances.</div>'}</div></section><aside class="stack"><section class="panel"><div class="sectionHeader"><h2>Shows / Roles</h2></div>${renderPersonSummary(pid)}</section><section class="panel"><div class="sectionHeader"><h2>Seen Together</h2><span class="muted">unique performances</span></div><div class="miniRows">${together.map(x=>`<div class="miniRow" data-action="open-person-page" data-id="${x.personId}"><b>${esc(personName(x.personId))}</b><span>${x.count} performance${x.count===1?'':'s'} together</span></div>`).join('') || '<div class="empty">No co-appearances.</div>'}</div></section>${variety?`<section class="panel"><div class="sectionHeader"><h2>Role Count Samples</h2><span class="muted">${variety.count}</span></div><div>${variety.samples.slice(0,24).map(s=>`<span class="roleToken">${esc(s.role)} · ${showBtn(s.showId)}</span>`).join('')}</div></section>`:''}${creds.length?`<section class="panel"><div class="sectionHeader"><h2>Creative Credits</h2><span class="muted">${creds.length}</span></div><div class="miniRows">${creds.slice(0,80).map(miniCredit).join('')}</div></section>`:''}</aside></div>`, false); }
function renderPersonSummary(pid){ const apps=byPerson[pid]||[], byS={}; for(const a of apps){ const sid=(performances[a.performanceId] && performances[a.performanceId].showId); if(!sid) continue; if(!byS[sid]) byS[sid]={roles:new Set(), count:0, covers:0}; const item=byS[sid]; item.count++; if(a.roleId) item.roles.add(roleName(a.roleId)); if(a.coverType) item.covers++; } const rows=Object.entries(byS).sort((a,b)=>b[1].count-a[1].count).map(([sid,x])=>`<tr><td>${showBtn(sid)}</td><td>${[...x.roles].slice(0,8).map(esc).join(', ')}</td><td>${x.count}</td><td>${x.covers||''}</td></tr>`).join(''); return `<div class="tableWrap"><table><thead><tr><th>Show</th><th>Roles</th><th>Apps</th><th>Covers</th></tr></thead><tbody>${rows}</tbody></table></div>`; }
function miniCredit(c){ return `<div class="miniRow" data-action="open-performance" data-id="${c.performanceId}"><b>${esc(c.credit)} · ${esc(perfTitle(c.performanceId))}</b><span>${fmtDate((performances[c.performanceId] && performances[c.performanceId].date))} · ${esc(c.raw)}</span></div>`; }
function renderPeople(){ const q=state.q.trim().toLowerCase(); let ids=Object.keys(people).map(Number).filter(pid=>{ if(!q) return (personStats[pid].performances || personStats[pid].creativeCredits) > 1; return people[pid].name.toLowerCase().includes(q); }); ids.sort((a,b)=>(personStats[b].performances+personStats[b].creativeCredits)-(personStats[a].performances+personStats[a].creativeCredits)||people[a].name.localeCompare(people[b].name)); ids=ids.slice(0,400); return appShell(`${renderStats()}<div class="toolbar"><input id="q" value="${esc(state.q)}" placeholder="Search people…"/></div><div class="sectionHeader"><h2>People</h2><div class="muted">Showing ${ids.length.toLocaleString()}</div></div><div class="grid">${ids.map(personCard).join('')}</div>`); }
function personCard(pid){ const p=people[pid], st=personStats[pid]||{}, variety=roleVarietyByPerson[pid]; return `<article class="card click" data-action="open-person-page" data-id="${pid}"><div class="showTitle" style="font-size:21px">${esc(p.name)}</div><div class="meta">${esc((p.kinds ? p.kinds.join(' · ') : '') || '')}</div><div class="badgeRow"><span class="badge">${st.performances||0} perfs</span><span class="badge">${st.shows||0} shows</span><span class="badge">${(variety && variety.count)||0} role count</span>${st.creativeCredits?`<span class="badge">${st.creativeCredits} creative</span>`:''}</div></article>`; }
function renderShows(){ const q=state.q.trim().toLowerCase(); let ids=Object.keys(shows).map(Number).filter(sid=>!q || shows[sid].title.toLowerCase().includes(q)); ids.sort((a,b)=>showStats[b].performances-showStats[a].performances || shows[a].title.localeCompare(shows[b].title)); return appShell(`${renderStats()}<div class="toolbar"><input id="q" value="${esc(state.q)}" placeholder="Search shows…"/></div><div class="sectionHeader"><h2>Shows</h2><div class="muted">${ids.length.toLocaleString()} shows</div></div><div class="grid">${ids.map(showCard).join('')}</div>`); }
function showCard(sid){ const st=showStats[sid]||{}; return `<article class="card click" data-action="open-show" data-id="${sid}"><div class="showTitle">${esc(showTitle(sid))}</div><div class="badgeRow"><span class="badge">${st.performances} seen</span><span class="badge">${st.people} people</span>${st.covers?`<span class="badge cover-understudy">${st.covers} covers</span>`:''}${st.first?`<span class="badge">${fmtDate(st.first)} → ${fmtDate(st.recent)}</span>`:''}</div></article>`; }
function renderShow(sid){ const s=shows[sid], perfIds=(byShow[sid]||[]).slice().sort((a,b)=>(performances[b].date||'').localeCompare(performances[a].date||'')), apps=perfIds.flatMap(id=>byPerf[id]||[]); const rolesInShow={}; for(const a of apps){ if(!a.roleId) continue; if(!rolesInShow[a.roleId]) rolesInShow[a.roleId]={people:new Set(), count:0, covers:0}; const item=rolesInShow[a.roleId]; item.people.add(a.personId); item.count++; item.covers += a.coverType?1:0; } const roleRows=Object.entries(rolesInShow).sort((a,b)=>b[1].count-a[1].count).slice(0,120).map(([rid,x])=>`<tr><td>${roleBtn(rid)}</td><td>${[...x.people].slice(0,8).map(pid=>personBtn(pid)).join(', ')}</td><td>${x.count}</td><td>${x.covers||''}</td></tr>`).join(''); return appShell(`${breadcrumb('Show')}<section class="detailHero"><div class="smallCaps">Show page</div><div class="detailTitle">${esc((s && s.title))}</div><div class="detailMeta"><span>${perfIds.length} performances</span><span>${unique(perfIds.map(id=>performances[id].venueId)).length} venues</span><span>${apps.filter(a=>a.coverType).length} covers / specials</span>${(showStats[sid] && showStats[sid].first)?`<span>${fmtDate(showStats[sid].first)} → ${fmtDate(showStats[sid].recent)}</span>`:''}</div></section><div class="twoCol"><section class="panel"><div class="sectionHeader"><h2>Performances</h2></div><div class="grid">${perfIds.map(perfCard).join('')}</div></section><aside class="panel"><div class="sectionHeader"><h2>Role History</h2></div><div class="tableWrap"><table><thead><tr><th>Role</th><th>People seen</th><th>Apps</th><th>Covers</th></tr></thead><tbody>${roleRows}</tbody></table></div></aside></div>`); }
function renderRole(rid){ const r=roles[rid]; if(!r) return appShell('<div class="empty">Role not found.</div>'); const norm=normalizeRoleName(r.name), siblingIds=Object.values(roles).filter(x=>x.showId===r.showId && normalizeRoleName(x.name)===norm).map(x=>x.id); const apps=siblingIds.flatMap(id=>byRole[id]||[]).sort(sortAppsAsc); const byP={}; for(const a of apps){ if(!byP[a.personId]) byP[a.personId]={count:0,covers:0,perfs:new Set(),first:''}; const item=byP[a.personId]; item.count++; item.covers+=a.coverType?1:0; item.perfs.add(a.performanceId); const d=(performances[a.performanceId] && performances[a.performanceId].date)||''; if(d && (!item.first || d<item.first)) item.first=d; } const rows=Object.entries(byP).sort((a,b)=>(a[1].first||'9999').localeCompare(b[1].first||'9999') || personName(a[0]).localeCompare(personName(b[0]))).map(([pid,x])=>`<tr><td>${personBtn(pid)}</td><td>${fmtDate(x.first)}</td><td>${x.perfs.size}</td><td>${x.covers||''}</td></tr>`).join(''); return appShell(`${breadcrumb('Role')}<section class="panel"><div class="sectionHeader"><h2>${esc(r.name)} <span class="soft">· ${showBtn(r.showId)}</span></h2><span class="muted">${Object.keys(byP).length} people · ${apps.length} appearances</span></div><div class="twoCol"><div><div class="sectionHeader"><h2>People Seen in Role</h2><span class="muted">chronological</span></div><div class="tableWrap"><table><thead><tr><th>Person</th><th>First seen</th><th>Perfs</th><th>Covers</th></tr></thead><tbody>${rows}</tbody></table></div></div><div><div class="sectionHeader"><h2>Appearances</h2><span class="muted">oldest first</span></div><div class="miniRows">${apps.map(miniAppearance).join('')}</div></div></div></section>`); }
function renderRoleVariety(){ const q=state.q.trim().toLowerCase(); const rows=roleVariety.filter(x=>!q || personName(x.personId).toLowerCase().includes(q) || x.samples.some(s=>s.role.toLowerCase().includes(q) || showTitle(s.showId).toLowerCase().includes(q))).slice(0,300); return appShell(`${renderStats()}<div class="toolbar"><input id="q" value="${esc(state.q)}" placeholder="Search people, roles, shows…"/></div><div class="sectionHeader"><h2>People Seen in the Most Different Roles</h2><span class="muted">${rows.length} shown</span></div><div class="countNote">Count uses distinct normalized role/track + production. For this v2, “production” means show + type + venue; cover type does not split the count, and repeated performances of the same role/track in the same production collapse.</div><div class="tableWrap"><table><thead><tr><th>#</th><th>Person</th><th>Role count</th><th>Performances</th><th>Sample roles</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td>${i+1}</td><td>${personBtn(x.personId)}</td><td><b>${x.count}</b></td><td>${x.performances}</td><td>${x.samples.slice(0,8).map(s=>`<span class="roleToken">${esc(s.role)} · ${esc(showTitle(s.showId))}</span>`).join('')}</td></tr>`).join('')}</tbody></table></div>`); }
function renderVenues(){ const q=state.q.trim().toLowerCase(); let ids=Object.keys(venues).map(Number).filter(vid=>!q || `${venues[vid].name} ${venues[vid].city}`.toLowerCase().includes(q)); ids.sort((a,b)=>venueStats[b].performances-venueStats[a].performances || venues[a].name.localeCompare(venues[b].name)); return appShell(`${renderStats()}<div class="toolbar"><input id="q" value="${esc(state.q)}" placeholder="Search venues…"/></div><div class="sectionHeader"><h2>Venues</h2><div class="muted">${ids.length.toLocaleString()} venues</div></div><div class="grid">${ids.map(venueCard).join('')}</div>`); }
function venueCard(vid){ const v=venues[vid], st=venueStats[vid]||{}; return `<article class="card click" data-action="open-venue" data-id="${vid}"><div class="showTitle" style="font-size:21px">${esc(v.name)}</div><div class="meta">${esc(v.city||'')}</div><div class="badgeRow"><span class="badge">${st.performances} perfs</span><span class="badge">${st.shows} shows</span>${st.first?`<span class="badge">${fmtDate(st.first)} → ${fmtDate(st.recent)}</span>`:''}</div></article>`; }
function renderVenue(vid){ const v=venues[vid], perfIds=(byVenue[vid]||[]).slice().sort((a,b)=>(performances[b].date||'').localeCompare(performances[a].date||'')); return appShell(`${breadcrumb('Venue')}<section class="detailHero"><div class="smallCaps">Venue page</div><div class="detailTitle">${esc((v && v.name))}</div><div class="detailMeta"><span>${esc((v && v.city)||'')}</span><span>${perfIds.length} performances</span><span>${unique(perfIds.map(id=>performances[id].showId)).length} shows</span></div></section><div class="grid">${perfIds.map(perfCard).join('')}</div>`); }
function renderCovers(){ const rows=appearances.filter(a=>a.coverType).slice().sort(sortAppsDesc); return appShell(`${renderStats()}<div class="sectionHeader"><h2>Covers / Special Appearances</h2><span class="muted">${rows.length.toLocaleString()}</span></div><div class="grid">${rows.map(a=>`<article class="card click" data-action="open-performance" data-id="${a.performanceId}"><div class="smallCaps">${esc(a.coverLabel||'cover')}</div><div class="showTitle" style="font-size:21px">${esc(personName(a.personId))}</div><div class="meta">${esc(roleName(a.roleId))} · ${esc(perfTitle(a.performanceId))}<br>${fmtDate((performances[a.performanceId] && performances[a.performanceId].date))} · ${esc(venueLabel(a.performanceId))}</div>${badge(a.coverLabel,a.coverType)}</article>`).join('')}</div>`); }
function renderEdits(){ const count=Object.keys(localEdits.performances||{}).length; return appShell(`${breadcrumb('Edits')}<section class="detailHero"><div class="smallCaps">Local changes</div><div class="detailTitle">Edits & Notes</div><div class="detailMeta"><span>${count} edited entries</span><span>stored in this browser</span></div></section><section class="panel"><div class="sectionHeader"><h2>Export / Import</h2></div><p class="countNote">Standalone HTML files cannot safely write back into themselves or into the Excel workbook. This dashboard saves edits in your browser localStorage. Export this patch file and send/upload it later if you want those edits merged into the source build.</p><div class="actionBar"><div class="actionLeft"><button class="btn" data-action="export-edits">Export edits JSON</button><button class="btn" data-action="import-toggle">Import edits JSON</button><button class="btn" data-action="clear-all-edits">Clear all local edits</button></div></div><div id="importArea" class="importBox" style="display:none"><textarea id="importText" placeholder="Paste exported edits JSON here…"></textarea><button class="btn" data-action="import-edits" style="margin-top:8px">Import pasted edits</button></div></section><section class="panel" style="margin-top:14px"><div class="sectionHeader"><h2>Edited Entries</h2></div><div class="miniRows">${Object.keys(localEdits.performances||{}).map(id=>`<div class="miniRow" data-action="open-performance" data-id="${id}"><b>${esc(perfTitle(id))}</b><span>${fmtDate(getPerf(id).date)} · ${esc(venueLabel(id))}</span></div>`).join('') || '<div class="empty">No local edits yet.</div>'}</div></section>`); }
function formatEntry(id, opts={}){
  const p=getPerf(id), v=perfVenueParts(id), apps=byPerf[id]||[], principals=apps.filter(a=>a.appearanceType==='principal'), ensemble=apps.filter(a=>a.appearanceType==='ensemble'), swings=apps.filter(a=>a.appearanceType==='swing');
  const lines=[`${opts.boldTitle?'***':''}${perfTitle(id).toUpperCase()}${opts.boldTitle?'***':''} | ${fmtDate(p.date)}`, `${v.name}${v.city?', '+v.city:''} | ${p.type||''}${p.time?' · '+p.time:''}`, ''];
  const entryFor=a=>{ const role=roleName(a.roleId) || a.roleRaw || ''; const entry=`${personName(a.personId)} (${coverPrefix(a.coverType)}${role}${a.alsoEnsemble?'/ensemble':''})`; return opts.boldCovers && a.coverType ? `**${entry}**` : entry; };
  if(!opts.creativesOnly){ const parts=principals.map(entryFor); if(parts.length) lines.push(parts.join(', ')); if(ensemble.length){ lines.push(''); lines.push(`Ensemble: ${ensemble.map(a=>personName(a.personId)).join(', ')}`); } if(swings.length){ lines.push(''); lines.push(`Swings: ${swings.map(entryFor).join(', ')}`); } }
  if(!opts.castOnly){ const credits=uniqueCreditsByRaw(creditsByPerf[id]||[]); if(credits.length){ lines.push(''); lines.push('Creative Team:'); for(const c of credits){ const names=(creditsByPerf[id]||[]).filter(x=>x.credit===c.credit && x.raw===c.raw).map(x=>personName(x.personId)); lines.push(`${c.credit}: ${names.length?names.join(' / '):c.raw}`); } } }
  return lines.join('\n').trim();
}


function showTimeline(perfIds){
  const ids=perfIds.slice().sort((a,b)=>(performances[a].date||'').localeCompare(performances[b].date||'') || a-b);
  return `<div class="timeline">${ids.map(id=>{ const p=getPerf(id), v=perfVenueParts(id); return `<button class="timelineItem" data-action="open-performance" data-id="${id}"><span>${fmtDate(p.date)}</span><b>${esc(v.name)}</b><em>${esc(p.type||'')}${p.time?' · '+esc(p.time):''}</em></button>`; }).join('')}</div>`;
}
function roleComparisonCards(apps){
  const byP={};
  for(const a of apps){
    if(!byP[a.personId]) byP[a.personId]={apps:[], covers:0, first:''};
    byP[a.personId].apps.push(a); byP[a.personId].covers += a.coverType?1:0;
    const d=(performances[a.performanceId]&&performances[a.performanceId].date)||'';
    if(d && (!byP[a.personId].first || d<byP[a.personId].first)) byP[a.personId].first=d;
  }
  const items=Object.entries(byP).sort((a,b)=>(a[1].first||'9999').localeCompare(b[1].first||'9999') || personName(a[0]).localeCompare(personName(b[0])));
  return `<div class="comparisonGrid">${items.map(([pid,x])=>`<article class="compareCard"><div class="compareName">${personBtn(pid)}</div><div class="meta">First: ${fmtDate(x.first)} · ${x.apps.length} appearance${x.apps.length===1?'':'s'}${x.covers?' · '+x.covers+' cover/special':''}</div><div class="miniRows">${x.apps.slice().sort(sortAppsAsc).slice(0,8).map(miniAppearance).join('')}</div></article>`).join('')}</div>`;
}
function renderShow(sid){
  const s=shows[sid], perfIds=(byShow[sid]||[]).slice().sort((a,b)=>(performances[b].date||'').localeCompare(performances[a].date||'')), apps=perfIds.flatMap(id=>byPerf[id]||[]);
  const rolesInShow={};
  for(const a of apps){ if(!a.roleId) continue; if(!rolesInShow[a.roleId]) rolesInShow[a.roleId]={people:new Set(), count:0, covers:0}; const item=rolesInShow[a.roleId]; item.people.add(a.personId); item.count++; item.covers += a.coverType?1:0; }
  const roleRows=Object.entries(rolesInShow).sort((a,b)=>b[1].count-a[1].count).slice(0,120).map(([rid,x])=>`<tr><td>${roleBtn(rid)}</td><td>${[...x.people].slice(0,8).map(pid=>personBtn(pid)).join(', ')}</td><td>${x.count}</td><td>${x.covers||''}</td></tr>`).join('');
  return appShell(`${breadcrumb('Show')}<section class="detailHero"><div class="smallCaps">Show page</div><div class="detailTitle">${esc((s && s.title))}</div><div class="detailMeta"><span>${perfIds.length} performances</span><span>${unique(perfIds.map(id=>performances[id].venueId)).length} venues</span><span>${apps.filter(a=>a.coverType).length} covers / specials</span>${(showStats[sid] && showStats[sid].first)?`<span>${fmtDate(showStats[sid].first)} → ${fmtDate(showStats[sid].recent)}</span>`:''}</div></section><section class="panel timelinePanel"><div class="sectionHeader"><h2>Performance Timeline</h2><span class="muted">oldest first</span></div>${showTimeline(perfIds)}</section><div class="twoCol"><section class="panel"><div class="sectionHeader"><h2>Performances</h2></div><div class="grid">${perfIds.map(perfCard).join('')}</div></section><aside class="panel"><div class="sectionHeader"><h2>Role History</h2></div><div class="tableWrap"><table><thead><tr><th>Role</th><th>People seen</th><th>Apps</th><th>Covers</th></tr></thead><tbody>${roleRows}</tbody></table></div></aside></div>`);
}
function renderRole(rid){
  const r=roles[rid]; if(!r) return appShell('<div class="empty">Role not found.</div>');
  const norm=normalizeRoleName(r.name), siblingIds=Object.values(roles).filter(x=>x.showId===r.showId && normalizeRoleName(x.name)===norm).map(x=>x.id), apps=siblingIds.flatMap(id=>byRole[id]||[]).sort(sortAppsAsc);
  const byP={}; for(const a of apps){ if(!byP[a.personId]) byP[a.personId]={count:0,covers:0,perfs:new Set(),first:''}; const item=byP[a.personId]; item.count++; item.covers+=a.coverType?1:0; item.perfs.add(a.performanceId); const d=(performances[a.performanceId] && performances[a.performanceId].date)||''; if(d && (!item.first || d<item.first)) item.first=d; }
  const rows=Object.entries(byP).sort((a,b)=>(a[1].first||'9999').localeCompare(b[1].first||'9999') || personName(a[0]).localeCompare(personName(b[0]))).map(([pid,x])=>`<tr><td>${personBtn(pid)}</td><td>${fmtDate(x.first)}</td><td>${x.perfs.size}</td><td>${x.covers||''}</td></tr>`).join('');
  return appShell(`${breadcrumb('Role')}<section class="panel"><div class="sectionHeader"><h2>${esc(r.name)} <span class="soft">· ${showBtn(r.showId)}</span></h2><span class="muted">${Object.keys(byP).length} people · ${apps.length} appearances</span></div><div class="sectionHeader"><h2>People Seen in Role</h2><span class="muted">chronological</span></div><div class="tableWrap"><table><thead><tr><th>Person</th><th>First seen</th><th>Perfs</th><th>Covers</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="panel"><div class="sectionHeader"><h2>Role Comparison</h2><span class="muted">by person, oldest first</span></div>${roleComparisonCards(apps)}</section><section class="panel"><div class="sectionHeader"><h2>Appearances</h2><span class="muted">oldest first</span></div><div class="miniRows">${apps.map(miniAppearance).join('')}</div></section>`);
}
function renderCities(){
  const q=state.q.trim().toLowerCase(); let ids=Object.keys(cityStats).filter(id=>!q || cityStats[id].city.toLowerCase().includes(q));
  ids.sort((a,b)=>cityStats[b].performances-cityStats[a].performances || cityStats[a].city.localeCompare(cityStats[b].city));
  return appShell(`${renderStats()}<div class="toolbar"><input id="q" value="${esc(state.q)}" placeholder="Search cities…"/></div><div class="sectionHeader"><h2>Cities</h2><div class="muted">${ids.length.toLocaleString()} cities</div></div><div class="grid">${ids.map(id=>{ const c=cityStats[id]; return `<article class="card click" data-action="open-city" data-id="${esc(id)}"><div class="showTitle">${esc(c.city)}</div><div class="badgeRow"><span class="badge">${c.performances} perfs</span><span class="badge">${c.shows} shows</span><span class="badge">${c.venues} venues</span>${c.first?`<span class="badge">${fmtDate(c.first)} → ${fmtDate(c.recent)}</span>`:''}</div></article>`; }).join('')}</div>`);
}
function renderCity(cityId){
  const c=cityStats[String(cityId)]; if(!c) return appShell('<div class="empty">City not found.</div>');
  const perfIds=c.perfIds.slice().sort((a,b)=>(performances[b].date||'').localeCompare(performances[a].date||''));
  const venueRows=[...c.venueIds].sort((a,b)=>(venueStats[b].performances||0)-(venueStats[a].performances||0)).map(vid=>`<tr><td>${venueBtn(vid)}</td><td>${venueStats[vid].performances}</td><td>${venueStats[vid].shows}</td></tr>`).join('');
  return appShell(`${breadcrumb('City')}<section class="detailHero"><div class="smallCaps">City page</div><div class="detailTitle">${esc(c.city)}</div><div class="detailMeta"><span>${c.performances} performances</span><span>${c.shows} shows</span><span>${c.venues} venues</span>${c.first?`<span>${fmtDate(c.first)} → ${fmtDate(c.recent)}</span>`:''}</div></section><div class="twoCol"><section class="panel"><div class="sectionHeader"><h2>Performances</h2></div><div class="grid">${perfIds.map(perfCard).join('')}</div></section><aside class="panel"><div class="sectionHeader"><h2>Venues in ${esc(c.city)}</h2></div><div class="tableWrap"><table><thead><tr><th>Venue</th><th>Perfs</th><th>Shows</th></tr></thead><tbody>${venueRows}</tbody></table></div></aside></div>`);
}
function healthTable(title, ids, note){ return `<section class="panel"><div class="sectionHeader"><h2>${esc(title)}</h2><span class="muted">${ids.length}</span></div>${note?`<div class="countNote">${esc(note)}</div>`:''}<div class="miniRows">${ids.slice(0,120).map(id=>`<div class="miniRow" data-action="open-performance" data-id="${id}"><b>${esc(perfTitle(id))}</b><span>${fmtDate(getPerf(id).date)} · ${esc(venueLabel(id))}</span></div>`).join('') || '<div class="empty">Nothing flagged here.</div>'}</div></section>`; }
function renderHealth(){
  const dupRows=healthStats.dupPeople.map(list=>`<tr><td>${list.map(pid=>personBtn(pid)).join(' / ')}</td><td>${list.map(pid=>people[pid].name).join(' | ')}</td></tr>`).join('');
  const roleRows=healthStats.roleVariants.slice(0,80).map(list=>`<tr><td>${list.map(rid=>roleBtn(rid)).join(' / ')}</td><td>${esc(showTitle(roles[list[0]].showId))}</td></tr>`).join('');
  return appShell(`${renderStats()}<section class="detailHero"><div class="smallCaps">Cleanup radar</div><div class="detailTitle">Data Health</div><div class="detailMeta"><span>${healthStats.missingCast.length} no parsed cast</span><span>${healthStats.missingVenue.length} venue flags</span><span>${healthStats.dupPeople.length} possible duplicate people groups</span></div></section><div class="twoCol"><div class="stack">${healthTable('No Parsed Cast', healthStats.missingCast, 'Entries where the parser found no cast appearances. These are worth checking first.')}${healthTable('Odd Raw Cast Text', healthStats.rawOdd, 'Raw cast text includes markers like TBD, Unknown, brackets, or question marks.')}</div><aside class="stack"><section class="panel"><div class="sectionHeader"><h2>Possible Duplicate People</h2><span class="muted">${healthStats.dupPeople.length}</span></div><div class="tableWrap"><table><thead><tr><th>People</th><th>Names</th></tr></thead><tbody>${dupRows || '<tr><td colspan="2">Nothing obvious.</td></tr>'}</tbody></table></div></section><section class="panel"><div class="sectionHeader"><h2>Normalized Role Variants</h2><span class="muted">${healthStats.roleVariants.length}</span></div><div class="countNote">These may be valid duplicate role IDs under the same show, but they are useful normalization smoke signals.</div><div class="tableWrap"><table><thead><tr><th>Roles</th><th>Show</th></tr></thead><tbody>${roleRows || '<tr><td colspan="2">Nothing obvious.</td></tr>'}</tbody></table></div></section></aside></div>`);
}
function formatCurrentPage(){
  if(state.view==='performance' && state.id) return formatEntry(state.id);
  if(state.view==='person' && state.id){ const p=people[state.id], st=personStats[state.id]||{}, apps=(byPerson[state.id]||[]).slice().sort(sortAppsAsc); return [`${p.name}`, `${st.performances||0} performances · ${st.shows||0} shows · ${((roleVarietyByPerson[state.id]||{}).count)||0} production-role counts`, '', ...apps.map(a=>`${fmtDate((performances[a.performanceId]||{}).date)} | ${perfTitle(a.performanceId)} | ${roleName(a.roleId)||a.roleRaw||a.appearanceType}${a.coverLabel?' | '+a.coverLabel:''}`)].join('\n'); }
  if(state.view==='show' && state.id){ const ids=(byShow[state.id]||[]).slice().sort((a,b)=>(performances[a].date||'').localeCompare(performances[b].date||'')); return [`${showTitle(state.id)}`, `${ids.length} performances`, '', ...ids.map(id=>`${fmtDate(getPerf(id).date)} | ${venueLabel(id)} | ${getPerf(id).type||''}${getPerf(id).time?' · '+getPerf(id).time:''}`)].join('\n'); }
  if(state.view==='role' && state.id){ const r=roles[state.id], apps=(byRole[state.id]||[]).slice().sort(sortAppsAsc); return [`${r.name} | ${showTitle(r.showId)}`, `${apps.length} appearances`, '', ...apps.map(a=>`${fmtDate((performances[a.performanceId]||{}).date)} | ${personName(a.personId)} | ${perfTitle(a.performanceId)}${a.coverLabel?' | '+a.coverLabel:''}`)].join('\n'); }
  if(state.view==='venue' && state.id){ const ids=(byVenue[state.id]||[]).slice().sort((a,b)=>(performances[a].date||'').localeCompare(performances[b].date||'')); return [`${venues[state.id].name}`, `${venues[state.id].city||''}`, '', ...ids.map(id=>`${fmtDate(getPerf(id).date)} | ${perfTitle(id)}`)].join('\n'); }
  if(state.view==='city' && state.id){ const c=cityStats[String(state.id)]; return [`${c.city}`, `${c.performances} performances · ${c.shows} shows · ${c.venues} venues`, '', ...c.perfIds.slice().sort((a,b)=>(performances[a].date||'').localeCompare(performances[b].date||'')).map(id=>`${fmtDate(getPerf(id).date)} | ${perfTitle(id)} | ${venueLabel(id)}`)].join('\n'); }
  return `Theatre Attendance Diary\nCurrent view: ${state.view}`;
}
function loadLocalEdits(){ try{ const raw=localStorage.getItem('theatreDiaryEditsSiteV1'); return raw ? JSON.parse(raw) : {version:2,performances:{}}; }catch(e){ return {version:2,performances:{}}; } }
function persistEdits(){ try{ localStorage.setItem('theatreDiaryEditsSiteV1', JSON.stringify(localEdits)); return true; }catch(e){ return false; } }
function savePerfEdits(id){ const form=document.getElementById('editForm'); if(!form) return; const data=Object.fromEntries(new FormData(form).entries()); data.updatedAt=new Date().toISOString(); if(!localEdits.performances) localEdits.performances = {}; localEdits.performances[id]=data; const ok=persistEdits(); state.editPerf=null; toast(ok?'Local edits saved.':'Edit held in memory, but this browser blocked localStorage. Export edits now.'); }
function exportEdits(){ const blob=new Blob([JSON.stringify(localEdits,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='theatre-dashboard-local-edits.json'; a.click(); URL.revokeObjectURL(a.href); toast('Edits exported.'); }

app.addEventListener('click', e=>{
  const btn=e.target.closest('[data-action]'); if(!btn) return; const action=btn.dataset.action, rawId=btn.dataset.id, id=rawId ? (/^\d+$/.test(rawId) ? Number(rawId) : rawId) : null;
  if(action==='nav') navigate(btn.dataset.view,null);
  else if(action==='open-performance') navigate('performance',id);
  else if(action==='open-show') navigate('show',id);
  else if(action==='open-venue') navigate('venue',id);
  else if(action==='open-city') navigate('city',id);
  else if(action==='open-role') navigate('role',id);
  else if(action==='open-person-page') navigate('person',id);
  else if(action==='open-drawer'){ state.drawerPerson=id; render(); }
  else if(action==='close-drawer'){ state.drawerPerson=null; render(); }
  else if(action==='random'){ const ids=Object.keys(performances).map(Number); navigate('performance', ids[Math.floor(Math.random()*ids.length)]); }
  else if(action==='toggle-density'){ state.viewMode = state.viewMode==='compact' ? 'comfy' : 'compact'; localStorage.setItem('theatreDiaryViewMode', state.viewMode); render(); }
  else if(action==='copy-current') copyText(formatCurrentPage());
  else if(action==='go-back') goBack();
  else if(action==='go-forward') goForward();
  else if(action==='copy-plain') copyText(formatEntry(id));
  else if(action==='copy-bold') copyText(formatEntry(id,{boldTitle:true,boldCovers:true}));
  else if(action==='copy-cast') copyText(formatEntry(id,{castOnly:true}));
  else if(action==='toggle-edit'){ state.editPerf = state.editPerf===id ? null : id; render(); }
  else if(action==='save-edits') savePerfEdits(id);
  else if(action==='clear-perf-edits'){ if(localEdits.performances) delete localEdits.performances[id]; persistEdits(); state.editPerf=null; toast('Local edits cleared.'); }
  else if(action==='export-edits') exportEdits();
  else if(action==='clear-all-edits'){ if(confirm('Clear all local dashboard edits on this browser?')){ localEdits={version:2,performances:{}}; persistEdits(); toast('All local edits cleared.'); } }
  else if(action==='import-toggle'){ const el=document.getElementById('importArea'); if(el) el.style.display = el.style.display==='none' ? 'block' : 'none'; }
  else if(action==='import-edits'){ const raw=(document.getElementById('importText') ? document.getElementById('importText').value : '') || ''; try{ const parsed=JSON.parse(raw); localEdits=parsed.performances ? parsed : {version:2,performances:parsed}; persistEdits(); toast('Edits imported.'); }catch(err){ toast('That JSON did not import.'); } }
});
app.addEventListener('input', e=>{
  if(e.target.id==='q'){
    const pos=e.target.selectionStart || e.target.value.length;
    state.q=e.target.value;
    render();
    const q=document.getElementById('q');
    if(q){ q.focus(); try{ q.setSelectionRange(pos,pos); }catch(_){} }
  }
  else if(e.target.id==='year'){ state.year=e.target.value; render(); }
  else if(e.target.id==='type'){ state.type=e.target.value; render(); }
  else if(e.target.id==='sort'){ state.sort=e.target.value; render(); }
  else if(e.target.id==='onlyCovers'){ state.onlyCovers=e.target.checked; render(); }
});
try{ render(); }catch(err){ window.onerror(err.message,'',0,0,err); }

}
bootTheatreDiary().catch(function(err){
  var el=document.getElementById('app');
  if(el){
    el.innerHTML='<div class="main"><section class="detailHero"><div class="smallCaps">Dashboard error</div><div class="detailTitle">The page loaded, but the data/app did not</div><div class="noteBox">'+String(err && err.message ? err.message : err)+'</div><div class="footnote">If you are opening this as a local file on iPhone, host the folder with GitHub Pages. Local file previews often block the data file.</div></section></div>';
  }
});
