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
  var STATE_KEYS = ['cdb_own', 'cdb_ueq', 'cdb_uph', 'cdb_var', 'cdb_mod', 'cdb_dim', 'cdb_wt', 'cdb_photo', 'cdb_hand'];
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
          if (res.value == null) lsDel(key); else lsSet(key, res.value);
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
        if (pending[k] == null) lsDel(k); else lsSet(k, pending[k]);
        return;
      }
      if (state && state[k] != null) lsSet(k, state[k]); else lsDel(k);
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

  window.CDB_CLOUD = {
    accessCode: function (info) {
      return askDealerCode('Valider la mise en main', 'Saisissez votre code concession pour générer le code d’accès du client.').then(function (code) {
        if (!code) return null;
        return api('POST', '/api/me/access-code', { dealershipCode: code, firstName: info.firstName, vin: info.vin });
      });
    },
    sendRequest: function (body) {
      // Follow-up of a closed request: its title says so, for the dealership.
      if (followUp && body.title === 'Un souci sur mon véhicule' && /^Suite de ma demande/.test(body.message || '')) body.title = ('Suite : ' + followUp).slice(0, 150);
      followUp = null;
      return api('POST', '/api/me/requests', body).then(function (r) { openReq[r.id] = true; loadRequests(); return r; });
    },
  };

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
        '<label class="eyebrow" for="c_plate">Immatriculation</label><input class="search" id="c_plate" name="plate" autocapitalize="characters" autocomplete="off">' +
        '<label class="eyebrow" for="c_vin">Numéro de série (VIN)</label><input class="search" id="c_vin" name="vin" autocapitalize="characters" autocomplete="off" placeholder="17 caractères">' +
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
      api('POST', '/api/handover', { dealershipCode: flow.code, vehicleId: flow.vehicleId, customer: data })
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
    STATE_KEYS.concat([DATA_KEY, PENDING_KEY]).forEach(lsDel);
    pending = {};
  }

  function startSession(res) {
    clearLocal();
    session = { token: res.token, customer: res.customer, vehicle: res.vehicle, dealership: res.dealership };
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
      session.customer = r[1].customer; session.vehicle = r[1].vehicle; session.dealership = r[1].dealership; saveSession();
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
        addAccountCard();
        loadRequests();
        setInterval(function () { if (document.visibilityState === 'visible') loadRequests(); }, 60000);
        flush();
        if (openScreen) { var b = document.querySelector('[data-go="' + openScreen + '"]'); if (b) b.click(); }
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
    var thread = '<div class="cloud-msg client"><p>' + esc(r.description || r.title).replace(/\n/g, '<br>') + '</p><small>Vous · ' + esc(fmt(r.createdAt)) + '</small></div>' +
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

  function enablePush() {
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('Notifications refusées : autorisez-les dans les réglages du téléphone.');
      return Promise.all([navigator.serviceWorker.ready, api('GET', '/api/push/key')]);
    }).then(function (r) {
      return r[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(r[1].publicKey) });
    }).then(function (sub) {
      return api('POST', '/api/me/push', { subscription: sub.toJSON() });
    });
  }

  function disablePush() {
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return;
      return api('DELETE', '/api/me/push', { endpoint: sub.endpoint }).catch(function () {}).then(function () { return sub.unsubscribe(); });
    });
  }

  function addAccountCard() {
    var home = document.getElementById('home'); if (!home || document.getElementById('cloudacc')) return;
    var req = document.createElement('div'); req.id = 'cloudhome'; req.hidden = true;
    var acc = document.createElement('div'); acc.id = 'cloudacc'; acc.className = 'card';
    if (DATA.announcement) {
      var ann = document.createElement('div'); ann.className = 'tip cloud-announce';
      ann.innerHTML = '<b>' + esc(DATA.dealer.name || 'Votre concession') + ' :</b> ' + esc(DATA.announcement);
      home.insertBefore(ann, home.firstChild);
    }
    home.insertBefore(req, home.firstChild); home.appendChild(acc);
    acc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-acc]'); if (!b) return;
      if (b.dataset.acc === 'logout') {
        if (!confirm('Se déconnecter de ce téléphone ? Vos données restent sauvegardées ; votre code d’accès permettra de les retrouver.')) return;
        api('POST', '/api/me/logout').catch(function () {}).then(function () { session = null; saveSession(); clearLocal(); location.reload(); });
      }
      if (b.dataset.acc === 'delete') {
        if (!confirm('Supprimer définitivement votre compte et toutes vos données (photos comprises) ?')) return;
        api('DELETE', '/api/me').then(function () { session = null; saveSession(); clearLocal(); location.reload(); }).catch(function (err) { toast(err.message); });
      }
      if (b.dataset.acc === 'update') checkUpdates(true);
      if (b.dataset.acc === 'push-on') enablePush().then(function () { toast('Notifications activées'); renderAccount(); }).catch(function (err) { toast(err.message); renderAccount(); });
      if (b.dataset.acc === 'push-off') disablePush().then(function () { toast('Notifications désactivées'); renderAccount(); });
    });
    renderAccount();
  }

  function renderAccount() {
    var el = document.getElementById('cloudacc'); if (!el || !session) return;
    var n = Object.keys(pending).length, c = session.customer || {};
    var status = n ? (navigator.onLine ? 'Sauvegarde en cours…' : 'Hors connexion : ' + n + ' modification' + (n > 1 ? 's' : '') + ' en attente, envoyée' + (n > 1 ? 's' : '') + ' au retour du réseau.')
      : '✓ Vos données sont sauvegardées' + (lastSaved ? ' (' + lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ')' : '') + '.';
    el.innerHTML = '<p class="eyebrow">Mon compte</p><p><b>' + esc([c.firstName, c.lastName].filter(Boolean).join(' ')) + '</b>' +
      (session.dealership ? ' · ' + esc(session.dealership.name) : '') + '</p><p class="sub">' + esc(status) + '</p>' +
      '<div id="cloudpush"></div>' +
      '<div class="btns"><button class="btn alt" data-acc="update">Vérifier les mises à jour</button><button class="btn alt" data-acc="logout">Se déconnecter</button></div>' +
      '<p style="text-align:center"><button class="lnk" data-acc="delete" type="button">Supprimer mon compte</button></p>';
    pushState().then(function (st) {
      var p = document.getElementById('cloudpush'); if (!p) return;
      var txt = {
        on: '<p class="sub">🔔 Notifications activées : vous êtes prévenu quand votre concession répond.</p><button class="lnk" data-acc="push-off" type="button">Désactiver les notifications</button>',
        off: '<button class="btn" data-acc="push-on" type="button">🔔 Être prévenu quand la concession répond</button>',
        denied: '<p class="sub">🔕 Notifications bloquées : autorisez-les pour cette appli dans les réglages du téléphone.</p>',
        'ios-install': '<p class="sub">🔔 Pour recevoir les notifications sur iPhone : touchez Partager puis « Sur l’écran d’accueil », et ouvrez l’appli depuis son icône.</p>',
        unsupported: '',
      }[st];
      p.innerHTML = txt || '';
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
  if (linkToken && !(session && session.token)) {
    root.innerHTML = '<div class="cloud-loading">Connexion…</div>';
    api('POST', '/api/link', { token: linkToken })
      .then(function (res) { startSession(res); return boot(); })
      .catch(function (err) { renderWelcome(); toast(err.message); });
  } else if (session && session.token) boot();
  else renderWelcome();
})();
