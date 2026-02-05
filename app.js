const state = {
  data: null,
  rows: [],
};

const els = {
  stats: document.getElementById('stats'),
  resultsBody: document.getElementById('resultsBody'),
  template: document.getElementById('rowTemplate'),
  search: document.getElementById('searchInput'),
  tier: document.getElementById('tierFilter'),
  lane: document.getElementById('laneFilter'),
  tone: document.getElementById('toneFilter'),
  scale: document.getElementById('scaleFilter'),
  budget: document.getElementById('budgetFilter'),
  actor: document.getElementById('actorFilter'),
  availability: document.getElementById('availabilityFilter'),
  clear: document.getElementById('clearBtn'),
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

  return (data.directors || []).map((d) => ({
    ...d,
    actors: [...new Set(actorByDirector.get(d.Director) || [])],
    next: nextByDirector.get(d.Director) || {},
    availability: availabilityByDirector.get(d.Director) || {},
    isBoardA: boardA.has(d.Director),
  }));
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

function filterRows() {
  const query = normalize(els.search.value.trim());
  const actorNeedle = normalize(els.actor.value.trim());
  const availabilityNeedle = normalize(els.availability.value.trim());

  const tierSet = selected(els.tier);
  const laneSet = selected(els.lane);
  const toneSet = selected(els.tone);
  const scaleSet = selected(els.scale);
  const budgetSet = selected(els.budget);

  return state.rows.filter((row) => {
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
    tr.children[6].innerHTML = row.actors.slice(0, 5).map((a) => `<span class="tag">${a}</span>`).join('') || '—';

    const nextProject = row.next.NextProject || 'No current project listed';
    const avail = row.next.Availability || row.availability.CurrentCommitment || 'No availability note';
    tr.children[7].innerHTML = `<span class="badge">${row.availability.Confidence || 'Unknown confidence'}</span><div><strong>${nextProject}</strong></div><div>${avail}</div>`;
    frag.appendChild(tr);
  }

  els.resultsBody.replaceChildren(frag);
}

function applyFilters() {
  const filtered = filterRows();
  renderStats(filtered);
  renderRows(filtered);
}

function bindEvents() {
  [els.search, els.tier, els.lane, els.tone, els.scale, els.budget, els.actor, els.availability].forEach((el) => {
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });

  els.clear.addEventListener('click', () => {
    els.search.value = '';
    els.actor.value = '';
    els.availability.value = '';
    [els.tier, els.lane, els.tone, els.scale, els.budget].forEach((sel) => {
      Array.from(sel.options).forEach((opt) => {
        opt.selected = false;
      });
    });
    applyFilters();
  });
}

async function init() {
  const response = await fetch('./data/directors.json');
  state.data = await response.json();
  state.rows = buildRows(state.data);

  fillSelectOptions();
  bindEvents();
  applyFilters();
}

init().catch((err) => {
  els.resultsBody.innerHTML = `<tr><td colspan="8">Failed to load dataset: ${err.message}</td></tr>`;
});
