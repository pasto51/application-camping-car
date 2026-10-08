/* Compagnon de bord : moteur de l'application. Généré par tools/import-compagnon.py, ne pas modifier à la main. */
window.startCompagnon = function(DATA){
  var $ = function(s,r){return (r||document).querySelector(s)};
  var $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  $(".hero-name").innerHTML = esc(DATA.vehicle.heroPrefix||"")+" <span>"+esc(DATA.vehicle.heroName||"")+"</span>";
  function dlogoHtml(){return DATA.dealer.logoUrl ? '<div class="dlogo img'+(DATA.dealer.website?' link':'')+'" title="Site de la concession"><img src="'+esc(DATA.dealer.logoUrl)+'" alt=""></div>' : '<div class="dlogo" aria-hidden="true">'+esc(dealerInitials())+'</div>'}
  function dealerInitials(){return (DATA.dealer.name||"").split(/\s+/).filter(function(w){return w.length>2}).slice(0,2).map(function(w){return w.charAt(0)}).join("").toUpperCase() || "CDB"}
  $$(".dlogo").forEach(function(d){if(DATA.dealer.logoUrl){d.innerHTML = '<img src="'+esc(DATA.dealer.logoUrl)+'" alt="">'; d.classList.add("img")} else d.textContent = dealerInitials()});
  // Dealership logo (header and dealership card) opens its website.
  function dealerSite(e){var l = e.target.closest(".top .dlogo, .card .dlogo"); if(!l || !DATA.dealer.website) return; e.preventDefault(); e.stopPropagation(); window.open(DATA.dealer.website, "_blank", "noopener")}
  document.addEventListener("click", dealerSite, true);
  if(DATA.dealer.website) $$(".top .dlogo").forEach(function(d){d.classList.add("link"); d.setAttribute("role","link"); d.setAttribute("title","Site de "+(DATA.dealer.name||"la concession"))});
  (function(){var im = $("#planSvg image"); im.setAttribute("href",DATA.vehicle.planUrl || (DATA.vehicle.spots.length ? "/app/plan-van.svg" : "")); if(!DATA.vehicle.planUrl && !DATA.vehicle.spots.length) im.remove()})();
  var titles = {home:"Compagnon de bord",daily:"Gestes du quotidien",equip:"Mes équipements",rdv:"Rendez-vous atelier",weight:"Poids et charge",hand:"Mise en main",what:"C'est quoi, ça ?",diag:"J'ai un souci",game:"Missions"};
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(t){return String(t==null?"":t).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  var toastTimer;
  function toast(msg){var t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.hidden=true},2600)}

  function go(id){
    $$(".screen").forEach(function(s){s.hidden = s.id !== id});
    $("#title").textContent = titles[id];
    $("#back").hidden = id === "home";
    $$(".nav button").forEach(function(b){b.setAttribute("aria-current", b.dataset.go === id ? "true" : "false")});
    if(id==="what") renderWhat();
    if(id==="equip") renderEquip();
    if(id==="rdv") renderRdv();
    if(id==="weight") renderWeight();
    if(id==="hand") renderHand();
    if(typeof updateCount==="function") updateCount();
    if(id==="diag") renderDiagList();
    if(id==="game") renderGame();
    window.scrollTo(0,0);
  }
  document.addEventListener("click",function(e){
    var b = e.target.closest("[data-go]");
    if(b){go(b.dataset.go)}
  });
  $("#back").addEventListener("click",function(){go("home")});

  /* ---------- Gestes du quotidien ---------- */
  var LISTS = DATA.lists;
  var REMINDERS = DATA.reminders;
  var OWN_ALIAS = DATA.config.OWN_ALIAS;
  function ownA(i){return own[i] || (OWN_ALIAS[i] && own[OWN_ALIAS[i]])}
  function RL(){return REMINDERS.filter(function(r){return !r.needs || r.needs.some(function(i){return ownA(i)})})}
  var checked = {arrivee:{},depart:{}}, reminded = {}, optin = false;
  var activeList = "arrivee";
  function renderChecks(){
    var isEnt = activeList === "entretien";
    $("#checkpart").hidden = isEnt; $("#remindpart").hidden = !isEnt;
    if(isEnt){
      $("#remindpart").innerHTML = '<p class="eyebrow">Vos rappels d\'entretien</p>' + RL().map(function(r,i){
        var on = !!reminded[r.t];
        return '<div class="rem"><h3>'+esc(r.t)+'</h3><p class="when">'+esc(r.w)+'</p><div style="display:flex;flex-wrap:wrap;gap:8px"><button data-r="'+i+'" aria-pressed="'+on+'">'+(on?'Rappel activé':'Me rappeler')+'</button>'+(r.m?'<button data-rdv="'+r.m+'" style="background:var(--accent);color:var(--accent-ink);border-color:var(--accent)">Prendre rendez-vous</button>':'')+'</div>' +
          (on ? '<div class="notif"><b>Compagnon de bord · maintenant</b><span>'+esc(r.t)+' : c\'est le moment. Touchez pour voir comment faire.</span></div><p class="picnote">Exemple de notification, programmée sur votre téléphone. Aucune donnée n\'est envoyée.</p>' : '') + '</div>';
      }).join("") +
      '<p class="eyebrow" style="margin-top:8px">Messages de la marque</p>' +
      '<label class="rem" style="flex-direction:row;align-items:flex-start;gap:12px;cursor:pointer"><input type="checkbox" id="optin" style="width:24px;height:24px;accent-color:var(--accent);flex:none"'+(optin?' checked':'')+'><span><b>Recevoir les conseils et offres de saison</b><br><span class="when">Facultatif, désactivable à tout moment. Rien n\'est envoyé sans votre accord.</span></span></label>' +
      (optin ? '<div class="notif"><b>Votre concession · exemple</b><span>Avant l\'hiver : protégez votre circuit d\'eau. Les produits d\'hivernage sont en rayon cette semaine.</span></div><div class="notif"><b>Votre concession · exemple</b><span>Départ en vacances ? Vérifiez vos pneus, puis passez prendre votre kit de dépannage.</span></div><p class="picnote">Messages d\'exemple. Contenu, fréquence et ciblage choisis par la concession.</p>' : '');
      $("#dailynote").textContent = "Fréquences données en exemple. Elles seront alignées sur les préconisations constructeur.";
      return;
    }
    var L = LISTS[activeList], ul = $("#checks");
    ul.innerHTML = L.items.map(function(t,i){
      return '<li><label><input type="checkbox" data-i="'+i+'"'+(checked[activeList][i]?' checked':'')+'><span>'+esc(t)+'</span></label></li>';
    }).join("");
    $("#dailynote").textContent = L.note;
    updateProgress(false);
  }
  function updateProgress(announce){
    var n = LISTS[activeList].items.length, d = Object.keys(checked[activeList]).filter(function(k){return checked[activeList][k]}).length;
    var pct = Math.round(d/n*100);
    $("#plabel").textContent = d + " sur " + n;
    $("#ppct").textContent = pct + " %";
    $("#pbar").style.width = pct + "%";
    if(announce && d===n && n>0) toast("Liste complétée. Bon voyage !");
  }
  $("#checks").addEventListener("change",function(e){
    var i = e.target.dataset.i; if(i===undefined) return;
    checked[activeList][i] = e.target.checked;
    updateProgress(true);
  });
  $("#remindpart").addEventListener("click",function(e){
    var b = e.target.closest("[data-r]"); if(!b) return;
    var k = RL()[+b.dataset.r].t; reminded[k] = !reminded[k];
    renderChecks();
    toast(reminded[k] ? "Démo : vous recevriez une notification au bon moment." : "Rappel désactivé.");
  });
  $("#remindpart").addEventListener("change",function(e){if(e.target.id==="optin"){optin = e.target.checked; renderChecks(); toast(optin?"Démo : vous recevriez les offres de saison.":"Offres désactivées.")}});
  $$(".seg button[data-list]").forEach(function(b){
    b.addEventListener("click",function(){
      activeList = b.dataset.list;
      $$(".seg button[data-list]").forEach(function(x){x.setAttribute("aria-pressed", x===b ? "true":"false")});
      renderChecks();
    });
  });
  renderChecks();

  /* ---------- Stockage local facultatif (jamais requis) ---------- */
  function lsGet(k){try{return window.localStorage.getItem(k)}catch(e){return null}}
  function lsSet(k,v){try{window.localStorage.setItem(k,v)}catch(e){} if(window.CDB_SYNC) window.CDB_SYNC.changed(k,v)}
  function lsDel(k){try{window.localStorage.removeItem(k)}catch(e){} if(window.CDB_SYNC) window.CDB_SYNC.changed(k,null)}
  function norm(s){return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")}

  /* ---------- Photo du véhicule ---------- */
  var PH = DATA.vehicle.photos.map(function(p){return p.url});
  var PIT = DATA.vehicle.photos.map(function(p,n){return {id:p.id,n:n}});
  var PHOTOS = {};
  var HERO = DATA.vehicle.heroUrl || "";
  var DEFAULT_PHOTO = HERO;
  function setPhoto(url){
    $("#vphoto").src = url || DEFAULT_PHOTO;
    $("#vimg").classList.add("custom");
    $("#vreset").hidden = !url;
  }
  function loadPhoto(file){
    if(!file) return;
    var fr = new FileReader();
    fr.onload = function(){
      var im = new Image();
      im.onload = function(){
        var m = 720, sc = Math.min(1, m/Math.max(im.width,im.height));
        var c = document.createElement("canvas"); c.width = Math.round(im.width*sc); c.height = Math.round(im.height*sc);
        c.getContext("2d").drawImage(im,0,0,c.width,c.height);
        var url = c.toDataURL("image/jpeg",0.82);
        setPhoto(url); lsSet("cdb_photo",url); toast("Photo remplacée et sauvegardée.");
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  $("#vcam").addEventListener("click",function(){$("#fcam").click()});
  $("#vlib").addEventListener("click",function(){$("#flib").click()});
  $("#fcam").addEventListener("change",function(e){loadPhoto(e.target.files[0]); e.target.value=""});
  $("#flib").addEventListener("change",function(e){loadPhoto(e.target.files[0]); e.target.value=""});
  $("#vreset").addEventListener("click",function(){setPhoto(null); lsDel("cdb_photo")});
  (function(){var p = lsGet("cdb_photo"); setPhoto(p || null)})();

  /* ---------- Catalogue des équipements ---------- */
  var CATS = DATA.cats;
  var EQUIP = DATA.equipment.map(function(q){return Object.assign({img:"",kw:"",tip:""},q)});
  EQUIP.forEach(function(q){q.idx = norm(q.name+" "+q.kw+" "+q.text); if(!q.spot) q.spot = null});
  function eqById0(id){return EQUIP.filter(function(q){return q.id===id})[0]}
  PIT.forEach(function(p){if(eqById0(p.id)) PHOTOS[p.id] = p.n});
  var SPOT_V114 = DATA.vehicle.spotOverrides || {};
  EQUIP.forEach(function(q){if(SPOT_V114[q.id]) q.spot = SPOT_V114[q.id]});
  var V114_EXTRA = DATA.vehicle.extra || [];
  /* ---------- Équipements et photos ajoutés à la main (V39) ---------- */
  var UPH = (function(){var o = {}; try{o = JSON.parse(lsGet("cdb_uph")||"{}")||{}}catch(e){} return o})();
  var UEQ = (function(){var a = []; try{a = JSON.parse(lsGet("cdb_ueq")||"[]")||[]}catch(e){} return Array.isArray(a)?a:[]})();
  function uphSave(){var v = JSON.stringify(UPH); try{window.localStorage.setItem("cdb_uph",v)}catch(e){if(!window.CDB_SYNC) return false} if(window.CDB_SYNC) window.CDB_SYNC.changed("cdb_uph",v); return true}
  function ueqSave(){lsSet("cdb_ueq",JSON.stringify(UEQ))}
  function addCustom(c){var q = {id:c.id,cat:c.cat,name:c.name,base:false,spot:null,text:c.text||"Équipement ajouté par vous. Notez son modèle et ajoutez une photo pour le retrouver facilement.",tip:"",img:"",kw:"",custom:true}; q.idx = norm(q.name+" "+q.text); EQUIP.push(q); return q}
  UEQ.forEach(addCustom);

  function baseOwn(){var o = {}; (DATA.vehicle.equipment||[]).forEach(function(i){if(eqById0(i)) o[i]=true}); return o}
  var own = (function(){
    var s = lsGet("cdb_own"); if(s){try{var o = JSON.parse(s); if(o && typeof o==="object") return o}catch(e){}}
    return baseOwn();
  })();
  function saveOwn(){lsSet("cdb_own",JSON.stringify(own))}
  /* ---------- Équipements implicites (V40) : cocher le parent coche d'office ses éléments ---------- */
  var IMPL = DATA.config.IMPL;
  var APP_VARS = DATA.config.APP_VARS;
  var IMPL_VISIBLE = DATA.config.IMPL_VISIBLE;
  var HIDDEN_EQ = DATA.config.HIDDEN_EQ;
  var IMPL_REV = {};
  Object.keys(IMPL).forEach(function(p){IMPL[p].forEach(function(c){(IMPL_REV[c] = IMPL_REV[c]||[]).indexOf(p)<0 && IMPL_REV[c].push(p)})});
  function isHidden(id){return !!HIDDEN_EQ[id] || (!!IMPL_REV[id] && !IMPL_VISIBLE[id])}
  function syncImplied(){
    delete own.comp;
    Object.keys(IMPL_REV).forEach(function(c){
      if(IMPL_VISIBLE[c] || !eqById(c)) return;
      if(IMPL_REV[c].some(function(p){return ownA(p)})) own[c] = true; else delete own[c];
    });
  }
  function implOn(parent){(IMPL[parent]||[]).forEach(function(c){if(eqById(c)) own[c] = true})}
  function ownCount(){return EQUIP.filter(function(q){return own[q.id] && !isHidden(q.id)}).length}
  function eqById(id){return EQUIP.filter(function(q){return q.id===id})[0]}
  function updateCount(){
    renderDims();
    var n = ownCount();
    $("#eqcount").textContent = n + " équipement" + (n>1?"s":"") + " dans votre véhicule. Touchez pour modifier.";
    $("#eqtotal").textContent = n + " équipement" + (n>1?"s":"") + " coché" + (n>1?"s":"");
  }


  /* ---------- Dimensions du véhicule selon les équipements ---------- */
  var MODEL = DATA.vehicle.model;
  var DIMS = DATA.config.DIMS;
  var dimv = (function(){var o = {}; try{o = JSON.parse(lsGet("cdb_dim")||"{}")||{}}catch(e){} return o})();
  function dimVal(id){var v = dimv[id]; return (typeof v==="number" && v>=0) ? v : DIMS[id].v}
  function fm(x){return x.toFixed(2).replace(".",",")+" m"}
  function dimCell(k,icon,base,key){
    var best = null;
    Object.keys(DIMS).forEach(function(id){
      var d = DIMS[id]; if(d.t!==key || !own[id]) return;
      var v = dimVal(id); if(v>0 && (!best || v>best.v)) best = {v:v,n:d.n};
    });
    var tot = base + (best ? best.v/100 : 0);
    return '<div class="dim"><span class="k">'+icon+k+'</span><span class="v">'+fm(tot)+'</span><span class="d">'+(best ? 'Base '+fm(base)+' + <b>'+best.v+' cm</b> ('+esc(best.n)+', la plus grande mesure)' : 'Base '+fm(base)+', sans équipement ajouté')+'</span></div>';
  }
  function renderDims(){
    if(typeof renderHomeLoad==="function") renderHomeLoad();
    var el = $("#dims"); if(!el) return;
    var ar = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    el.innerHTML = dimCell("Longueur", ar+'<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>', MODEL.l, "l") +
                   dimCell("Hauteur", ar+'<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/></svg>', MODEL.h, "h");
  }

  /* ---------- Poids et charge ---------- */
  var WT = DATA.config.WT;
  var W_DEFAULT = DATA.vehicle.weights;
  var wt = (function(){var o = {}; try{o = JSON.parse(lsGet("cdb_wt")||"{}")||{}}catch(e){} o.opt = o.opt||{}; return o})();
  function wdrv(){return wt.drv!==false}
  function wv(k){var v = wt[k]; return (typeof v==="number" && v>=0) ? v : W_DEFAULT[k]}
  function wopt(id){var v = wt.opt[id]; return (typeof v==="number") ? v : WT[id]}
  function wtSave(){lsSet("cdb_wt",JSON.stringify(wt))}
  // Maximum load per axle: given by the dealership (vehicle profile), otherwise noted by the customer (0 = not known).
  function wax(k){var d = W_DEFAULT[k]; if(d>0) return d; var v = wt[k]; return (typeof v==="number" && v>0) ? v : 0}
  // Weighings noted by the customer, latest first: {d: date, t: total, av: front axle, ar: rear axle, n: note}.
  function wpes(){return Array.isArray(wt.pes) ? wt.pes : []}
  function fday(d){return new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}
  function wstate(rest){return rest < 0 ? "bad" : (rest < 100 ? "warn" : "ok")}
  function wmsg(st){return st==="ok"?"ok":(st==="warn"?"safety":"badmsg")}
  function loadCalc(){
    var opts = Object.keys(WT).filter(function(id){return own[id]}).map(function(id){return {id:id,n:eqById(id).name,kg:wopt(id)}});
    var optSum = opts.reduce(function(a,o){return a+o.kg},0);
    var lines = [
      {n:"Masse en ordre de marche (carte grise)",kg:wv("mom")},
      {n:"Conducteur (75 kg)",kg:wdrv()?0:75},
      {n:"Équipements ajoutés",kg:optSum},
      {n:"Passagers en plus du conducteur ("+wv("pax")+" × 75 kg)",kg:wv("pax")*75},
      {n:"Eau en plus des 20 L d'origine ("+wv("eau")+" L)",kg:wv("eau")},
      {n:"Gaz en plus de la dotation d'origine",kg:wv("gaz")},
      {n:"Bagages, vélos, matériel",kg:wv("bag")}
    ];
    var total = lines.reduce(function(a,l){return a+l.kg},0), ptac = wv("ptac"), rest = ptac - total;
    var st = rest < 0 ? "bad" : (rest < 100 ? "warn" : "ok");
    return {opts:opts,lines:lines,total:total,ptac:ptac,rest:rest,st:st,pct:Math.max(0,Math.min(100,ptac?total/ptac*100:0))};
  }
  function kg(n){return Math.round(n).toLocaleString("fr-FR")+" kg"}
  function stText(c){
    return c.st==="bad" ? "Surcharge de "+kg(-c.rest)+". Délestez avant de rouler : c'est une contravention de 4e classe (90 € pour les 500 premiers kg de dépassement), et un risque pour la sécurité et l'assurance."
         : c.st==="warn" ? "Il reste peu de marge. Pensez à alléger ou à vérifier par une pesée."
         : "Vous êtes dans la limite autorisée.";
  }
  function renderHomeLoad(){
    var el = $("#loadcard"); if(!el) return;
    var c = loadCalc();
    var p = wpes()[0];
    el.className = "loadcard is-"+c.st;
    el.innerHTML = '<span class="lc-top"><span class="lc-h">⚖️ Poids du véhicule</span><span class="lc-badge is-'+c.st+'">'+(c.st==="bad"?"Surcharge":(c.st==="warn"?"Peu de marge":"Dans la limite"))+'</span></span>' +
      '<span class="lc-top"><span class="lc-v '+c.st+'">'+(c.rest<0?"−":"")+kg(Math.abs(c.rest))+'</span><span class="lc-sub">'+(c.rest<0?"de trop":"encore possibles")+'</span></span>' +
      '<span class="gauge" aria-hidden="true"><i class="'+c.st+'" style="width:'+c.pct.toFixed(0)+'%"></i></span>' +
      '<span class="lc-sub">Estimé '+kg(c.total)+' sur '+kg(c.ptac)+' autorisés.'+(p?' Dernière pesée : '+kg(p.t)+' le '+fday(p.d)+'.':' Aucune pesée notée.')+'</span><span class="lc-more">Ajuster mon chargement ›</span>';
  }
  function fld(id,label,val,unit,hint,dis){
    return '<div class="fld"><label for="'+id+'">'+label+'</label><span class="dimin"><input id="'+id+'" type="number" inputmode="numeric" min="0" max="9999" step="1" value="'+val+'"'+(dis?' disabled':'')+'> '+unit+'</span>'+(hint?'<small>'+hint+'</small>':'')+'</div>';
  }
  function renderWeight(){
    var c = loadCalc();
    var h = '<div class="card" id="wgauge"></div>' +
      '<h3 class="sech">Mes pesées</h3><div class="card" id="wpes"></div>' +
      '<h3 class="sech">Votre véhicule</h3><div class="card">' +
      fld("w_ptac","PTAC (poids total autorisé en charge)",wv("ptac"),"kg",hand.code?"Fourni et vérifié par votre concession.":"Carte grise, rubrique F.2 : la limite à ne jamais dépasser. Valeur d'exemple.",!!hand.code) +
      fld("w_mom","Masse en ordre de marche (masse en service)",wv("mom"),"kg",hand.code?"Fourni et vérifié par votre concession.":"Carte grise, rubrique G.1 : véhicule de série avec carburant à 90 %, 20 L d'eau propre et gaz. Valeur d'exemple, à vérifier.",!!hand.code) +
      '<label class="eqitem"><input type="checkbox" id="w_drv"'+(wdrv()?' checked':'')+(hand.code?' disabled':'')+'><span><b>Ma valeur inclut déjà le conducteur (75 kg)</b><small>Les sources divergent entre G et G.1. Vérifiez sur votre certificat de conformité ; si le conducteur n\'y est pas, décochez.</small></span></label>' +
      fld("w_eav","Charge maximale sur l\'essieu avant",wax("eav")||"","kg",W_DEFAULT.eav>0?"Fourni par votre concession.":"Plaque du constructeur (montant de porte) ou certificat de conformité. Facultatif : sert à vérifier vos pesées essieu par essieu.",W_DEFAULT.eav>0) +
      fld("w_ear","Charge maximale sur l\'essieu arrière",wax("ear")||"","kg",W_DEFAULT.ear>0?"Fourni par votre concession.":"Même endroit. L\'arrière est souvent le plus chargé : porte-vélos, soute, réserves.",W_DEFAULT.ear>0) + '</div>' +
      '<h3 class="sech">Chargement</h3><div class="card">' +
      fld("w_pax","Passagers en plus du conducteur",wv("pax"),"pers.","75 kg par personne. Chaque passager réduit la charge utile, même si le véhicule a 4 places homologuées.") +
      fld("w_eau","Eau propre en plus des 20 L d'origine",wv("eau"),"L","La plupart des véhicules sont homologués avec 20 L seulement. 1 litre = 1 kg. Réservoir plein de 50 L : mettez 30.") +
      fld("w_gaz","Gaz en plus de la dotation d'origine",wv("gaz"),"kg","Bouteilles supplémentaires ou plus grosses que celles prévues d'origine (gaz plus bouteille vide). Sinon laissez 0.") +
      fld("w_bag","Bagages, vélos, matériel",wv("bag"),"kg","Pesez ou estimez : ça monte vite.") + '</div>' +
      '<h3 class="sech">Équipements ajoutés</h3>';
    if(c.opts.length){
      h += '<div class="card">'+c.opts.map(function(o){return fld("wo_"+o.id,esc(o.n),o.kg,"kg","")}).join("")+'<small class="picnote">Poids d\'exemple, à remplacer par ceux de la facture ou de la fiche technique. Tout ce qui est ajouté après la sortie d\'usine réduit la charge utile. Les équipements de série sont déjà dans la masse en ordre de marche.</small></div>';
    } else h += '<div class="empty"><p>Aucun équipement lourd coché. Les options de la liste « Mes équipements » ajoutent ici leur poids.</p><button class="btn" data-go="equip">Mes équipements</button></div>';
    h += '<h3 class="sech">Détail du calcul</h3><div class="card" id="wlines"></div><p class="sub">Estimation seulement. Seule une pesée fait foi. Dépasser le PTAC est interdit.</p><details class="cat"><summary><span>À savoir sur le poids</span></summary><div class="card"><small class="picnote">Pesée : un pèse-caravane électronique (une mesure par essieu, moins de 150 € environ) ou un pont-bascule.<br><br>Les essieux comptent aussi : le total peut être bon alors qu’un essieu dépasse sa limite, par exemple avec une charge lourde à l’arrière. Pesez essieu par essieu.<br><br>Permis B : jusqu’à 3,5 t de PTAC. Au-delà, il faut un permis poids lourd (C1 jusqu’à 7,5 t). Surcharger reste interdit avec n’importe quel permis.<br><br>Remorque : le PTRA figure en F.3 de la carte grise (case vide : pas d’attelage autorisé). Au-delà de 3,5 t de PTRA, 80 km/h sur route et 90 km/h sur autoroute.</small></div></details>';
    $("#weightbody").innerHTML = h;
    renderWeightSummary();
  }
  function renderWeightSummary(){
    var c = loadCalc(), g = $("#wgauge"); if(!g) return;
    g.innerHTML = '<p class="eyebrow">Charge restante</p><p class="lc-v big '+c.st+'">'+(c.rest<0?"−":"")+kg(Math.abs(c.rest))+'</p><span class="gauge"><i class="'+c.st+'" style="width:'+c.pct.toFixed(0)+'%"></i></span><p class="'+(c.st==="ok"?"ok":(c.st==="warn"?"safety":"badmsg"))+'">'+esc(stText(c))+'</p>';
    $("#wlines").innerHTML = c.lines.map(function(l){return '<div class="ln"><span>'+esc(l.n)+'</span><b>'+kg(l.kg)+'</b></div>'}).join("") + '<div class="ln tot"><span>Total estimé</span><b>'+kg(c.total)+'</b></div><div class="ln"><span>PTAC</span><b>'+kg(c.ptac)+'</b></div>';
    renderPesees();
    renderHomeLoad();
  }
  function axleLine(name,v,max){
    if(!v) return '';
    var over = max && v > max;
    return '<div class="ln"><span>'+name+(max?' (maximum '+kg(max)+')':'')+'</span><b class="'+(over?"wbad":"")+'">'+kg(v)+(max?(over?' ⚠':' ✓'):'')+'</b></div>';
  }
  function renderPesees(){
    var el = $("#wpes"); if(!el) return;
    var c = loadCalc(), P = wpes(), h = '';
    var today = new Date().toISOString().slice(0,10);
    if(P.length){
      var p = P[0], rest = c.ptac - p.t, st = wstate(rest), diff = p.t - c.total;
      h += '<p class="eyebrow">Dernière pesée, le '+fday(p.d)+'</p><p class="lc-v '+st+'">'+kg(p.t)+'</p>' +
        '<p class="'+wmsg(st)+'">'+(rest<0?"Surcharge de "+kg(-rest)+" ce jour-là : allégez avant de reprendre la route.":"Ce jour-là, il restait "+kg(rest)+" sous le PTAC.")+'</p>';
      var ax = axleLine("Essieu avant",p.av,wax("eav")) + axleLine("Essieu arrière",p.ar,wax("ear"));
      if(ax) h += '<div class="wlines">'+ax+'</div>';
      if((p.av && wax("eav") && p.av > wax("eav")) || (p.ar && wax("ear") && p.ar > wax("ear"))) h += '<p class="badmsg">Un essieu dépasse sa limite, même si le total est bon : répartissez la charge (plus lourd vers l\'avant si l\'arrière dépasse).</p>';
      if(p.n) h += '<p class="sub">'+esc(p.n)+'</p>';
      if(Math.abs(diff) >= 30) h += '<p class="sub">Votre estimation actuelle ('+kg(c.total)+') est '+(diff>0?"plus basse":"plus haute")+' de '+kg(Math.abs(diff))+'. Si vous étiez chargé comme d\'habitude ce jour-là, calez l\'estimation sur la pesée.</p><button class="btn alt" type="button" data-pes="cal">Caler mon estimation sur cette pesée</button>';
      if(P.length > 1) h += '<details class="cat"><summary><span>Pesées précédentes ('+(P.length-1)+')</span></summary><div class="wlines">'+P.slice(1).map(function(q,i){return '<div class="ln"><span>'+fday(q.d)+(q.n?' · '+esc(q.n):'')+' <button class="lnk" type="button" data-pes="del" data-i="'+(i+1)+'">Retirer</button></span><b>'+kg(q.t)+'</b></div>'}).join("")+'</div></details>';
      h += '<p><button class="lnk" type="button" data-pes="del" data-i="0">Retirer cette pesée</button></p>';
    } else h += '<p class="sub">Seule une pesée dit le poids réel. Pont-bascule (déchetterie, coopérative, carrière…) ou pèse-essieux : notez le résultat ici pour suivre votre poids au fil des voyages.</p>';
    h += '<details class="cat wpesadd"'+(P.length?'':' open')+'><summary><span>＋ Noter une pesée</span></summary>' +
      '<div class="fld"><label for="pe_d">Date</label><span class="dimin"><input id="pe_d" type="date" value="'+today+'" max="'+today+'"></span></div>' +
      fld("pe_t","Poids total",'',"kg","Ou remplissez seulement les deux essieux : le total se calcule.") +
      fld("pe_av","Essieu avant (facultatif)",'',"kg","") + fld("pe_ar","Essieu arrière (facultatif)",'',"kg","") +
      '<div class="fld"><label for="pe_n">Note (facultatif)</label><input id="pe_n" class="search" maxlength="120" placeholder="Lieu, plein d\'eau, vélos…"></div>' +
      '<button class="btn" type="button" data-pes="save" style="width:100%">Enregistrer la pesée</button></details>';
    if(window.CDB_CLOUD && window.CDB_CLOUD.partRequest) h += '<button class="btn alt" type="button" data-pes="shop" style="width:100%;margin-top:8px">🛒 Pèse-essieux : se peser soi-même</button>';
    el.innerHTML = h;
  }
  $("#weightbody").addEventListener("click",function(e){
    var b = e.target.closest("[data-pes]"); if(!b) return;
    var a = b.dataset.pes, P = wpes().slice();
    var val = function(id){var n = parseFloat(($("#"+id)||{}).value); return isNaN(n) ? 0 : Math.round(n)};
    if(a==="save"){
      var d = ($("#pe_d")||{}).value, t = val("pe_t"), av = val("pe_av"), ar = val("pe_ar");
      if(!t && av && ar) t = av + ar;
      if(!d || !t){toast("Indiquez la date et le poids total (ou les deux essieux)."); return}
      if(t < 1000 || t > 9999 || av > 9999 || ar > 9999){toast("Poids en kilos, entre 1 000 et 9 999 kg."); return}
      var q = {d:d,t:t}; if(av) q.av = av; if(ar) q.ar = ar;
      var n = (($("#pe_n")||{}).value||"").trim().slice(0,120); if(n) q.n = n;
      P.push(q); P.sort(function(x,y){return x.d < y.d ? 1 : (x.d > y.d ? -1 : 0)});
      wt.pes = P.slice(0,30); wtSave(); renderWeightSummary(); toast("Pesée enregistrée.");
    } else if(a==="del"){
      P.splice(+b.dataset.i,1); wt.pes = P; wtSave(); renderWeightSummary(); toast("Pesée retirée.");
    } else if(a==="cal" && P[0]){
      var c = loadCalc();
      wt.bag = Math.max(0, Math.min(9999, wv("bag") + P[0].t - c.total)); wtSave(); renderWeight(); toast("Estimation calée sur la pesée (ligne « Bagages »).");
    } else if(a==="shop"){
      window.CDB_CLOUD.partRequest(null,"Pèse-essieux (pesée roue par roue)","accessoire");
    }
  });
  $("#weightbody").addEventListener("input",function(e){
    var id = e.target.id; if(!id) return;
    var n = parseFloat(e.target.value); if(isNaN(n)) n = 0;
    n = Math.max(0,Math.min(9999,Math.round(n)));
    if(id==="w_drv"){wt.drv = e.target.checked; wtSave(); renderWeightSummary(); return}
    var map = {w_ptac:"ptac",w_mom:"mom",w_pax:"pax",w_eau:"eau",w_gaz:"gaz",w_bag:"bag",w_eav:"eav",w_ear:"ear"};
    if(map[id]) wt[map[id]] = n;
    else if(id.indexOf("wo_")===0) wt.opt[id.slice(3)] = Math.round(parseFloat(e.target.value)||0);
    else return;
    wtSave(); renderWeightSummary();
  });

  /* ---------- Écran Mes équipements ---------- */
  var eqMode = "all";
  function matches(q,query){
    if(!query) return true;
    return query.split(" ").every(function(w){return !w || q.idx.indexOf(w) >= 0});
  }
  function implRow(q){
    var ch = (IMPL[q.id]||[]).filter(function(c){return eqById(c)}).map(function(c){return eqById(c).name});
    if(!ch.length) return '';
    return '<div class="implrow" data-impl="'+q.id+'"'+(own[q.id]?'':' hidden')+'><b>Compris d\'office :</b> '+esc(ch.join(", "))+'.</div>';
  }
  function renderEquip(){
    var query = norm($("#esearch").value).trim(), html = "", total = 0;
    CATS.forEach(function(c){
      var all = EQUIP.filter(function(q){return q.cat===c[0] && !isHidden(q.id)});
      var items = all.filter(function(q){return matches(q,query) && (eqMode==="all" || own[q.id])});
      if(!items.length) return;
      total += items.length;
      var have = all.filter(function(q){return own[q.id]}).length;
      html += '<details class="cat" data-c="'+c[0]+'"'+((query||eqMode==="mine")?' open':'')+'><summary><span>'+esc(c[1])+'</span><span class="cnt" data-cc="'+c[0]+'">'+have+' sur '+all.length+'</span></summary>' +
        items.map(function(q){
          var row = '';
          if(DIMS[q.id]){
            var lab = DIMS[q.id].t==="l" ? "Dépassement à l'arrière" : "Hauteur au-dessus du toit";
            row = '<div class="dimrow" data-dr="'+q.id+'"'+(own[q.id]?'':' hidden')+'><label for="di_'+q.id+'">'+lab+'</label><span class="dimin"><input id="di_'+q.id+'" type="number" inputmode="numeric" min="0" max="300" step="1" data-di="'+q.id+'" value="'+dimVal(q.id)+'"> cm</span><small>Mesurez sur votre véhicule. La plus grande valeur est retenue pour la '+(DIMS[q.id].t==="l"?'longueur':'hauteur')+' totale.</small></div>';
          }
          return '<label class="eqitem"><input type="checkbox" data-e="'+q.id+'"'+(own[q.id]?' checked':'')+'><span><b>'+esc(q.name)+'</b>'+'</span></label>'+row+varRow(q)+implRow(q);
        }).join("") + '</details>';
    });
    if(!total) html = '<div class="empty"><p>'+(eqMode==="mine" && !query ? "Aucun équipement coché pour le moment." : "Aucun équipement ne correspond. Essayez un autre mot, par exemple « chauffage », « batterie » ou « antenne ».")+'</p></div>';
    $("#eqlist").innerHTML = html;
    updateCount();
  }
  function refreshCats(){
    CATS.forEach(function(c){
      var el = $('[data-cc="'+c[0]+'"]'); if(!el) return;
      var all = EQUIP.filter(function(q){return q.cat===c[0] && !isHidden(q.id)});
      el.textContent = all.filter(function(q){return own[q.id]}).length + " sur " + all.length;
    });
    updateCount();
  }
  $("#eqlist").addEventListener("change",function(e){
    var id = e.target.dataset.e; if(!id) return;
    if(e.target.checked){own[id] = true; implOn(id); if(APP_VARS[id]){Object.keys(APP_VARS[id]).forEach(function(k){vars[k] = APP_VARS[id][k]}); varSave()}} else delete own[id];
    syncImplied();
    var ir = $('[data-impl="'+id+'"]'); if(ir) ir.hidden = !e.target.checked;
    var dr = $('[data-dr="'+id+'"]'); if(dr) dr.hidden = !e.target.checked;
    var vr = $('[data-vr="'+id+'"]'); if(vr) vr.hidden = !e.target.checked;
    saveOwn(); refreshCats();
  });
  $("#eqlist").addEventListener("input",function(e){
    var id = e.target.dataset.di; if(!id) return;
    var n = parseFloat(e.target.value);
    if(isNaN(n) || n<0) delete dimv[id]; else dimv[id] = Math.min(300,Math.round(n));
    lsSet("cdb_dim",JSON.stringify(dimv)); renderDims();
  });
  $("#eqlist").addEventListener("click",function(e){
    var b = e.target.closest("[data-vv]"); if(!b) return;
    var id = b.dataset.vv; vars[id] = b.dataset.v; varSave();
    var row = b.closest(".varrow");
    row.querySelectorAll(".vchip").forEach(function(c){c.setAttribute("aria-pressed", c===b ? "true":"false")});
    var o = varOpt(id), h = row.querySelector(".vh"); if(h) h.textContent = (o && o[2]) ? o[2] : "Touchez la réponse qui correspond : l'appli adaptera ses conseils et son diagnostic.";
    toast("Enregistré");
  });
  $("#esearch").addEventListener("input",renderEquip);
  function setMode(m){
    eqMode = m;
    $("#mAll").setAttribute("aria-pressed", m==="all"?"true":"false");
    $("#mMine").setAttribute("aria-pressed", m==="mine"?"true":"false");
    renderEquip();
  }
  $("#mAll").addEventListener("click",function(){setMode("all")});
  $("#mMine").addEventListener("click",function(){setMode("mine")});
  (function(){
    var sel = $("#ae_cat"); sel.innerHTML = CATS.map(function(c){return '<option value="'+c[0]+'">'+esc(c[1])+'</option>'}).join("");
    var pending = null;
    $("#ae_file").addEventListener("change",function(e){
      var f = e.target.files && e.target.files[0]; if(!f) return;
      resizeImg(f,function(d){
        if(!d){toast("Cette photo n'a pas pu être lue.");return}
        pending = d; var p = $("#ae_prev"); p.src = d; p.hidden = false;
        $("#ae_phl").firstChild.nodeValue = "Changer la photo";
      });
    });
    $("#ae_ok").addEventListener("click",function(){
      var name = $("#ae_name").value.trim();
      if(!name){toast("Écrivez d'abord le nom de l'équipement.");$("#ae_name").focus();return}
      var id = "u_"+Date.now().toString(36);
      var c = {id:id,cat:$("#ae_cat").value,name:name.slice(0,60)};
      UEQ.push(c); ueqSave(); addCustom(c); own[id] = true; saveOwn();
      if(pending){UPH[id] = pending; if(!uphSave()){delete UPH[id]; toast("Équipement ajouté, mais la photo n'a pas pu être gardée (mémoire pleine).")} else toast("Équipement et photo ajoutés")} else toast("Équipement ajouté");
      pending = null; $("#ae_name").value = ""; $("#ae_prev").hidden = true; $("#ae_phl").firstChild.nodeValue = "Prendre ou choisir une photo";
      $("#addeq").open = false; $("#esearch").value = ""; renderEquip();
    });
  })();
  

  /* ---------- C'est quoi, ça ? : plan réel du V114 vu du dessus ---------- */
  var SPOTS = DATA.vehicle.spots;
  var FULL = {x:0,y:0,w:800,h:360}, vb = {x:0,y:0,w:800,h:360}, selSpot = null, anim = null;
  function spotById(id){return SPOTS.filter(function(z){return z.id===id})[0]}
  var PORD = {}; PIT.forEach(function(p,k){PORD[p.id]=k});
  function ownedAt(id){return EQUIP.filter(function(q){return q.spot===id && own[q.id]}).sort(function(a,b){return (PORD[a.id]==null?999:PORD[a.id])-(PORD[b.id]==null?999:PORD[b.id])})}
  function ownedNoSpot(){return EQUIP.filter(function(q){return !q.spot && own[q.id]})}

  function drawSpots(){
    $("#planSpots").innerHTML = SPOTS.map(function(s){
      var empty = ownedAt(s.id).length===0;
      return '<g class="spot'+(empty?' empty':'')+(selSpot===s.id?' sel':'')+'" data-id="'+s.id+'" tabindex="0" role="button" aria-label="'+esc(s.n+'. '+s.name)+'"><circle r="38" fill="transparent"/><circle class="dot" r="26"/><text>'+s.n+'</text></g>';
    }).join("");
    applyVb();
  }
  function applyVb(){
    $("#planSvg").setAttribute("viewBox", vb.x+" "+vb.y+" "+vb.w+" "+vb.h);
    var k = vb.w/FULL.w;
    $$("#planSpots .spot").forEach(function(g){
      var s = spotById(g.dataset.id);
      g.setAttribute("transform","translate("+s.x+" "+s.y+") scale("+k.toFixed(3)+")");
    });
  }
  function animateTo(t){
    if(anim) cancelAnimationFrame(anim);
    if(reduce){vb = {x:t.x,y:t.y,w:t.w,h:t.h}; applyVb(); return}
    var from = {x:vb.x,y:vb.y,w:vb.w,h:vb.h}, t0 = null, D = 450;
    function step(ts){
      if(t0===null) t0 = ts;
      var p = Math.min(1,(ts-t0)/D), e = 1-Math.pow(1-p,3);
      vb = {x:from.x+(t.x-from.x)*e, y:from.y+(t.y-from.y)*e, w:from.w+(t.w-from.w)*e, h:from.h+(t.h-from.h)*e};
      applyVb();
      if(p<1) anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
  }
  var CAM_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  var X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function photoWrap(it,media,has){
    return '<div class="phwrap">'+media+'<div class="phact">'+(has?'<button type="button" class="phcam" data-phdel="'+it.id+'" aria-label="Retirer ma photo" title="Retirer ma photo">'+X_SVG+'</button>':'')+'<label class="phcam" title="'+(has?'Changer ma photo':'Ajouter ma photo')+'" aria-label="'+(has?'Changer ma photo':'Ajouter ma photo')+'">'+CAM_SVG+'<input type="file" accept="image/*" data-ph="'+it.id+'" hidden></label></div></div>';
  }
  function photoExtra(it){return it.custom ? '<p class="phdel"><button type="button" class="linkbtn" data-eqdel="'+it.id+'">Supprimer cet équipement</button></p>' : ''}
  function photoBox(it){
    if(UPH[it.id]){return photoWrap(it,'<img class="pic" src="'+UPH[it.id]+'" alt="'+esc(it.name)+'">',true)+'<p class="picnote">Votre photo. Touchez-la pour l\'agrandir.</p>'+photoExtra(it)}
    if(PHOTOS[it.id]!=null){return photoWrap(it,'<img class="pic" src="'+PH[PHOTOS[it.id]]+'" alt="'+esc(it.name)+'">',false)+'<p class="picnote">Photo de votre '+esc(DATA.vehicle.fullName)+'. Touchez-la pour l\'agrandir.</p>'+photoExtra(it)}
    if(it.img) return photoWrap(it,'<img class="pic" src="'+it.img+'" alt="'+esc(it.name)+'" loading="lazy">',false)+'<p class="picnote">Touchez la photo pour l\'agrandir.</p>'+photoExtra(it);
    return photoWrap(it,'<div class="photo">'+CAM_SVG+'<span>Pas encore de photo</span><span>'+esc(it.name)+'</span></div>',false)+photoExtra(it);
  }
  function resizeImg(file,cb){
    var r = new FileReader();
    r.onerror = function(){cb(null)};
    r.onload = function(){
      var im = new Image();
      im.onerror = function(){cb(null)};
      im.onload = function(){
        var m = 1000, w = im.width, h = im.height, k = Math.min(1,m/Math.max(w,h));
        var c = document.createElement("canvas"); c.width = Math.round(w*k); c.height = Math.round(h*k);
        c.getContext("2d").drawImage(im,0,0,c.width,c.height);
        var out; try{out = c.toDataURL("image/jpeg",0.72)}catch(e){out = null}
        cb(out);
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  }
  function setUserPhoto(id,file,done){
    resizeImg(file,function(d){
      if(!d){toast("Cette photo n'a pas pu être lue.");return}
      var prev = UPH[id]; UPH[id] = d;
      if(!uphSave()){ if(prev) UPH[id] = prev; else delete UPH[id]; toast("Mémoire pleine : retirez une photo avant d'en ajouter."); return }
      toast("Photo enregistrée"); if(done) done();
    });
  }
  var mods = (function(){var o = {}; try{o = JSON.parse(lsGet("cdb_mod")||"{}")||{}}catch(e){} var vm = DATA.vehicle.models||{}; Object.keys(vm).forEach(function(k){var m = o[k] = o[k]||{}; if(!m.name && vm[k]) m.name = vm[k]}); return o})();
  function modSave(){lsSet("cdb_mod",JSON.stringify(mods))}
  window.CDB_PARTINFO = function(id){var it = eqById(id); if(!it) return null; var m = mods[id]||{}; return {id:id, name:it.name, userPhoto: UPH[id] || null, genericPhoto: PHOTOS[id]!=null ? PH[PHOTOS[id]] : (it.img||null), model:m.name||"", ref:m.ref||""}};
  window.CDB_SETMOD = function(id,name,ref){if(!eqById(id)) return; var m = mods[id] = mods[id]||{}; m.name = String(name||"").slice(0,80); m.ref = String(ref||"").slice(0,80); modSave()};
  var PLATE = DATA.config.PLATE;
  var VARIANTS = DATA.config.VARIANTS;
  var V114_VARS = DATA.vehicle.vars || {};
  var vars = (function(){var o = null; try{var t = lsGet("cdb_var"); if(t) o = JSON.parse(t)}catch(e){} if(!o||typeof o!=="object"){o = {}; Object.keys(V114_VARS).forEach(function(k){o[k]=V114_VARS[k]})} return o})();
  function varSave(){lsSet("cdb_var",JSON.stringify(vars))}
  function varOpt(id){var V = VARIANTS[id], v = vars[id]; if(!V || !v) return null; return V.o.filter(function(o){return o[0]===v})[0]||null}
  function varRow(q){
    var V = VARIANTS[q.id]; if(!V) return "";
    var sel = vars[q.id], o = varOpt(q.id);
    return '<div class="varrow" data-vr="'+q.id+'"'+(own[q.id]?'':' hidden')+'><span class="vq">'+esc(V.q)+'</span><div class="vchips">'+
      V.o.map(function(x){return '<button type="button" class="vchip" data-vv="'+q.id+'" data-v="'+x[0]+'" aria-pressed="'+(sel===x[0])+'">'+esc(x[1])+'</button>'}).join("")+'</div>'+
      '<small class="vh">'+(o && o[2] ? esc(o[2]) : "Touchez la réponse qui correspond : l'appli adaptera ses conseils et son diagnostic.")+'</small></div>';
  }
  function modLabel(id){var m = mods[id]; if(!m || (!m.name && !m.ref)) return ""; return [m.name,m.ref&&("réf. "+m.ref)].filter(Boolean).join(", ")}
  function modBlock(it){
    var m = mods[it.id]||{}, ml = modLabel(it.id);
    return '<details class="mod"><summary>'+(ml?'Mon modèle : <b>'+esc(ml)+'</b>':'Afficher / noter le modèle et le numéro de série')+'</summary>'+
      '<label>Marque et modèle<input class="search" type="text" data-mod="'+it.id+'" data-f="name" autocomplete="off" placeholder="Ex. marque et nom du modèle" value="'+esc(m.name||"")+'"></label>'+
      '<label>Numéro de série ou référence (si l\'équipement en a un)<input class="search" type="text" data-mod="'+it.id+'" data-f="ref" autocomplete="off" placeholder="Facultatif" value="'+esc(m.ref||"")+'"></label>'+
      '<small>À relever '+esc(PLATE[it.id]||"sur l'étiquette ou la plaque de l'équipement, ou dans la notice")+'. Beaucoup de pièces (bonde, joint…) n\'ont pas de numéro : notez alors seulement la marque, ou prenez-les en photo. Tout s\'enregistre tout seul sur ce téléphone, vous n\'avez rien à valider.</small><p class="saved" aria-live="polite" hidden>✓ Enregistré</p></details>';
  }
  function card(it){
    return '<div class="card">'+photoBox(it)+'<h3>'+esc(it.name)+'</h3><p>'+esc(it.text)+'</p>'+(it.tip?'<div class="tip">'+esc(it.tip)+'</div>':'')+(varOpt(it.id) && varOpt(it.id)[0]!=="ns" ? '<p class="vline">Votre type : '+esc(varOpt(it.id)[1])+'</p>' : '')+modBlock(it)+'<button class="btn alt partbtn" type="button" data-part="'+it.id+'">🛒 Pièce ou remplacement</button></div>';
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function zoomTo(s){
    $("#whint").hidden = true;
    animateTo({x:clamp(s.x-120,0,560),y:clamp(s.y-54,0,252),w:240,h:108});
  }
  function selectSpot(id){
    selSpot = id;
    var s = spotById(id), mine = ownedAt(id);
    var rest = EQUIP.filter(function(q){return q.spot===id && !own[q.id]});
    $$("#planSpots .spot").forEach(function(g){g.classList.toggle("sel", g.dataset.id===id)});
    zoomTo(s);
    var h = '<div class="detail"><button class="btn alt" id="zback" style="width:100%">← Revenir au plan</button><p class="eyebrow">Zone '+s.n+'</p><h2>'+esc(s.name)+'</h2>';
    if(mine.length) h += mine.map(card).join("");
    else h += '<div class="empty"><p>Aucun équipement coché dans cette zone.</p><button class="btn" data-go="equip">Modifier mes équipements</button></div>';
    if(rest.length) h += '<p class="sub">Possible aussi ici, non coché : '+rest.map(function(q){return esc(q.name)}).join(", ")+'. <a href="#" data-go="equip" style="color:var(--accent)">Ajouter</a></p>';
    h += '<p class="sub">Selon le modèle, voir aussi la notice du constructeur.</p></div>';
    $("#whatbody").innerHTML = h;
    var d = $("#whint"); if(d.scrollIntoView) d.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
  }
  function showItem(id){
    var it = eqById(id); if(!it) return;
    window.CDB_TRACK&&window.CDB_TRACK("equip",{id:id,label:it.name});
    if(it.spot){selectSpot(it.spot); return}
    selSpot = null; $$("#planSpots .spot").forEach(function(g){g.classList.remove("sel")});
    $("#whatbody").innerHTML = '<div class="detail"><button class="btn alt" id="zback" style="width:100%">← Retour à la liste</button><p class="eyebrow">Emplacement variable selon le modèle</p>'+card(it)+'</div>';
    window.scrollTo(0,0);
  }
  function resetPlan(){
    selSpot = null;
    $("#whint").hidden = false;
    $$("#planSpots .spot").forEach(function(g){g.classList.remove("sel")});
    animateTo({x:FULL.x,y:FULL.y,w:FULL.w,h:FULL.h});
    renderWhatList();
  }
  function renderWhatList(){
    var query = norm($("#wsearch").value).trim(), h = "";
    if(query){
      var res = EQUIP.filter(function(q){return own[q.id] && matches(q,query)});
      h = '<p class="eyebrow">'+res.length+' résultat'+(res.length>1?'s':'')+' dans vos équipements</p>';
      if(res.length){
        h += '<div class="list" style="margin-top:8px">'+res.map(function(q){
          var z = q.spot ? 'Zone '+spotById(q.spot).n+' · '+spotById(q.spot).name : 'Emplacement variable';
          return '<button class="row" data-e="'+q.id+'"><span>'+esc(q.name)+'<small>'+esc(z)+'</small></span><span aria-hidden="true">›</span></button>';
        }).join("")+'</div>';
      } else {
        h += '<div class="empty" style="margin-top:8px"><p>Rien ne correspond dans vos équipements. Il manque peut-être à la liste.</p><button class="btn" data-go="equip">Ouvrir Mes équipements</button></div>';
      }
      $("#whatbody").innerHTML = h; return;
    }
    h = '<p class="eyebrow">Ou choisissez dans la liste</p><div class="list" style="margin-top:8px">' +
      SPOTS.map(function(s){var n = ownedAt(s.id).length; return '<button class="row" data-id="'+s.id+'"><span>'+s.n+'. '+esc(s.name)+'<small>'+n+' équipement'+(n>1?'s':'')+'</small></span><span aria-hidden="true">›</span></button>'}).join("") + '</div>';
    var ns = ownedNoSpot();
    if(ns.length){
      h += '<p class="eyebrow" style="margin-top:16px">Sans emplacement sur le plan ('+ns.length+')</p><div class="list" style="margin-top:8px">'+
        ns.map(function(q){return '<button class="row" data-e="'+q.id+'"><span>'+esc(q.name)+'</span><span aria-hidden="true">›</span></button>'}).join("")+'</div>';
    }
    var kept = EQUIP.filter(function(q){return modLabel(q.id)});
    if(kept.length) h += '<p class="eyebrow" style="margin-top:16px">Mes modèles mémorisés ('+kept.length+')</p><div class="card">'+kept.map(function(q){return '<div class="mem"><b>'+esc(q.name)+'</b><span>'+esc(modLabel(q.id))+'</span></div>'}).join("")+'</div>';
    h += '<p class="sub" style="margin-top:12px">Ce qui apparaît ici dépend de vos équipements cochés. Photos du véhicule : rapportez-vous aux « Photo à ajouter » pour les compléter.</p>';
    $("#whatbody").innerHTML = h;
  }
  function renderWhat(){
    drawSpots();
    if(selSpot) selectSpot(selSpot); else renderWhatList();
  }
  $("#wsearch").addEventListener("input",function(){
    if(selSpot){selSpot = null; $("#whint").hidden = false; animateTo({x:0,y:0,w:800,h:360}); drawSpots()}
    renderWhatList();
  });
  $("#planSpots").addEventListener("click",function(e){
    var g = e.target.closest(".spot"); if(g){$("#wsearch").value=""; selectSpot(g.dataset.id)}
  });
  $("#planSpots").addEventListener("keydown",function(e){
    if(e.key==="Enter" || e.key===" "){var g = e.target.closest(".spot"); if(g){e.preventDefault(); $("#wsearch").value=""; selectSpot(g.dataset.id)}}
  });
  $("#whatbody").addEventListener("input",function(e){
    var t = e.target; if(!t.dataset || !t.dataset.mod) return;
    var m = mods[t.dataset.mod] = mods[t.dataset.mod]||{}; m[t.dataset.f] = t.value.slice(0,80); modSave();
    var d = t.closest("details"); if(!d) return;
    var sm = d.querySelector("summary"), ml = modLabel(t.dataset.mod);
    sm.innerHTML = ml ? 'Mon modèle : <b>'+esc(ml)+'</b>' : 'Afficher / noter le modèle et le numéro de série';
    var sv = d.querySelector(".saved"); sv.hidden = true; clearTimeout(d._t);
    d._t = setTimeout(function(){sv.hidden = false}, 700);
  });
  $("#whatbody").addEventListener("change",function(e){
    var t = e.target; if(!t.dataset || !t.dataset.ph || !t.files || !t.files[0]) return;
    var id = t.dataset.ph;
    setUserPhoto(id,t.files[0],function(){showItem(id)});
  });
  $("#whatbody").addEventListener("click",function(e){
    var pb = e.target.closest("[data-part]"); if(pb){window.CDB_CLOUD.partRequest(pb.dataset.part); return}
    var im = e.target.closest("img.pic"); if(im){im.classList.toggle("full"); if(im.parentNode.tagName==="FIGURE") im.parentNode.classList.toggle("full"); return}
    var pd = e.target.closest("[data-phdel]"); if(pd){delete UPH[pd.dataset.phdel]; uphSave(); toast("Photo retirée"); showItem(pd.dataset.phdel); return}
    var ed = e.target.closest("[data-eqdel]"); if(ed){
      var id = ed.dataset.eqdel;
      EQUIP = EQUIP.filter(function(q){return q.id!==id}); UEQ = UEQ.filter(function(q){return q.id!==id});
      delete own[id]; delete UPH[id]; ueqSave(); uphSave(); saveOwn(); toast("Équipement supprimé");
      $("#wsearch").value=""; resetPlan(); renderEquip(); window.scrollTo(0,0); return}
    if(e.target.closest("#zback")){$("#wsearch").value=""; resetPlan(); window.scrollTo(0,0); return}
    if(e.target.closest("[data-go]")) return;
    var q = e.target.closest("[data-e]"); if(q){showItem(q.dataset.e); return}
    var r = e.target.closest("[data-id]"); if(r){selectSpot(r.dataset.id)}
  });
  syncImplied(); updateCount();

  /* ---------- Rendez-vous atelier ---------- */
  var DEALER = DATA.dealer;
  var MOTIFS = DATA.motifs;
  var rdv = {m:null,ctx:"",msg:"",sent:false,period:"15 jours"};
  function ownsAny(ids){return ids.some(function(i){return ownA(i)})}
  function motifById(id){return MOTIFS.filter(function(m){return m.id===id})[0]}
  function motifsFor(){return MOTIFS.filter(function(m){return !m.needs || ownsAny(m.needs)})}
  function buildMsg(){
    var m = motifById(rdv.m); if(!m) return "";
    var t = "Bonjour, je souhaite prendre rendez-vous pour : " + (rdv.m==="souci" ? "un souci sur mon véhicule" : m.t) + ".";
    if(rdv.m==="souci" && rdv.ctx) t += "\nMon souci : " + rdv.ctx;
    else if(m.why) t += "\nPourquoi : " + m.why;
    t += "\nVéhicule : "+DATA.vehicle.fullName+".";
    if(m.needs){
      var n = EQUIP.filter(function(q){return m.needs.indexOf(q.id)>=0 && own[q.id]}).map(function(q){return q.name});
      if(n.length) t += "\nÉquipement concerné : " + n.join(", ") + ".";
    }
    return t;
  }
  function openRdv(id,ctx){rdv.m = motifById(id) ? id : "souci"; rdv.ctx = ctx||""; rdv.msg = buildMsg(); rdv.sent = false; go("rdv")}
  function dealerCard(){
    return '<div class="card" style="flex-direction:row;align-items:center;gap:14px">'+dlogoHtml()+'<div><b style="font-family:var(--font-display);font-size:18px">'+esc(DEALER.name)+'</b><p class="sub">'+esc(DEALER.hours)+'<br>'+esc(DEALER.tel)+'</p></div></div>';
  }
  function renderRdv(){
    var b = $("#rdvbody");
    if(rdv.sent){
      b.innerHTML = dealerCard()+'<div class="ok"><b>Demande envoyée.</b> '+esc(DEALER.name)+' vous répond ici, dans « Mes demandes ». Délai souhaité : '+esc(rdv.period)+'.</div><div id="cloudreq" class="cloud-block"></div><button class="btn alt" id="rnew" style="width:100%">Faire une autre demande</button>';
      if(window.CDB_CLOUD && window.CDB_CLOUD.rdvRendered) window.CDB_CLOUD.rdvRendered();
      return;
    }
    var h = dealerCard() + '<div id="cloudreq" class="cloud-block"></div><p class="eyebrow">Nouvelle demande</p><div class="opts">' +
      motifsFor().map(function(m){return '<button class="opt'+(rdv.m===m.id?' sel':'')+'" data-m="'+m.id+'" aria-pressed="'+(rdv.m===m.id)+'">'+esc(m.t)+'</button>'}).join("") + '</div>';
    if(rdv.m){
      h += '<label class="eyebrow" for="rmsg">Message pour l\'atelier (modifiable)</label><textarea class="search" id="rmsg" rows="10" style="line-height:1.4"></textarea>' +
        '<p class="eyebrow">Quand ?</p><div class="seg" role="group" aria-label="Délai">' +
        ["Cette semaine","15 jours","Ce mois-ci"].map(function(p){return '<button data-p="'+p+'" aria-pressed="'+(rdv.period===p)+'">'+p+'</button>'}).join("") + '</div>' +
        '<label class="eyebrow" for="rtel">Votre numéro (facultatif)</label><input class="search" id="rtel" type="tel" inputmode="tel" placeholder="06 00 00 00 00" autocomplete="off">' +
        '<button class="btn" id="rsend" style="width:100%">Envoyer ma demande</button><p class="sub">La demande part vers l\'atelier de votre concession.</p>';
    }
    b.innerHTML = h;
    if(rdv.m) $("#rmsg").value = rdv.msg;
    if(window.CDB_CLOUD && window.CDB_CLOUD.rdvRendered) window.CDB_CLOUD.rdvRendered();
  }
  $("#rdvbody").addEventListener("click",function(e){
    var m = e.target.closest("[data-m]");
    if(m){rdv.m = m.dataset.m; rdv.ctx = rdv.m==="souci" ? rdv.ctx : ""; rdv.msg = buildMsg(); renderRdv(); var t=$("#rmsg"); if(t&&t.scrollIntoView) t.scrollIntoView({behavior:reduce?"auto":"smooth",block:"center"}); return}
    var p = e.target.closest("[data-p]");
    if(p){rdv.period = p.dataset.p; $$("#rdvbody [data-p]").forEach(function(x){x.setAttribute("aria-pressed", x===p?"true":"false")}); return}
    if(e.target.closest("#rsend")){var rb = e.target.closest("#rsend"), rm = motifById(rdv.m); rb.disabled = true; window.CDB_CLOUD.sendRequest({title: rdv.m==="souci" ? "Un souci sur mon véhicule" : rm.t, message: rdv.msg, period: rdv.period, phone: ($("#rtel")||{}).value || ""}).then(function(){rdv.sent = true; renderRdv(); window.scrollTo(0,0)}).catch(function(err){rb.disabled = false; toast(err.message)}); return}
    if(e.target.closest("#rnew")){rdv = {m:null,ctx:"",msg:"",sent:false,period:"15 jours"}; renderRdv()}
  });
  $("#rdvbody").addEventListener("input",function(e){if(e.target.id==="rmsg") rdv.msg = e.target.value});
  document.addEventListener("click",function(e){
    var r = e.target.closest("[data-rdv]");
    if(r) openRdv(r.dataset.rdv, r.dataset.ctx || "");
  });

  /* ---------- Espace concession : mise en main ---------- */
  var hand = (function(){var o = {}; try{o = JSON.parse(lsGet("cdb_hand")||"{}")||{}}catch(e){} o.steps = o.steps||{}; o.name = o.name||""; o.vin = o.vin||""; return o})();
  function handSave(){lsSet("cdb_hand",JSON.stringify(hand))}
  function dimTot(key,base){
    var best = 0;
    Object.keys(DIMS).forEach(function(id){var d = DIMS[id]; if(d.t===key && own[id]) best = Math.max(best,dimVal(id))});
    return base + best/100;
  }
  var HSTEPS = [
    {k:"eq",t:"Équipements du véhicule",go:"equip",goLabel:"Ouvrir la liste",sum:function(){return ownCount()+" équipements cochés pour ce véhicule. Comparez avec le bon de commande et ajustez la liste."}},
    {k:"wt",t:"Poids et PTAC",go:"weight",goLabel:"Ouvrir le poids",sum:function(){var c = loadCalc(); return "PTAC "+kg(c.ptac)+", masse en ordre de marche "+kg(wv("mom"))+". À comparer avec la fiche technique."}},
    {k:"dim",t:"Longueur et hauteur",go:"home",goLabel:"Voir l'accueil",sum:function(){return "Longueur "+fm(dimTot("l",MODEL.l))+", hauteur "+fm(dimTot("h",MODEL.h))+". Mesures des accessoires saisies ?"}},
    {k:"liv",t:"Points oubliés par les premiers clients",go:"daily",goLabel:"Voir les gestes",sum:function(){return "Clim : 230 V uniquement, réversible (chaud et froid), avec télécommande. Stores et rideaux : se manipulent doucement, sans crainte. Départ : câble P17, cales, marchepied, antenne, lanterneaux."}},
    {k:"expl",t:"Explications données au client",go:"daily",goLabel:"Ouvrir les gestes",sum:function(){return "Arrivée, départ, entretien, gaz et électricité, eaux, rendez-vous atelier : tout a été montré sur le véhicule."}}
  ];
  function renderHand(){
    var b = $("#handbody"), left = HSTEPS.filter(function(s){return !hand.steps[s.k]}).length;
    var h = '<div class="card"><p class="eyebrow">Espace concession</p><p>Mise en main de <b>'+esc(DEALER.name)+'</b>. Vérifiez chaque point avec le client, puis générez son code d\'accès. Cet écran est réservé à la concession : son code est demandé pour valider.</p></div>';
    h += '<div class="card">'+
      '<div class="fld"><label for="h_name">Prénom du client (facultatif)</label><input class="search" id="h_name" type="text" autocomplete="off" value="'+esc(hand.name)+'"></div>'+
      '<div class="fld"><label for="h_vin">Numéro de série du véhicule (VIN)</label><input class="search" id="h_vin" type="text" autocomplete="off" autocapitalize="characters" placeholder="17 caractères" value="'+esc(hand.vin)+'"><small class="sub">Reste sur ce téléphone, jamais enregistré sur nos serveurs.</small></div></div>';
    h += '<p class="eyebrow">À vérifier avec le client</p>';
    h += HSTEPS.map(function(s){
      var on = !!hand.steps[s.k];
      return '<div class="card hstep'+(on?' done':'')+'"><div class="hrow"><h3>'+esc(s.t)+'</h3><span class="hchk" aria-hidden="true">'+(on?'✓':'')+'</span></div><p class="sub">'+esc(s.sum())+'</p><div class="btns"><button class="btn alt" data-go="'+s.go+'">'+esc(s.goLabel)+'</button><button class="btn'+(on?' alt':'')+'" data-hs="'+s.k+'" aria-pressed="'+on+'">'+(on?'Vérifié, annuler':'Marquer vérifié')+'</button></div></div>';
    }).join("");
    if(hand.code){
      h += '<div class="result"><p class="eyebrow">Code d\'accès client</p><p class="lc-v big" style="font-size:30px;letter-spacing:.02em;white-space:nowrap">'+esc(hand.code)+'</p><p>Remis le '+esc(hand.date)+(hand.name?' à '+esc(hand.name):'')+'. Avec son nom, ce code permet au client de retrouver ses données sur un autre téléphone. Valable 2 ans.</p><button class="btn alt" id="hreset" style="width:100%">Nouvelle mise en main</button></div>';
    } else {
      h += '<button class="btn" id="hgen" style="width:100%"'+(left?' disabled':'')+'>Valider et générer le code</button>'+(left?'<p class="sub">Il reste '+left+' point'+(left>1?'s':'')+' à vérifier.</p>':'');
    }
    b.innerHTML = h;
  }
  function renderVerified(){
    var el = $("#verified"); if(!el) return;
    el.hidden = !hand.code;
    if(hand.code) el.textContent = "✓ Vérifié par "+DEALER.name+" le "+hand.date;
  }
  $("#handbody").addEventListener("click",function(e){
    var s = e.target.closest("[data-hs]");
    if(s){hand.steps[s.dataset.hs] = !hand.steps[s.dataset.hs]; handSave(); renderHand(); return}
    if(e.target.closest("#hgen")){
      var hb = e.target.closest("#hgen"); hb.disabled = true;
      window.CDB_CLOUD.accessCode({firstName:hand.name, vin:hand.vin}).then(function(r){
        if(!r){hb.disabled = false; return}
        hand.code = r.code; hand.date = r.date; hand.expires = r.expiresAt; handSave(); renderHand(); renderVerified(); window.scrollTo(0,document.body.scrollHeight);
      }).catch(function(err){hb.disabled = false; toast(err.message)});
      return;
    }
    if(e.target.closest("#hreset")){hand = {steps:{},name:"",vin:"",code:null,date:null}; handSave(); renderHand(); renderVerified()}
  });
  $("#handbody").addEventListener("input",function(e){
    if(e.target.id==="h_name") hand.name = e.target.value; else if(e.target.id==="h_vin") hand.vin = e.target.value; else return;
    handSave();
  });
  renderVerified();

  /* ---------- Diagnostic ---------- */
  var DCATS = [["eau","Eau"],["elec","Électricité et batteries"],["gaz","Gaz et cuisine"],["chauf","Chauffage et eau chaude"],["frigo","Réfrigérateur"],["wc","Toilettes et odeurs"],["hum","Humidité et étanchéité"],["ext","Extérieur, porteur et accessoires"]];
  var SAFE_PRO = "Cette intervention relève de l'atelier. Les vérifications ci-dessus ne demandent aucun démontage.";
  var SOUCIS = DATA.diagnostics;
  var diag = {i:-1,ans:[],auto:[],h:[]};
  function autoAdvance(){
    for(var g=0; g<8; g++){
      var n = diagNode();
      if(!(n.n && n.vk)) return;
      var val = vars[n.vk]; if(!val || val==="ns") return;
      var idx = -1; n.vv.forEach(function(p,i){if(p.split("|").indexOf(val)>=0) idx = i});
      if(idx<0) return;
      diag.ans.push(idx); diag.auto[diag.ans.length-1] = VARIANTS[n.vk].q + " : " + varOpt(n.vk)[1];
    }
  }
  function causeOn(c){var v; if(c.only){v = vars[c.only[0]]; if(v && v!=="ns" && c.only[1].indexOf(v)<0) return false} if(c.not){v = vars[c.not[0]]; if(v && c.not[1].indexOf(v)>=0) return false} return true}
  function elimState(s){
    var E = s.elim, rem = E.causes.filter(causeOn).map(function(c){return c.k}), asked = {}, conf = null, nq = 0;
    diag.h.forEach(function(h){
      if(h.q!=null){
        asked[h.q] = 1; nq++;
        var o = E.qs[h.q].k[h.a], nr = rem;
        if(Array.isArray(o)) nr = rem.filter(function(x){return o.indexOf(x)>=0});
        else if(o && o.no) nr = rem.filter(function(x){return o.no.indexOf(x)<0});
        if(nr.length) rem = nr;
      } else if(h.y) conf = h.c; else rem = rem.filter(function(x){return x!==h.c});
    });
    return {rem:rem,asked:asked,conf:conf,nq:nq};
  }
  function elimCause(s,k){return s.elim.causes.filter(function(c){return c.k===k})[0]}
  function elimNext(s,st){
    if(st.rem.length<2) return -1;
    var E = s.elim;
    for(var i=0;i<E.qs.length;i++){
      if(st.asked[i]) continue;
      var q = E.qs[i];
      if(q.need && !q.need.some(function(x){return st.rem.indexOf(x)>=0})) continue;
      var useful = q.k.some(function(o){
        var nr = Array.isArray(o) ? st.rem.filter(function(x){return o.indexOf(x)>=0}) : (o && o.no ? st.rem.filter(function(x){return o.no.indexOf(x)<0}) : st.rem);
        return nr.length && nr.length < st.rem.length;
      });
      if(useful) return i;
    }
    return -1;
  }
  function elimChips(s,st,cur){
    var on = s.elim.causes.filter(causeOn);
    return '<div class="cwrap"><p class="eyebrow">Causes possibles : '+st.rem.length+' sur '+on.length+'</p><div class="cch">'+on.map(function(c){
      var alive = st.rem.indexOf(c.k)>=0;
      return '<span class="cc'+(alive?'':' off')+(c.k===cur?' cur':'')+'"'+(alive?'':' aria-label="'+esc(c.n)+' : écartée"')+'>'+(alive?'':'✕ ')+esc(c.n)+'</span>';
    }).join("")+'</div></div>';
  }
  function renderElim(s){
    var b = $("#diagbody"), st = elimState(s), back = '<button class="btn alt" data-back="1" style="margin-top:14px;width:100%">← Retour</button>';
    if(st.conf){
      var c = elimCause(s,st.conf);
      b.innerHTML = resultHTML(s,c.r,back,"",'<div class="tip">Vérifié : '+esc(c.yes)+'</div>');
      return;
    }
    if(!st.rem.length){
      b.innerHTML = '<div class="result"><p class="eyebrow">Pas de cause simple trouvée</p><h3>'+esc(s.label)+'</h3><div class="block"><p>Les vérifications à votre portée n\'ont rien révélé. Le problème est plus profond ou demande des mesures : mieux vaut un contrôle à l\'atelier.</p></div><div class="btns"><button class="btn" data-act="rdv">Rendez-vous atelier</button></div></div>'+back+'<button class="btn alt" id="dagain" style="width:100%;margin-top:12px">Un autre souci</button>';
      return;
    }
    var qi = elimNext(s,st);
    if(qi>=0){
      var q = s.elim.qs[qi];
      b.innerHTML = '<p class="eyebrow">'+esc(s.label)+' · question '+(st.nq+1)+'</p><h2 style="font-size:23px;margin:6px 0 14px">'+esc(q.t)+'</h2><div class="opts">'+
        q.o.map(function(o,k){return '<button class="opt" data-eq="'+qi+'" data-ea="'+k+'">'+esc(o)+'</button>'}).join("")+'</div>'+elimChips(s,st,"")+back;
      return;
    }
    var rem = st.rem.map(function(k){return elimCause(s,k)}).sort(function(a,b){return a.p-b.p}), c0 = rem[0];
    b.innerHTML = '<p class="eyebrow">'+esc(s.label)+' · vérification</p><h2 style="font-size:23px;margin:6px 0 8px">À vérifier : '+esc(c0.n)+'</h2>'+
      '<p class="sub">'+(rem.length>1 ? 'Plusieurs causes restent possibles. On les vérifie une par une, des plus simples aux plus techniques.' : 'Par élimination, il ne reste qu\'une cause. Vérifions-la pour en être sûr.')+'</p>'+
      '<div class="block"><b>Comment vérifier</b><p>'+esc(c0.test)+'</p></div>'+
      '<div class="block"><b>Ce qui confirme</b><p>'+esc(c0.yes)+'</p></div>'+(c0.cx?'<div class="tip">'+esc(c0.cx)+'</div>':'')+
      '<div class="opts" style="margin-top:12px"><button class="opt" data-ec="'+c0.k+'" data-ey="1">Oui, c\'est ça</button><button class="opt" data-ec="'+c0.k+'" data-ey="0">Non, rien d\'anormal, ou impossible à vérifier</button></div>'+elimChips(s,st,c0.k)+back;
  }
  function diagNode(){
    var s0 = SOUCIS[diag.i];
    if(s0 && s0.elim){var st0 = elimState(s0); return st0.conf ? elimCause(s0,st0.conf).r : {cause:"",geste:"",prod:"Aucun",sec:null}}
    var n = SOUCIS[diag.i].tree;
    for(var k=0;k<diag.ans.length;k++){ if(!n.n) break; n = n.n[diag.ans[k]]; }
    return n;
  }
  function keepBlock(s,r){
    if(!s.eq || r.prod.indexOf("Aucun")===0) return "";
    var it = eqById(s.eq), ml = modLabel(s.eq);
    return '<div class="shop keep"><b>À retenir avant d\'aller en magasin</b><p>'+esc(it?it.name:"")+' : '+(ml?'<strong>'+esc(ml)+'</strong>':'modèle non renseigné.')+'</p>'+
      (ml?'<div class="btns"><button class="btn alt" data-act="copy">Copier cette fiche</button></div>':'<div class="btns"><button class="btn alt" data-act="fill">Renseigner mon modèle</button></div>')+'</div>';
  }
  function keepText(s,r){
    var it = eqById(s.eq);
    return s.label+". Équipement : "+(it?it.name:"")+", modèle : "+modLabel(s.eq)+". Pièce à demander : "+r.prod.split(" (")[0]+".";
  }
  function treeText(n){
    if(!n) return "";
    if(!n.n) return (n.cause||"")+" "+(n.geste||"");
    return n.t+" "+n.o.join(" ")+" "+n.n.map(treeText).join(" ");
  }
  var STOP = "le la les un une des de du d l au aux et ou a ai as ont est sont mon ma mes ton ta ses son sa je j tu il elle on nous vous ils elles ne n pas plus ca ce cet cette qui que qu quoi dans sur sous avec sans pour par en y se s m t c quand tres trop bien mal fait fais font veut veux peut peux comment pourquoi puis alors aussi encore toujours jamais rien tout tous toute meme apres avant depuis cest jai marche fonctionne".split(" ");
  var SYN = {skydome:"lanterneau aerateur",ficelle:"store plisse cordon",cordon:"store plisse",rideau:"store plisse occultant",chaudiere:"chauffage",boiler:"eau chaude chauffe-eau",radiateur:"chauffage",froid:"refroidit",frigidaire:"frigo",refrigerateur:"frigo",glaciere:"frigo",courant:"electricite 12v 230",electricite:"electricite 12v 230",jus:"batterie",batt:"batterie",ampoule:"led lumiere",lumiere:"led 12v",lumieres:"led 12v",puante:"odeur",pue:"odeur",puent:"odeur",senteur:"odeur",sent:"odeur",coule:"fuite",goutte:"fuite",gouttes:"fuite",inonde:"fuite",tuyau:"fuite",moisissure:"moisi humidite",humide:"humidite",buee:"condensation",toilette:"wc",toilettes:"wc cassette",chiotte:"wc",chiottes:"wc",rechaud:"plaque gaz",feux:"plaque gaz",gaz:"gaz bouteille",bouteille:"gaz",marchepied:"marche pied",demarre:"allume demarrage",demarrer:"allume demarrage",allume:"allumage demarre",panne:"souci",bloque:"coince",coince:"bloque",tele:"tv",pneus:"pneu",crevaison:"pneu",gonfle:"pression pneu",coupe:"disjoncte",saute:"disjoncte",grille:"fusible",voyant:"voyant tableau",orange:"voyant",rouge:"voyant",alarme:"detecteur alarme",bip:"detecteur",hiver:"hivernage",hivernage:"hivernage sortie",parabole:"tv satellite antenne",clim:"climatisation clim",climatiseur:"climatisation clim"};
  Object.assign(SYN,{fuient:"fuite",fuit:"fuite",fuite:"fuite",brule:"brule fumee",fume:"fumee",chauffe:"chauffe",prise:"230",prises:"230",borne:"230 branche",branche:"branche 230",robinet:"robinet eau",goutte:"fuite",gout:"gout",douche:"douche eau",froide:"froide chaude tiede",vide:"decharge",television:"tv",tele:"tv",demarre:"demarre demarrage moteur",velo:"velo",jauge:"niveau"});
  function stem(w){return w.length>5 ? w.slice(0,5) : w.replace(/[sx]$/,"")}
  function qTokens(q){
    var out = [];
    norm(q).replace(/[’']/g," ").split(/[^a-z0-9]+/).forEach(function(w){
      if(!w || STOP.indexOf(w)>=0) return;
      out.push({w:w});
      if(SYN[w]) SYN[w].split(" ").forEach(function(x){if(x && !out.some(function(o){return o.w===x})) out.push({w:x,syn:true})});
    });
    return out;
  }
  function wset(t){var o = {}; norm(t).replace(/[’']/g," ").split(/[^a-z0-9]+/).forEach(function(w){if(w && STOP.indexOf(w)<0) o[stem(w)] = 1}); return o}
  function topText(n,d){return (n && n.n && d<2) ? n.o.join(" ")+" "+n.n.map(function(x){return topText(x,d+1)}).join(" ") : ""}
  var DF = null;
  function dIndex(s){
    if(s._ix) return s._ix;
    var cat = DCATS.filter(function(c){return c[0]===s.cat})[0], eq = s.eq && eqById(s.eq);
    s._ix = {a:wset(s.label), b:wset((s.kw||"")+" "+(eq?eq.name:"")+" "+(cat?cat[1]:"")+" "+topText(s.tree,0)), c:wset(treeText(s.tree))};
    s._ix.na = Object.keys(s._ix.a).length;
    return s._ix;
  }
  function idf(w){
    if(!DF){DF = {}; SOUCIS.forEach(function(s){var ix = dIndex(s), all = {}; [ix.a,ix.b,ix.c].forEach(function(x){Object.keys(x).forEach(function(k){all[k] = 1})}); Object.keys(all).forEach(function(k){DF[k] = (DF[k]||0)+1})})}
    return Math.log(1 + SOUCIS.length/(DF[w]||SOUCIS.length));
  }
  function dScore(s,toks){
    var ix = dIndex(s), sc = 0, hit = 0, inLabel = 0, seen = {};
    toks.forEach(function(t){
      var st = stem(t.w), k = t.syn ? 0.6 : 1, h = 0;
      if(seen[st]) return; seen[st] = 1;
      if(ix.a[st]){h = 3; inLabel++} else if(ix.b[st]) h = 1.5; else if(ix.c[st]) h = 0.4;
      if(h){sc += h*idf(st)*k; hit++}
    });
    if(!hit) return 0;
    sc += 2.5*inLabel/Math.max(1,ix.na) + (relevant(s)?1:0);
    if(s.urgent && inLabel>=2) sc += 6;
    return sc;
  }
  function present(id){return !!ownA(id)}
  function vOK(s){if(!s.vonly) return true; var v = vars[s.vonly[0]]; return !v || v==="ns" || s.vonly[1].indexOf(v)>=0}
  function relevant(s){return (!s.eq || present(s.eq)) && vOK(s)}
  function eqName(s){var it = s.eq && eqById(s.eq); return it ? it.name : "Autres"}
  function groupBtns(list){var cur = null, h = ""; list.forEach(function(s){var n = eqName(s); if(n!==cur){cur = n; h += '<p class="eyebrow" style="margin:12px 0 4px">'+esc(n)+'</p>'} h += dBtn(s)}); return h}
  function dBtn(s){var i = SOUCIS.indexOf(s); return '<button class="opt'+(s.urgent?' urg':'')+'" data-s="'+i+'">'+(s.urgent?'<span class="urgtag">Urgent</span> ':'')+esc(s.label)+(relevant(s)?'':' <span class="mut">(autre équipement)</span>')+'</button>'}
  function drawDiagList(q){
    var el = $("#dlist"), h = ""; if(!el) return;
    if(q){
      var tk = qTokens(q), res = SOUCIS.map(function(s){return {s:s,k:dScore(s,tk)}}).filter(function(x){return x.k>0}).sort(function(a,b){return b.k-a.k || (a.s.urgent?1:0)-(b.s.urgent?1:0)}); var top = res.length ? res[0].k : 0; res = res.filter(function(x){return x.k >= Math.max(top*0.55,1)}).slice(0,8).map(function(x){return x.s}); window.CDB_TRACK&&window.CDB_TRACK("search",{q:q,n:res.length});
      el.innerHTML = res.length ? '<p class="eyebrow">'+res.length+' proposition'+(res.length>1?'s':'')+', la plus proche en premier</p><div class="opts" style="margin-top:8px">'+res.map(dBtn).join("")+'</div><p class="sub" style="margin-top:12px">Ce n\'est pas tout à fait ça ? Reformulez avec d\'autres mots, ou passez à l\'atelier.</p><button class="btn alt" data-act="rdvfree" style="width:100%">Rendez-vous atelier</button>' : '<div class="empty"><p>Aucun souci ne correspond. Essayez un autre mot, par exemple « gaz », « batterie » ou « odeur », ou passez à l\'atelier.</p><button class="btn" data-act="rdvfree">Rendez-vous atelier</button></div>';
      return;
    }
    var urg = SOUCIS.filter(function(s){return s.urgent && relevant(s)});
    h = '<p class="eyebrow">Urgences : danger</p><div class="opts">'+urg.map(dBtn).join("")+'</div>';
    DCATS.forEach(function(c){
      var its = SOUCIS.filter(function(s){return s.cat===c[0] && !s.urgent && relevant(s)}).sort(function(a,b){return eqName(a).localeCompare(eqName(b),"fr")});
      if(its.length) h += '<details class="cat"><summary><span>'+esc(c[1])+'</span><span class="cnt">'+its.length+'</span></summary><div class="opts" style="margin-top:8px">'+groupBtns(its)+'</div></details>';
    });
    var oth = SOUCIS.filter(function(s){return !relevant(s)}).sort(function(a,b){return eqName(a).localeCompare(eqName(b),"fr")});
    if(oth.length) h += '<details class="cat"><summary><span>Autres équipements (pas dans mon véhicule)</span><span class="cnt">'+oth.length+'</span></summary><div class="opts" style="margin-top:8px">'+oth.map(dBtn).join("")+'</div><p class="sub">Un équipement manque ? Cochez-le dans « Mes équipements ».</p></details>';
    el.innerHTML = h;
  }
  function renderDiagList(){
    var b = $("#diagbody"); diag = {i:-1,ans:[],auto:[],h:[]};
    b.innerHTML = '<p class="sub">Dites-nous ce qui se passe. On pose quelques questions, comme au comptoir. Exemple : « mon frigo ne refroidit plus » ou « ça sent mauvais ».</p>' +
      '<input class="search" id="dsearch" type="search" placeholder="Décrivez votre problème en quelques mots" autocomplete="off" style="margin:12px 0">' +
      '<div id="dlist"></div>' +
      '<div class="safety" style="margin-top:14px">Odeur de gaz, étincelles, fumée ou fil qui chauffe : coupez, aérez et appelez un professionnel. Ne cherchez pas la cause vous-même.</div>';
    drawDiagList("");
  }
  function resultHTML(s,r,back,autoTxt,vnote){
    var pro = r.pro || s.pro, none = r.prod.indexOf("Aucun")===0;
    return '<div class="result"><p class="eyebrow">'+(s.urgent?"Danger : agissez maintenant":r.achat?"Notre conseil":"Cause probable")+'</p><h3>'+esc(s.label)+'</h3>' +
        '<div class="block"><b>Ce qui se passe sans doute</b><p>'+esc(r.cause)+'</p></div>' +
        '<div class="block"><b>Ce que vous pouvez faire</b><p>'+esc(r.geste)+'</p></div>' + vnote + autoTxt +
        (pro ? '<div class="safety"><b>À faire faire par un professionnel.</b> '+esc(SAFE_PRO)+'</div>' : '') +
        (r.sec ? '<div class="safety">'+esc(r.sec)+'</div>' : '') +
        (none ? '' : '<div class="shop"><b>En rayon</b><p>'+esc(r.prod)+'</p></div>') + keepBlock(s,r) +
        '<div class="btns">'+(none?'':'<button class="btn" data-act="shop">Demander au magasin</button>')+'<button class="btn'+(none?'':' alt')+'" data-act="rdv">Rendez-vous atelier</button></div>' +
        (r.achat ? '<p class="sub">Le magasin vous conseille le modèle adapté à votre véhicule.</p></div>' : '<p class="sub">Diagnostic probable, pas une certitude. En cas de doute, passez à l\'atelier.</p></div>') + back +
        '<button class="btn alt" id="dagain" style="width:100%;margin-top:12px">Un autre souci</button>';
  }
  function renderDiagStep(){
    if(SOUCIS[diag.i].elim){renderElim(SOUCIS[diag.i]); return}
    autoAdvance(); var s = SOUCIS[diag.i], b = $("#diagbody"), n = diagNode();
    var back = '<button class="btn alt" data-back="1" style="margin-top:14px;width:100%">← Question précédente</button>';
    var autos = diag.auto.filter(Boolean), autoTxt = autos.length ? '<p class="sub">D\'après votre fiche : '+autos.map(esc).join(" ; ")+'.</p>' : "";
    var vo = s.eq && varOpt(s.eq), vnote = vo && vo[3] ? '<div class="tip">Selon votre équipement : '+esc(vo[3])+'</div>' : "";
    if(n.n){
      b.innerHTML = '<p class="eyebrow">'+esc(s.label)+' · question '+(diag.ans.length+1)+'</p><h2 style="font-size:23px;margin:6px 0 14px">'+esc(n.t)+'</h2>'+autoTxt+'<div class="opts">' +
        n.o.map(function(o,k){return '<button class="opt" data-a="'+k+'">'+esc(o)+'</button>'}).join("") + '</div>' + back;
    } else {
      b.innerHTML = resultHTML(s,n,back,autoTxt,vnote); window.CDB_TRACK&&window.CDB_TRACK("result",{id:s.id,label:n.cause,prod:n.prod.indexOf("Aucun")===0?null:n.prod});
    }
  }
  $("#diagbody").addEventListener("input",function(e){if(e.target.id==="dsearch") drawDiagList(norm(e.target.value).trim())});
  $("#diagbody").addEventListener("click",function(e){
    var s = e.target.closest("[data-s]");
    if(s){diag.i = +s.dataset.s; diag.ans = []; diag.auto = []; diag.h = []; window.CDB_TRACK&&window.CDB_TRACK("diag",{id:SOUCIS[diag.i].id,label:SOUCIS[diag.i].label}); renderDiagStep(); window.scrollTo(0,0); return}
    if(e.target.closest("[data-back]")){ if(SOUCIS[diag.i].elim){ if(diag.h.length){diag.h.pop(); renderDiagStep()} else renderDiagList(); window.scrollTo(0,0); return } do{diag.ans.pop(); diag.auto.length = Math.min(diag.auto.length, diag.ans.length+1); var wasAuto = diag.auto[diag.ans.length]; diag.auto[diag.ans.length] = undefined}while(diag.ans.length && wasAuto); diag.auto.length = diag.ans.length; if(diag.ans.length || SOUCIS[diag.i].tree.n){ if(!diag.ans.length && SOUCIS[diag.i].tree.vk && vars[SOUCIS[diag.i].tree.vk] && vars[SOUCIS[diag.i].tree.vk]!=="ns"){renderDiagList()} else renderDiagStep()} else renderDiagList(); window.scrollTo(0,0); return}
    var ea = e.target.closest("[data-ea]");
    if(ea){diag.h.push({q:+ea.dataset.eq,a:+ea.dataset.ea}); renderDiagStep(); window.scrollTo(0,0); return}
    var ey = e.target.closest("[data-ey]");
    if(ey){diag.h.push({c:ey.dataset.ec,y:ey.dataset.ey==="1"}); renderDiagStep(); window.scrollTo(0,0); return}
    var an = e.target.closest("[data-a]");
    if(an){diag.ans.push(+an.dataset.a); renderDiagStep(); window.scrollTo(0,0); return}
    var a = e.target.closest("[data-act]");
    if(a){
      var sj = SOUCIS[diag.i], rr = sj ? diagNode() : null;
      if(a.dataset.act==="rdv"){openRdv(rr.rdv || "souci", sj.label + ". Cause probable : " + rr.cause + (sj.eq && modLabel(sj.eq) ? " Mon modèle : " + modLabel(sj.eq) + "." : ""))}
      else if(a.dataset.act==="rdvfree"){openRdv("souci","")}
      else if(a.dataset.act==="fill"){$("#wsearch").value = ""; go("what"); showItem(sj.eq)}
      else if(a.dataset.act==="copy"){var tx = keepText(sj,rr); try{navigator.clipboard.writeText(tx).then(function(){toast("Fiche copiée")},function(){toast(tx)})}catch(err){toast(tx)}}
      else if(a.dataset.act==="shop"){window.CDB_TRACK&&window.CDB_TRACK("shop",{id:sj.id,label:sj.label,prod:rr.prod}); window.CDB_CLOUD.partRequest(sj.eq||null, rr.prod.split(" (")[0], rr.achat ? "accessoire" : null)}
      return;
    }
    if(e.target.closest("#dagain")){renderDiagList()}
  });

  /* ---------- Missions ---------- */
  var STEPS = DATA.steps;
  var game = {order:[],done:[],msg:"",finished:false,badge:false};
  function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
  function resetGame(){game.order = shuffle(STEPS.map(function(_,i){return i})); game.done=[]; game.msg=""; game.finished=false}
  resetGame();
  var BADGES = [
    {n:"Départ serein",icon:'<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',key:"depart"},
    {n:"Maître des eaux",icon:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',key:"eaux"},
    {n:"Énergie au top",icon:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',key:"energie"},
    {n:"Premier réveil",icon:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',key:"reveil"}
  ];
  function renderGame(){
    var b = $("#gamebody"), n = STEPS.length, d = game.done.length;
    var html = '<div class="card"><p class="eyebrow">Mission</p><h2 style="font-size:23px">Préparer le départ</h2><p class="sub">Touchez les gestes dans le bon ordre. Pas de pénalité : on vous explique à chaque fois.</p></div>';
    html += '<div><div class="progress-row"><span>Sérénité</span><span>'+d+' sur '+n+'</span></div><div class="progress"><i style="width:'+Math.round(d/n*100)+'%"></i></div></div>';
    if(game.done.length){
      html += '<ol class="seq">'+game.done.map(function(i,k){return '<li><b>'+(k+1)+'. '+esc(STEPS[i].t)+'</b><span>'+esc(STEPS[i].why)+'</span></li>'}).join("")+'</ol>';
    }
    if(!game.finished){
      if(game.msg) html += '<div class="safety">'+esc(game.msg)+'</div>';
      html += '<p class="eyebrow">Quel est le prochain geste ?</p><div class="opts">' +
        game.order.filter(function(i){return game.done.indexOf(i)<0}).map(function(i){return '<button class="opt" data-step="'+i+'">'+esc(STEPS[i].t)+'</button>'}).join("") + '</div>';
    } else {
      html += '<div class="ok"><b>Bravo, départ serein !</b> Le véhicule est prêt à rouler. Ordre conseillé, à valider pour ce modèle.</div><button class="btn" id="replay" style="width:100%">Rejouer la mission</button>';
    }
    html += '<p class="eyebrow">Vos badges</p><div class="badges">' +
      BADGES.map(function(x){var on = x.key==="depart" && game.badge; return '<div class="badge'+(on?' on':'')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+x.icon+'</svg><span>'+esc(x.n)+'</span></div>'}).join("") + '</div>';
    b.innerHTML = html;
  }
  $("#gamebody").addEventListener("click",function(e){
    var s = e.target.closest("[data-step]");
    if(s){
      var i = +s.dataset.step, expected = game.done.length;
      if(i === expected){
        game.done.push(i); game.msg = "";
        if(game.done.length === STEPS.length){game.finished = true; game.badge = true; toast("Badge gagné : Départ serein")}
      } else {
        game.msg = "Pas tout de suite. Indice : " + STEPS[expected].why;
      }
      renderGame(); return;
    }
    if(e.target.closest("#replay")){resetGame(); renderGame()}
  });
};
