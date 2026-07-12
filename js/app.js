// ============================================================
// Cromos Copa 2026 — lógica do app (multi-álbum)
// ============================================================

const STORE_KEY = 'copa2026_album_v2';

const state = loadState();

function emptyAlbumState() {
  return { owned: {}, dups: {}, labels: {} };
}

// Marca como coladas as figurinhas com o:1 na base (lista real do usuário)
function seededAlbumState(albumId) {
  const a = emptyAlbumState();
  for (const sec of ALBUMS[albumId].sections) {
    sec.stickers.forEach((s, i) => {
      if (s.o) a.owned[`${sec.code}-${i + 1}`] = true;
    });
  }
  return a;
}

function loadState() {
  const base = {
    currentAlbum: 'copa',
    albums: {},
    alerts: {},        // eventId: true
    notified: {},      // eventId: true (alerta já disparado)
    matches: [],       // cache da agenda/resultados
    lastSync: null,
    openSections: {},
    tab: 'album',
    matchFilter: 'proximos',
    syncId: null,      // código do álbum compartilhado (sincronização entre celulares)
    syncRev: 0,        // carimbo de tempo da última versão conhecida no servidor
  };
  let st = base;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) st = Object.assign(base, JSON.parse(raw));
  } catch (e) { console.warn('Falha ao carregar dados salvos', e); }
  // Primeira carga de cada álbum: coladas transcritas (o:1); Legends começa vazio
  for (const id in ALBUMS) { if (!st.albums[id]) st.albums[id] = seededAlbumState(id); }
  if (!ALBUMS[st.currentAlbum]) st.currentAlbum = 'copa';
  return st;
}

function persistLocal() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Falha ao salvar', e); }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistLocal, 150);
}

// ============================================================
// Compartilhar o álbum com outro celular POR CÓDIGO (sem servidor)
// Gera um código compacto de todo o álbum; o outro cola e as marcações se somam.
// ============================================================
// ordem estável de TODAS as figurinhas de TODOS os álbuns (para o código)
function allOrderedEntries() {
  const out = [];
  for (const id of Object.keys(ALBUMS))
    for (const sec of ALBUMS[id].sections)
      for (let i = 1; i <= sec.stickers.length; i++) out.push({ a: id, id: sec.code + '-' + i });
  return out;
}
function b64urlFromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function bytesFromB64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function b64urlFromStr(s) { return b64urlFromBytes(new TextEncoder().encode(s)); }
function strFromB64url(s) { return new TextDecoder().decode(bytesFromB64url(s)); }

function generateShareCode() {
  const entries = allOrderedEntries();
  const bytes = new Uint8Array(Math.ceil(entries.length / 8));
  const dups = {}, labels = {};
  entries.forEach((e, i) => {
    const data = state.albums[e.a];
    if (data.owned[e.id]) bytes[i >> 3] |= (1 << (i & 7));
    if (data.dups[e.id]) dups[i] = data.dups[e.id];
    if (data.labels[e.id]) labels[i] = data.labels[e.id];
  });
  const b = b64urlFromBytes(bytes);
  const extras = {};
  if (Object.keys(dups).length) extras.d = dups;
  if (Object.keys(labels).length) extras.l = labels;
  return Object.keys(extras).length
    ? ('2' + b + '.' + b64urlFromStr(JSON.stringify(extras)))
    : ('1' + b);
}

// Aplica um código recebido: UNIÃO (nunca remove o que este celular já tem)
function applyShareCode(raw) {
  let code = String(raw || '').trim();
  const m = code.match(/code=([^\s&#]+)/);
  if (m) code = m[1];
  if (!/^[12]/.test(code)) { toast('Código inválido. Copie o código inteiro.'); return false; }
  try {
    const ver = code[0];
    let bpart = code.slice(1), extras = {};
    if (ver === '2') {
      const dot = bpart.indexOf('.');
      extras = JSON.parse(strFromB64url(bpart.slice(dot + 1)));
      bpart = bpart.slice(0, dot);
    }
    const bytes = bytesFromB64url(bpart);
    const entries = allOrderedEntries();
    let added = 0;
    entries.forEach((e, i) => {
      if (bytes[i >> 3] & (1 << (i & 7))) {
        const data = state.albums[e.a];
        if (!data.owned[e.id]) added++;
        data.owned[e.id] = true;
      }
    });
    if (extras.d) for (const k in extras.d) { const e = entries[+k]; if (e) { const d = state.albums[e.a]; d.dups[e.id] = Math.max(d.dups[e.id] || 0, extras.d[k]); d.owned[e.id] = true; } }
    if (extras.l) for (const k in extras.l) { const e = entries[+k]; if (e) state.albums[e.a].labels[e.id] = extras.l[k]; }
    save(); render();
    toast(added ? ('Combinado! ' + added + ' figurinha(s) nova(s) do outro celular. \u2713') : 'Já estava tudo igual — nada novo para somar. \u2713');
    return true;
  } catch (e) {
    console.warn('applyShareCode', e);
    toast('Não consegui ler esse código. Confira se copiou inteiro.');
    return false;
  }
}

function shareCodeLink() {
  return location.origin + location.pathname + '#code=' + generateShareCode();
}

// ---------- acesso ao álbum atual ----------
function curAlbum() { return ALBUMS[state.currentAlbum]; }
function curData() { return state.albums[state.currentAlbum]; }
function curSections() { return curAlbum().sections; }

// ---------- utilidades ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function stickerId(code, idx) { return `${code}-${idx}`; }

function stickerLabel(section, idx) {
  const id = stickerId(section.code, idx);
  return curData().labels[id] || section.stickers[idx - 1].label;
}

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
  toastTimer = setTimeout(() => t.remove(), 3000);
}

// ---------- estatísticas ----------
function sectionStats(section) {
  const data = curData();
  let owned = 0, dups = 0;
  for (let i = 1; i <= section.stickers.length; i++) {
    const id = stickerId(section.code, i);
    if (data.owned[id]) owned++;
    dups += data.dups[id] || 0;
  }
  return { owned, dups, total: section.stickers.length };
}

function globalStats() {
  let owned = 0, dups = 0, total = 0;
  for (const s of curSections()) {
    const st = sectionStats(s);
    owned += st.owned;
    dups += st.dups;
    total += st.total;
  }
  return { owned, dups, total, missing: total - owned };
}

function renderHeader() {
  const g = globalStats();
  const pct = g.total ? (g.owned / g.total) * 100 : 0;
  const at = $('#albumTitle');
  if (at) at.textContent = curAlbum().title;
  $('#statStrip').innerHTML = `
    <div class="stat"><b>${g.total}</b><span>Total</span></div>
    <div class="stat"><b style="color:var(--green)">${g.owned}</b><span>Tenho</span></div>
    <div class="stat"><b style="color:var(--red)">${g.missing}</b><span>Faltam</span></div>
    <div class="stat"><b style="color:var(--amber)">${g.dups}</b><span>Repetidas</span></div>
    <div class="stat"><b>${pct.toFixed(1)}%</b><span>Álbum</span></div>`;
  $('#mainBar').style.width = pct + '%';
  updateHeaderHeight();
}

// ---------- troca de álbum (só aparece se houver mais de um) ----------
function albumSwitcherHtml() {
  const ids = Object.values(ALBUMS);
  if (ids.length < 2) return '';
  return `<div class="mode-row">
    ${ids.map(a =>
      `<button class="chip-btn ${state.currentAlbum === a.id ? 'active' : ''}" data-album="${a.id}">${a.short}</button>`).join('')}
  </div>`;
}

// mede o cabeçalho para a barra fixa grudar logo abaixo dele
function updateHeaderHeight() {
  const bar = document.querySelector('header.topbar');
  if (bar) document.documentElement.style.setProperty('--header-h', bar.offsetHeight + 'px');
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-album]');
  if (!btn) return;
  if (state.currentAlbum !== btn.dataset.album) {
    state.currentAlbum = btn.dataset.album;
    state.openSections = {};
    save();
    render();
  }
});

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
    case 'dicas': renderDicas(main); break;
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
  const modeRow = curAlbum().isLegends ? '' : `
      <div class="mode-row">
        <span class="hint">Ao tocar:</span>
        <button class="chip-btn mode-own ${markMode === 'own' ? 'active' : ''}" data-mode="own">✓ Tenho</button>
        <button class="chip-btn mode-dup ${markMode === 'dup' ? 'active' : ''}" data-mode="dup">+1 Repetida</button>
        <button class="chip-btn mode-dupminus ${markMode === 'dupminus' ? 'active' : ''}" data-mode="dupminus">−1 Repetida</button>
        <button class="chip-btn mode-rename ${markMode === 'rename' ? 'active' : ''}" data-mode="rename">✏️ Nomear</button>
      </div>`;
  main.innerHTML = `
    <div class="album-sticky">
      ${albumSwitcherHtml()}
      <div class="searchbar">
        <input id="searchInput" type="search" placeholder="${curAlbum().isLegends ? 'Buscar jogador...' : 'Buscar: país, número, jogador...'}" value="${esc(albumQuery)}">
      </div>${modeRow}
    </div>
    <div id="albumSections"></div>`;

  $('#searchInput', main).addEventListener('input', e => {
    albumQuery = e.target.value;
    renderAlbumSections();
  });
  $$('.mode-row [data-mode]', main).forEach(b => b.addEventListener('click', () => {
    markMode = b.dataset.mode;
    renderAlbum(main);
  }));
  renderAlbumSections();
}

// remove acentos para busca (Modrić -> modric)
function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchesQuery(section, idx) {
  if (!albumQuery.trim()) return true;
  const q = norm(albumQuery.trim());
  const s = section.stickers[idx - 1];
  const label = norm(stickerLabel(section, idx));
  const hay = norm(`${section.code} ${section.name} ${label} grupo ${section.group || ''}`);
  const qNorm = q.replace(/(\D)(\d)/, '$1 $2');
  return qNorm.split(/\s+/).every(part => {
    if (/^\d+$/.test(part)) return String(s.n) === part || String(idx) === part;
    return hay.includes(part);
  });
}

function renderAlbumSections() {
  const container = $('#albumSections');
  if (curAlbum().isLegends) { renderLegends(container); return; }
  const searching = !!albumQuery.trim();
  let html = '';
  for (const section of curSections()) {
    const idxs = [];
    for (let i = 1; i <= section.stickers.length; i++) if (matchesQuery(section, i)) idxs.push(i);
    if (searching && idxs.length === 0) continue;

    const st = sectionStats(section);
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
        ${open ? renderStickerGrid(section, idxs) : ''}
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

function renderStickerGrid(section, idxs) {
  const data = curData();
  let cells = '';
  for (const i of idxs) {
    const s = section.stickers[i - 1];
    const id = stickerId(section.code, i);
    const owned = !!data.owned[id];
    const dups = data.dups[id] || 0;
    const label = stickerLabel(section, i);
    cells += `
      <div class="sticker ${owned ? 'owned' : ''}" data-id="${id}" title="${esc(label)}">
        ${dups ? `<span class="dupbadge">×${dups}</span>` : ''}
        <div class="num">${s.n != null ? `${section.code} ${s.n}` : '★'}</div>
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

// Álbum Legends: cada jogador numa linha, com 4 cores selecionáveis
const LEGEND_COLORS = ['ouro', 'prata', 'bronze', 'bordo'];
function renderLegends(container) {
  const data = curData();
  const q = albumQuery.trim();
  let rows = '';
  let shownPlayers = 0;
  for (const sec of curSections()) {
    if (q && !norm(sec.name + ' ' + sec.abbr).includes(norm(q))) continue;
    shownPlayers++;
    const chips = sec.stickers.map((stk, i) => {
      const id = stickerId(sec.code, i + 1);
      const owned = !!data.owned[id];
      return `<button class="lchip ${LEGEND_COLORS[i]} ${owned ? 'owned' : ''}" data-id="${id}">${esc(stk.label)}</button>`;
    }).join('');
    const have = sec.stickers.filter((_, i) => data.owned[stickerId(sec.code, i + 1)]).length;
    rows += `
      <div class="legend-row">
        <span class="flag">${sec.flag}</span>
        <div class="lg-info"><div class="lg-name">${esc(sec.name)} <small>${esc(sec.abbr)}</small></div>
          <div class="legend-chips">${chips}</div></div>
        <span class="lg-count ${have === 4 ? 'done' : ''}">${have}/4</span>
      </div>`;
  }
  container.innerHTML = `
    <div class="card" style="padding:12px 13px">
      <p class="help" style="margin:0">⭐ As <b>Legends</b> são figurinhas extras (não colam no álbum). Cada craque tem 4 cores: <b>Ouro, Prata, Bronze, Bordô</b>. Toque na cor que você já tem.</p>
    </div>
    ${rows || '<div class="empty">Nenhum jogador encontrado.</div>'}`;
  container.onclick = e => {
    const chip = e.target.closest('.lchip');
    if (!chip) return;
    const id = chip.dataset.id;
    if (data.owned[id]) delete data.owned[id]; else data.owned[id] = true;
    save();
    renderHeader();
    renderLegends(container);
  };
}

function handleStickerTap(id) {
  const data = curData();
  const [code, idxStr] = id.split('-');
  const idx = parseInt(idxStr, 10);
  const section = curSections().find(s => s.code === code);
  if (markMode === 'own') {
    if (data.owned[id]) {
      delete data.owned[id];
      delete data.dups[id];
    } else {
      data.owned[id] = true;
    }
  } else if (markMode === 'dup') {
    data.owned[id] = true; // se tem repetida, tem a colada
    data.dups[id] = (data.dups[id] || 0) + 1;
  } else if (markMode === 'dupminus') {
    if (data.dups[id]) {
      data.dups[id]--;
      if (!data.dups[id]) delete data.dups[id];
    }
  } else if (markMode === 'rename') {
    const original = section.stickers[idx - 1].label;
    const current = data.labels[id] || original;
    const name = prompt(`Nome da figurinha (${section.name}):`, current);
    if (name !== null) {
      const trimmed = name.trim();
      if (trimmed && trimmed !== original) data.labels[id] = trimmed;
      else delete data.labels[id];
    }
  }
  save();
  renderHeader();
  renderAlbumSections();
}

function bulkMark(code, on) {
  const data = curData();
  const section = curSections().find(s => s.code === code);
  for (let i = 1; i <= section.stickers.length; i++) {
    const id = stickerId(code, i);
    if (on) data.owned[id] = true;
    else { delete data.owned[id]; delete data.dups[id]; }
  }
  save();
  renderHeader();
  renderAlbumSections();
}

// ============================================================
// ABA PAÍSES / SEÇÕES (resumo)
// ============================================================
function renderResumo(main) {
  const rows = curSections().map(s => ({ s, st: sectionStats(s) }));
  const complete = rows.filter(r => r.st.owned === r.st.total).length;
  let html = albumSwitcherHtml() + `
    <div class="card">
      <h2>🌎 Resumo por seção <small style="color:var(--text-dim);font-weight:400">· ${complete}/${rows.length} completas</small></h2>`;
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
function missingBySection() {
  const data = curData();
  const out = [];
  for (const s of curSections()) {
    const items = [];
    s.stickers.forEach((stk, i) => {
      if (!data.owned[stickerId(s.code, i + 1)]) items.push({ idx: i + 1, n: stk.n, label: stickerLabel(s, i + 1) });
    });
    if (items.length) out.push({ section: s, items });
  }
  return out;
}

function compressNums(nums) {
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

// Formata itens (números conhecidos comprimidos + nomes das figurinhas sem número)
function formatItems(items, withCount) {
  const nums = items.filter(i => i.n != null).map(i => i.n).sort((a, b) => a - b);
  const named = items.filter(i => i.n == null).map(i => i.label + (withCount && i.d > 1 ? ` (x${i.d})` : ''));
  const numTxt = nums.length
    ? (withCount
        ? items.filter(i => i.n != null).sort((a, b) => a.n - b.n).map(i => i.d > 1 ? `${i.n} (x${i.d})` : `${i.n}`).join(', ')
        : compressNums(nums))
    : '';
  return [numTxt, named.join('; ')].filter(Boolean).join(' · ');
}

function renderFaltam(main) {
  const missing = missingBySection();
  const total = missing.reduce((s, m) => s + m.items.length, 0);
  let html = albumSwitcherHtml() + `
    <div class="card">
      <h2>🔍 Figurinhas que faltam <small style="color:var(--text-dim);font-weight:400">· ${total}</small></h2>
      <p class="help">💡 Conseguiu uma na troca? <b>Toque nela aqui</b> que ela já entra como "tenho" e some da lista.</p>
      <div class="btn-row"><button class="btn small" id="copyMissing">📋 Copiar lista</button></div>`;
  if (!missing.length) {
    html += '<div class="empty">🎉 Parabéns! Álbum completo, não falta nenhuma!</div>';
  } else {
    for (const m of missing) {
      const chips = m.items.map(it =>
        `<button class="miss-chip" data-fid="${m.section.code}-${it.idx}">${esc((it.n != null && !m.section.legend) ? String(it.n) : it.label)}</button>`).join('');
      html += `
        <div class="missing-line">
          <span class="flag">${m.section.flag}</span><b>${esc(m.section.name)} - ${esc(m.section.abbr || m.section.code)} -</b>
          <small>(${m.items.length} de ${m.section.stickers.length})</small>
          <div class="miss-chips">${chips}</div>
        </div>`;
    }
  }
  html += '</div>';
  main.innerHTML = html;
  const btn = $('#copyMissing');
  if (btn) btn.onclick = () => {
    const text = `FALTAM — ${curAlbum().title}:\n` + missing.map(m =>
      `${m.section.flag} ${m.section.name} - ${m.section.abbr || m.section.code} -: ${formatItems(m.items, false)}`).join('\n') +
      `\nTotal: ${total} figurinhas`;
    copyText(text);
  };
  // tocar numa figurinha faltante = marquei "tenho" (peguei na troca)
  main.querySelectorAll('[data-fid]').forEach(el => el.onclick = () => {
    curData().owned[el.dataset.fid] = true;
    save();
    renderFaltam(main);
  });
}

// ============================================================
// ABA TROCAS (repetidas)
// ============================================================
function dupsBySection() {
  const data = curData();
  const out = [];
  for (const s of curSections()) {
    const items = [];
    s.stickers.forEach((stk, i) => {
      const d = data.dups[stickerId(s.code, i + 1)] || 0;
      if (d > 0) items.push({ idx: i + 1, n: stk.n, label: stickerLabel(s, i + 1), d });
    });
    if (items.length) out.push({ section: s, items });
  }
  return out;
}

function renderTrocas(main) {
  const dups = dupsBySection();
  const total = dups.reduce((s, m) => s + m.items.reduce((a, i) => a + i.d, 0), 0);
  let html = albumSwitcherHtml() + `
    <div class="card">
      <h2>🔁 Repetidas para troca <small style="color:var(--text-dim);font-weight:400">· ${total}</small></h2>
      <p class="help">Estas são as figurinhas que você tem além da colada — disponíveis para trocar.</p>
      <div class="btn-row"><button class="btn small" id="copyDups">📋 Copiar lista</button></div>`;
  if (!dups.length) {
    html += '<div class="empty">Nenhuma repetida registrada ainda. Use o modo "+1 Repetida" na aba Álbum.</div>';
  } else {
    for (const m of dups) {
      html += `
        <div class="missing-line">
          <span class="flag">${m.section.flag}</span><b>${esc(m.section.name)} - ${esc(m.section.abbr || m.section.code)} -</b>
          <small>(${m.items.reduce((a, i) => a + i.d, 0)} repetidas)</small><br>
          <span class="nums trade">${esc(formatItems(m.items, true))}</span>
        </div>`;
    }
  }
  html += '</div>';
  main.innerHTML = html;
  const btn = $('#copyDups');
  if (btn) btn.onclick = () => {
    const text = `TENHO PARA TROCA — ${curAlbum().title}:\n` + dups.map(m =>
      `${m.section.flag} ${m.section.name} - ${m.section.abbr || m.section.code} -: ${formatItems(m.items, true)}`).join('\n') +
      `\nTotal: ${total} figurinhas`;
    copyText(text);
  };
}

// ============================================================
// ABA DICAS — assistente que analisa o álbum e sugere como completar
// ============================================================
function renderDicas(main) {
  const g = globalStats();
  const isLeg = curAlbum().isLegends;
  const missing = missingBySection().sort((a, b) => a.items.length - b.items.length);
  const dups = dupsBySection();
  const totalDups = dups.reduce((s, m) => s + m.items.reduce((a, i) => a + i.d, 0), 0);
  const complete = curSections().length - missing.length;
  const almost = missing.filter(m => m.items.length <= 3 && m.items.length > 0);
  const pct = g.total ? (g.owned / g.total) * 100 : 0;

  // estimativa simples de envelopes p/ terminar (colecionador avulso, com repetidas crescentes)
  const envEstimate = Math.ceil((g.missing / 5) * (1 + (g.missing < 100 ? (100 - g.missing) / 60 : 0)));

  let html = albumSwitcherHtml() + `
    <div class="card dica-hero">
      <h2>🤖 Assistente do álbum</h2>
      <p class="help" style="margin-bottom:6px">Analisei o seu <b>${esc(curAlbum().title)}</b>:</p>
      <div class="dica-diag">
        <div><b>${g.owned}/${g.total}</b><span>tenho (${pct.toFixed(0)}%)</span></div>
        <div><b style="color:var(--red)">${g.missing}</b><span>faltam</span></div>
        <div><b style="color:var(--amber)">${totalDups}</b><span>repetidas</span></div>
        <div><b style="color:var(--green)">${complete}</b><span>${isLeg ? 'craques ok' : 'seções ok'}</span></div>
      </div>
    </div>`;

  // 1) Quase lá
  if (almost.length) {
    html += `<div class="card"><h2>🔥 Ataque nas quase completas</h2>
      <p class="help">Faltam pouquíssimas nestas — priorize! Toque para ir direto e conferir os números.</p>`;
    for (const m of almost.slice(0, 12)) {
      html += `<div class="dica-goto" data-goto="${m.section.code}">
        <span class="flag">${m.section.flag}</span>
        <b>${esc(m.section.name)}</b> <small>${esc(m.section.abbr || m.section.code)}</small>
        <span class="dica-need">faltam ${m.items.length}</span></div>`;
    }
    html += `</div>`;
  }

  // 2) Estratégia
  const tips = [];
  if (!isLeg) {
    if (g.missing > 150) tips.push(['📦', 'Compre em caixa fechada', 'Caixa com 50–100 envelopes sai bem mais barato por figurinha do que comprar avulso, e no começo quase tudo é novidade.']);
    tips.push(['🔁', 'Troque suas repetidas', totalDups > 0 ? `Você tem <b>${totalDups}</b> repetidas — são suas "moedas de troca". Veja a aba Trocas e mande a lista nos grupos.` : 'Assim que juntar repetidas, use-as para trocar pelas que faltam. Uma repetida vale por uma faltante.']);
    tips.push(['👥', 'Entre em grupos de troca', 'Grupos de WhatsApp/Facebook da sua cidade e feiras de troca (bancas, shoppings) são o jeito mais rápido de fechar o álbum.']);
    if (g.missing <= 60) tips.push(['✉️', 'Reta final: encomende as que faltam', 'Com poucas faltando, o serviço oficial da Panini de <b>figurinhas faltantes</b> (você pede pelos números) costuma sair mais barato que ficar abrindo envelope.']);
    tips.push(['📉', 'Regra de ouro', 'As últimas ~10% custam mais que os primeiros 90% (probabilidade). Perto do fim, aposte em troca e encomenda, não em envelope aleatório.']);
    tips.push(['🤝', 'Junte-se com alguém', 'Comprem envelopes juntos e dividam: as repetidas de um viram as faltantes do outro. (Vocês já podem sincronizar pelo código na aba Dados!)']);
  } else {
    tips.push(['⭐', 'Legends são raras', 'As figurinhas Legends (Ouro/Prata/Bronze/Bordô) são extras e saem com baixa frequência nos envelopes — não conte só com sorte.']);
    tips.push(['🔁', 'Troca é o caminho', 'A forma mais eficiente é trocar/comprar avulso as cores específicas que faltam, em grupos ou marketplaces (Mercado Livre, OLX).']);
    tips.push(['🥇', 'Ouro é a mais difícil', 'Em geral a variação Ouro é a mais rara. Se achar por um preço justo, vale garantir.']);
  }
  html += `<div class="card"><h2>💡 Estratégia pra completar</h2>`;
  for (const [ic, t, d] of tips) {
    html += `<div class="dica-item"><span class="dica-ic">${ic}</span><div><b>${t}</b><br><span class="help" style="margin:0">${d}</span></div></div>`;
  }
  html += `</div>`;

  // 3) resumo de esforço
  if (!isLeg && g.missing > 0) {
    html += `<div class="card"><h2>🎯 Meta</h2>
      <p class="help">Faltam <b>${g.missing}</b> figurinhas. Comprando só avulso, seriam ~<b>${envEstimate}</b> envelopes (e cada vez mais repetidas). Por isso: <b>troca + encomenda na reta final</b> é o segredo pra não gastar à toa. 💪</p></div>`;
  }
  if (g.missing === 0) {
    html += `<div class="card"><div class="empty">🏆 Álbum completo! Não falta nenhuma. Parabéns!</div></div>`;
  }

  main.innerHTML = html;
  main.querySelectorAll('[data-goto]').forEach(el => el.onclick = () => {
    state.openSections = { [el.dataset.goto]: true };
    albumQuery = '';
    setTab('album');
    setTimeout(() => {
      const t = $(`.team-section[data-code="${el.dataset.goto}"]`);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  });
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
const BR_TZ = 'America/Sao_Paulo'; // horários sempre no fuso de Brasília
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
      <div class="sync-info">🕐 Horários no fuso de Brasília${state.lastSync ? ' · atualizado ' + new Date(state.lastSync).toLocaleString('pt-BR', { timeZone: BR_TZ }) : ''}</div>
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
      const dayKey = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: BR_TZ });
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
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: BR_TZ });
  const live = m.state === 'in';
  const done = m.state === 'post';
  const statusHtml = done
    ? `<div class="st-time">Fim</div><div class="st-detail">${esc(m.detail)}</div>`
    : live
      ? `<div class="st-time">AO VIVO</div><div class="st-detail">${esc(m.detail)}</div>`
      : `<div class="st-time">${time}</div><div class="st-detail">Brasília</div>`;
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
        try { new Notification(title, { body }); } catch (e) { /* mobile precisa de SW */ }
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
function syncCardHtml() {
  return `
    <div class="card">
      <h2>📲 Compartilhar com outro celular</h2>
      <p class="help">Junte o álbum com outra pessoa (ex: sua esposa) por um <b>código</b> — sem cadastro e sem depender de servidor, funciona sempre. Um gera o código, manda pelo WhatsApp, o outro cola. <b>As marcações se somam</b> (ninguém perde as suas). Repita quando quiser passar novidades.</p>
      <h3>1) Enviar o meu</h3>
      <div class="btn-row">
        <button class="btn" id="genCode">📤 Gerar código</button>
        <button class="btn secondary" id="genLink">🔗 Gerar link (WhatsApp)</button>
      </div>
      <textarea class="paste" id="myCode" readonly placeholder="Toque em Gerar código — ele aparece aqui e já é copiado" style="min-height:60px"></textarea>
      <h3>2) Receber do outro</h3>
      <textarea class="paste" id="inCode" placeholder="Cole aqui o código (ou link) recebido"></textarea>
      <div class="btn-row"><button class="btn" id="applyCode">✅ Aplicar código recebido</button></div>
    </div>`;
}

function renderDados(main) {
  const g = globalStats();
  main.innerHTML = albumSwitcherHtml() + syncCardHtml() + `
    <div class="card">
      <h2>📥 Importar figurinhas <small style="color:var(--text-dim);font-weight:400">· ${esc(curAlbum().title)}</small></h2>
      <p class="help">
        Cole a sua lista e o app marca tudo de uma vez <b>no álbum selecionado acima</b>.
        Uma seção por linha — código ou nome, depois os números (aceita intervalos e repetidas com "x"):<br><br>
        <b>BEL: 6, 9, 17x3</b> &nbsp;(17x3 = tenho 1 colada + 2 repetidas)<br>
        <b>HIST: 1-22</b> &nbsp;·&nbsp; <b>Colômbia: 2 3 5</b>
      </p>
      <h3>Figurinhas que TENHO</h3>
      <textarea class="paste" id="pasteOwned" placeholder="BEL: 6, 9, 20&#10;COCA: 1-8&#10;HIST: 1-22"></textarea>
      <h3>Repetidas (opcional, se não usou "x" acima)</h3>
      <textarea class="paste" id="pasteDups" placeholder="COCA: 5, 5, 9x4"></textarea>
      <div class="btn-row">
        <button class="btn" id="importBtn">Importar e marcar</button>
      </div>
    </div>

    <div class="card">
      <h2>💾 Backup</h2>
      <p class="help">Neste álbum você tem <b>${g.owned}</b> figurinhas marcadas e <b>${g.dups}</b> repetidas. Os dados (dos dois álbuns) ficam salvos neste aparelho — exporte um backup para não perder nada.</p>
      <div class="btn-row">
        <button class="btn" id="exportBtn">⬇️ Exportar backup (.json)</button>
        <button class="btn secondary" id="importFileBtn">⬆️ Restaurar backup</button>
        <input type="file" id="importFile" accept=".json,application/json" style="display:none">
      </div>
    </div>

    <div class="card">
      <h2>⚠️ Zerar álbum atual</h2>
      <p class="help">Apaga todas as marcações do álbum <b>${esc(curAlbum().title)}</b> (tenho, repetidas e nomes). Não afeta o outro álbum nem a agenda de jogos.</p>
      <div class="btn-row"><button class="btn danger" id="resetBtn">Zerar este álbum</button></div>
    </div>`;

  // --- Compartilhar por código ---
  const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
  on('genCode', () => { const c = generateShareCode(); const t = $('#myCode'); if (t) t.value = c; copyText(c); });
  on('genLink', () => { const l = shareCodeLink(); const t = $('#myCode'); if (t) t.value = l; copyText(l); });
  on('applyCode', () => { if (applyShareCode($('#inCode').value)) { const t = $('#inCode'); if (t) t.value = ''; } });

  $('#importBtn').onclick = () => {
    const r1 = importList($('#pasteOwned').value, 'owned');
    const r2 = importList($('#pasteDups').value, 'dups');
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
        if (data.albums) {
          state.albums = Object.assign(state.albums, data.albums);
        } else if (data.owned) {
          // backup antigo (álbum oficial)
          state.albums.copa = { owned: data.owned, dups: data.dups || {}, labels: data.labels || {} };
        } else throw new Error('formato inválido');
        if (data.alerts) state.alerts = data.alerts;
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
    if (confirm(`Tem certeza? Isso apaga TODAS as marcações do álbum "${curAlbum().title}".`)) {
      state.albums[state.currentAlbum] = emptyAlbumState();
      save();
      render();
      toast('Álbum zerado.');
    }
  };
}

// aceita: "BEL: 6, 9, 17x3" | "Bélgica 6 9" | "HIST 1-22"
function resolveSectionCode(token) {
  const t = token.trim().toLowerCase().replace(/[:\-–]$/, '').trim();
  if (!t) return null;
  const sections = curSections();
  const byCode = sections.find(s => s.code.toLowerCase() === t);
  if (byCode) return byCode.code;
  const byName = sections.find(s => s.name.toLowerCase() === t);
  if (byName) return byName.code;
  const partial = sections.filter(s => s.name.toLowerCase().startsWith(t));
  if (partial.length === 1) return partial[0].code;
  return null;
}

function importList(text, target) {
  const data = curData();
  let count = 0;
  const errors = [];
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-zÀ-ÿ .'’-]+?)[\s:]+([\dxX,\s\-–;]+)$/);
    if (!m) { errors.push(line.slice(0, 25)); continue; }
    const code = resolveSectionCode(m[1]);
    if (!code) { errors.push(m[1].slice(0, 25) + '?'); continue; }
    const section = curSections().find(s => s.code === code);
    // mapa: número do álbum -> índice da figurinha na seção
    const byNum = {};
    section.stickers.forEach((s, i) => { if (s.n != null) byNum[s.n] = i + 1; });
    const tokens = m[2].split(/[,;\s]+/).filter(Boolean);
    const apply = (n, times) => {
      const idx = byNum[n];
      if (!idx) return;
      const id = stickerId(code, idx);
      if (target === 'owned') {
        data.owned[id] = true;
        if (times > 1) data.dups[id] = (data.dups[id] || 0) + (times - 1);
      } else {
        data.owned[id] = true;
        data.dups[id] = (data.dups[id] || 0) + times;
      }
      count++;
    };
    for (const tok of tokens) {
      const range = tok.match(/^(\d+)[\-–](\d+)$/);
      const mult = tok.match(/^(\d+)[xX](\d+)$/);
      const single = tok.match(/^(\d+)$/);
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
    version: 2,
    exportedAt: new Date().toISOString(),
    albums: state.albums,
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
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.update();
    // quando uma versão nova assumir o controle, recarrega para mostrar as novidades
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }).catch(() => {});
}

setTab(state.tab || 'album');
updateHeaderHeight();
window.addEventListener('resize', updateHeaderHeight);
if ('ResizeObserver' in window) {
  const bar = document.querySelector('header.topbar');
  if (bar) new ResizeObserver(updateHeaderHeight).observe(bar);
}

// primeira carga da agenda em segundo plano (se nunca sincronizou ou faz +1h)
if (!state.lastSync || Date.now() - state.lastSync > 3600e3) {
  syncMatches(true);
}
checkAlerts();

// ---- Link de compartilhamento: .../#code=<código> aplica automaticamente ----
(function initShare() {
  const m = location.hash.match(/code=([^\s&#]+)/);
  if (m && m[1]) {
    if (confirm('Recebeu um álbum compartilhado. Deseja SOMAR as figurinhas dele às suas neste celular?')) {
      applyShareCode(m[1]);
    }
    history.replaceState(null, '', location.pathname); // limpa o hash da barra
  }
})();
