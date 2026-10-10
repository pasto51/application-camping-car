/* Compagnon de bord : liaison avec le cloud.
   - mise en main par la concession (code concession, marque, véhicule, client) ou récupération du compte ;
   - chargement des données de l'appli (catalogue, véhicule, concession) depuis le serveur ;
   - sauvegarde dans le cloud de tout ce que le client enregistre (équipements, photos, poids…) ;
   - mises à jour à distance (contenu et application). */
(function () {
  'use strict';

  var SESSION_KEY = 'cdb_cloud';
  var DATA_KEY = 'cdb_cloud_data';
  var PENDING_KEY = 'cdb_cloud_pending';
  var STATE_KEYS = ['cdb_chk', 'cdb_own', 'cdb_ueq', 'cdb_uph', 'cdb_var', 'cdb_mod', 'cdb_dim', 'cdb_wt', 'cdb_photo', 'cdb_hand', 'cdb_nick', 'cdb_dates'];
  var root = document.getElementById('cloud');
  var device = document.getElementById('device');

  // ---------- Small helpers ----------

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function readJson(k, fallback) { try { return JSON.parse(lsGet(k) || 'null') || fallback; } catch (e) { return fallback; } }

  var session = readJson(SESSION_KEY, null); // { token, customer, vehicle, dealership }

  function saveSession() {
    if (session) lsSet(SESSION_KEY, JSON.stringify(session)); else lsDel(SESSION_KEY);
  }

  function api(method, url, body) {
    var headers = {};
    if (session && session.token) headers.Authorization = 'Bearer ' + session.token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(url, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) })
      .catch(function () { var e = new Error('Pas de connexion internet'); e.offline = true; throw e; })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) { var e = new Error(data.error || ('Erreur ' + res.status)); e.status = res.status; throw e; }
          return data;
        });
      });
  }

  function toast(msg) {
    var t = document.getElementById('cloudtoast');
    if (!t) { t = document.createElement('div'); t.id = 'cloudtoast'; t.className = 'cloud-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  // ---------- Cloud save of the app's storage ----------

  var pending = readJson(PENDING_KEY, {}); // key -> value not yet saved (survives a restart offline)
  var uploaded = {}; // data URL -> stored URL, so a photo is uploaded only once
  var timer = null, saving = false, lastSaved = null;

  function substitute(key, value) {
    if (value == null) return value;
    if (key === 'cdb_photo') return uploaded[value] || value;
    if (key !== 'cdb_uph') return value;
    try {
      var o = JSON.parse(value);
      Object.keys(o).forEach(function (k) { if (uploaded[o[k]]) o[k] = uploaded[o[k]]; });
      return JSON.stringify(o);
    } catch (e) { return value; }
  }

  function remember(key, sent, stored) {
    if (key === 'cdb_photo') { if (sent && sent !== stored) uploaded[sent] = stored; return; }
    if (key !== 'cdb_uph' || !sent || !stored) return;
    try {
      var a = JSON.parse(sent), b = JSON.parse(stored);
      Object.keys(a).forEach(function (k) { if (a[k] !== b[k] && b[k]) uploaded[a[k]] = b[k]; });
    } catch (e) { /* ignore */ }
  }

  // The VIN never leaves this phone: it is kept apart (cdb_vin) and taken out of the handover checklist before saving.
  var VIN_KEY = 'cdb_vin';
  function stripVin(key, value) {
    if (key !== 'cdb_hand' || value == null) return value;
    try {
      var o = JSON.parse(value);
      if (typeof o.vin === 'string') { if (o.vin.trim()) lsSet(VIN_KEY, o.vin.trim().slice(0, 40)); else lsDel(VIN_KEY); }
      delete o.vin;
      return JSON.stringify(o);
    } catch (e) { return value; }
  }
  function withLocalVin(key, value) {
    if (key !== 'cdb_hand' || value == null) return value;
    try { var o = JSON.parse(value); o.vin = lsGet(VIN_KEY) || ''; return JSON.stringify(o); } catch (e) { return value; }
  }
  function localVin() { return lsGet(VIN_KEY) || ''; }

  function flush() {
    timer = null;
    if (saving || !session) return;
    var keys = Object.keys(pending);
    if (!keys.length) { renderAccount(); return; }
    saving = true;
    var key = keys[0], value = substitute(key, pending[key]);
    api('PUT', '/api/me/state/' + key, { value: value })
      .then(function (res) {
        remember(key, pending[key], res.value);
        if (substitute(key, pending[key]) === value) {
          delete pending[key];
          // Keep the light version (photo URLs) on the phone.
          if (res.value == null) lsDel(key); else lsSet(key, withLocalVin(key, res.value));
        }
        lsSet(PENDING_KEY, JSON.stringify(pending));
        lastSaved = new Date();
        saving = false;
        flush();
      })
      .catch(function (err) {
        saving = false;
        if (err.status === 401) return signedOut();
        if (err.status && err.status < 500) { delete pending[key]; lsSet(PENDING_KEY, JSON.stringify(pending)); toast(err.message); flush(); return; }
        renderAccount();
        timer = setTimeout(flush, 30000); // offline: retry later
      });
  }

  window.CDB_SYNC = {
    changed: function (key, value) {
      if (STATE_KEYS.indexOf(key) < 0 || !session) return;
      value = stripVin(key, value);
      pending[key] = value == null ? null : value;
      if (!lsSet(PENDING_KEY, JSON.stringify(pending))) lsDel(PENDING_KEY);
      clearTimeout(timer); timer = setTimeout(flush, 700);
      renderAccount();
    },
  };
  window.addEventListener('online', function () { flush(); });

  // Server state replaces the phone's copy, except changes still waiting to be saved.
  function applyState(state) {
    STATE_KEYS.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(pending, k)) {
        if (pending[k] == null) lsDel(k); else lsSet(k, withLocalVin(k, pending[k]));
        return;
      }
      if (state && state[k] != null) lsSet(k, withLocalVin(k, state[k])); else lsDel(k);
    });
  }

  // ---------- Dealership-only actions called by the app ----------

  function askDealerCode(title, text) {
    return new Promise(function (resolve) {
      var m = document.createElement('div');
      m.className = 'cloud-modal';
      m.innerHTML = '<form class="card"><p class="eyebrow">Réservé à la concession</p><h3>' + esc(title) + '</h3><p class="sub">' + esc(text) + '</p>' +
        '<input class="search code" name="code" required autocomplete="off" autocapitalize="characters" placeholder="Code concession">' +
        '<div class="btns"><button type="button" class="btn alt" data-x>Annuler</button><button class="btn">Valider</button></div></form>';
      document.body.appendChild(m);
      var input = m.querySelector('input');
      setTimeout(function () { input.focus(); }, 50);
      function close(v) { m.remove(); resolve(v); }
      m.querySelector('[data-x]').onclick = function () { close(null); };
      m.querySelector('form').onsubmit = function (e) { e.preventDefault(); close(input.value.trim()); };
    });
  }

  // ---------- Usage statistics (anonymous: searches, problems, advice, store requests, equipment looked at) ----------

  var events = [], lastSearch = null, searchTimer = null;
  function sendEvents(leaving) {
    if (lastSearch) { events.push(lastSearch); lastSearch = null; clearTimeout(searchTimer); }
    if (!events.length || !(session && session.token)) return;
    var batch = events.splice(0, 50);
    try {
      fetch('/api/me/events', { method: 'POST', keepalive: !!leaving, headers: { Authorization: 'Bearer ' + session.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ events: batch }) }).catch(function () {});
    } catch (e) { /* statistics are never worth an error */ }
  }
  // A search is kept once the customer stops typing (only the last words count, not every letter).
  window.CDB_TRACK = function (kind, data) {
    data = data || {}; data.kind = kind;
    if (kind === 'search') {
      lastSearch = data; clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { if (lastSearch) { events.push(lastSearch); lastSearch = null; } }, 2500);
      return;
    }
    if (lastSearch) { events.push(lastSearch); lastSearch = null; clearTimeout(searchTimer); }
    events.push(data);
    if (events.length >= 20) sendEvents(false);
  };
  setInterval(function () { sendEvents(false); }, 20000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sendEvents(true); });

  window.CDB_CLOUD = {
    accessCode: function (info) {
      return askDealerCode('Valider la mise en main', 'Saisissez votre code concession pour générer le code d’accès du client.').then(function (code) {
        if (!code) return null;
        return api('POST', '/api/me/access-code', { dealershipCode: code, firstName: info.firstName });
      });
    },
    sendRequest: function (body) {
      // Follow-up of a closed request: its title says so, for the dealership.
      if (followUp && body.title === 'Un souci sur mon véhicule' && /^Suite de ma demande/.test(body.message || '')) body.title = ('Suite : ' + followUp).slice(0, 150);
      followUp = null;
      return api('POST', '/api/me/requests', body).then(function (r) { openReq[r.id] = true; loadRequests(); return r; });
    },
  };

  function addYears(date, years) { var d = new Date(date + 'T12:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + years); return d.toISOString().slice(0, 10); }

  // ---------- Store request: spare part or replacement ----------

  function vehicleYear() {
    var c = (session && session.customer) || {};
    var m = /\b(19|20)\d{2}\b/.exec((session && session.vehicle && session.vehicle.modelYear) || '');
    return c.vehicleYear || (m ? m[0] : '');
  }

  // need: « accessoire » when the request comes from a comfort problem (a product to buy): it goes to the store.
  function partRequest(id, product, need) {
    var info = (id && window.CDB_PARTINFO && window.CDB_PARTINFO(id)) || { id: null, name: '', userPhoto: null, genericPhoto: null, model: '', ref: '' };
    var c = (session && session.customer) || {}, vin = localVin(), newPhoto = null;
    // The vehicle's photo is the same for every customer of this model: it is only sent when the customer has none of their own.
    var vt = (DATA && DATA.vehicle && DATA.vehicle.type) || '';
    var kind = vt === 'van' || vt === 'fourgon' ? 'fourgon' : vt ? 'camping-car' : 'véhicule';
    function photoHtml() {
      var mine = newPhoto || info.userPhoto;
      return (mine
        ? '<p class="eyebrow">Photo client</p><div class="cloud-part-photo"><img src="' + esc(mine) + '" alt=""></div>'
        : (info.genericPhoto
          ? '<p class="eyebrow">Photo générique</p><div class="cloud-part-photo generic"><img src="' + esc(info.genericPhoto) + '" alt=""></div>' +
            '<p class="cloud-generic-note">Photo générique de ce modèle de ' + kind + ' : joignez une photo de votre produit s’il diffère.</p>'
          : '<div class="cloud-part-photo"><span>📷 Pas encore de photo</span></div>')) +
        '<label class="cloud-photo-btn btn alt">' + (mine ? 'Changer la photo client' : '📷 Ajouter une photo client') + '<input type="file" accept="image/*" capture="environment" hidden data-photo></label>';
    }
    var m = document.createElement('div');
    m.className = 'cloud-modal cloud-sheet';
    m.innerHTML = '<form class="card" novalidate><p class="eyebrow">Demande au magasin</p><h3>' + esc(info.name || 'Pièce ou équipement') + '</h3>' +
      '<div class="cloud-photos">' + photoHtml() + '</div>' +
      '<p class="eyebrow">Il me faut</p><div class="cloud-need">' +
      [['piece', 'Une pièce détachée'], ['remplacement', 'Remplacer l’équipement'], ['accessoire', 'Ajouter un accessoire, ou un consommable']].map(function (o, i) {
        return '<label><input type="radio" name="need" value="' + o[0] + '"' + ((need ? o[0] === need : i === 0) ? ' checked' : '') + '> ' + o[1] + '</label>';
      }).join('') + '</div>' +
      (info.name ? '' : '<label class="eyebrow">Équipement concerné</label><select class="search" data-eq><option value="">— Choisir dans mes équipements —</option>' + myEquipment().map(function (q) { return '<option value="' + esc(q.id) + '">' + esc(q.name) + '</option>'; }).join('') + '<option value="__other">Autre (à préciser)</option></select>' +
        '<input class="search" name="equipmentName" maxlength="120" placeholder="ex : store, pompe à eau…" hidden>') +
      '<label class="eyebrow">Pièce ou produit (si vous le savez)</label><input class="search" name="product" maxlength="200" value="' + esc(product || '') + '" placeholder="ex : joint, bouchon, thermostat…">' +
      '<label class="eyebrow">Marque et modèle</label><input class="search" name="model" maxlength="80" value="' + esc(info.model) + '" placeholder="Sur l’étiquette de l’appareil">' +
      '<label class="eyebrow">Référence ou numéro de série</label><input class="search" name="ref" maxlength="80" value="' + esc(info.ref) + '" placeholder="Sur l’étiquette ou la plaque">' +
      '<label class="eyebrow">Numéro de cellule</label><input class="search" name="cellNumber" maxlength="40" value="' + esc(c.cellNumber || '') + '" placeholder="Plaque du constructeur de la cellule">' +
      '<small class="sub">Sur la plaque d’identification de la cellule (souvent près de la porte d’entrée ou dans un placard). Votre conseiller peut aussi vous le donner.</small>' +
      '<label class="eyebrow">Année du véhicule</label><input class="search" name="vehicleYear" maxlength="10" inputmode="numeric" value="' + esc(vehicleYear()) + '">' +
      '<label class="eyebrow">VIN (numéro de série du véhicule)</label><input class="search" name="vin" maxlength="40" autocapitalize="characters" autocomplete="off" value="' + esc(vin) + '" placeholder="Carte grise, case E">' +
      '<label class="cloud-check"><input type="checkbox" name="sendVin"' + (vin ? ' checked' : '') + '> Joindre mon VIN à l’e-mail envoyé au magasin</label>' +
      '<small class="sub">Votre VIN reste sur ce téléphone : il n’est jamais enregistré sur nos serveurs, seulement transmis au magasin dans l’e-mail de cette demande si vous cochez la case.</small>' +
      '<label class="eyebrow">Message</label><textarea class="search" name="message" rows="3" maxlength="4000" placeholder="Ce qui ne va pas, la quantité…"></textarea>' +
      '<div class="btns"><button type="button" class="btn alt" data-x>Annuler</button><button class="btn">Envoyer au magasin</button></div></form>';
    document.body.appendChild(m);
    document.body.style.overflow = 'hidden';
    function close() { m.remove(); document.body.style.overflow = ''; }
    m.querySelector('[data-x]').onclick = close;
    var eqSel = m.querySelector('[data-eq]');
    if (eqSel) eqSel.onchange = function () {
      var other = eqSel.value === '__other', picked = !other && eqSel.value && window.CDB_PARTINFO && window.CDB_PARTINFO(eqSel.value);
      m.querySelector('[name=equipmentName]').hidden = !other;
      info = picked || { id: null, name: '', userPhoto: null, genericPhoto: null, model: '', ref: '' };
      m.querySelector('h3').textContent = info.name || 'Pièce ou équipement';
      m.querySelector('[name=model]').value = info.model; m.querySelector('[name=ref]').value = info.ref;
      m.querySelector('.cloud-photos').innerHTML = photoHtml();
    };
    m.querySelector('.cloud-photos').onchange = function (e) {
      if (!e.target.matches('[data-photo]')) return;
      var f = e.target.files && e.target.files[0]; if (!f) return;
      compress(f).then(function (url) {
        newPhoto = url;
        m.querySelector('.cloud-photos').innerHTML = photoHtml();
      }).catch(function () { toast('Photo illisible'); });
    };
    m.querySelector('form').onsubmit = function (e) {
      e.preventDefault();
      var f = e.target, val = function (n) { return f.elements[n] ? f.elements[n].value.trim() : ''; };
      var body = {
        need: (f.querySelector('[name=need]:checked') || {}).value,
        equipmentId: info.id, equipmentName: info.name || val('equipmentName'), product: val('product'),
        model: val('model'), ref: val('ref'), cellNumber: val('cellNumber'), vehicleYear: val('vehicleYear'), message: val('message'),
        photo: newPhoto || info.userPhoto || info.genericPhoto || null,
        photoKind: newPhoto || info.userPhoto ? 'client' : 'generique',
        vin: f.elements.sendVin.checked ? val('vin') : '',
      };
      if (!body.equipmentName && !body.product) { toast('Indiquez l’équipement ou la pièce'); return; }
      // What the customer typed is kept for next time: brand and reference on the equipment, VIN on this phone only.
      if (info.id && window.CDB_SETMOD) window.CDB_SETMOD(info.id, body.model, body.ref);
      if (val('vin')) lsSet(VIN_KEY, val('vin')); else lsDel(VIN_KEY);
      var btn = f.querySelector('button:not([type=button])'); btn.disabled = true;
      api('POST', '/api/me/parts', body).then(function (r) {
        if (session.customer) { session.customer.cellNumber = body.cellNumber || session.customer.cellNumber; session.customer.vehicleYear = body.vehicleYear || session.customer.vehicleYear; saveSession(); }
        openReq[r.id] = true; loadRequests();
        f.innerHTML = '<p class="eyebrow">Demande au magasin</p><h3>Demande envoyée ✓</h3><p class="sub">' + esc((DATA && DATA.dealer && DATA.dealer.name) || 'Le magasin') + ' a reçu votre demande avec la photo et les références' + (r.service === 'sav' ? ' : elle est transmise au <b>SAV</b>, votre véhicule étant sous garantie.' : ' : elle est transmise au <b>magasin</b>.') + ' La réponse arrivera dans « Mes demandes ».</p>' +
          '<div class="btns"><button type="button" class="btn alt" data-x>Fermer</button><button type="button" class="btn" data-see>Voir mes demandes</button></div>';
        f.querySelector('[data-x]').onclick = close;
        f.querySelector('[data-see]').onclick = function () { close(); var t = document.querySelector('.tile[data-go="rdv"]'); if (t) t.click(); };
      }).catch(function (err) { btn.disabled = false; toast(err.message); });
    };
  }

  // Equipment ticked by the customer (for « Demander une pièce » from the home screen).
  function myEquipment() {
    var own = readJson('cdb_own', null);
    if (!own) { own = {}; ((DATA && DATA.vehicle && DATA.vehicle.equipment) || []).forEach(function (id) { own[id] = true; }); }
    return ((DATA && DATA.equipment) || []).filter(function (q) { return own[q.id] && !(DATA.config.HIDDEN_EQ || {})[q.id]; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
  }

  // Phone photo → light JPEG data URL.
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }

  window.CDB_CLOUD.partRequest = partRequest;
  window.CDB_CLOUD.compress = compress;
  // « Partager mon astuce »: sent to the dealership, published once read.
  window.CDB_CLOUD.shareTip = function (data) { return api('POST', '/api/me/tips', data); };

  // ---------- Onboarding (before the app) ----------

  var flow = null; // { step, code, dealership, catalog, brandId, vehicleId }

  function shell(title, back, body) {
    return '<div class="device cloud-device"><header class="top">' +
      (back ? '<button class="back" data-a="' + back + '" aria-label="Retour">←</button>' : '') +
      '<h1>' + esc(title) + '</h1></header><main class="main"><section class="screen">' + body + '</section></main></div>';
  }

  function steps(current) {
    var names = [['code', 'Concession'], ['brand', 'Marque'], ['vehicle', 'Véhicule'], ['client', 'Client']];
    var idx = names.map(function (n) { return n[0]; }).indexOf(current);
    return '<ol class="cloud-steps">' + names.map(function (n, i) {
      return '<li class="' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '">' + n[1] + '</li>';
    }).join('') + '</ol>';
  }

  function renderWelcome() {
    root.innerHTML = shell('Compagnon de bord', null,
      '<div class="hero cloud-hero"><p class="eyebrow">Bienvenue à bord</p><h2 class="hero-name">Compagnon <span>de bord</span></h2>' +
      '<p class="sub">Votre camping-car expliqué, vos gestes du quotidien et l’aide en cas de souci, toujours avec vous.</p></div>' +
      '<button class="btn" data-a="start">Mise en main par la concession</button>' +
      '<button class="btn alt" data-a="restore">J’ai déjà un code d’accès</button>' +
      '<p class="sub">La mise en main se fait avec votre concessionnaire : il saisit son code concession puis choisit votre véhicule.</p>');
  }

  function renderRestore() {
    root.innerHTML = shell('Retrouver mes données', 'welcome',
      '<form class="card" data-f="restore"><p class="sub">Saisissez votre nom et le code d’accès remis par votre concession lors de la mise en main.</p>' +
      '<label class="eyebrow" for="r_name">Nom</label><input class="search" id="r_name" name="lastName" required autocomplete="family-name">' +
      '<label class="eyebrow" for="r_code">Code d’accès</label><input class="search code" id="r_code" name="code" required autocomplete="off" autocapitalize="characters" placeholder="V114-XXXX-XXXX">' +
      '<button class="btn">Retrouver mes données</button></form>' +
      '<p class="sub">Code perdu ? Votre concession peut vous en donner un nouveau.</p>');
  }

  function renderFlow() {
    var f = flow, body = steps(f.step);
    if (f.dealership) body += '<p class="tip">Concession : <b>' + esc(f.dealership.name) + '</b>' + (f.dealership.city ? ' · ' + esc(f.dealership.city) : '') + '</p>';
    if (f.step === 'code') {
      body += '<form class="card" data-f="code"><p class="sub">Étape réservée à la concession.</p>' +
        '<label class="eyebrow" for="f_code">Code concession</label><input class="search code" id="f_code" name="code" required autocomplete="off" autocapitalize="characters" value="' + esc(f.code || '') + '">' +
        '<button class="btn">Valider</button></form>';
    }
    if (f.step === 'brand') {
      var brands = f.catalog.brands.filter(function (b) { return f.catalog.vehicles.some(function (v) { return v.brandId === b.id; }); });
      body += '<p class="eyebrow">Choisissez la marque</p><div class="cloud-grid">' + brands.map(function (b) {
        return '<button class="opt cloud-brand" data-a="brand" data-id="' + b.id + '" style="--brand:' + esc(b.color || '#0a7c82') + '">' +
          (b.logoUrl ? '<img src="' + esc(b.logoUrl) + '" alt="">' : '<span class="cloud-initial">' + esc(b.name.charAt(0)) + '</span>') +
          '<strong>' + esc(b.name) + '</strong></button>';
      }).join('') + '</div>';
    }
    if (f.step === 'vehicle') {
      var brand = f.catalog.brands.filter(function (b) { return b.id === f.brandId; })[0] || {};
      body += '<p class="eyebrow">Véhicules ' + esc(brand.name) + '</p><div class="opts">' + f.catalog.vehicles.filter(function (v) { return v.brandId === f.brandId; }).map(function (v) {
        return '<button class="opt cloud-vehicle" data-a="vehicle" data-id="' + v.id + '">' +
          (v.photoUrl ? '<img src="' + esc(v.photoUrl) + '" alt="">' : '<span class="cloud-ph">🚐</span>') +
          '<span><strong>' + esc(v.name) + '</strong>' + (v.modelYear ? '<br><span class="sub">' + esc(v.modelYear) + '</span>' : '') + '</span></button>';
      }).join('') + '</div>';
    }
    if (f.step === 'client') {
      var v = f.catalog.vehicles.filter(function (x) { return x.id === f.vehicleId; })[0] || {};
      var today = new Date().toISOString().slice(0, 10);
      body += '<p class="tip">Véhicule : <b>' + esc(v.name) + '</b> ' + esc(v.modelYear || '') + '</p>' +
        '<form class="card" data-f="client">' +
        '<label class="eyebrow" for="c_first">Prénom</label><input class="search" id="c_first" name="firstName" autocomplete="off">' +
        '<label class="eyebrow" for="c_last">Nom *</label><input class="search" id="c_last" name="lastName" required autocomplete="off">' +
        '<label class="eyebrow" for="c_tel">Téléphone</label><input class="search" id="c_tel" name="phone" type="tel" autocomplete="off">' +
        '<label class="eyebrow" for="c_mail">E-mail</label><input class="search" id="c_mail" name="email" type="email" autocomplete="off">' +
        ((f.dealership && f.dealership.salespeople && f.dealership.salespeople.length)
          ? '<label class="eyebrow" for="c_sales">Commercial qui a vendu le véhicule</label><select class="search" id="c_sales" name="salespersonId"><option value="">— Choisir —</option>' +
            f.dealership.salespeople.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select>'
          : '') +
        '<label class="eyebrow" for="c_wend">Fin de garantie</label><input class="search" id="c_wend" name="warrantyEnd" type="date" value="' + addYears(today, (f.dealership && f.dealership.warrantyYears) || 2) + '"><small class="sub">Garantie habituelle de la concession à partir d’aujourd’hui : modifiez-la si besoin.</small>' +
        '<label class="eyebrow" for="c_wext">Extension de garantie jusqu’au</label><input class="search" id="c_wext" name="warrantyExtEnd" type="date"><small class="sub">Laissez vide si le client n’a pas pris d’extension. Pendant la garantie, ses demandes de pièces vont au SAV.</small>' +
        '<label class="eyebrow" for="c_vin">Numéro de série (VIN)</label><input class="search" id="c_vin" name="vin" autocapitalize="characters" autocomplete="off" placeholder="17 caractères"><small class="sub">Gardé uniquement sur ce téléphone, jamais sur nos serveurs.</small>' +
        '<label class="eyebrow" for="c_date">Date de mise en main</label><input class="search" id="c_date" name="handoverDate" type="date" value="' + today + '">' +
        '<button class="btn">Créer le compte du client</button></form>' +
        '<p class="sub">Ensuite, l’appli ouvre l’Espace concession : cochez les équipements et vérifiez chaque point avec le client, puis générez son code d’accès.</p>';
    }
    var back = f.step === 'code' ? 'welcome' : 'flowback';
    root.innerHTML = shell('Mise en main', back, body);
    var first = root.querySelector('input'); if (first && f.step === 'code') first.focus();
  }

  function busy(form, on) {
    var b = form && form.querySelector('button:not([type="button"])');
    if (b) b.disabled = on;
  }

  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]'); if (!el) return;
    var a = el.dataset.a;
    if (a === 'welcome') { flow = null; renderWelcome(); }
    if (a === 'restore') renderRestore();
    if (a === 'start') { flow = { step: 'code' }; renderFlow(); }
    if (a === 'flowback') { flow.step = { brand: 'code', vehicle: 'brand', client: 'vehicle' }[flow.step]; renderFlow(); }
    if (a === 'brand') {
      flow.brandId = Number(el.dataset.id);
      var list = flow.catalog.vehicles.filter(function (v) { return v.brandId === flow.brandId; });
      if (list.length === 1) { flow.vehicleId = list[0].id; flow.step = 'client'; } else flow.step = 'vehicle';
      renderFlow();
    }
    if (a === 'vehicle') { flow.vehicleId = Number(el.dataset.id); flow.step = 'client'; renderFlow(); }
    window.scrollTo(0, 0);
  });

  root.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-f]'); if (!form) return;
    e.preventDefault();
    var data = {};
    Array.prototype.forEach.call(form.elements, function (x) { if (x.name) data[x.name] = x.value.trim(); });
    busy(form, true);
    var done = function () { busy(form, false); };
    if (form.dataset.f === 'code') {
      Promise.all([api('GET', '/api/dealerships/code/' + encodeURIComponent(data.code)), api('GET', '/api/catalog')])
        .then(function (r) {
          flow.code = data.code; flow.dealership = r[0]; flow.catalog = r[1];
          var brands = r[1].brands.filter(function (b) { return r[1].vehicles.some(function (v) { return v.brandId === b.id; }); });
          if (!brands.length) throw new Error('Aucun véhicule n’est encore proposé : ajoutez-en dans le back-office.');
          flow.step = 'brand'; renderFlow();
        })
        .catch(function (err) { done(); toast(err.message); });
    }
    if (form.dataset.f === 'client') {
      var customer = {}; Object.keys(data).forEach(function (k) { if (k !== 'vin' && k !== 'salespersonId') customer[k] = data[k]; }); // the VIN stays on the phone
      api('POST', '/api/handover', { dealershipCode: flow.code, vehicleId: flow.vehicleId, salespersonId: data.salespersonId || null, customer: customer })
        .then(function (res) {
          startSession(res);
          // The handover checklist starts with the customer's name and VIN.
          var hand = { steps: {}, name: data.firstName || '', vin: data.vin || '', code: null, date: null };
          lsSet('cdb_hand', JSON.stringify(hand));
          window.CDB_SYNC.changed('cdb_hand', JSON.stringify(hand));
          return boot('hand');
        })
        .catch(function (err) { done(); toast(err.message); });
    }
    if (form.dataset.f === 'restore') {
      api('POST', '/api/restore', data)
        .then(function (res) { startSession(res); toast('Données retrouvées'); return boot(); })
        .catch(function (err) { done(); toast(err.message); });
    }
  });

  function clearLocal() {
    STATE_KEYS.concat([DATA_KEY, PENDING_KEY, VIN_KEY]).forEach(lsDel);
    pending = {};
  }

  function startSession(res) {
    clearLocal();
    session = { token: res.token, customer: res.customer, vehicle: res.vehicle, dealership: res.dealership, warranty: res.warranty || null };
    saveSession();
    applyState(res.state);
  }

  function signedOut() {
    session = null; saveSession(); clearLocal();
    alert('Votre session a expiré. Retrouvez vos données avec votre nom et votre code d’accès.');
    location.reload();
  }

  // ---------- Start of the app ----------

  var DATA = null;

  function boot(openScreen) {
    root.innerHTML = '<div class="cloud-loading">Chargement de votre camping-car…</div>';
    var online = Promise.all([api('GET', '/api/app/data'), api('GET', '/api/me')]).then(function (r) {
      DATA = r[0];
      lsSet(DATA_KEY, JSON.stringify(DATA));
      session.customer = r[1].customer; session.vehicle = r[1].vehicle; session.dealership = r[1].dealership; session.warranty = r[1].warranty || null; saveSession();
      applyState(r[1].state);
    });
    return online
      .catch(function (err) {
        if (err.status === 401) { signedOut(); throw err; }
        DATA = readJson(DATA_KEY, null); // offline: last copy kept on the phone
        if (!DATA) throw err;
        toast('Hors connexion : données enregistrées sur le téléphone');
      })
      .then(function () {
        root.innerHTML = '';
        device.hidden = false;
        window.startCompagnon(DATA);
        renderNick();
        addAccountCard();
        addHelp();
        syncPush().then(drawPushCard);
        loadRequests();
        setInterval(function () { if (document.visibilityState === 'visible') loadRequests(); }, 60000);
        flush();
        if (openScreen) { var b = document.querySelector('[data-go="' + openScreen + '"]'); if (b) b.click(); }
        openNotifFromHash();
        if (location.hash === '#demandes') { history.replaceState(null, '', location.pathname); var t = document.querySelector('.tile[data-go="rdv"]'); if (t) t.click(); }
      })
      .catch(function (err) {
        if (err.status === 401) return;
        root.innerHTML = shell('Compagnon de bord', null, '<div class="safety">' + esc(err.message) + '</div><button class="btn" onclick="location.reload()">Réessayer</button>');
      });
  }

  // ---------- Added to the home screen: workshop requests and account ----------

  var requests = [];
  var STATUS = { nouveau: 'Envoyée', en_cours: 'En cours', resolu: 'Clôturée' };

  var SEEN_KEY = 'cdb_cloud_seen'; // last dealership message read, per request
  var seen = readJson(SEEN_KEY, {});
  var openReq = {};
  var drafts = {}; // request id -> message being typed
  var followUp = null; // title of the closed request a new one follows

  function loadRequests() {
    if (!session) return;
    api('GET', '/api/me/requests').then(function (r) {
      requests = r;
      // Link to one request (#demande-12, from an e-mail or a notification): open it and show it.
      var want = (location.hash.match(/^#demande-(\d+)/) || [])[1];
      if (want && requests.some(function (x) { return x.id === Number(want); })) {
        history.replaceState(null, '', location.pathname);
        renderRequests();
        showRequest(Number(want));
        return;
      }
      renderRequests();
    }).catch(function () { /* offline */ });
  }

  function dateOf(t) { return new Date(String(t).replace(' ', 'T') + 'Z'); }
  function fmt(t) { var d = dateOf(t); return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  function lastDealerMsg(r) { var m = (r.messages || []).filter(function (x) { return x.author === 'concession'; }); return m.length ? m[m.length - 1].id : 0; }
  function unread(r) { return lastDealerMsg(r) > (seen[r.id] || 0); }

  function card(r, dealer) {
    var open = !!openReq[r.id], msgs = r.messages || [], last = msgs[msgs.length - 1];
    var head = '<button type="button" class="cloud-req-head" data-req="' + r.id + '" aria-expanded="' + open + '"><span><b>' + esc(r.title) + '</b><br><span class="sub">' + esc(dateOf(r.createdAt).toLocaleDateString('fr-FR')) + ' · ' + (msgs.length + 1) + ' message' + (msgs.length ? 's' : '') + '</span></span>' +
      '<span class="cloud-status ' + (unread(r) ? 'new' : esc(r.status)) + '">' + (unread(r) ? 'Nouvelle réponse' : esc(STATUS[r.status] || r.status)) + '</span></button>';
    if (!open) {
      return '<div class="card cloud-req' + (unread(r) ? ' unread' : '') + '">' + head +
        (last ? '<p class="sub cloud-last">' + esc(last.author === 'concession' ? dealer + ' : ' : 'Vous : ') + esc(last.body.slice(0, 110)) + (last.body.length > 110 ? '…' : '') + '</p>' : '<p class="sub cloud-last">En attente de la réponse de ' + esc(dealer) + '.</p>') + '</div>';
    }
    var thread = '<div class="cloud-msg client">' + (r.part && r.part.photoUrl ? '<img class="cloud-msg-photo" src="' + esc(r.part.photoUrl) + '" alt="">' : '') + '<p>' + esc(r.description || r.title).replace(/\n/g, '<br>') + '</p><small>Vous · ' + esc(fmt(r.createdAt)) + '</small></div>' +
      msgs.map(function (m) {
        return '<div class="cloud-msg ' + esc(m.author) + '"><p>' + esc(m.body).replace(/\n/g, '<br>') + '</p><small>' + (m.author === 'concession' ? esc(dealer) : 'Vous') + ' · ' + esc(fmt(m.createdAt)) + '</small></div>';
      }).join('');
    // Closed by the dealership: read-only; a follow-up starts a new request that refers to this one.
    var end = r.status === 'resolu'
      ? '<div class="cloud-closed"><p>🔒 Demande clôturée par ' + esc(dealer) + (r.closedAt ? ' le ' + esc(dateOf(r.closedAt).toLocaleDateString('fr-FR')) : '') + '.</p>' +
        '<button type="button" class="btn alt" data-followup="' + r.id + '">Nouvelle demande à ce sujet</button></div>'
      : '<form class="cloud-reply" data-reply="' + r.id + '"><textarea class="search" name="body" rows="2" required placeholder="Votre message à ' + esc(dealer) + '"></textarea><button class="btn">Envoyer</button></form>';
    return '<div class="card cloud-req open' + (r.status === 'resolu' ? ' closed' : '') + '">' + head + '<div class="cloud-thread">' + thread + '</div>' + end + '</div>';
  }

  // "Mes demandes" lives in the workshop screen; the home screen only says when the dealership has answered.
  function renderRequests() {
    var dealer = (DATA && DATA.dealer && DATA.dealer.name) || 'La concession';
    var news = requests.filter(unread), n = news.length;
    var el = document.getElementById('cloudreq');
    if (el) {
      // Keep what the customer is typing when the list refreshes.
      Array.prototype.forEach.call(el.querySelectorAll('[data-reply] textarea'), function (t) { drafts[t.form.dataset.reply] = t.value; });
      var focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-reply]');
      var active = requests.filter(function (r) { return r.status !== 'resolu' || unread(r); });
      var done = requests.filter(function (r) { return active.indexOf(r) < 0; });
      active.sort(function (x, y) { return (unread(y) ? 1 : 0) - (unread(x) ? 1 : 0); });
      el.hidden = !requests.length;
      el.innerHTML = '<p class="eyebrow">Mes demandes' + (n ? ' <span class="cloud-new">' + n + ' nouvelle' + (n > 1 ? 's' : '') + ' réponse' + (n > 1 ? 's' : '') + '</span>' : '') + '</p>' +
        active.map(function (r) { return card(r, dealer); }).join('') +
        (done.length ? '<details class="cloud-done"' + (done.some(function (r) { return openReq[r.id]; }) ? ' open' : '') + '><summary>Demandes clôturées (' + done.length + ')</summary>' + done.map(function (r) { return card(r, dealer); }).join('') + '</details>' : '');
      Array.prototype.forEach.call(el.querySelectorAll('[data-reply] textarea'), function (t) {
        var id = t.form.dataset.reply;
        if (drafts[id]) t.value = drafts[id];
        if (focused && focused.dataset.reply === id) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
      });
    }
    // Opening a request marks the dealership's answers as read.
    requests.forEach(function (r) { if (openReq[r.id] && unread(r)) { seen[r.id] = lastDealerMsg(r); lsSet(SEEN_KEY, JSON.stringify(seen)); } });
    n = requests.filter(unread).length;
    var home = document.getElementById('cloudhome');
    if (home) {
      home.hidden = !n;
      home.innerHTML = n ? '<button type="button" class="cloud-home-new" data-open-rdv="' + requests.filter(unread)[0].id + '"><span class="cloud-home-ic">💬</span><span><b>' + esc(dealer) + ' vous a répondu</b><br><span class="sub">' + esc(requests.filter(unread)[0].title) + (n > 1 ? ' et ' + (n - 1) + ' autre' + (n > 2 ? 's' : '') : '') + '</span></span><span class="cloud-home-go">Voir</span></button>' : '';
    }
    var tile = document.querySelector('.tile[data-go="rdv"]'), badge = tile && tile.querySelector('.cloud-dot');
    if (tile && !badge && n) { badge = document.createElement('span'); badge.className = 'cloud-dot'; tile.appendChild(badge); }
    if (badge) { badge.hidden = !n; badge.textContent = n; }
  }
  window.CDB_CLOUD.rdvRendered = renderRequests;

  // Opens the workshop screen on one request (home banner, e-mail, notification).
  function showRequest(id) {
    openReq[id] = true;
    var go = document.querySelector('.tile[data-go="rdv"]'); if (go) go.click();
    setTimeout(function () { var el = document.querySelector('[data-req="' + id + '"]'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 250);
  }
  // "Nouvelle demande à ce sujet": the new-request form below, motif "J'ai un souci", message referring to the old one.
  document.addEventListener('click', function (e) {
    var f = e.target.closest('[data-followup]'); if (!f) return;
    var r = requests.filter(function (x) { return x.id === Number(f.dataset.followup); })[0]; if (!r) return;
    followUp = r.title;
    var m = document.querySelector('#rdvbody [data-m="souci"]'); if (m) m.click();
    setTimeout(function () {
      var t = document.getElementById('rmsg'); if (!t) return;
      t.value = 'Suite de ma demande « ' + r.title + ' » du ' + dateOf(r.createdAt).toLocaleDateString('fr-FR') + ' :\n\n';
      t.dispatchEvent(new Event('input', { bubbles: true }));
      t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.focus(); t.setSelectionRange(t.value.length, t.value.length);
    }, 50);
  });
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open-rdv]'); if (!o) return;
    e.preventDefault(); showRequest(Number(o.dataset.openRdv));
  });

  document.addEventListener('click', function (e) {
    var h = e.target.closest('[data-req]'); if (!h) return;
    var id = Number(h.dataset.req); openReq[id] = !openReq[id]; renderRequests();
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-reply]'); if (!f) return;
    e.preventDefault();
    var id = Number(f.dataset.reply), body = f.elements.body.value.trim(); if (!body) return;
    f.querySelector('button').disabled = true;
    api('POST', '/api/me/requests/' + id + '/messages', { body: body }).then(function (r) {
      delete drafts[id]; f.elements.body.value = '';
      requests = requests.map(function (x) { return x.id === id ? r : x; }); renderRequests(); toast('Message envoyé à votre concession');
    }).catch(function (err) { f.querySelector('button').disabled = false; toast(err.message); });
  });

  // ---------- Push notifications (answers from the dealership) ----------

  function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  function keyBytes(b64) { var s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

  function pushState() {
    if (!pushSupported()) return Promise.resolve(/iPhone|iPad/.test(navigator.userAgent) && !isStandalone() ? 'ios-install' : 'unsupported');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) { return sub ? 'on' : 'off'; });
  }

  function sameKey(sub, key) {
    var k = sub.options && sub.options.applicationServerKey;
    if (!k) return true; // older browsers do not tell: keep the subscription
    var a = new Uint8Array(k), b = keyBytes(key);
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Gives the server this phone's subscription (made again if it was made for another server key).
  function subscribePush() {
    return Promise.all([navigator.serviceWorker.ready, api('GET', '/api/push/key')]).then(function (r) {
      var reg = r[0], key = r[1].publicKey;
      return reg.pushManager.getSubscription().then(function (sub) {
        if (sub && sameKey(sub, key)) return sub;
        return (sub ? sub.unsubscribe() : Promise.resolve()).then(function () {
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
        });
      });
    }).then(function (sub) {
      return api('POST', '/api/me/push', { subscription: sub.toJSON() });
    });
  }

  function enablePush() {
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('Notifications refusées : autorisez-les dans les réglages du téléphone.');
      return subscribePush();
    }).then(function (r) { drawPushCard(); return r; });
  }

  // At every start: a phone that already allows notifications is (re)registered on the server,
  // even if the permission was given outside the app's button (installation, phone settings…).
  function syncPush() {
    if (!pushSupported() || Notification.permission !== 'granted') return Promise.resolve();
    return subscribePush().catch(function () { /* offline: next start */ });
  }

  // On the home screen, as long as this phone does not receive the messages: a clear invitation.
  var PUSH_LATER_KEY = 'cdb_push_later';
  function drawPushCard() {
    var home = document.getElementById('home'); if (!home) return;
    pushState().then(function (st) {
      var card = document.getElementById('cloudpush');
      var later = Number(lsGet(PUSH_LATER_KEY) || 0) > Date.now();
      if ((st !== 'off' && st !== 'ios-install') || later) { if (card) card.remove(); return; }
      if (!card) {
        card = document.createElement('div'); card.id = 'cloudpush'; card.className = 'card cloud-pushcard';
        var top = document.getElementById('cloudhome');
        home.insertBefore(card, top ? top.nextSibling : home.firstChild);
        card.addEventListener('click', function (e) {
          var b = e.target.closest('[data-pc]'); if (!b) return;
          if (b.dataset.pc === 'later') { lsSet(PUSH_LATER_KEY, String(Date.now() + 7 * 864e5)); card.remove(); return; }
          b.disabled = true;
          enablePush().then(function () { toast('C’est fait : ce téléphone recevra les messages de votre concession'); })
            .catch(function (err) { b.disabled = false; toast(err.message); drawPushCard(); });
        });
      }
      card.innerHTML = '<h3>🔔 Recevoir les messages de votre concession</h3>' +
        (st === 'ios-install'
          ? '<p class="sub">Sur iPhone, il faut d’abord installer l’appli : touchez <b>Partager</b> (le carré avec une flèche) puis « <b>Sur l’écran d’accueil</b> ». Ouvrez ensuite l’appli depuis sa nouvelle icône.</p>'
          : '<p class="sub">Réponses à vos demandes, rappels d’entretien, informations de la concession.</p><button class="btn" type="button" data-pc="on">Activer sur ce téléphone</button>') +
        '<button class="lnk" type="button" data-pc="later">Plus tard</button>';
    });
  }

  function disablePush() {
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return;
      return api('DELETE', '/api/me/push', { endpoint: sub.endpoint }).catch(function () {}).then(function () { return sub.unsubscribe(); });
    });
  }

  // ---------- A notification touched on the phone: the app opens on what it announces ----------

  function openNotifFromHash() {
    var id = (location.hash.match(/^#notif-(\d+)/) || [])[1];
    if (!id) return;
    history.replaceState(null, '', location.pathname);
    api('GET', '/api/me/notifs/' + id)
      .then(function (n) { if (window.CDB_OPEN_ACTION) window.CDB_OPEN_ACTION(n); })
      .catch(function () { /* a message removed in the meantime: the app simply opens */ });
  }
  window.addEventListener('hashchange', function () { if (/^#notif-\d+/.test(location.hash) && DATA) openNotifFromHash(); });

  // ---------- « Prendre en main » (the presentation video, « ? » at the top) and « Signaler un problème » (a bug of the app, bottom of the home screen) ----------

  function videoEmbed(url) {
    var u; try { u = new URL(url); } catch (e) { return null; }
    var host = u.hostname.replace(/^www\.|^m\./, ''), id = null, m;
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') id = u.pathname === '/watch' ? u.searchParams.get('v') : ((u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1]);
    if (id && /^[\w-]{6,20}$/.test(id)) return 'https://www.youtube-nocookie.com/embed/' + id;
    if ((host === 'vimeo.com' || host === 'player.vimeo.com') && (m = u.pathname.match(/(\d{6,12})/))) return 'https://player.vimeo.com/video/' + m[1];
    return null;
  }
  function openHelp() {
    var url = DATA && DATA.helpVideo, embed = url && videoEmbed(url);
    if (url && !embed) { window.open(url, '_blank', 'noopener'); return; }
    var m = document.createElement('div');
    m.className = 'cloud-modal';
    m.innerHTML = '<div class="card cloud-helpcard"><p class="eyebrow">Prendre en main l’appli</p>' +
      (embed
        ? '<div class="cloud-video"><iframe src="' + esc(embed) + '" title="Présentation de l’appli" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>'
        : '<h3>La vidéo arrive bientôt</h3><p class="sub">En attendant : <b>Gestes du quotidien</b> pour vos listes, <b>C’est quoi, ça ?</b> pour comprendre un équipement sur le plan, <b>J’ai un souci</b> pour trouver la cause d’une panne pas à pas, et le bouton de rendez-vous pour écrire à votre concession.</p>') +
      '<div class="btns"><button type="button" class="btn" data-x>Fermer</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-x]')) m.remove(); });
  }
  function openBug() {
    var m = document.createElement('div');
    m.className = 'cloud-modal';
    m.innerHTML = '<form class="card"><p class="eyebrow">Signaler un problème avec l’appli</p><h3>Que s’est-il passé ?</h3>' +
      '<p class="sub">Ce que vous faisiez et ce que vous avez vu (un écran blanc, un bouton qui ne marche pas…). Pour une panne de votre camping-car, utilisez plutôt « J’ai un souci ».</p>' +
      '<textarea class="search" name="message" rows="5" maxlength="3000" required></textarea>' +
      '<div class="btns"><button type="button" class="btn alt" data-x>Annuler</button><button class="btn">Envoyer</button></div></form>';
    document.body.appendChild(m);
    var form = m.querySelector('form'), ta = m.querySelector('textarea');
    setTimeout(function () { ta.focus(); }, 50);
    m.querySelector('[data-x]').onclick = function () { m.remove(); };
    form.onsubmit = function (e) {
      e.preventDefault();
      var btn = form.querySelector('button:not([type=button])'); btn.disabled = true;
      var title = document.getElementById('title');
      api('POST', '/api/me/bugs', { message: ta.value, page: title ? title.textContent : '' })
        .then(function () { m.remove(); toast('Merci ! Votre message est bien envoyé.'); })
        .catch(function (err) { btn.disabled = false; toast(err.message); });
    };
  }
  function addHelp() {
    var top = document.querySelector('.top'), logo = top && top.querySelector('.dlogo');
    if (top && !document.getElementById('cloudhelp')) {
      var q = document.createElement('button');
      q.id = 'cloudhelp'; q.type = 'button'; q.className = 'cloud-help'; q.textContent = '?';
      q.setAttribute('aria-label', 'Prendre en main l’appli (vidéo)');
      q.onclick = openHelp;
      top.insertBefore(q, logo || null);
    }
    var home = document.getElementById('home');
    if (home && !document.getElementById('cloudfoot')) {
      var f = document.createElement('div');
      f.id = 'cloudfoot'; f.className = 'cloud-foot';
      f.innerHTML = '<button type="button" class="lnk" data-help>❓ Prendre en main l’appli</button><button type="button" class="lnk" data-bug>⚠️ Signaler un problème</button>';
      f.querySelector('[data-help]').onclick = openHelp;
      f.querySelector('[data-bug]').onclick = openBug;
      home.appendChild(f);
    }
  }

  // ---------- Nickname of the vehicle (« Le Baroudeur »): shown big at the top, the model just below ----------

  var NICK_KEY = 'cdb_nick';
  function renderNick() {
    var h = document.querySelector('#home .hero-name');
    if (!h || !DATA || !DATA.vehicle) return;
    var nick = (lsGet(NICK_KEY) || '').trim(), v = DATA.vehicle;
    var model = [v.heroPrefix, v.heroName].filter(Boolean).join(' ');
    h.innerHTML = nick ? esc(nick) : esc(v.heroPrefix || '') + ' <span>' + esc(v.heroName || '') + '</span>';
    h.classList.toggle('cloud-nick', !!nick);
    var line = document.getElementById('cloudnick');
    if (!line) {
      line = document.createElement('p');
      line.id = 'cloudnick';
      line.className = 'cloud-nickline';
      h.insertAdjacentElement('afterend', line);
    }
    line.innerHTML = (nick ? '<span>' + esc(v.fullName || model) + '</span> ' : '') +
      '<button type="button" class="lnk" data-nick>' + (nick ? 'Changer le petit nom' : 'Donner un petit nom à mon véhicule') + '</button>';
    line.querySelector('[data-nick]').onclick = editNick;
  }
  function editNick() {
    var cur = lsGet(NICK_KEY) || '';
    var m = document.createElement('div');
    m.className = 'cloud-modal';
    m.innerHTML = '<form class="card"><p class="eyebrow">Votre véhicule</p><h3>Son petit nom</h3>' +
      '<p class="sub">Il s’affiche en grand à l’accueil de l’appli, le modèle reste écrit juste en dessous.</p>' +
      '<input class="search" name="nick" maxlength="40" autocomplete="off" placeholder="ex : Le Baroudeur" value="' + esc(cur) + '">' +
      '<div class="btns">' + (cur ? '<button type="button" class="btn alt" data-clear>Effacer</button>' : '') +
      '<button type="button" class="btn alt" data-x>Annuler</button><button class="btn">Enregistrer</button></div></form>';
    document.body.appendChild(m);
    var input = m.querySelector('input');
    setTimeout(function () { input.focus(); }, 50);
    function save(v) {
      v = (v || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (v) lsSet(NICK_KEY, v); else lsDel(NICK_KEY);
      if (window.CDB_SYNC) window.CDB_SYNC.changed(NICK_KEY, v || null);
      m.remove();
      renderNick();
    }
    m.querySelector('[data-x]').onclick = function () { m.remove(); };
    var clr = m.querySelector('[data-clear]'); if (clr) clr.onclick = function () { save(''); };
    m.querySelector('form').onsubmit = function (e) { e.preventDefault(); save(input.value); };
  }

  function addAccountCard() {
    var home = document.getElementById('home'); if (!home || document.getElementById('cloudacc')) return;
    var req = document.createElement('div'); req.id = 'cloudhome'; req.hidden = true;
    var acc = document.createElement('div'); acc.id = 'cloudacc'; acc.className = 'card cloud-acc';
    if (DATA.announcement) {
      var ann = document.createElement('div'); ann.className = 'tip cloud-announce';
      ann.innerHTML = '<b>' + esc(DATA.dealer.name || 'Votre concession') + ' :</b> ' + esc(DATA.announcement);
      home.insertBefore(ann, home.firstChild);
    }
    home.insertBefore(req, home.firstChild); home.appendChild(acc);
    // The maintenance logbook, just under the weight of the vehicle, with a red dot when something is to be done.
    var ent = document.createElement('button'); ent.id = 'cloudent'; ent.type = 'button'; ent.className = 'cloud-carnet';
    var load = document.getElementById('loadcard');
    if (load) load.parentNode.insertBefore(ent, load.nextSibling); else home.insertBefore(ent, req.nextSibling);
    ent.addEventListener('click', openCarnet);
    renderEntretien();
    loadEntretien();
    api('GET', '/api/me/featured').then(function (r) { if (window.CDB_SET_FEATURED) window.CDB_SET_FEATURED(r.featured); }).catch(function () {});
    acc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-acc]'); if (!b) return;
      if (b.dataset.acc === 'space') openSpace();
      if (b.dataset.acc === 'part') partRequest(null);
      if (b.dataset.acc === 'mk-yes' || b.dataset.acc === 'mk-no') setMarketing(b.dataset.acc === 'mk-yes');
    });
    renderAccount();
  }

  // Home card: who is signed in, backup status, and the two entries of the client space.
  // ---------- Maintenance: reminders on the home screen and the logbook kept by the customer ----------

  var ENT = null;
  function fmtDay(d) { return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function loadEntretien() {
    return api('GET', '/api/me/entretien').then(function (r) { ENT = r; renderEntretien(); return r; }).catch(function () { return ENT; });
  }
  function addLog(body) {
    return api('POST', '/api/me/entretien', body).then(function (r) { ENT = r; renderEntretien(); return r; }).catch(function (err) { toast(err.message); throw err; });
  }
  function dueNow() { return ENT ? ENT.items.filter(function (i) { return i.state !== 'later'; }) : []; }
  // The home button: « Carnet d'entretien », the red dot counts what is to be done (late, or within 45 days).
  function renderEntretien() {
    var el = document.getElementById('cloudent'); if (!el) return;
    var due = dueNow(), next = ENT && ENT.items[0];
    el.innerHTML = '<span class="cloud-carnet-ic" aria-hidden="true">📒</span><span class="cloud-carnet-t"><b>Carnet d’entretien</b><span>' +
      (due.length ? esc(due.map(function (i) { return i.label; }).join(' · ')) : next ? 'Prochain : ' + esc(next.label) + ', ' + esc(fmtDay(next.due)) : 'Ce qui est fait, ce qui est à prévoir') + '</span></span>' +
      (due.length ? '<span class="cloud-dot" aria-label="' + due.length + ' à faire">' + due.length + '</span>' : '') + '<span class="cloud-carnet-go" aria-hidden="true">›</span>';
  }
  function todoHtml() {
    var due = dueNow();
    if (!due.length) return '<p class="ok">✓ Rien à prévoir dans les semaines qui viennent.</p>';
    return '<p class="eyebrow">À faire</p>' + due.map(function (i) {
      return '<div class="cloud-ent-item' + (i.state === 'late' ? ' late' : '') + '"><p><b>' + esc(i.label) + '</b><br><span class="sub">' +
        (i.state === 'late' ? 'Prévu le ' + esc(fmtDay(i.due)) + ' : à faire dès que possible' : 'À faire avant le ' + esc(fmtDay(i.due))) + (i.why ? '. ' + esc(i.why) : '') + '</span></p>' +
        '<div class="cloud-ent-btns"><button class="btn" type="button" data-rdv="' + esc(i.rdv || 'souci') + '" data-ctx="' + esc('Rappel : ' + i.label + ' à prévoir (le ' + fmtDay(i.due) + ').') + '">Prendre rendez-vous</button>' +
        (i.dated ? '<button class="btn alt" type="button" data-eq-open="' + esc(i.eq) + '">J’ai changé la pièce : noter la date</button>' : '<button class="btn alt" type="button" data-ent-done="' + esc(i.kind) + '">C’est fait</button>') + '</div></div>';
    }).join('');
  }
  window.CDB_CLOUD.openCarnet = function () { openCarnet(); };
  function openCarnet() {
    var m = document.createElement('div');
    m.className = 'cloud-modal cloud-sheet cloud-space';
    var draw = function () {
      m.innerHTML = '<div class="card"><div class="cloud-space-head"><h2>Carnet d’entretien</h2><button type="button" class="btn alt" data-cn="close">Fermer</button></div>' +
        '<p class="sub">Notez ce qui est fait : l’application calcule les prochaines dates et vous prévient sur le téléphone 15 jours avant.</p>' +
        (ENT ? todoHtml() : '') + '<form data-spf="log">' + carnetHtml() + '</form>' +
        (ENT && ENT.tips && ENT.tips.length ? '<p class="eyebrow">À vérifier vous-même</p><ul class="cloud-list">' + ENT.tips.map(function (t) { return '<li><b>' + esc(t.label) + '</b><br><span class="sub">' + esc(t.when) + '</span></li>'; }).join('') + '</ul>' : '') +
        '<button type="button" class="btn alt cloud-close-bottom" data-cn="close">Fermer</button></div>';
    };
    draw();
    document.body.appendChild(m); document.body.style.overflow = 'hidden';
    function close() { m.remove(); document.body.style.overflow = ''; }
    loadEntretien().then(draw);
    m.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-spf]'); if (!f) return;
      e.preventDefault();
      var val = function (n) { return f.elements[n] ? f.elements[n].value.trim() : undefined; };
      addLog({ kind: val('kind'), doneOn: val('doneOn'), note: val('note') }).then(function () { draw(); toast('Noté dans votre carnet'); });
    });
    m.addEventListener('click', function (e) {
      if (e.target === m) return close();
      if (e.target.closest('[data-rdv]')) return close(); // the appointment screen opens behind
      var eo = e.target.closest('[data-eq-open]');
      if (eo) { close(); if (window.CDB_SHOW_EQ) window.CDB_SHOW_EQ(eo.dataset.eqOpen); return; }
      var d = e.target.closest('[data-ent-done]');
      if (d) return addLog({ kind: d.dataset.entDone }).then(function () { draw(); toast('Noté dans votre carnet d’entretien'); });
      var b = e.target.closest('[data-cn],[data-sp="logdel"]'); if (!b) return;
      if (b.dataset.cn === 'close') close();
      if (b.dataset.sp === 'logdel') api('DELETE', '/api/me/entretien/' + b.dataset.id).then(function (r) { ENT = r; renderEntretien(); draw(); }).catch(function (err) { toast(err.message); });
    });
  }
  function carnetHtml() {
    if (!ENT) return '<p class="sub">Chargement…</p>';
    var next = ENT.items.filter(function (i) { return i.state === 'later'; }).map(function (i) {
      return '<li><b>' + esc(i.label) + '</b> : ' + (i.state === 'late' ? '<span class="cloud-late">en retard (' + esc(fmtDay(i.due)) + ')</span>' : esc(fmtDay(i.due))) + '</li>';
    }).join('');
    var log = ENT.log.length ? ENT.log.map(function (e) {
      return '<li><b>' + esc(fmtDay(e.doneOn)) + '</b> · ' + esc(e.label) + (e.note ? '<br><span class="sub">' + esc(e.note) + '</span>' : '') +
        ' <button class="lnk cloud-del" type="button" data-sp="logdel" data-id="' + e.id + '" aria-label="Retirer">Retirer</button></li>';
    }).join('') : '<li class="sub">Rien de noté pour l’instant.</li>';
    var today = new Date().toISOString().slice(0, 10);
    // Parts with a date written on them (gas hose, regulator, detectors…) whose date is not noted yet.
    var miss = (ENT.datesMissing || []).map(function (d) {
      return '<li><b>' + esc(d.label) + '</b>' + (d.where ? '<br><span class="sub">' + esc(d.where) + '</span>' : '') + ' <button class="lnk" type="button" data-eq-open="' + esc(d.id) + '">Noter la date</button></li>';
    }).join('');
    return (miss ? '<p class="eyebrow">Dates à relever sur vos pièces</p><ul class="cloud-list">' + miss + '</ul>' : '') +
      (next ? '<p class="eyebrow">Plus tard</p><ul class="cloud-list">' + next + '</ul>' : '') +
      '<p class="eyebrow">Ce qui a été fait</p><ul class="cloud-list">' + log + '</ul>' +
      '<details class="cloud-more"><summary>＋ Noter une intervention</summary>' +
      '<label class="eyebrow">Quoi</label><select class="search" name="kind">' + ENT.kinds.map(function (k) { return '<option value="' + esc(k[0]) + '">' + esc(k[1]) + '</option>'; }).join('') + '</select>' +
      '<label class="eyebrow">Quand</label><input class="search" type="date" name="doneOn" value="' + today + '" max="' + today + '">' +
      '<label class="eyebrow">Note (facultatif)</label><input class="search" name="note" maxlength="300" placeholder="Garage, kilométrage, remarque…">' +
      '<button class="btn">Enregistrer</button></details>';
  }

  // Consent to the dealership's advice and offers (campaigns), asked once, separately from the answers to requests.
  function setMarketing(yes) {
    return api('PUT', '/api/me/info', { marketing: yes }).then(function (cust) {
      session.customer = cust; saveSession(); renderAccount();
      toast(yes ? 'Merci : vous recevrez les conseils et offres de votre concession' : 'C’est noté : pas de conseils ni d’offres');
    }).catch(function (err) { toast(err.message); });
  }
  function marketingAsk() {
    var c = (session && session.customer) || {};
    if (c.marketingOptin === 0 || c.marketingOptin === 1) return '';
    var d = (session && session.dealership && session.dealership.name) || 'votre concession';
    return '<div class="cloud-ask"><p><b>Recevoir les conseils de ' + esc(d) + ' ?</b><br><span class="sub">Conseils d’entretien de saison, nouveautés et, de temps en temps, une offre. Vous pourrez changer d’avis dans votre espace client.</span></p>' +
      '<div class="cloud-ask-btns"><button class="btn" data-acc="mk-yes" type="button">Oui, volontiers</button><button class="btn alt" data-acc="mk-no" type="button">Non merci</button></div></div>';
  }

  function renderAccount() {
    var el = document.getElementById('cloudacc'); if (!el || !session) return;
    var n = Object.keys(pending).length, c = session.customer || {};
    var status = n ? (navigator.onLine ? 'Sauvegarde en cours…' : 'Hors connexion : ' + n + ' modification' + (n > 1 ? 's' : '') + ' en attente, envoyée' + (n > 1 ? 's' : '') + ' au retour du réseau.')
      : '✓ Vos données sont sauvegardées' + (lastSaved ? ' (' + lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ')' : '') + '.';
    // Simple and large: who I am, who to contact, two buttons. The backup status stays small at the bottom.
    el.innerHTML = '<p class="eyebrow">Mon espace client</p><p class="cloud-who"><b>' + esc([c.firstName, c.lastName].filter(Boolean).join(' ')) + '</b>' +
      (session.dealership ? '<br><span class="sub">' + esc(session.dealership.name) + '</span>' : '') + '</p>' + marketingAsk() + contactsHtml() +
      '<div class="cloud-acc-btns"><button class="btn" data-acc="part" type="button">🛒 Demander une pièce</button><button class="btn alt" data-acc="space" type="button">👤 Mon espace client</button></div>' +
      '<p class="sub cloud-saved">' + esc(status) + '</p>';
  }

  // Who the customer contacts: the SAV (workshop) and the store, always both, with a discreet « Appeler » / « Écrire ».
  function telLink(phone) { return 'tel:' + String(phone).replace(/[^\d+]/g, ''); }
  function mailLink(email) {
    var c = (session && session.customer) || {}, v = (DATA && DATA.vehicle) || {};
    var subject = 'Mon camping-car' + (v.fullName ? ' ' + v.fullName : '') + ' – ' + [c.firstName, c.lastName].filter(Boolean).join(' ');
    return 'mailto:' + email + '?subject=' + encodeURIComponent(subject);
  }
  function contactsHtml() {
    var d = (DATA && DATA.dealer) || {};
    var row = function (label, x) {
      x = x || {};
      var phone = x.phone || d.tel, email = x.email || d.email;
      if (!phone && !email) return '';
      return '<div class="cloud-contact"><span>' + label + '</span>' +
        (phone ? '<a class="cloud-mini" href="' + esc(telLink(phone)) + '" aria-label="Appeler le ' + label + '">📞 Appeler</a>' : '') +
        (email ? '<a class="cloud-mini" href="' + esc(mailLink(email)) + '" aria-label="Écrire au ' + label + '">✉️ Écrire</a>' : '') + '</div>';
    };
    var h = row('SAV', d.sav) + row('Magasin', d.store);
    return h ? '<div class="cloud-contacts">' + h + '</div>' : '';
  }

  function warrantyHtml() {
    var w = session && session.warranty; if (!w || !w.until) return '';
    var date = new Date(w.until).toLocaleDateString('fr-FR');
    return w.active ? '<p class="sub">🛡️ Véhicule sous ' + (w.extended ? 'extension de garantie' : 'garantie') + ' jusqu’au ' + esc(date) + '.</p>' : '<p class="sub">Garantie terminée le ' + esc(date) + '.</p>';
  }

  // ---------- Client space: my details, my vehicle, my code, notifications, my data ----------

  function pushHtml(st) {
    return {
      on: '<p class="sub">🔔 Activées sur ce téléphone : vous êtes prévenu quand votre concession répond.</p><button class="btn alt" data-sp="push-off" type="button">Désactiver sur ce téléphone</button>',
      off: '<button class="btn" data-sp="push-on" type="button">🔔 Activer sur ce téléphone</button>',
      denied: '<p class="sub">🔕 Bloquées : autorisez-les pour cette appli dans les réglages du téléphone.</p>',
      'ios-install': '<p class="sub">Sur iPhone : touchez Partager puis « Sur l’écran d’accueil », et ouvrez l’appli depuis son icône pour pouvoir les activer.</p>',
      unsupported: '<p class="sub">Ce navigateur ne permet pas les notifications.</p>',
    }[st] || '';
  }

  function openSpace() {
    var c = (session && session.customer) || {}, v = (DATA && DATA.vehicle) || {}, d = (DATA && DATA.dealer) || {};
    var m = document.createElement('div');
    m.className = 'cloud-modal cloud-sheet cloud-space';
    m.innerHTML = '<div class="card"><div class="cloud-space-head"><h2>Mon espace client</h2><button type="button" class="btn alt" data-sp="close">Fermer</button></div>' +
      '<section><h3>Contacter ma concession</h3><p class="sub">' + esc(d.name || '') + '</p>' + (contactsHtml() || '<p class="sub">Coordonnées non renseignées.</p>') + '</section>' +
      '<form data-spf="veh"><h3>Mon véhicule</h3><p class="cloud-big">' + esc(v.fullName || '') + '</p>' + warrantyHtml() +
      '<details class="cloud-more"' + (c.cellNumber && vehicleYear() ? '' : ' open') + '><summary>Année, n° de cellule, VIN</summary>' +
      '<label class="eyebrow">Année du véhicule</label><input class="search" name="vehicleYear" maxlength="10" inputmode="numeric" value="' + esc(vehicleYear()) + '">' +
      '<label class="eyebrow">Numéro de cellule</label><input class="search" name="cellNumber" maxlength="40" value="' + esc(c.cellNumber || '') + '" placeholder="Sur la plaque de la cellule">' +
      '<label class="eyebrow">VIN (numéro de série)</label><input class="search" name="vin" maxlength="40" autocapitalize="characters" autocomplete="off" value="' + esc(localVin()) + '" placeholder="Carte grise, case E">' +
      '<small class="sub">Le VIN reste sur ce téléphone, il n’est jamais envoyé sur internet (sauf dans une demande de pièce).</small>' +
      '<button class="btn">Enregistrer</button></details></form>' +
      '<form data-spf="me"><h3>Mes coordonnées</h3>' +
      '<label class="eyebrow">Prénom</label><input class="search" name="firstName" maxlength="100" autocomplete="given-name" value="' + esc(c.firstName || '') + '">' +
      '<label class="eyebrow">Nom</label><input class="search" value="' + esc(c.lastName || '') + '" disabled><small class="sub">Pour changer de nom, demandez à votre concession.</small>' +
      '<label class="eyebrow">E-mail</label><input class="search" name="email" type="email" maxlength="200" autocomplete="email" value="' + esc(c.email || '') + '">' +
      '<label class="eyebrow">Téléphone</label><input class="search" name="phone" type="tel" maxlength="40" autocomplete="tel" value="' + esc(c.phone || '') + '">' +
      '<button class="btn">Enregistrer</button></form>' +
      '<section><h3>Conseils de saison</h3><label class="cloud-check"><input type="checkbox" data-sp="marketing"' + (c.marketingOptin === 1 ? ' checked' : '') + '> Recevoir les conseils de saison et les offres de ' + esc(d.name || 'ma concession') + '</label></section>' +
      '<section><h3>Être prévenu des réponses</h3><div data-push></div>' +
      '<label class="cloud-check"><input type="checkbox" data-sp="mailnotif"' + (c.emailNotify === 0 ? '' : ' checked') + (c.email ? '' : ' disabled') + '> Recevoir aussi les réponses par e-mail' + (c.email ? '' : ' (ajoutez votre e-mail ci-dessus)') + '</label></section>' +
      '<section><h3>Mon code d’accès</h3><p class="sub">À garder : avec votre nom, il permet de retrouver l’application sur un autre téléphone.</p><div data-code><button class="btn alt" type="button" data-sp="code">Afficher mon code</button></div></section>' +
      '<details class="cloud-more cloud-options"><summary>Autres options</summary>' +
      '<p class="sub">L’application enregistre pour votre concession : vos coordonnées, votre véhicule, vos équipements, vos photos, vos demandes et messages, et des statistiques anonymes d’utilisation (ce qui est cherché, sans savoir qui). Ni votre VIN ni votre immatriculation.</p>' +
      '<button class="btn alt" type="button" data-sp="update">Vérifier les mises à jour</button>' +
      '<button class="btn alt" type="button" data-sp="export">Télécharger mes données</button>' +
      '<a class="btn alt" href="/app/legal.html" target="_blank" rel="noopener">Confidentialité et mentions légales</a>' +
      '<button class="btn alt" type="button" data-sp="logout">Se déconnecter de ce téléphone</button>' +
      '<button class="cloud-danger" data-sp="delete" type="button">Supprimer mon compte et mes données</button></details>' +
      '<button type="button" class="btn alt cloud-close-bottom" data-sp="close">Fermer</button>' +
      '</div>';
    document.body.appendChild(m);
    document.body.style.overflow = 'hidden';
    function close() { m.remove(); document.body.style.overflow = ''; renderAccount(); }
    function drawPush() { pushState().then(function (st) { var p = m.querySelector('[data-push]'); if (p) p.innerHTML = pushHtml(st); }); }
    drawPush();
    m.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-spf]'); if (!f) return;
      e.preventDefault();
      var val = function (n) { return f.elements[n] ? f.elements[n].value.trim() : undefined; }, body;
      if (f.dataset.spf === 'me') body = { firstName: val('firstName'), email: val('email'), phone: val('phone') };
      else {
        if (val('vin')) lsSet(VIN_KEY, val('vin')); else lsDel(VIN_KEY);
        body = { vehicleYear: val('vehicleYear'), cellNumber: val('cellNumber') };
      }
      api('PUT', '/api/me/info', body).then(function (cust) { session.customer = cust; saveSession(); toast('Enregistré'); }).catch(function (err) { toast(err.message); });
    });
    m.addEventListener('change', function (e) {
      if (e.target.dataset.sp === 'marketing') {
        api('PUT', '/api/me/info', { marketing: e.target.checked }).then(function (cust) { session.customer = cust; saveSession(); toast(e.target.checked ? 'Conseils et offres activés' : 'Plus de conseils ni d’offres'); }).catch(function (err) { toast(err.message); });
        return;
      }
      if (e.target.dataset.sp !== 'mailnotif') return;
      api('PUT', '/api/me/info', { emailNotify: e.target.checked }).then(function (cust) { session.customer = cust; saveSession(); toast(e.target.checked ? 'Réponses par e-mail activées' : 'Plus d’e-mails de réponse'); }).catch(function (err) { toast(err.message); });
    });
    m.addEventListener('click', function (e) {
      if (e.target === m) return close();
      var b = e.target.closest('[data-sp]'); if (!b || b.tagName === 'INPUT') return;
      var a = b.dataset.sp;
      if (a === 'close') close();
      if (a === 'code') {
        api('GET', '/api/me/access').then(function (r) {
          m.querySelector('[data-code]').innerHTML = r.accessCode
            ? '<p class="cloud-code">' + esc(r.accessCode) + '</p><p class="sub">Valable jusqu’au ' + esc(new Date(r.expiresAt).toLocaleDateString('fr-FR')) + '. Notez-le en lieu sûr.</p>'
            : '<p class="sub">Votre code ne peut pas être réaffiché : demandez-en un nouveau à ' + esc(d.name || 'votre concession') + '.</p>';
        }).catch(function (err) { toast(err.message); });
      }
      if (a === 'push-on') enablePush().then(function () { toast('Notifications activées'); drawPush(); }).catch(function (err) { toast(err.message); drawPush(); });
      if (a === 'push-off') disablePush().then(function () { toast('Notifications désactivées'); drawPush(); drawPushCard(); });
      if (a === 'export') {
        api('GET', '/api/me/export').then(function (data) {
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'mes-donnees-compagnon-de-bord.json';
          document.body.appendChild(link); link.click(); link.remove();
        }).catch(function (err) { toast(err.message); });
      }
      if (a === 'update') checkUpdates(true);
      if (a === 'logout') {
        if (!confirm('Se déconnecter de ce téléphone ? Vos données restent sauvegardées ; votre code d’accès permettra de les retrouver.')) return;
        api('POST', '/api/me/logout').catch(function () {}).then(function () { session = null; saveSession(); clearLocal(); location.reload(); });
      }
      if (a === 'delete') {
        if (!confirm('Supprimer définitivement votre compte et toutes vos données (photos, demandes) ? Cette action est irréversible.')) return;
        api('DELETE', '/api/me').then(function () { session = null; saveSession(); clearLocal(); location.reload(); }).catch(function (err) { toast(err.message); });
      }
    });
  }

  // ---------- Remote updates ----------

  var swReg = null;

  function banner(text, action) {
    var b = document.getElementById('cloudbanner');
    if (!b) { b = document.createElement('div'); b.id = 'cloudbanner'; b.className = 'cloud-banner'; document.body.insertBefore(b, document.body.firstChild); }
    b.innerHTML = '<span>' + esc(text) + '</span><button type="button">Mettre à jour</button>';
    b.querySelector('button').onclick = action;
  }

  function checkUpdates(manual) {
    if (!session || !DATA) return;
    if (swReg) swReg.update().catch(function () {});
    api('GET', '/api/config').then(function (cfg) {
      if (cfg.contentVersion !== DATA.contentVersion) banner('Votre concession a mis à jour le contenu de l’appli.', function () { location.reload(); });
      else if (manual) toast('L’application est à jour');
    }).catch(function () { if (manual) toast('Pas de connexion internet'); });
  }

  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { checkUpdates(false); loadRequests(); flush(); } });

  if ('serviceWorker' in navigator) {
    // A new version activates by itself; the page then reloads on it (not on the very first install).
    var hadController = !!navigator.serviceWorker.controller, reloading = false;
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).then(function (reg) { swReg = reg; }).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloading) { hadController = true; return; }
      reloading = true; location.reload();
    });
  }

  // ---------- Go ----------

  // Arriving from the "Consulter la réponse" button of an e-mail: sign in with the link, then open the request.
  var linkToken = new URLSearchParams(location.search).get('lien');
  if (linkToken) history.replaceState(null, '', location.pathname + location.hash);
  if (linkToken) {
    // A link for another customer than the one open on this device switches to that customer.
    root.innerHTML = '<div class="cloud-loading">Connexion…</div>';
    api('POST', '/api/link', { token: linkToken })
      .then(function (res) {
        if (!(session && session.token && session.customer && res.customer && session.customer.id === res.customer.id)) startSession(res);
        return boot();
      })
      .catch(function (err) {
        // Link already used or expired: stay on the account open on this device, if any.
        if (session && session.token) boot(); else renderWelcome();
        toast(err.message);
      });
  } else if (session && session.token) boot();
  else renderWelcome();
})();
