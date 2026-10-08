// Usage : BASE=http://localhost:3000 N=500 node tools/simulate-diagnostics.js   (Playwright requis)
// 500 simulations de parcours de diagnostic, jouées dans la vraie appli (navigateur).
// Pour chaque simulation : une panne réelle est tirée (une fin de parcours), le client simulé décrit son souci,
// répond aux questions comme si c'était cette panne, et l'on vérifie la conclusion affichée.
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs');
const SP = process.env.OUT || '.', B = process.env.BASE || 'http://localhost:3000';
const PW = process.env.PW || 'playwright';
const N = Number(process.env.N || 500);

// Deterministic random
let seed = 20261008;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function leavesOf(d) {
  const out = [];
  (function walk(n, path) {
    if (Array.isArray(n.n)) n.o.forEach((o, i) => walk(n.n[i], path.concat([{ t: n.t, o: n.o, a: i, vk: n.vk, vv: n.vv }])));
    else out.push({ path, leaf: n });
  })(d.tree, []);
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('dialog', (d) => d.accept());

  // One customer, created by a handover like in the dealership
  await page.goto(B + '/app/');
  await page.click('text=Mise en main par la concession');
  await page.fill('#f_code', 'DEMO2026'); await page.click('form button');
  await page.click('.cloud-brand >> text=Challenger');
  await page.fill('#c_last', 'Simulation'); await page.click('text=Créer le compte du client');
  await page.waitForSelector('#handbody .hstep');
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('cdb_cloud')).token);
  const DATA = await page.evaluate(async (t) => (await fetch('/api/app/data', { headers: { Authorization: 'Bearer ' + t } })).json(), token);
  const baseVars = DATA.vehicle.vars;

  // Scenarios: half drawn per diagnostic (each entry gets its share), half per end point (weight of big flowcharts)
  const trees = DATA.diagnostics.filter((d) => d.tree && !d.elim);
  const elims = DATA.diagnostics.filter((d) => d.elim);
  const all = trees.flatMap((d) => leavesOf(d).map((x) => ({ d, ...x })));
  const scenarios = [];
  for (let i = 0; i < N; i++) {
    if (i % 25 === 24 && elims.length) {
      const d = pick(elims); scenarios.push({ d, elim: pick(d.elim.causes.map((c) => c.k)) });
    } else if (i % 2) scenarios.push(pick(all));
    else { const d = pick(trees); scenarios.push({ d, ...pick(leavesOf(d)) }); }
  }

  async function setVars(vars) {
    await page.evaluate(async ({ t, v }) => {
      await fetch('/api/me/state/cdb_var', { method: 'PUT', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(v) }) });
    }, { t: token, v: vars });
    await page.reload();
    await page.waitForSelector('#device:not([hidden]) #home');
  }

  const results = [];
  let currentVars = null;
  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i], d = sc.d;
    const r = { n: i + 1, id: d.id, label: d.label, ok: false, issues: [] };
    try {
      // Vehicle variants consistent with the drawn breakdown (e.g. a gas fridge for a gas branch)
      const vars = { ...baseVars };
      (sc.path || []).forEach((p) => { if (p.vk && p.vv) vars[p.vk] = p.vv[p.a].split('|')[0]; });
      const sig = JSON.stringify(vars);
      if (sig !== currentVars) { await setVars(vars); currentVars = sig; }

      // The customer describes the problem in their own words
      await page.click('.nav [data-go="diag"]');
      await page.waitForSelector('#dsearch');
      const words = sc.path && sc.path.length && /constatez|précisez/i.test(sc.path[0].t) ? sc.path[0].o[sc.path[0].a] : d.label.replace(/\(.*?\)/g, '');
      r.query = words;
      await page.fill('#dsearch', words);
      const found = await page.$$eval('#dlist [data-s]', (bs) => bs.map((b) => b.textContent.trim()));
      r.rank = found.findIndex((t) => t.includes(d.label)) + 1;
      // Open the diagnostic (from the results, or from the full list if search missed it)
      await page.fill('#dsearch', '');
      await page.evaluate((label) => {
        const b = [...document.querySelectorAll('#dlist [data-s]')].find((x) => x.textContent.includes(label));
        b.click();
      }, d.label);

      if (sc.elim) {
        // Elimination flowchart: answer according to the true cause
        for (let step = 0; step < 30; step++) {
          if (await page.$('#diagbody .result')) break;
          const q = await page.$('#diagbody [data-ea]');
          if (q) {
            const qi = Number(await q.getAttribute('data-eq'));
            const qq = d.elim.qs[qi];
            let ans = qq.k.findIndex((o) => (Array.isArray(o) ? o.includes(sc.elim) : o && o.no ? !o.no.includes(sc.elim) : false));
            if (ans < 0) ans = qq.k.findIndex((o) => !o || (!Array.isArray(o) && !o.no));
            if (ans < 0) ans = 0;
            await page.click(`#diagbody [data-ea="${ans}"]`);
            continue;
          }
          const ec = await page.$('#diagbody [data-ec]');
          if (!ec) break;
          const k = await ec.getAttribute('data-ec');
          await page.click(`#diagbody [data-ec="${k}"][data-ey="${k === sc.elim ? 1 : 0}"]`);
        }
        const target = d.elim.causes.find((c) => c.k === sc.elim);
        const shown = await page.$eval('#diagbody .result .block p', (p) => p.textContent).catch(() => null);
        r.expected = target.r.cause; r.shown = shown;
        r.ok = norm(shown) === norm(target.r.cause);
        if (!r.ok) r.issues.push('conclusion différente de la panne simulée');
        r.path = [`(élimination) panne simulée : ${target.n}`];
      } else {
        // Answer each question as the drawn breakdown would
        const asked = [];
        for (let step = 0; step < 40; step++) {
          if (await page.$('#diagbody .result')) break;
          const qText = (await page.textContent('#diagbody h2')).trim();
          const k = sc.path.findIndex((p, j) => j >= asked.length && norm(p.t) === norm(qText));
          if (k < 0) { r.issues.push(`question inattendue : « ${qText} »`); break; }
          for (let j = asked.length; j < k; j++) asked.push({ ...sc.path[j], auto: true }); // skipped thanks to the vehicle sheet
          const want = sc.path[k].o[sc.path[k].a];
          const btns = await page.$$('#diagbody [data-a]');
          let clicked = false;
          for (const b of btns) if (norm(await b.textContent()) === norm(want)) { await b.click(); clicked = true; break; }
          if (!clicked) { r.issues.push(`réponse absente : « ${want} »`); break; }
          asked.push(sc.path[k]);
        }
        const shown = await page.$eval('#diagbody .result .block p', (p) => p.textContent).catch(() => null);
        r.expected = sc.leaf.cause; r.shown = shown;
        r.ok = shown != null && norm(shown) === norm(sc.leaf.cause);
        if (!r.ok && !r.issues.length) r.issues.push('conclusion différente de la panne simulée');
        r.path = asked.map((p) => `${p.auto ? '[auto] ' : ''}${p.t} → ${p.o[p.a]}`);
        r.leaf = sc.leaf;
        r.depth = sc.path.length;
      }

      // Every tenth run: ask the dealership for an appointment from the result screen
      if (r.ok && i % 10 === 0) {
        await page.click('#diagbody [data-act="rdv"]');
        await page.waitForSelector('#rdvbody');
        if (!(await page.$('#rmsg'))) await page.click('#rdvbody [data-m="souci"]');
        await page.click('#rsend');
        await page.waitForSelector('#rdvbody .ok', { timeout: 5000 }).catch(() => r.issues.push('demande de rendez-vous non envoyée'));
        r.rdvSent = !!(await page.$('#rdvbody .ok'));
        if (!r.rdvSent) r.ok = false;
      }
    } catch (e) {
      r.issues.push('erreur : ' + e.message.split('\n')[0]);
    }
    if (pageErrors.length) { r.issues.push('erreur JavaScript : ' + pageErrors.join(' | ')); r.ok = false; pageErrors.length = 0; }
    results.push(r);
    if ((i + 1) % 50 === 0) console.log(`${i + 1} simulations, ${results.filter((x) => x.ok).length} conformes`);
    await page.click('#back').catch(() => {});
  }
  fs.writeFileSync(SP + '/sim-results.json', JSON.stringify(results, null, 1));
  const ok = results.filter((x) => x.ok).length;
  const ranks = results.filter((x) => x.rank !== undefined);
  console.log(`FIN : ${ok}/${results.length} conclusions conformes`);
  console.log(`Recherche : 1er = ${ranks.filter((x) => x.rank === 1).length}, top 3 = ${ranks.filter((x) => x.rank >= 1 && x.rank <= 3).length}, non trouvé = ${ranks.filter((x) => x.rank === 0).length}`);
  console.log('RDV envoyés :', results.filter((x) => x.rdvSent).length, '/', results.filter((x) => x.rdvSent !== undefined).length);
  results.filter((x) => !x.ok).slice(0, 15).forEach((x) => console.log('KO', x.n, x.id, x.issues.join(' ; ')));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
