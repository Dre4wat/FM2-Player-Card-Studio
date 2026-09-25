import { DEFAULT_PLAYER, attributeSets } from './data.js';
import { exportPlayerCard } from './export.js';

// NeonSportz allows cross-origin reads. GitHub Actions snapshots images for canvas export.
const API = 'https://neonsportz.com/api/leagues/FM2';
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const devNames = ['Normal Dev', 'Star Dev', 'Superstar Dev', 'X-Factor Dev'];
const money = (value) => !value ? '$0' : Math.abs(value) >= 1e6 ? `$${(value / 1e6).toFixed(2).replace(/\.00$/, '')}M` : `$${Math.round(value / 1000)}K`;
const height = (value) => `${Math.floor(value / 12)}'${value % 12}"`;
function color(value, fallback) { const n = Number(value); return Number.isFinite(n) ? `#${Math.max(0, Math.min(0xffffff, n)).toString(16).padStart(6, '0')}` : fallback; }
function blend(a, b, weight) { return `#${[0,2,4].map(i => Math.round(parseInt(a.slice(i + 1, i + 3),16) * weight + parseInt(b.slice(i + 1, i + 3),16) * (1 - weight)).toString(16).padStart(2,'0')).join('')}`; }
function group(position) {
  if (['LT','LG','C','RG','RT'].includes(position)) return 'OL';
  if (['DT','LE','RE','LEDGE','REDGE'].includes(position)) return 'DL';
  if (['LOLB','ROLB','MLB','SAM','MIKE','WILL'].includes(position)) return 'LB';
  if (['CB','FS','SS'].includes(position)) return 'DB';
  if (['K','P'].includes(position)) return 'K';
  return position in attributeSets ? position : 'HB';
}
function rows(items) { return `<dl class="data-list">${items.map(([k,v]) => `<div class="data-row"><dt>${escapeHtml(k)}:</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>`; }
function box(title, items, className) { return `<section class="metal-box ${className}"><h2 class="section-title">${title}</h2>${rows(items)}</section>`; }
const state = { player: DEFAULT_PLAYER, players: [DEFAULT_PLAYER], prepared: null, searchTimer: null, searchController: null, rosterController: null, loading: false };
function media(kind, id) { return `./assets/${kind}/${encodeURIComponent(id)}.webp`; }
function message(text) { $('error').textContent = text; $('error').hidden = !text; }
function render() {
  const p = state.player, t = p.team, team = color(t?.primaryColor, '#8f1028'), dark = blend(team, '#000000', .48), accent = blend(team, '#ff405e', .58), title = blend(team, '#e62242', .7);
  const logo = t ? media('team', t.logoId) : '';
  const card = $('card');
  card.style.cssText = `--team:${team};--team-dark:${dark};--team-light:${blend(team, '#ffffff', .88)};--team-accent:${accent};--team-title:${title};--team-glow:${blend(team,'#000000',.68)}ad;--team-line:${blend(team,'#000000',.33)}55`;
  card.innerHTML = `
    <div class="card-noise"></div><div class="team-stripe one"></div><div class="team-stripe two"></div>${logo ? `<img class="team-watermark" src="${logo}" alt="" crossorigin="anonymous">` : ''}
    <div class="card-grid">
      <section class="portrait-panel" aria-label="${escapeHtml(p.fullName)} headshot">${logo ? `<img class="portrait-team-logo" src="${logo}" alt="" crossorigin="anonymous">` : ''}<img class="player-portrait" src="${media('portrait',p.portraitId)}" alt="${escapeHtml(p.fullName)}" crossorigin="anonymous"><div class="portrait-shine"></div></section>
      <section class="identity-panel"><div class="team-kicker">${escapeHtml(t ? `${t.cityName} ${t.displayName}` : 'FM2 Free Agent')}</div><h1 class="player-name"><span class="first">${escapeHtml(p.firstName)}</span><span class="last">${escapeHtml(p.lastName)}</span></h1><div class="position-line"><span>${escapeHtml(p.position)} #${escapeHtml(p.jerseyNum)}</span></div><div class="rating-dev"><div class="ovr-block"><span class="ovr-number">${escapeHtml(p.playerBestOvr)}</span><span class="ovr-label">OVR</span></div><span class="dev-divider"></span><div class="dev-block"><img class="dev-icon" src="${media('dev',p.devTrait)}" alt="" crossorigin="anonymous"><span class="dev-text">${escapeHtml(devNames[p.devTrait] ?? 'Development')}</span></div></div></section>
      <div class="stats-left">${box('Details',[['Age',p.age],['Height / Weight',`${height(p.height)} / ${p.weight} lbs`],['Years Pro',p.yearsPro === 0 ? 'ROOKIE' : p.yearsPro]],'details-box')}${box('Contract',[['Cap Hit',money(p.capHit)],['Salary',money(p.contractSalary)],['Bonus',money(p.contractBonus)],['Years Left / Length',`${p.contractYearsLeft}/${p.contractLength}`],['Release Net Savings',money(p.capReleaseNetSavings)],['Total Release Penalty',money(p.capReleasePenalty)]],'contract-box')}</div>
      <div class="stats-right">${box('Key Attributes',(attributeSets[group(p.position)] ?? attributeSets.HB).map(({label,key}) => [label,Number(p[key] ?? 0)]),'attributes-box')}<section class="brand-lockup">${logo ? `<img class="brand-logo" src="${logo}" alt="" crossorigin="anonymous">` : ''}<div class="brand-copy"><span class="brand-city">${escapeHtml(t?.cityName ?? 'FM2')}</span><span class="brand-team">${escapeHtml(t?.displayName ?? 'Free Agent')}</span><span class="brand-rule"></span><span class="brand-league">FM2 Franchise</span></div></section></div>
      <footer class="card-footer"><div class="footer-brand"><span class="footer-ea">EA</span><span>MADDEN NFL</span></div><div class="footer-meta"><strong>${escapeHtml(t?.abbrName ?? 'FA')}</strong><span class="footer-slash"></span><span>Built from NeonSportz</span></div></footer>
    </div>${state.loading ? '<div class="loading-cover">Loading player</div>' : ''}`;
}
async function request(path, signal) { const r = await fetch(`${API}${path}`, { signal }); if (!r.ok) throw new Error(`FM2 request failed (${r.status})`); return r.json(); }
async function loadPlayer(id) {
  if (!id) return;
  state.loading = true; render(); message('');
  try {
    state.player = await request(`/players/${encodeURIComponent(id)}/?t=${Date.now()}`);
    $('team-select').value = state.player.team?.abbrName ?? '';
    if ($('team-select').value) await loadRoster($('team-select').value);
    $('roster-select').value = String(state.player.rosterId);
  } catch { message('That player could not be loaded. Please try again.'); }
  finally { state.loading = false; render(); }
}
async function loadTeams() {
  try {
    const data = await request('/teams/?size=100&ordering=cityName,displayName');
    const teams = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
    teams.sort((a,b) => `${a.cityName} ${a.displayName}`.localeCompare(`${b.cityName} ${b.displayName}`));
    $('team-select').innerHTML = '<option value="">Team</option>' + teams.map(t => `<option value="${escapeHtml(t.abbrName)}">${escapeHtml(`${t.cityName} ${t.displayName}`)}</option>`).join('');
    $('team-select').value = state.player.team?.abbrName ?? '';
  } catch { message('The FM2 team list is unavailable right now. Search still works.'); }
}
async function loadRoster(abbr) {
  if (state.rosterController) state.rosterController.abort();
  $('roster-select').innerHTML = '<option value="">Loading roster…</option>';
  if (!abbr) { $('roster-select').innerHTML = '<option value="">Select player</option>'; return; }
  const controller = new AbortController(); state.rosterController = controller;
  try {
    const data = await request(`/players/?${new URLSearchParams({team__abbrName:abbr,size:'100',ordering:'-playerBestOvr,fullName'})}`,controller.signal);
    if (controller.signal.aborted) return;
    state.players = (data.results ?? []).sort((a,b) => b.playerBestOvr - a.playerBestOvr || a.fullName.localeCompare(b.fullName));
    $('roster-select').innerHTML = '<option value="">Select player</option>' + state.players.map(p => `<option value="${p.rosterId}">${p.playerBestOvr} OVR · ${escapeHtml(p.fullName)} · ${escapeHtml(p.position)}</option>`).join('');
    $('roster-select').value = state.players.some(p => p.rosterId === state.player.rosterId) ? String(state.player.rosterId) : '';
  } catch (e) { if (e.name !== 'AbortError') message('That team roster could not be loaded right now.'); }
}
async function search(term) {
  if (state.searchController) state.searchController.abort();
  if (!term.trim()) { $('search-results').hidden = true; return; }
  const controller = new AbortController(); state.searchController = controller;
  const panel = $('search-results'); panel.hidden = false; panel.innerHTML = '<p>Searching FM2…</p>';
  try {
    const data = await request(`/players/?${new URLSearchParams({search:term.trim(),size:'24',ordering:'-playerBestOvr,fullName'})}`,controller.signal);
    if (controller.signal.aborted) return;
    const options = data.results ?? []; panel.innerHTML = options.length ? options.map(p => `<button type="button" data-id="${p.rosterId}"><span>${escapeHtml(p.fullName)}</span><small>${escapeHtml(p.team?.abbrName ?? 'FA')} · ${escapeHtml(p.position)} · ${p.playerBestOvr} OVR</small></button>`).join('') : '<p>No player found.</p>';
  } catch (e) { if (e.name !== 'AbortError') panel.innerHTML = '<p>Search unavailable right now.</p>'; }
}
function clearPrepared() { if (state.prepared) URL.revokeObjectURL(state.prepared.url); state.prepared = null; $('export-result').hidden = true; $('export-result').replaceChildren(); }
async function save() {
  if (state.loading) return;
  $('save').disabled = true; $('save').textContent = 'Creating…'; clearPrepared();
  try {
    await document.fonts.ready;
    const blob = await exportPlayerCard($('card'));
    const name = state.player.fullName.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-fm2-card.png';
    const file = new File([blob],name,{type:'image/png'}), url = URL.createObjectURL(blob);
    state.prepared = {file,url};
    const section = $('export-result'); section.hidden = false;
    section.innerHTML = `<div class="export-controls"><strong>Your PNG is ready</strong><button id="share-image" type="button">Save / Share image</button><a id="download-file" download="${name}">Download file</a><button id="close-image" type="button">Close</button></div><p>On iPhone, tap Save / Share image, then Save Image. You can also press and hold the image below.</p><img alt="Generated player card PNG">`;
    section.querySelector('img').src = url; $('download-file').href = url;
    $('close-image').onclick = clearPrepared;
    $('share-image').onclick = async () => {
      if (navigator.canShare?.({files:[file]})) try { await navigator.share({files:[file]}); } catch (e) { if (e.name !== 'AbortError') message('Sharing was blocked. Press and hold the image below or use Download file.'); }
      else message('Press and hold the PNG below to save it to Photos, or use Download file.');
    };
  } catch (e) { message(e.message || 'The PNG could not be created. Please refresh and try again.'); }
  finally { $('save').disabled = false; $('save').textContent = 'Save PNG'; }
}
$('player-search').addEventListener('input', e => { clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => search(e.target.value),280); });
$('search-results').addEventListener('click', e => { const button = e.target.closest('button[data-id]'); if (!button) return; $('player-search').value = ''; $('search-results').hidden = true; loadPlayer(button.dataset.id); });
document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) $('search-results').hidden = true; });
$('team-select').addEventListener('change', e => loadRoster(e.target.value));
$('roster-select').addEventListener('change', e => { if (e.target.value) loadPlayer(e.target.value); });
$('refresh').addEventListener('click', () => loadPlayer(state.player.rosterId));
$('save').addEventListener('click', save);
render();
Promise.all([loadTeams(), loadPlayer(DEFAULT_PLAYER.rosterId)]).catch(() => {});
