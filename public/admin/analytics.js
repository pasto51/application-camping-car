// « Statistiques » : what customers look for in the app (anonymous), to decide the next communication campaigns.
// Simple charts drawn in SVG/HTML (no library): one colour, a table behind every chart, hover for the exact figure.
import { esc } from '/shared/common.js';

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const monthLabel = (m) => `${MONTHS_FR[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const monthLong = (m) => `${['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
const TYPES = { van: 'Van', fourgon: 'Fourgon', compact: 'Profilé compact', profile: 'Profilé', integral: 'Intégral', capucine: 'Capucine', inconnu: 'Non renseigné' };

// Evolution against the previous period, in words and an arrow (never colour alone).
function trend(now, before) {
  if (!before) return now ? '<span class="trend up">▲ nouveau</span>' : '';
  const p = Math.round(((now - before) / before) * 100);
  if (Math.abs(p) < 5) return '<span class="trend">= stable</span>';
  return p > 0 ? `<span class="trend up">▲ +${p} %</span>` : `<span class="trend down">▼ ${p} %</span>`;
}

// Vertical bars, one series. Hover a bar for its month and value.
function barChart(points, label) {
  const W = 720, H = 220, L = 36, B = 28, T = 10;
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const slot = (W - L) / points.length;
  const bw = Math.max(6, Math.min(36, slot - 6));
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const ticks = [0, top / 2, top];
  const grid = ticks
    .map((t) => `<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="viz-grid"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" class="viz-axis">${fmt(t)}</text>`)
    .join('');
  const bars = points
    .map((p, i) => {
      const x = L + i * slot + (slot - bw) / 2;
      const h = Math.max(0, y(0) - y(p.value));
      const r = Math.min(4, h);
      const path = h ? `M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z` : '';
      return `<g class="viz-hit" data-tip="${esc(p.tip)}"><rect x="${L + i * slot}" y="${T}" width="${slot}" height="${H - T - B}" fill="transparent"/>${path ? `<path d="${path}" class="viz-bar"/>` : ''}<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="viz-axis">${esc(p.label)}</text></g>`;
    })
    .join('');
  return `<div class="viz-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}${bars}</svg><div class="viz-tip" hidden></div></div>`;
}

// Horizontal bars with the label and the figure written next to each bar.
function barList(items, { value, label, extra = () => '', unit = '' }) {
  const max = Math.max(1, ...items.map(value));
  return `<div class="viz-hlist">${items
    .map(
      (it) => `<div class="viz-hrow" title="${esc(label(it, true))} : ${fmt(value(it))}${unit}">
        <div class="viz-hlabel">${label(it)}</div>
        <div class="viz-htrack"><div class="viz-hbar" style="width:${Math.max(2, (value(it) / max) * 100)}%"></div></div>
        <div class="viz-hval">${fmt(value(it))}${unit} ${extra(it)}</div>
      </div>`
    )
    .join('')}</div>`;
}

// Problems × months, the shade grows with the count (one hue, light to dark). The figure is written in each cell.
function heatmap(season) {
  const max = Math.max(1, ...season.rows.flatMap((r) => r.counts));
  return `<div class="table-wrap"><table class="viz-heat">
    <thead><tr><th>Problème</th>${season.months.map((m) => `<th>${esc(monthLabel(m))}</th>`).join('')}</tr></thead>
    <tbody>${season.rows
      .map(
        (r) => `<tr><td>${esc(r.label)}</td>${r.counts
          .map((n, i) => {
            const k = n / max;
            return `<td class="${k > 0.55 ? 'deep' : ''}" style="background:color-mix(in oklab, var(--series-1) ${Math.round(k * 85)}%, var(--card))" title="${esc(r.label)} — ${esc(monthLong(season.months[i]))} : ${fmt(n)}">${n || ''}</td>`;
          })
          .join('')}</tr>`
      )
      .join('')}</tbody></table></div>`;
}

// Campaign ideas worked out from the figures: what is rising now, and what peaked next month last year.
function ideas(d) {
  const out = [];
  // Only real rises (it was already looked for in the previous period), the three strongest.
  const rising = d.topProblems
    .filter((p) => p.previous >= 3 && p.count >= p.previous * 1.3)
    .sort((a, b) => b.count / b.previous - a.count / a.previous)
    .slice(0, 3);
  for (const p of rising) out.push(`<li><b>${esc(p.label)}</b> est en forte hausse (${fmt(p.previous)} → ${fmt(p.count)}, +${Math.round((p.count / p.previous - 1) * 100)} %) : c’est le moment d’en parler.</li>`);
  // The first of the 12 months is next month, one year ago.
  if (d.seasonality.months.length) {
    const peak = d.seasonality.rows.map((r) => ({ label: r.label, n: r.counts[0] })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
    if (peak.length) out.push(`<li>L’an dernier à la même période (${esc(monthLong(d.seasonality.months[0]))}), vos clients cherchaient surtout : ${peak.map((p) => `<b>${esc(p.label)}</b>`).join(', ')}. Préparez la campagne du mois prochain.</li>`);
  }
  const low = d.topProducts.filter((p) => p.shown >= 5 && p.asked / p.shown < 0.1).slice(0, 2);
  for (const p of low) out.push(`<li><b>${esc(p.product)}</b> est souvent conseillé (${fmt(p.shown)} fois) mais peu demandé au magasin : une promotion pourrait déclencher l’achat.</li>`);
  if (d.unanswered.length) out.push(`<li>${fmt(d.unanswered.length)} recherche(s) n’ont trouvé aucune réponse (ex. « ${esc(d.unanswered[0].query)} ») : un diagnostic à ajouter ?</li>`);
  return out.length ? `<ul class="viz-ideas">${out.join('')}</ul>` : '<p class="muted">Pas encore assez de données pour proposer des campagnes.</p>';
}

function tile(label, now, before, hint) {
  return `<div class="tile viz-tile"><strong>${fmt(now)}</strong><span>${esc(label)}</span>${before === undefined ? '' : trend(now, before)}${hint ? `<small class="muted">${esc(hint)}</small>` : ''}</div>`;
}

export function registerAnalyticsView(VIEWS, h) {
  const { api, pageHeader, canSeeAll } = h;

  VIEWS.analytics = async function analytics(el) {
    const f = (h.state.filter.analytics ||= { months: 3, dealershipId: '' });
    const [d, dealerships] = await Promise.all([
      api('GET', `/api/admin/analytics?months=${f.months}${f.dealershipId ? `&dealershipId=${f.dealershipId}` : ''}`),
      canSeeAll() ? api('GET', '/api/admin/dealerships') : Promise.resolve([]),
    ]);
    const t = d.totals, p = d.prevTotals;
    const askRate = t.result ? Math.round(((t.shop || 0) / t.result) * 100) : 0;
    const empty = !Object.values(t).some(Boolean);
    el.innerHTML = `${pageHeader('Statistiques')}
      <p class="muted">Ce que vos clients cherchent dans l’application, sans savoir qui : pour choisir vos prochaines campagnes. Comparaison avec la période précédente de même durée.</p>
      <div class="filter-bar">
        ${[3, 6, 12, 24].map((m) => `<button class="chip ${f.months === m ? 'active' : ''}" data-act="months" data-value="${m}">${m} mois</button>`).join('')}
        ${
          canSeeAll()
            ? `<select data-dealer><option value="">Toutes les concessions</option>${dealerships.map((x) => `<option value="${x.id}" ${String(f.dealershipId) === String(x.id) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`
            : ''
        }
      </div>
      ${empty ? `<div class="card warn-card">Pas encore de données pour cette période${f.dealershipId ? ' et cette concession' : ''} : elles arrivent dès que les clients utilisent l’application (recherches, diagnostics, conseils).${canSeeAll() ? ' Pour voir la page avec des données de test : <code>node server/demo.js --stats</code> sur le serveur.' : ''}</div>` : ''}
      <div class="tiles">
        ${tile('Recherches', t.search || 0, p.search || 0)}
        ${tile('Problèmes consultés', t.diag || 0, p.diag || 0)}
        ${tile('Conseils produit affichés', t.result || 0, p.result || 0)}
        ${tile('Demandes au magasin', t.shop || 0, p.shop || 0, `${askRate} % des conseils`)}
        ${tile('Clients', d.customers, undefined, 'avec l’application')}
      </div>
      <div class="card"><h2>Idées de campagne</h2>${ideas(d)}</div>
      <div class="card">
        <h2>Problèmes consultés par mois</h2>
        ${barChart(d.perMonth.map((m) => ({ label: monthLabel(m.month), value: m.diag, tip: `${monthLong(m.month)} : ${fmt(m.diag)} problème(s) consulté(s), ${fmt(m.search)} recherche(s), ${fmt(m.shop)} demande(s) au magasin` })), 'Problèmes consultés par mois')}
        <details><summary>Voir le tableau</summary><div class="table-wrap"><table><thead><tr><th>Mois</th><th>Recherches</th><th>Problèmes</th><th>Conseils</th><th>Demandes magasin</th><th>Équipements vus</th></tr></thead>
        <tbody>${d.perMonth.map((m) => `<tr><td>${esc(monthLong(m.month))}</td><td>${fmt(m.search)}</td><td>${fmt(m.diag)}</td><td>${fmt(m.result)}</td><td>${fmt(m.shop)}</td><td>${fmt(m.equip)}</td></tr>`).join('')}</tbody></table></div></details>
      </div>
      <div class="detail-grid">
        <div class="card">
          <h2>Problèmes les plus consultés</h2>
          ${d.topProblems.length ? barList(d.topProblems, { value: (x) => x.count, label: (x, plain) => (plain ? x.label : `${esc(x.label)}${x.comfort ? ' <span class="status resolu">Confort</span>' : ''}`), extra: (x) => trend(x.count, x.previous) }) : '<p class="muted">Aucun pour l’instant.</p>'}
        </div>
        <div class="card">
          <h2>Produits conseillés</h2>
          ${
            d.topProducts.length
              ? `<div class="table-wrap"><table><thead><tr><th>Produit</th><th>Conseillé</th><th>Demandé au magasin</th></tr></thead><tbody>${d.topProducts
                  .map((x) => `<tr><td>${esc(x.product)}</td><td>${fmt(x.shown)}</td><td>${fmt(x.asked)} <small class="muted">(${x.shown ? Math.round((x.asked / x.shown) * 100) : 0} %)</small></td></tr>`)
                  .join('')}</tbody></table></div>`
              : '<p class="muted">Aucun pour l’instant.</p>'
          }
        </div>
      </div>
      <div class="card">
        <h2>Saisonnalité : les problèmes mois par mois (12 derniers mois)</h2>
        <p class="muted">Plus la case est foncée, plus le problème a été consulté ce mois-là. Utile pour préparer les campagnes un mois à l’avance.</p>
        ${d.seasonality.rows.length ? heatmap(d.seasonality) : '<p class="muted">Aucune donnée.</p>'}
      </div>
      <div class="detail-grid">
        <div class="card">
          <h2>Ce que les clients tapent</h2>
          ${
            d.topSearches.length
              ? `<div class="table-wrap"><table><thead><tr><th>Recherche</th><th>Fois</th><th>Sans réponse</th></tr></thead><tbody>${d.topSearches
                  .map((x) => `<tr><td>« ${esc(x.query)} »</td><td>${fmt(x.count)}</td><td>${x.noResult ? fmt(x.noResult) : ''}</td></tr>`)
                  .join('')}</tbody></table></div>`
              : '<p class="muted">Aucune recherche pour l’instant.</p>'
          }
        </div>
        <div class="card">
          <h2>Recherches sans réponse</h2>
          <p class="muted">Des mots que l’application n’a pas su relier à un problème : des idées de diagnostics ou de conseils à ajouter.</p>
          ${d.unanswered.length ? `<ul>${d.unanswered.map((x) => `<li>« ${esc(x.query)} » <small class="muted">${fmt(x.count)} fois</small></li>`).join('')}</ul>` : '<p class="muted">Aucune : bravo.</p>'}
        </div>
      </div>
      <div class="detail-grid">
        <div class="card">
          <h2>Équipements de vos clients</h2>
          <p class="muted">Nombre de clients équipés (cochés dans leur application, ou prévus sur leur modèle), et nombre de fois où la fiche a été ouverte.</p>
          ${d.equipment.length ? barList(d.equipment, { value: (x) => x.owners, label: (x) => esc(x.name), extra: (x) => (x.views ? `<small class="muted">· ${fmt(x.views)} vue(s)</small>` : ''), unit: ' client(s)' }) : '<p class="muted">Aucun.</p>'}
        </div>
        <div class="card">
          <h2>Types de véhicules</h2>
          <p class="muted">Problèmes consultés selon le type de véhicule.</p>
          ${d.vehicleTypes.length ? barList(d.vehicleTypes, { value: (x) => x.n, label: (x) => esc(TYPES[x.type] || x.type) }) : '<p class="muted">Aucun.</p>'}
        </div>
      </div>`;

    // Hover: the exact figure of the bar under the pointer.
    el.querySelectorAll('.viz-chart').forEach((chart) => {
      const tip = chart.querySelector('.viz-tip');
      chart.addEventListener('pointermove', (e) => {
        const g = e.target.closest('.viz-hit');
        chart.querySelectorAll('.viz-hit.on').forEach((x) => x !== g && x.classList.remove('on'));
        if (!g) return (tip.hidden = true);
        g.classList.add('on');
        tip.textContent = g.dataset.tip;
        tip.hidden = false;
        const box = chart.getBoundingClientRect();
        tip.style.left = `${Math.min(box.width - 220, Math.max(0, e.clientX - box.left - 110))}px`;
        tip.style.top = `${Math.max(0, e.clientY - box.top - 56)}px`;
      });
      chart.addEventListener('pointerleave', () => {
        tip.hidden = true;
        chart.querySelectorAll('.viz-hit.on').forEach((x) => x.classList.remove('on'));
      });
    });
    el.querySelector('[data-dealer]')?.addEventListener('change', (e) => {
      f.dealershipId = e.target.value;
      VIEWS.analytics(el);
    });
    el.onclick = (e) => {
      const b = e.target.closest('[data-act="months"]');
      if (!b) return;
      f.months = Number(b.dataset.value);
      VIEWS.analytics(el);
    };
  };
}
