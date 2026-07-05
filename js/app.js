// ============================================================
// Cromos Copa 2026 — lógica do app
// ============================================================

const STORE_KEY = 'copa2026_album_v1';

const state = loadState();

function loadState() {
  const base = {
    owned: {},        // 'BRA-5': true
    dups: {},         // 'BRA-5': 2  (repetidas além da colada)
    labels: {},       // 'BRA-5': 'Vini Jr.'
    alerts: {},       // eventId: true
    notified: {},     // eventId: true (alerta já disparado)
    matches: [],      // cache da agenda/resultados
    lastSync: null,
    openSections: { FWC: true },
    tab: 'album',
    matchFilter: 'proximos',
  };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(base, JSON.parse(raw));
  } catch (e) { console.warn('Falha ao carregar dados salvos', e); }
  return base;
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn('Falha ao salvar', e); }
  }, 150);
}

// ---------- utilidades ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function stickerId(code, num) { return `${code}-${num}`; }

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer = null;
function toast(msg) {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}

// ---------- estatísticas ----------
function sectionStats(code) {
  const section = SECTIONS.find(s => s.code === code);
  let owned = 0, dups = 0;
  for (let n = 1; n <= section.count; n++) {
    const id = stickerId(code, n);
    if (state.owned[id]) owned++;
    dups += state.dups[id] || 0;
  }
  return { owned, dups, total: section.count };
}

function globalStats() {
  let owned = 0, dups = 0;
  for (const s of SECTIONS) {
    const st = sectionStats(s.code);
    owned += st.owned;
    dups += st.dups;
  }
  return { owned, dups, total: TOTAL_STICKERS, missing: TOTAL_STICKERS - owned };
}

function renderHeader() {
  const g = globalStats();
  const pct = ((g.owned / g.total) * 100);
  $('#statStrip').innerHTML = `
    <div class="stat"><b>${g.total}</b><span>Total</span></div>
    <div class="stat"><b style="color:var(--green)">${g.owned}</b><span>Tenho</span></div>
    <div class="stat"><b style="color:var(--red)">${g.missing}</b><span>Faltam</span></div>
    <div class="stat"><b style="color:var(--amber)">${g.dups}</b><span>Repetidas</span></div>
    <div class="stat"><b>${pct.toFixed(1)}%</b><span>Álbum</span></div>`;
  $('#mainBar').style.width = pct + '%';
}

// ---------- navegação ----------
function setTab(tab) {
  state.tab = tab;
  save();
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  render();
}

$('#tabs').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (btn) setTab(btn.dataset.tab);
});

function render() {
  renderHeader();
  const main = $('#main');
  switch (state.tab) {
    case 'album': renderAlbum(main); break;
    case 'resumo': renderResumo(main); break;
    case 'faltam': renderFaltam(main); break;
    case 'trocas': renderTrocas(main); break;
    case 'jogos': renderJogos(main); break;
    case 'dados': renderDados(main); break;
  }
}

// ============================================================
// ABA ÁLBUM
// ============================================================
let albumQuery = '';
let markMode = 'own'; // own | dup | dupminus | rename

function renderAlbum(main) {
  main.innerHTML = `
    <div class="searchbar">
      <input id="searchInput" type="search" placeholder="Buscar: país, número (ex: BRA 7), jogador..." value="${esc(albumQuery)}">
    </div>
    <div class="mode-row">
      <span class="hint">Ao tocar:</span>
      <button class="chip-btn mode-own ${markMode === 'own' ? 'active' : ''}" data-mode="own">✓ Tenho</button>
      <button class="chip-btn mode-dup ${markMode === 'dup' ? 'active' : ''}" data-mode="dup">+1 Repetida</button>
      <button class="chip-btn mode-dupminus ${markMode === 'dupminus' ? 'active' : ''}" data-mode="dupminus">−1 Repetida</button>
      <button class="chip-btn mode-rename ${markMode === 'rename' ? 'active' : ''}" data-mode="rename">✏️ Nomear</button>
    </div>
    <div id="albumSections"></div>`;

  $('#searchInput', main).addEventListener('input', e => {
    albumQuery = e.target.value;
    renderAlbumSections();
  });
  $('.mode-row', main).addEventListener('click', e => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    markMode = btn.dataset.mode;
    renderAlbum(main);
  });
  renderAlbumSections();
}

function matchesQuery(section, num) {
  if (!albumQuery.trim()) return true;
  const q = albumQuery.trim().toLowerCase();
  const id = stickerId(section.code, num);
  const label = (state.labels[id] || defaultLabel(section.code, num)).toLowerCase();
  const hay = `${section.code.toLowerCase()} ${section.name.toLowerCase()} ${section.code.toLowerCase()} ${num} ${label} grupo ${section.group || ''}`.toLowerCase();
  // permite "bra 7" / "bra7" / "7" / "vini"
  const qNorm = q.replace(/(\D)(\d)/, '$1 $2');
  return qNorm.split(/\s+/).every(part => {
    if (/^\d+$/.test(part)) return String(num) === part;
    return hay.includes(part);
  });
}

function renderAlbumSections() {
  const container = $('#albumSections');
  const searching = !!albumQuery.trim();
  let html = '';
  for (const section of SECTIONS) {
    const nums = [];
    for (let n = 1; n <= section.count; n++) if (matchesQuery(section, n)) nums.push(n);
    if (searching && nums.length === 0) continue;

    const st = sectionStats(section.code);
    const open = searching || state.openSections[section.code];
    const pct = (st.owned / st.total) * 100;
    html += `
      <div class="team-section" data-code="${section.code}">
        <div class="team-head" data-toggle="${section.code}">
          <span class="flag">${section.flag}</span>
          <span class="tname">${esc(section.name)}${section.group ? ` <small>Grupo ${section.group}</small>` : ''}</span>
          <span class="tprog"><b class="${st.owned === st.total ? 'done' : ''}">${st.owned}/${st.total}</b>${st.dups ? ` · <span style="color:var(--amber)">${st.dups} rep.</span>` : ''}</span>
          <span>${open ? '▾' : '▸'}</span>
        </div>
        <div class="team-mini-bar"><i style="width:${pct}%"></i></div>
        ${open ? renderStickerGrid(section, nums) : ''}
      </div>`;
  }
  container.innerHTML = html || '<div class="empty">Nada encontrado para essa busca.</div>';

  container.onclick = e => {
    const head = e.target.closest('[data-toggle]');
    if (head) {
      const code = head.dataset.toggle;
      state.openSections[code] = !state.openSections[code];
      save();
      renderAlbumSections();
      return;
    }
    const stick = e.target.closest('.sticker');
    if (stick) {
      handleStickerTap(stick.dataset.id);
      return;
    }
    const bulk = e.target.closest('[data-bulk]');
    if (bulk) {
      const [action, code] = bulk.dataset.bulk.split(':');
      bulkMark(code, action === 'all');
    }
  };
}

function renderStickerGrid(section, nums) {
  let cells = '';
  for (const n of nums) {
    const id = stickerId(section.code, n);
    const owned = !!state.owned[id];
    const dups = state.dups[id] || 0;
    const label = state.labels[id] || defaultLabel(section.code, n);
    cells += `
      <div class="sticker ${owned ? 'owned' : ''}" data-id="${id}" title="${esc(label)}">
        ${dups ? `<span class="dupbadge">×${dups}</span>` : ''}
        <div class="num">${section.code} ${n}</div>
        <div class="lbl">${esc(label)}</div>
      </div>`;
  }
  return `
    <div class="sticker-grid">${cells}</div>
    <div class="btn-row" style="padding:0 11px 11px">
      <button class="btn small secondary" data-bulk="all:${section.code}">✓ Tenho todas</button>
      <button class="btn small danger" data-bulk="none:${section.code}">Limpar seleção</button>
    </div>`;
}

function handleStickerTap(id) {
  const [code, numStr] = id.split('-');
  const num = parseInt(numStr, 10);
  if (markMode === 'own') {
    if (state.owned[id]) {
      delete state.owned[id];
      delete state.dups[id];
    } else {
      state.owned[id] = true;
    }
  } else if (markMode === 'dup') {
    state.owned[id] = true; // se tem repetida, tem a colada
    state.dups[id] = (state.dups[id] || 0) + 1;
  } else if (markMode === 'dupminus') {
    if (state.dups[id]) {
      state.dups[id]--;
      if (!state.dups[id]) delete state.dups[id];
    }
  } else if (markMode === 'rename') {
    const current = state.labels[id] || defaultLabel(code, num);
    const name = prompt(`Nome da figurinha ${code} ${num}:`, current);
    if (name !== null) {
      const trimmed = name.trim();
      if (trimmed && trimmed !== defaultLabel(code, num)) state.labels[id] = trimmed;
      else delete state.labels[id];
    }
  }
  save();
  renderHeader();
  renderAlbumSections();
}

function bulkMark(code, on) {
  const section = SECTIONS.find(s => s.code === code);
  for (let n = 1; n <= section.count; n++) {
    const id = stickerId(code, n);
    if (on) state.owned[id] = true;
    else { delete state.owned[id]; delete state.dups[id]; }
  }
  save();
  renderHeader();
  renderAlbumSections();
}

// ============================================================
// ABA PAÍSES (resumo)
// ============================================================
function renderResumo(main) {
  const rows = SECTIONS.map(s => ({ s, st: sectionStats(s.code) }));
  const complete = rows.filter(r => r.st.owned === r.st.total).length;
  let html = `
    <div class="card">
      <h2>🌎 Resumo por seleção <small style="color:var(--text-dim);font-weight:400">· ${complete}/${rows.length} completas</small></h2>`;
  for (const { s, st } of rows) {
    const pct = (st.owned / st.total) * 100;
    html += `
      <div class="country-row" data-goto="${s.code}">
        <span class="flag">${s.flag}</span>
        <div class="info">
          <div class="nm">${esc(s.name)} ${s.group ? `<small>· Grupo ${s.group}</small>` : ''}</div>
          <div class="bar"><i class="${pct === 100 ? 'full' : ''}" style="width:${pct}%"></i></div>
        </div>
        <div class="nums">
          <b class="${pct === 100 ? 'done' : ''}">${st.owned}/${st.total}</b>
          faltam ${st.total - st.owned}
          ${st.dups ? `<span class="dupcount"> · ${st.dups} rep.</span>` : ''}
        </div>
      </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
  main.onclick = e => {
    const row = e.target.closest('[data-goto]');
    if (!row) return;
    state.openSections = { [row.dataset.goto]: true };
    albumQuery = '';
    setTab('album');
    setTimeout(() => {
      const el = $(`.team-section[data-code="${row.dataset.goto}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };
}

// ============================================================
// ABA FALTAM
// ============================================================
function missingByCountry() {
  const out = [];
  for (const s of SECTIONS) {
    const nums = [];
    for (let n = 1; n <= s.count; n++) {
      if (!state.owned[stickerId(s.code, n)]) nums.push(n);
    }
    if (nums.length) out.push({ section: s, nums });
  }
  return out;
}

function compressNums(nums) {
  // [1,2,3,7,9,10] -> "1-3, 7, 9-10"
  const parts = [];
  let start = null, prev = null;
  for (const n of nums) {
    if (start === null) { start = prev = n; continue; }
    if (n === prev + 1) { prev = n; continue; }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = n;
  }
  if (start !== null) parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(', ');
}

function renderFaltam(main) {
  const missing = missingByCountry();
  const total = missing.reduce((s, m) => s + m.nums.length, 0);
  let html = `
    <div class="card">
      <h2>🔍 Figurinhas que faltam <small style="color:var(--text-dim);font-weight:400">· ${total}</small></h2>
      <p class="help">Toque em "Copiar lista" para mandar no grupo de trocas do WhatsApp.</p>
      <div class="btn-row"><button class="btn small" id="copyMissing">📋 Copiar lista</button></div>`;
  if (!missing.length) {
    html += '<div class="empty">🎉 Parabéns! Álbum completo, não falta nenhuma!</div>';
  } else {
    for (const m of missing) {
      html += `
        <div class="missing-line">
          <span class="flag">${m.section.flag}</span><b>${esc(m.section.name)}</b>
          <small>(${m.nums.length} de ${m.section.count})</small><br>
          <span class="nums">${m.section.code} ${compressNums(m.nums)}</span>
        </div>`;
    }
  }
  html += '</div>';
  main.innerHTML = html;
  const btn = $('#copyMissing');
  if (btn) btn.onclick = () => {
    const text = 'FALTAM — Álbum Copa 2026:\n' + missing.map(m =>
      `${m.section.flag} ${m.section.code}: ${compressNums(m.nums)}`).join('\n') +
      `\nTotal: ${total} figurinhas`;
    copyText(text);
  };
}

// ============================================================
// ABA TROCAS (repetidas)
// ============================================================
function dupsByCountry() {
  const out = [];
  for (const s of SECTIONS) {
    const items = [];
    for (let n = 1; n <= s.count; n++) {
      const d = state.dups[stickerId(s.code, n)] || 0;
      if (d > 0) items.push({ n, d });
    }
    if (items.length) out.push({ section: s, items });
  }
  return out;
}

function renderTrocas(main) {
  const dups = dupsByCountry();
  const total = dups.reduce((s, m) => s + m.items.reduce((a, i) => a + i.d, 0), 0);
  let html = `
    <div class="card">
      <h2>🔁 Repetidas para troca <small style="color:var(--text-dim);font-weight:400">· ${total}</small></h2>
      <p class="help">Estas são as figurinhas que você tem além da colada — disponíveis para trocar.</p>
      <div class="btn-row"><button class="btn small" id="copyDups">📋 Copiar lista</button></div>`;
  if (!dups.length) {
    html += '<div class="empty">Nenhuma repetida registrada ainda. Use o modo "+1 Repetida" na aba Álbum.</div>';
  } else {
    for (const m of dups) {
      const txt = m.items.map(i => i.d > 1 ? `${i.n}(×${i.d})` : `${i.n}`).join(', ');
      html += `
        <div class="missing-line">
          <span class="flag">${m.section.flag}</span><b>${esc(m.section.name)}</b>
          <small>(${m.items.reduce((a, i) => a + i.d, 0)} repetidas)</small><br>
          <span class="nums trade">${m.section.code} ${txt}</span>
        </div>`;
    }
  }
  html += '</div>';
  main.innerHTML = html;
  const btn = $('#copyDups');
  if (btn) btn.onclick = () => {
    const text = 'TENHO PARA TROCA — Álbum Copa 2026:\n' + dups.map(m =>
      `${m.section.flag} ${m.section.code}: ${m.items.map(i => i.d > 1 ? `${i.n} (x${i.d})` : i.n).join(', ')}`).join('\n') +
      `\nTotal: ${total} figurinhas`;
    copyText(text);
  };
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('Lista copiada! Cole no WhatsApp 📲'), () => fallbackCopy(text));
  } else fallbackCopy(text);
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toast('Lista copiada!'); }
  catch (e) { prompt('Copie manualmente:', text); }
  ta.remove();
}

// ============================================================
// ABA JOGOS — agenda, resultados automáticos e alertas
// ============================================================
const API_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=250';
let syncing = false;
let syncFailed = false;

async function syncMatches(silent = false) {
  if (syncing) return;
  syncing = true;
  if (!silent) toast('Buscando jogos e resultados...');
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const events = (data.events || []).map(ev => {
      const comp = (ev.competitions || [])[0] || {};
      const competitors = comp.competitors || [];
      const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
      const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
      const note = ((comp.notes || [])[0] || {}).headline || '';
      const status = (ev.status || {}).type || {};
      return {
        id: String(ev.id),
        date: ev.date,
        note,
        venue: (comp.venue || {}).fullName || '',
        state: status.state || 'pre',            // pre | in | post
        detail: status.shortDetail || status.detail || '',
        home: parseCompetitor(home),
        away: parseCompetitor(away),
      };
    });
    if (events.length) {
      syncFailed = false;
      state.matches = events.sort((a, b) => new Date(a.date) - new Date(b.date));
      state.lastSync = Date.now();
      save();
      if (!silent) toast(`Agenda atualizada: ${events.length} jogos ✓`);
    } else if (!silent) {
      toast('A API não retornou jogos. Tente novamente mais tarde.');
    }
  } catch (e) {
    console.warn('Erro ao sincronizar jogos', e);
    syncFailed = true;
    if (!silent) toast('Sem conexão com a fonte de resultados. Mostrando dados salvos.');
  } finally {
    syncing = false;
    if (state.tab === 'jogos') render();
    else renderHeader();
  }
}

function parseCompetitor(c) {
  const team = c.team || {};
  const name = team.displayName || team.name || '?';
  const code = apiTeamToCode(name) || apiTeamToCode(team.shortDisplayName);
  return {
    name,
    code,
    flag: code && TEAMS[code] ? TEAMS[code].flag : '⚽',
    ptName: code && TEAMS[code] ? TEAMS[code].name : name,
    score: c.score != null ? String(c.score) : '',
    winner: !!c.winner,
  };
}

function matchPassesFilter(m, filter) {
  const now = new Date();
  const d = new Date(m.date);
  switch (filter) {
    case 'hoje': return d.toDateString() === now.toDateString();
    case 'proximos': return m.state !== 'post' && d >= new Date(now.getTime() - 3 * 3600e3);
    case 'resultados': return m.state === 'post';
    case 'aovivo': return m.state === 'in';
    case 'alertas': return !!state.alerts[m.id];
    default: return true;
  }
}

function renderJogos(main) {
  const filter = state.matchFilter || 'proximos';
  const filters = [
    ['proximos', 'Próximos'], ['hoje', 'Hoje'], ['aovivo', 'Ao vivo 🔴'],
    ['resultados', 'Resultados'], ['alertas', 'Meus alertas 🔔'], ['todos', 'Todos'],
  ];
  const matches = (state.matches || []).filter(m => matchPassesFilter(m, filter));

  let html = `
    <div class="card" style="padding:10px 12px">
      <div class="btn-row" style="margin:0">
        <button class="btn small" id="syncBtn" ${syncing ? 'disabled' : ''}>🔄 Atualizar resultados</button>
        <button class="btn small secondary" id="notifBtn">🔔 Ativar notificações</button>
      </div>
      <div class="sync-info">${state.lastSync ? 'Última atualização: ' + new Date(state.lastSync).toLocaleString('pt-BR') : 'Toque em "Atualizar resultados" para baixar a agenda completa da Copa.'}</div>
    </div>
    ${syncFailed ? `<div class="banner warn">⚠️ Não consegui buscar os resultados agora${state.matches.length ? ' — mostrando os últimos dados salvos' : ''}. Se você está usando a versão hospedada no claude.ai, a busca automática é bloqueada por segurança: use a versão do GitHub Pages para resultados ao vivo.</div>` : ''}
    <div class="filter-row">
      ${filters.map(([k, lbl]) => `<button class="chip-btn ${filter === k ? 'active' : ''}" data-filter="${k}">${lbl}</button>`).join('')}
    </div>`;

  if (!state.matches.length) {
    html += `<div class="empty">Nenhum jogo carregado ainda.<br><br>O app busca automaticamente a agenda e os resultados oficiais da Copa 2026 (11/jun a 19/jul).<br>Toque em <b>Atualizar resultados</b>.</div>`;
  } else if (!matches.length) {
    html += '<div class="empty">Nenhum jogo neste filtro.</div>';
  } else {
    let lastDay = '';
    for (const m of matches) {
      const d = new Date(m.date);
      const dayKey = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      if (dayKey !== lastDay) {
        html += `<div class="match-day-head">${dayKey}</div>`;
        lastDay = dayKey;
      }
      html += renderMatch(m, d);
    }
  }
  main.innerHTML = html;

  main.onclick = e => {
    const f = e.target.closest('[data-filter]');
    if (f) { state.matchFilter = f.dataset.filter; save(); render(); return; }
    const bell = e.target.closest('[data-bell]');
    if (bell) { toggleAlert(bell.dataset.bell); return; }
    if (e.target.closest('#syncBtn')) { syncMatches(); return; }
    if (e.target.closest('#notifBtn')) { requestNotifPermission(); return; }
  };
}

function renderMatch(m, d) {
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const live = m.state === 'in';
  const done = m.state === 'post';
  const statusHtml = done
    ? `<div class="st-time">Fim</div><div class="st-detail">${esc(m.detail)}</div>`
    : live
      ? `<div class="st-time">AO VIVO</div><div class="st-detail">${esc(m.detail)}</div>`
      : `<div class="st-time">${time}</div><div class="st-detail">horário local</div>`;
  const alertOn = !!state.alerts[m.id];
  return `
    <div class="match">
      <div class="teams">
        <div class="line ${done && m.home.winner ? 'winner' : ''}">
          <span>${m.home.flag}</span><span class="nm">${esc(m.home.ptName)}</span>
          <span class="score">${done || live ? esc(m.home.score) : ''}</span>
        </div>
        <div class="line ${done && m.away.winner ? 'winner' : ''}">
          <span>${m.away.flag}</span><span class="nm">${esc(m.away.ptName)}</span>
          <span class="score">${done || live ? esc(m.away.score) : ''}</span>
        </div>
        <div class="meta">${esc([m.note, m.venue].filter(Boolean).join(' · '))}</div>
      </div>
      <div class="status ${live ? 'live' : ''}">${statusHtml}</div>
      ${!done ? `<button class="bell ${alertOn ? 'on' : ''}" data-bell="${m.id}" title="Alerta de jogo">${alertOn ? '🔔' : '🔕'}</button>` : ''}
    </div>`;
}

function toggleAlert(eventId) {
  if (state.alerts[eventId]) {
    delete state.alerts[eventId];
    toast('Alerta removido');
  } else {
    state.alerts[eventId] = true;
    requestNotifPermission(true);
    toast('Alerta ativado — você será avisado ~30 min antes do jogo (com o app aberto)');
  }
  save();
  render();
}

function requestNotifPermission(silent = false) {
  if (!('Notification' in window)) {
    if (!silent) toast('Este navegador não suporta notificações.');
    return;
  }
  if (Notification.permission === 'granted') {
    if (!silent) toast('Notificações já estão ativas ✓');
    return;
  }
  Notification.requestPermission().then(p => {
    if (p === 'granted' && !silent) toast('Notificações ativadas ✓');
  });
}

// verificação periódica de alertas (~30 min antes do jogo)
function checkAlerts() {
  const now = Date.now();
  for (const m of state.matches || []) {
    if (!state.alerts[m.id] || state.notified[m.id] || m.state === 'post') continue;
    const start = new Date(m.date).getTime();
    const diffMin = (start - now) / 60000;
    if (diffMin <= 30 && diffMin > -5) {
      state.notified[m.id] = true;
      save();
      const title = `⚽ ${m.home.ptName} x ${m.away.ptName}`;
      const body = diffMin > 0
        ? `Começa em ${Math.max(1, Math.round(diffMin))} min! ${m.venue || ''}`
        : 'O jogo está começando!';
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body, icon: undefined }); } catch (e) { /* mobile precisa de SW */ }
      }
      toast(`🔔 ${title} — ${body}`);
    }
  }
}
setInterval(checkAlerts, 30000);

// atualização automática de resultados a cada 5 min quando visível
setInterval(() => {
  if (document.visibilityState === 'visible' && state.matches.length) syncMatches(true);
}, 5 * 60 * 1000);

// ============================================================
// ABA DADOS — importar, exportar, zerar
// ============================================================
function renderDados(main) {
  const g = globalStats();
  main.innerHTML = `
    <div class="card">
      <h2>📥 Importar minhas figurinhas</h2>
      <p class="help">
        Cole a sua lista e o app marca tudo de uma vez. Formato: uma seleção por linha —
        código ou nome do país, depois os números (aceita intervalos e repetidas com "x"):<br><br>
        <b>BRA: 1, 2, 5-9, 12x3</b> &nbsp;(12x3 = tenho 1 colada + 2 repetidas)<br>
        <b>FWC: 1-20</b> &nbsp;·&nbsp; <b>Argentina: 4 7 10</b>
      </p>
      <h3>Figurinhas que TENHO</h3>
      <textarea class="paste" id="pasteOwned" placeholder="BRA: 1-11, 14, 17x2&#10;ARG: 3, 5, 9&#10;FWC: 1-20"></textarea>
      <h3>Repetidas (opcional, se não usou "x" acima)</h3>
      <textarea class="paste" id="pasteDups" placeholder="BRA: 5, 5, 9x4"></textarea>
      <div class="btn-row">
        <button class="btn" id="importBtn">Importar e marcar</button>
      </div>
    </div>

    <div class="card">
      <h2>💾 Backup</h2>
      <p class="help">Você tem <b>${g.owned}</b> figurinhas marcadas e <b>${g.dups}</b> repetidas. Os dados ficam salvos neste aparelho — exporte um backup para não perder nada.</p>
      <div class="btn-row">
        <button class="btn" id="exportBtn">⬇️ Exportar backup (.json)</button>
        <button class="btn secondary" id="importFileBtn">⬆️ Restaurar backup</button>
        <input type="file" id="importFile" accept=".json,application/json" style="display:none">
      </div>
    </div>

    <div class="card">
      <h2>⚠️ Zerar álbum</h2>
      <p class="help">Apaga todas as marcações (tenho, repetidas e nomes). Não afeta a agenda de jogos.</p>
      <div class="btn-row"><button class="btn danger" id="resetBtn">Zerar tudo</button></div>
    </div>`;

  $('#importBtn').onclick = () => {
    const ownedText = $('#pasteOwned').value;
    const dupsText = $('#pasteDups').value;
    const r1 = importList(ownedText, 'owned');
    const r2 = importList(dupsText, 'dups');
    save();
    renderHeader();
    const errs = [...r1.errors, ...r2.errors];
    let msg = `Importado: ${r1.count} figurinhas` + (r2.count ? ` + ${r2.count} repetidas` : '');
    if (errs.length) msg += ` · ${errs.length} linha(s) não reconhecida(s): ${errs.slice(0, 3).join('; ')}`;
    toast(msg);
    if (r1.count || r2.count) { $('#pasteOwned').value = ''; $('#pasteDups').value = ''; }
  };

  $('#exportBtn').onclick = exportBackup;
  $('#importFileBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.owned && !data.dups) throw new Error('formato inválido');
        Object.assign(state, {
          owned: data.owned || {},
          dups: data.dups || {},
          labels: data.labels || {},
          alerts: data.alerts || state.alerts,
        });
        save();
        render();
        toast('Backup restaurado ✓');
      } catch (err) {
        toast('Arquivo inválido — use um backup exportado por este app.');
      }
    };
    reader.readAsText(file);
  };

  $('#resetBtn').onclick = () => {
    if (confirm('Tem certeza? Isso apaga TODAS as marcações do álbum.')) {
      state.owned = {}; state.dups = {}; state.labels = {};
      save();
      render();
      toast('Álbum zerado.');
    }
  };
}

// aceita: "BRA: 1, 2, 5-9, 12x3" | "Brasil 1 2 5-9" | "FWC 1-20"
function resolveSectionCode(token) {
  const t = token.trim().toLowerCase().replace(/[:\-–]$/, '').trim();
  if (!t) return null;
  const byCode = SECTIONS.find(s => s.code.toLowerCase() === t);
  if (byCode) return byCode.code;
  const byName = SECTIONS.find(s => s.name.toLowerCase() === t);
  if (byName) return byName.code;
  const partial = SECTIONS.filter(s => s.name.toLowerCase().startsWith(t));
  if (partial.length === 1) return partial[0].code;
  return null;
}

function importList(text, target) {
  let count = 0;
  const errors = [];
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // separa o identificador da seleção dos números
    const m = line.match(/^([A-Za-zÀ-ÿ .'’-]+?)[\s:]+([\dxX,\s\-–;]+)$/);
    if (!m) { errors.push(line.slice(0, 25)); continue; }
    const code = resolveSectionCode(m[1]);
    if (!code) { errors.push(m[1].slice(0, 25) + '?'); continue; }
    const section = SECTIONS.find(s => s.code === code);
    const tokens = m[2].split(/[,;\s]+/).filter(Boolean);
    for (const tok of tokens) {
      const range = tok.match(/^(\d+)[\-–](\d+)$/);
      const mult = tok.match(/^(\d+)[xX](\d+)$/);
      const single = tok.match(/^(\d+)$/);
      const apply = (n, times) => {
        if (n < 1 || n > section.count) return;
        const id = stickerId(code, n);
        if (target === 'owned') {
          state.owned[id] = true;
          if (times > 1) state.dups[id] = (state.dups[id] || 0) + (times - 1);
        } else {
          state.owned[id] = true;
          state.dups[id] = (state.dups[id] || 0) + times;
        }
        count++;
      };
      if (range) {
        const a = parseInt(range[1], 10), b = parseInt(range[2], 10);
        for (let n = Math.min(a, b); n <= Math.max(a, b); n++) apply(n, 1);
      } else if (mult) {
        apply(parseInt(mult[1], 10), parseInt(mult[2], 10));
      } else if (single) {
        apply(parseInt(single[1], 10), 1);
      }
    }
  }
  return { count, errors };
}

function exportBackup() {
  const data = {
    app: 'cromos-copa-2026',
    exportedAt: new Date().toISOString(),
    owned: state.owned,
    dups: state.dups,
    labels: state.labels,
    alerts: state.alerts,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `album-copa2026-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup exportado ✓');
}

// ============================================================
// Inicialização
// ============================================================
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

setTab(state.tab || 'album');

// primeira carga da agenda em segundo plano (se nunca sincronizou ou faz +1h)
if (!state.lastSync || Date.now() - state.lastSync > 3600e3) {
  syncMatches(true);
}
checkAlerts();
