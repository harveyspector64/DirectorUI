const state = {
  data: null,
  rows: [],
  filtered: [],
  page: 1,
};

const els = {
  stats: document.getElementById('stats'),
  resultSummary: document.getElementById('resultSummary'),
  activeFilters: document.getElementById('activeFilters'),
  pager: document.getElementById('pager'),
  resultsBody: document.getElementById('resultsBody'),
  template: document.getElementById('rowTemplate'),
  preset: document.getElementById('presetFilter'),
  search: document.getElementById('searchInput'),
  tier: document.getElementById('tierFilter'),
  lane: document.getElementById('laneFilter'),
  tone: document.getElementById('toneFilter'),
  scale: document.getElementById('scaleFilter'),
  budget: document.getElementById('budgetFilter'),
  actor: document.getElementById('actorFilter'),
  availability: document.getElementById('availabilityFilter'),
  sortBy: document.getElementById('sortBy'),
  pageSize: document.getElementById('pageSize'),
  clear: document.getElementById('clearBtn'),
  export: document.getElementById('exportBtn'),
};

const normalize = (v) => (v || '').toLowerCase();
const splitTags = (v) => (v || '').split(/[;,]/).map((x) => x.trim()).filter(Boolean);
const selected = (sel) => new Set(Array.from(sel.selectedOptions).map((o) => o.value));

function buildRows(data) {
  const actorByDirector = new Map();
  for (const row of data.actorMatrix || []) {
    if (!row.Director || !row.Actor) continue;
    const arr = actorByDirector.get(row.Director) || [];
    arr.push(row.Actor);
    actorByDirector.set(row.Director, arr);
  }

  const nextByDirector = new Map((data.projectsNext || []).map((r) => [r.Director, r]));
  const availabilityByDirector = new Map((data.availability || []).map((r) => [r.Director, r]));
  const boardA = new Set((data.boardA || []).map((r) => r.Director));

  return (data.directors || []).map((d) => {
    const tier = d.Tier || '';
    const phase = normalize(d.CareerPhase);

    return {
      ...d,
      actors: [...new Set(actorByDirector.get(d.Director) || [])],
      next: nextByDirector.get(d.Director) || {},
      availability: availabilityByDirector.get(d.Director) || {},
      isBoardA: boardA.has(d.Director),
      isWorkman: tier === 'T3',
      isUpAndComer: tier === 'T5' || phase.includes('breakout'),
    };
  });
}

function fillSelectOptions() {
  const assign = (el, values) => {
    el.innerHTML = values.map((v) => `<option value="${v}">${v}</option>`).join('');
  };

  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  assign(els.tier, uniq(state.rows.map((r) => r.Tier)));
  assign(els.lane, uniq(state.rows.map((r) => r.PrimaryLane)));
  assign(els.scale, uniq(state.rows.map((r) => r.ScaleProven)));
  assign(els.budget, uniq(state.rows.map((r) => r.BudgetBandTypical)));

  const tones = [];
  state.rows.forEach((r) => tones.push(...splitTags(r.TonalDNA)));
  assign(els.tone, uniq(tones));
}

function renderStats(filtered) {
  const boardAHits = filtered.filter((r) => r.isBoardA).length;
  const uniqueLanes = new Set(filtered.map((r) => r.PrimaryLane).filter(Boolean)).size;

  els.stats.innerHTML = `
    <div class="metric"><b>${filtered.length}</b><span>Matching directors</span></div>
    <div class="metric"><b>${state.rows.length}</b><span>Total universe</span></div>
    <div class="metric"><b>${boardAHits}</b><span>Board A matches</span></div>
    <div class="metric"><b>${uniqueLanes}</b><span>Lane coverage</span></div>
  `;
}

function passesMulti(rowValue, selectedSet, split = false) {
  if (!selectedSet.size) return true;
  if (!rowValue) return false;
  const values = split ? splitTags(rowValue) : [rowValue];
  return values.some((v) => selectedSet.has(v));
}

function applyPreset(rows, preset) {
  if (preset === 'boardA') return rows.filter((r) => r.isBoardA);
  if (preset === 'workman') return rows.filter((r) => r.isWorkman);
  if (preset === 'upcoming') return rows.filter((r) => r.isUpAndComer);
  return rows;
}

function sortRows(rows, mode) {
  const copy = [...rows];
  const tierValue = (tier) => {
    const m = (tier || '').match(/T(\d+)/);
    return m ? Number(m[1]) : 99;
  };

  if (mode === 'nameDesc') return copy.sort((a, b) => (b.Director || '').localeCompare(a.Director || ''));
  if (mode === 'tierAsc') return copy.sort((a, b) => tierValue(a.Tier) - tierValue(b.Tier) || (a.Director || '').localeCompare(b.Director || ''));
  if (mode === 'tierDesc') return copy.sort((a, b) => tierValue(b.Tier) - tierValue(a.Tier) || (a.Director || '').localeCompare(b.Director || ''));
  return copy.sort((a, b) => (a.Director || '').localeCompare(b.Director || ''));
}

function getFilterChips() {
  const chips = [];
  if (els.preset.value !== 'all') chips.push(`Preset: ${els.preset.options[els.preset.selectedIndex].text}`);
  if (els.search.value.trim()) chips.push(`Search: ${els.search.value.trim()}`);
  if (els.actor.value.trim()) chips.push(`Actor: ${els.actor.value.trim()}`);
  if (els.availability.value.trim()) chips.push(`Availability: ${els.availability.value.trim()}`);

  const addSelected = (label, sel) => {
    Array.from(sel.selectedOptions).forEach((o) => chips.push(`${label}: ${o.value}`));
  };

  addSelected('Tier', els.tier);
  addSelected('Lane', els.lane);
  addSelected('Tone', els.tone);
  addSelected('Scale', els.scale);
  addSelected('Budget', els.budget);

  return chips;
}

function filterRows() {
  const query = normalize(els.search.value.trim());
  const actorNeedle = normalize(els.actor.value.trim());
  const availabilityNeedle = normalize(els.availability.value.trim());

  const tierSet = selected(els.tier);
  const laneSet = selected(els.lane);
  const toneSet = selected(els.tone);
  const scaleSet = selected(els.scale);
  const budgetSet = selected(els.budget);

  const filtered = applyPreset(state.rows, els.preset.value).filter((row) => {
    const hay = normalize([
      row.Director,
      row.PrimaryLane,
      row.SecondaryLanes,
      row.TonalDNA,
      row.PackagingNotes,
      row.ActorMagnet,
      row.Last3Features,
    ].join(' | '));

    if (query && !hay.includes(query)) return false;
    if (!passesMulti(row.Tier, tierSet)) return false;
    if (!passesMulti(row.PrimaryLane, laneSet)) return false;
    if (!passesMulti(row.ScaleProven, scaleSet)) return false;
    if (!passesMulti(row.BudgetBandTypical, budgetSet)) return false;
    if (!passesMulti(row.TonalDNA, toneSet, true)) return false;

    if (actorNeedle) {
      const actors = normalize(row.actors.join(' | '));
      if (!actors.includes(actorNeedle)) return false;
    }

    if (availabilityNeedle) {
      const availText = normalize(`${row.next.Availability || ''} ${row.availability.CurrentCommitment || ''}`);
      if (!availText.includes(availabilityNeedle)) return false;
    }

    return true;
  });

  return sortRows(filtered, els.sortBy.value);
}

function renderSummary(total, shown, pageSize, page) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = total === 0 ? 0 : start + shown - 1;

  els.resultSummary.innerHTML = `<strong>Showing ${start}-${end}</strong> of <strong>${total}</strong> directors. Use Rows=All to force full list in one table.`;

  const chips = getFilterChips();
  els.activeFilters.innerHTML = chips.length
    ? `<div>${chips.map((c) => `<span class="filterChip">${c}</span>`).join('')}</div>`
    : '<div style="color: var(--muted)">No active filters.</div>';
}

function renderRows(rows) {
  const frag = document.createDocumentFragment();

  for (const row of rows) {
    const tr = els.template.content.firstElementChild.cloneNode(true);
    tr.children[0].innerHTML = `<strong>${row.Director}</strong><small>${row.CareerPhase || '—'}${row.Region ? ` · ${row.Region}` : ''}</small>`;
    tr.children[1].textContent = row.Tier || '—';
    tr.children[2].textContent = row.PrimaryLane || '—';
    tr.children[3].textContent = row.TonalDNA || '—';
    tr.children[4].textContent = row.ScaleProven || '—';
    tr.children[5].textContent = row.BudgetBandTypical || '—';
    tr.children[6].innerHTML = row.actors.slice(0, 7).map((a) => `<span class="tag">${a}</span>`).join('') || '—';

    const nextProject = row.next.NextProject || 'No current project listed';
    const avail = row.next.Availability || row.availability.CurrentCommitment || 'No availability note';
    tr.children[7].innerHTML = `<span class="badge">${row.availability.Confidence || 'Unknown confidence'}</span><div><strong>${nextProject}</strong></div><div>${avail}</div>`;
    frag.appendChild(tr);
  }

  els.resultsBody.replaceChildren(frag);
}

function renderPager(total, pageSize) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (state.page > totalPages) state.page = totalPages;

  const prevDisabled = state.page <= 1 ? 'disabled' : '';
  const nextDisabled = state.page >= totalPages ? 'disabled' : '';

  els.pager.innerHTML = `
    <button id="prevPage" ${prevDisabled}>Prev</button>
    <div>Page ${state.page} of ${totalPages}</div>
    <button id="nextPage" ${nextDisabled}>Next</button>
  `;

  const prev = document.getElementById('prevPage');
  const next = document.getElementById('nextPage');
  if (prev) prev.addEventListener('click', () => {
    state.page = Math.max(1, state.page - 1);
    render();
  });
  if (next) next.addEventListener('click', () => {
    state.page = Math.min(totalPages, state.page + 1);
    render();
  });
}

function currentPageRows() {
  const pageSize = Number(els.pageSize.value);
  if (pageSize >= 99999) return state.filtered;
  const start = (state.page - 1) * pageSize;
  const end = start + pageSize;
  return state.filtered.slice(start, end);
}

function exportFilteredCsv() {
  const cols = ['Director', 'Tier', 'PrimaryLane', 'SecondaryLanes', 'TonalDNA', 'ScaleProven', 'BudgetBandTypical', 'NextProject', 'Availability', 'Actors'];
  const escape = (v) => `"${String(v || '').replaceAll('"', '""')}"`;
  const lines = [cols.join(',')];

  for (const row of state.filtered) {
    lines.push([
      row.Director,
      row.Tier,
      row.PrimaryLane,
      row.SecondaryLanes,
      row.TonalDNA,
      row.ScaleProven,
      row.BudgetBandTypical,
      row.next.NextProject,
      row.next.Availability || row.availability.CurrentCommitment,
      row.actors.join('; '),
    ].map(escape).join(','));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `directors_filtered_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function render() {
  state.filtered = filterRows();
  const pageRows = currentPageRows();
  const pageSize = Number(els.pageSize.value);

  renderStats(state.filtered);
  renderSummary(state.filtered.length, pageRows.length, pageSize, state.page);
  renderRows(pageRows);
  renderPager(state.filtered.length, pageSize);
}

function resetFilters() {
  els.preset.value = 'all';
  els.search.value = '';
  els.actor.value = '';
  els.availability.value = '';
  els.sortBy.value = 'nameAsc';
  els.pageSize.value = '100';

  [els.tier, els.lane, els.tone, els.scale, els.budget].forEach((sel) => {
    Array.from(sel.options).forEach((opt) => {
      opt.selected = false;
    });
  });

  state.page = 1;
  render();
}

function bindEvents() {
  [els.preset, els.search, els.tier, els.lane, els.tone, els.scale, els.budget, els.actor, els.availability, els.sortBy].forEach((el) => {
    el.addEventListener('input', () => {
      state.page = 1;
      render();
    });
    el.addEventListener('change', () => {
      state.page = 1;
      render();
    });
  });

  els.pageSize.addEventListener('change', () => {
    state.page = 1;
    render();
  });

  els.clear.addEventListener('click', resetFilters);
  els.export.addEventListener('click', exportFilteredCsv);
}

async function init() {
  const response = await fetch('./data/directors.json');
  state.data = await response.json();
  state.rows = buildRows(state.data);

  fillSelectOptions();
  bindEvents();
  render();
}

init().catch((err) => {
  els.resultsBody.innerHTML = `<tr><td colspan="8">Failed to load dataset: ${err.message}</td></tr>`;
});
