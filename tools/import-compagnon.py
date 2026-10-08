#!/usr/bin/env python3
"""Importe une version de l'application « Compagnon de bord » (fichier HTML unique).

Usage : python3 tools/import-compagnon.py chemin/vers/compagnon-de-bord.html

Produit :
  public/app/index.html          l'appli (le « moteur »), sans données ni photos intégrées
  public/app/compagnon.js        son script, qui reçoit les données du cloud au démarrage
  server/seed/compagnon.json     données : équipements, diagnostics, listes, réglages, profil du V114
  server/seed/photos/*.jpg       photos du V114 (une par équipement) et photo d'accueil

Les données ne sont plus écrites dans le code : elles sont chargées depuis le serveur, qui les
initialise avec server/seed/compagnon.json et permet de les modifier dans le back-office.
Le script vérifie chaque point de découpe : si une nouvelle version change la structure, il s'arrête
avec un message clair plutôt que de produire une appli cassée.
"""
import base64
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def die(msg):
    sys.exit(f"Erreur : {msg}")


def cut(text, start, end, *, include_end=True):
    """Returns (before, section, after); section spans from start to end (end included)."""
    i = text.find(start)
    if i < 0:
        die(f"début introuvable : {start[:60]!r}")
    j = text.find(end, i)
    if j < 0:
        die(f"fin introuvable : {end[:60]!r}")
    j = j + len(end) if include_end else j
    return text[:i], text[i:j], text[j:]


def replace_section(text, start, end, replacement, *, include_end=True):
    before, section, after = cut(text, start, end, include_end=include_end)
    return before + replacement + after, section


def replace_once(text, old, new):
    if text.count(old) != 1:
        die(f"motif attendu une seule fois ({text.count(old)} trouvé(s)) : {old[:70]!r}")
    return text.replace(old, new)


def main():
    if len(sys.argv) != 2:
        die("indiquez le fichier HTML de l'application")
    html = open(sys.argv[1], encoding="utf-8").read()

    m = re.search(r"<script>\n(.*)\n</script>", html, re.S)
    if not m:
        die("bloc <script> introuvable")
    script = m.group(1)
    head, body_html = html[: m.start()], html[m.end():]

    sections = {}  # name -> original source, evaluated in Node to extract the data
    s = script

    s, sections["lists"] = replace_section(
        s, "  var LISTS = {", 'var OWN_ALIAS = {chauf:"trumac",eauch:"trumac",comp:"frigo"};',
        "  var LISTS = DATA.lists;\n  var REMINDERS = DATA.reminders;\n  var OWN_ALIAS = DATA.config.OWN_ALIAS;")

    s, sections["photos"] = replace_section(
        s, "  var PH=[", "var DEFAULT_PHOTO = HERO;",
        "  var PH = DATA.vehicle.photos.map(function(p){return p.url});\n"
        "  var PIT = DATA.vehicle.photos.map(function(p,n){return {id:p.id,n:n}});\n"
        "  var PHOTOS = {};\n  var HERO = DATA.vehicle.heroUrl || \"\";\n  var DEFAULT_PHOTO = HERO;")

    s, sections["equip"] = replace_section(
        s, "  var CATS = [", '  var V114_EXTRA = ["trumac","solaire","store","camera","extinct","agm"];',
        "  var CATS = DATA.cats;\n"
        "  var EQUIP = DATA.equipment.map(function(q){return Object.assign({img:\"\",kw:\"\",tip:\"\"},q)});\n"
        "  EQUIP.forEach(function(q){q.idx = norm(q.name+\" \"+q.kw+\" \"+q.text); if(!q.spot) q.spot = null});\n"
        "  function eqById0(id){return EQUIP.filter(function(q){return q.id===id})[0]}\n"
        "  PIT.forEach(function(p){if(eqById0(p.id)) PHOTOS[p.id] = p.n});\n"
        "  var SPOT_V114 = DATA.vehicle.spotOverrides || {};\n"
        "  EQUIP.forEach(function(q){if(SPOT_V114[q.id]) q.spot = SPOT_V114[q.id]});\n"
        "  var V114_EXTRA = DATA.vehicle.extra || [];")

    s, sections["impl"] = replace_section(
        s, "  var CHAUF_P = [", "  var HIDDEN_EQ = {comp:1};",
        "  var IMPL = DATA.config.IMPL;\n  var APP_VARS = DATA.config.APP_VARS;\n"
        "  var IMPL_VISIBLE = DATA.config.IMPL_VISIBLE;\n  var HIDDEN_EQ = DATA.config.HIDDEN_EQ;")

    s, sections["dims"] = replace_section(
        s, "  var MODEL = {", '\n  var dimv = ',
        "  var MODEL = DATA.vehicle.model;\n  var DIMS = DATA.config.DIMS;\n  var dimv = ")
    sections["dims"] = sections["dims"].rsplit("\n  var dimv = ", 1)[0]

    s, sections["weights"] = replace_section(
        s, "  var WT = {", "  var W_DEFAULT = {ptac:3500,mom:2800,pax:2,eau:30,gaz:0,bag:100};",
        "  var WT = DATA.config.WT;\n  var W_DEFAULT = DATA.vehicle.weights;")

    s, sections["spots"] = replace_section(
        s, "  var SPOTS = [", "\n  ];", "  var SPOTS = DATA.vehicle.spots;")

    s, sections["variants"] = replace_section(
        s, "  var PLATE = {", "  var V114_VARS = {",
        "  var PLATE = DATA.config.PLATE;\n  var VARIANTS = DATA.config.VARIANTS;\n  var V114_VARS = DATA.vehicle.vars || {};\n  var __unused_vars = {",
        include_end=True)
    sections["variants"] = sections["variants"][: -len("  var V114_VARS = {")]
    vars_match = re.search(r"  var __unused_vars = \{[^\n]*\n", s)
    if not vars_match:
        die("ligne V114_VARS introuvable")
    sections["vehicle_vars"] = "  var V114_VARS = {" + vars_match.group(0)[len("  var __unused_vars = {"):]
    s = s[: vars_match.start()] + s[vars_match.end():]

    s, sections["dealer"] = replace_section(
        s, '  var DEALER = {', "\n  ];",
        "  var DEALER = DATA.dealer;\n  var MOTIFS = DATA.motifs;")

    s, sections["diag"] = replace_section(
        s, "  var SOUCIS = [", "\n  tagVars();",
        "  var SOUCIS = DATA.diagnostics;")

    s, sections["steps"] = replace_section(
        s, "  var STEPS = [", "\n  ];", "  var STEPS = DATA.steps;")

    # Consts needed by the extracted sections, kept in the engine as well.
    pre = re.search(r'  var DCATS = .*\n  var SAFE_PRO = .*\n', script)
    if not pre:
        die("DCATS / SAFE_PRO introuvables")

    # ---- Engine adjustments ----
    if not s.startswith("(function(){\n"):
        die("début de la fonction principale inattendu")
    s = "window.startCompagnon = function(DATA){\n" + s[len("(function(){\n"):]
    if not s.rstrip().endswith("})();"):
        die("fin de la fonction principale inattendue")
    s = s.rstrip()[: -len("})();")] + "};\n"

    # Storage: every change goes through the cloud sync (photos are uploaded, other values saved).
    s = replace_once(
        s, '  function lsSet(k,v){try{window.localStorage.setItem(k,v)}catch(e){}}\n'
           '  function lsDel(k){try{window.localStorage.removeItem(k)}catch(e){}}',
        '  function lsSet(k,v){try{window.localStorage.setItem(k,v)}catch(e){} if(window.CDB_SYNC) window.CDB_SYNC.changed(k,v)}\n'
        '  function lsDel(k){try{window.localStorage.removeItem(k)}catch(e){} if(window.CDB_SYNC) window.CDB_SYNC.changed(k,null)}')
    s = replace_once(
        s, 'function uphSave(){try{window.localStorage.setItem("cdb_uph",JSON.stringify(UPH));return true}catch(e){return false}}',
        'function uphSave(){var v = JSON.stringify(UPH); try{window.localStorage.setItem("cdb_uph",v)}catch(e){if(!window.CDB_SYNC) return false} if(window.CDB_SYNC) window.CDB_SYNC.changed("cdb_uph",v); return true}')
    s = replace_once(s, 'toast("Photo remplacée. Elle reste sur ce téléphone.")', 'toast("Photo remplacée et sauvegardée.")')

    # Vehicle names coming from the cloud.
    s = replace_once(s, "Photo de votre Challenger V114. Touchez-la", "Photo de votre '+esc(DATA.vehicle.fullName)+'. Touchez-la")
    s = replace_once(s, "Photos du V114 :", "Photos du véhicule :")
    s = replace_once(s, 't += "\\nVéhicule : Van V114.";', 't += "\\nVéhicule : "+DATA.vehicle.fullName+".";')
    s = replace_once(s, 'hand.code = "V114-"+r(4)+"-"+r(4);', 'hand.code = (DATA.vehicle.codePrefix||"CDB")+"-"+r(4)+"-"+r(4);')
    s = replace_once(
        s, 'var $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};',
        'var $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};\n'
        '  $(".hero-name").innerHTML = esc(DATA.vehicle.heroPrefix||"")+" <span>"+esc(DATA.vehicle.heroName||"")+"</span>";\n'
        '  function dlogoHtml(){return DATA.dealer.logoUrl ? \'<div class="dlogo img\'+(DATA.dealer.website?\' link\':\'\')+\'" title="Site de la concession"><img src="\'+esc(DATA.dealer.logoUrl)+\'" alt=""></div>\' : \'<div class="dlogo" aria-hidden="true">\'+esc(dealerInitials())+\'</div>\'}\n'
        '  function dealerInitials(){return (DATA.dealer.name||"").split(/\\s+/).filter(function(w){return w.length>2}).slice(0,2).map(function(w){return w.charAt(0)}).join("").toUpperCase() || "CDB"}\n'
        '  $$(".dlogo").forEach(function(d){if(DATA.dealer.logoUrl){d.innerHTML = \'<img src="\'+esc(DATA.dealer.logoUrl)+\'" alt="">\'; d.classList.add("img")} else d.textContent = dealerInitials()});\n'
        '  // Dealership logo (header and dealership card) opens its website.\n'
        '  function dealerSite(e){var l = e.target.closest(".top .dlogo, .card .dlogo"); if(!l || !DATA.dealer.website) return; e.preventDefault(); e.stopPropagation(); window.open(DATA.dealer.website, "_blank", "noopener")}\n'
        '  document.addEventListener("click", dealerSite, true);\n'
        '  if(DATA.dealer.website) $$(".top .dlogo").forEach(function(d){d.classList.add("link"); d.setAttribute("role","link"); d.setAttribute("title","Site de "+(DATA.dealer.name||"la concession"))});\n'
        '  (function(){var im = $("#planSvg image"); im.setAttribute("href",DATA.vehicle.planUrl || (DATA.vehicle.spots.length ? "/app/plan-van.svg" : "")); if(!DATA.vehicle.planUrl && !DATA.vehicle.spots.length) im.remove()})();')
    # esc is declared after $$ in the original: make the call order safe by hoisting esc.
    s = replace_once(s, '  function esc(t){return String(t).replace(', '  function esc(t){return String(t==null?"":t).replace(')

    # Handover validated by the dealership: the access code comes from the cloud.
    s = replace_once(
        s, 'var ch = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", r = function(n){var o=""; for(var i=0;i<n;i++) o += ch.charAt(Math.floor(Math.random()*ch.length)); return o};\n'
           '      hand.code = (DATA.vehicle.codePrefix||"CDB")+"-"+r(4)+"-"+r(4); hand.date = new Date().toLocaleDateString("fr-FR"); handSave(); renderHand(); renderVerified(); window.scrollTo(0,document.body.scrollHeight); return;',
        'var hb = e.target.closest("#hgen"); hb.disabled = true;\n'
        '      window.CDB_CLOUD.accessCode({firstName:hand.name, vin:hand.vin}).then(function(r){\n'
        '        if(!r){hb.disabled = false; return}\n'
        '        hand.code = r.code; hand.date = r.date; hand.expires = r.expiresAt; handSave(); renderHand(); renderVerified(); window.scrollTo(0,document.body.scrollHeight);\n'
        '      }).catch(function(err){hb.disabled = false; toast(err.message)});\n'
        '      return;')
    s = replace_once(s, "Le client le saisit dans l\\'appli pour créer son accès. Usage unique.",
                     "Avec son nom, ce code permet au client de retrouver ses données sur un autre téléphone. Valable 2 ans.")
    s = replace_once(s, " Démonstration : dans l\\'appli réelle, cet écran est réservé aux vendeurs.",
                     " Cet écran est réservé à la concession : son code est demandé pour valider.")
    s = replace_once(s, """<div class="dlogo" aria-hidden="true">LOGO</div><div><b style=""", """'+dlogoHtml()+'<div><b style=""")
    # Diagnostics may suggest "atelier", which is not a listed reason: it becomes "J'ai un souci" (message kept).
    s = replace_once(s, "function openRdv(id,ctx){rdv.m = id;", "function openRdv(id,ctx){rdv.m = motifById(id) ? id : \"souci\";")
    # Search: word sets weighted by rarity (a word present in every diagnostic counts little),
    # first answers of each flowchart count as keywords, a danger matching the description comes first.
    old_search = s[s.index("  function dIndex(s){"):s.index("  function present(id){")]
    s = s.replace(old_search, r'''  function wset(t){var o = {}; norm(t).replace(/[’']/g," ").split(/[^a-z0-9]+/).forEach(function(w){if(w && STOP.indexOf(w)<0) o[stem(w)] = 1}); return o}
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
''')
    s = replace_once(s, '''      out.push(w);
      if(SYN[w]) SYN[w].split(" ").forEach(function(x){if(x && out.indexOf(x)<0) out.push(x)});''',
        '''      out.push({w:w});
      if(SYN[w]) SYN[w].split(" ").forEach(function(x){if(x && !out.some(function(o){return o.w===x})) out.push({w:x,syn:true})});''')
    s = replace_once(s, "res = res.filter(function(x){return x.k >= Math.max(top*0.55,3)})", "res = res.filter(function(x){return x.k >= Math.max(top*0.55,1)})")
    s = replace_once(s, "  function stem(w){", '''  Object.assign(SYN,{fuient:"fuite",fuit:"fuite",fuite:"fuite",brule:"brule fumee",fume:"fumee",chauffe:"chauffe",prise:"230",prises:"230",borne:"230 branche",branche:"branche 230",robinet:"robinet eau",goutte:"fuite",gout:"gout",douche:"douche eau",froide:"froide chaude tiede",vide:"decharge",television:"tv",tele:"tv",demarre:"demarre demarrage moteur",velo:"velo",jauge:"niveau"});
  function stem(w){''')

    # No "factory" equipment: each vehicle has its own pre-checked list, set in the back-office;
    # the dealership then adjusts everything with the customer.
    s = replace_once(s, 'function baseOwn(){var o = {}; EQUIP.forEach(function(q){if(q.base) o[q.id]=true}); V114_EXTRA.forEach(function(i){o[i]=true}); Object.keys(o).forEach(function(i){if(PHOTOS[i]==null) delete o[i]}); return o}',
                     'function baseOwn(){var o = {}; (DATA.vehicle.equipment||[]).forEach(function(i){if(eqById0(i)) o[i]=true}); return o}')
    s = replace_once(s, "+(q.base?'<small>De série</small>':'')", "")
    # Store requests (spare part or replacement): a button on each equipment and on a diagnosis result.
    s = replace_once(s, "+modBlock(it)+'</div>';\n  }", "+modBlock(it)+'<button class=\"btn alt partbtn\" type=\"button\" data-part=\"'+it.id+'\">🛒 Pièce ou remplacement</button></div>';\n  }")
    s = replace_once(s, 'function modSave(){lsSet("cdb_mod",JSON.stringify(mods))}',
                     'function modSave(){lsSet("cdb_mod",JSON.stringify(mods))}\n'
                     '  window.CDB_PARTINFO = function(id){var it = eqById(id); if(!it) return null; var m = mods[id]||{}; return {id:id, name:it.name, userPhoto: UPH[id] || null, genericPhoto: PHOTOS[id]!=null ? PH[PHOTOS[id]] : (it.img||null), model:m.name||"", ref:m.ref||""}};\n'
                     '  window.CDB_SETMOD = function(id,name,ref){if(!eqById(id)) return; var m = mods[id] = mods[id]||{}; m.name = String(name||"").slice(0,80); m.ref = String(ref||"").slice(0,80); modSave()};')
    s = replace_once(s, '$("#whatbody").addEventListener("click",function(e){\n', '$("#whatbody").addEventListener("click",function(e){\n    var pb = e.target.closest("[data-part]"); if(pb){window.CDB_CLOUD.partRequest(pb.dataset.part); return}\n')
    s = replace_once(s, '<button class="btn" data-act="shop">Voir en magasin</button>', '<button class="btn" data-act="shop">Demander au magasin</button>')
    s = replace_once(s, 'else toast("Démo : la fiche produit s\'ouvrirait ici.");', 'else if(a.dataset.act==="shop"){window.CDB_CLOUD.partRequest(sj.eq||null, rr.prod.split(" (")[0])}')
    # The VIN is entered at the handover on the customer's phone and stays there (never saved on the server).
    s = replace_once(s, 'placeholder="17 caractères" value="\'+esc(hand.vin)+\'"></div></div>\';', 'placeholder="17 caractères" value="\'+esc(hand.vin)+\'"><small class="sub">Reste sur ce téléphone, jamais enregistré sur nos serveurs.</small></div></div>\';')
    # No "reset to the model's list" button: one touch would erase what the dealership set with the customer.
    s = replace_once(s, '$("#eqreset").addEventListener("click",function(){own = baseOwn(); syncImplied(); saveOwn(); renderEquip(); toast("Liste de série rétablie.")});', '')
    # Brand and model of each equipment: those noted for the vehicle (back-office / relevé) come pre-filled, the customer's own notes win.
    s = replace_once(s, 'var mods = (function(){var o = {}; try{o = JSON.parse(lsGet("cdb_mod")||"{}")||{}}catch(e){} return o})();',
                     'var mods = (function(){var o = {}; try{o = JSON.parse(lsGet("cdb_mod")||"{}")||{}}catch(e){} var vm = DATA.vehicle.models||{}; Object.keys(vm).forEach(function(k){var m = o[k] = o[k]||{}; if(!m.name && vm[k]) m.name = vm[k]}); return o})();')
    s = replace_once(s, '" équipements cochés (de série et options). Comparez avec le bon de commande."', '" équipements cochés pour ce véhicule. Comparez avec le bon de commande et ajustez la liste."')
    s = replace_once(s, "function present(id){var it = eqById(id); return !!(ownA(id) || (it && it.base))}", "function present(id){return !!ownA(id)}")

    # Workshop requests really reach the dealership.
    s = replace_once(
        s, 'if(e.target.closest("#rsend")){rdv.sent = true; renderRdv(); window.scrollTo(0,0); return}',
        'if(e.target.closest("#rsend")){var rb = e.target.closest("#rsend"), rm = motifById(rdv.m); rb.disabled = true;'
        ' window.CDB_CLOUD.sendRequest({title: rdv.m==="souci" ? "Un souci sur mon véhicule" : rm.t, message: rdv.msg, period: rdv.period, phone: ($("#rtel")||{}).value || ""})'
        '.then(function(){rdv.sent = true; renderRdv(); window.scrollTo(0,0)}).catch(function(err){rb.disabled = false; toast(err.message)}); return}')
    s = replace_once(s, " (Démonstration : rien n\\'est réellement envoyé.)", " Vous retrouverez sa réponse dans l\\'application.")
    s = replace_once(s, "Démonstration : la demande partirait vers l\\'atelier de la concession qui vous a remis le véhicule.",
                     "La demande part vers l\\'atelier de votre concession.")
    # Dealership logo from the back-office.
    head = replace_once(head, ".dlogo.sm{", ".dlogo.img{background:var(--panel);border:1px solid var(--line);overflow:hidden}.dlogo img{width:100%;height:100%;object-fit:contain}\n.dlogo.sm{")

    # Workshop screen = the single place to talk with the dealership: its card, the customer's requests
    # (conversations, rendered by cloud.js in #cloudreq), then a new request.
    s = replace_once(s, """b.innerHTML = dealerCard()+'<div class="ok"><b>Demande envoyée.</b> '+esc(DEALER.name)+' vous rappelle pour fixer le rendez-vous, '+esc(rdv.period)+'. Vous retrouverez sa réponse dans l\\'application.</div><button class="btn" id="rnew" style="width:100%">Une autre demande</button>';""",
        """b.innerHTML = dealerCard()+'<div class="ok"><b>Demande envoyée.</b> '+esc(DEALER.name)+' vous répond ici, dans « Mes demandes ». Délai souhaité : '+esc(rdv.period)+'.</div><div id="cloudreq" class="cloud-block"></div><button class="btn alt" id="rnew" style="width:100%">Faire une autre demande</button>';
      if(window.CDB_CLOUD && window.CDB_CLOUD.rdvRendered) window.CDB_CLOUD.rdvRendered();""")
    s = replace_once(s, """var h = dealerCard() + '<p class="eyebrow">Pourquoi prendre rendez-vous ?</p><div class="opts">' +""",
        """var h = dealerCard() + '<div id="cloudreq" class="cloud-block"></div><p class="eyebrow">Nouvelle demande</p><div class="opts">' +""")
    s = replace_once(s, """    b.innerHTML = h;
    if(rdv.m) $("#rmsg").value = rdv.msg;""", """    b.innerHTML = h;
    if(rdv.m) $("#rmsg").value = rdv.msg;
    if(window.CDB_CLOUD && window.CDB_CLOUD.rdvRendered) window.CDB_CLOUD.rdvRendered();""")

    # ---- Page shell ----
    # The original file is a fragment (no doctype, no viewport): give it a full mobile page.
    page = head
    page = replace_once(page, '<div class="note"><span><b>Maquette de démonstration.</b> Contenus et photos d\'exemple, à valider avec les constructeurs et les concessions.</span></div>\n', '')
    style_end = page.rindex("</style>") + len("</style>")
    head_part, body_part = page[:style_end], page[style_end:]
    if "<html" in head_part.lower() or "<body" in body_part.lower():
        die("la page contient déjà <html> ou <body> : adaptez tools/import-compagnon.py")
    body_part = replace_once(body_part, '<image href="img/dessus.png" ', '<image ')
    body_part = replace_once(body_part, "Les équipements de série sont déjà cochés : décochez ce qui manque.", "Les équipements prévus pour ce modèle sont déjà cochés : ajoutez ou décochez avec la concession.")
    body_part = replace_once(body_part, '<button class="btn alt" id="eqreset">Liste de série</button>', '')
    body_part = replace_once(body_part, '<div class="device" id="device">', '<div id="cloud"></div>\n<div class="device" id="device" hidden>')
    page = (
        '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="theme-color" content="#0a7c82">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
        '<link rel="manifest" href="/app/manifest.webmanifest">\n<link rel="icon" href="/app/icon.svg" type="image/svg+xml">\n'
        '<link rel="apple-touch-icon" href="/app/icon.svg">\n'
        + head_part +
        '\n<link rel="stylesheet" href="/app/cloud.css">\n</head>\n<body>'
        + body_part +
        '<script src="/app/compagnon.js"></script>\n<script src="/app/cloud.js"></script>' + body_html + '\n</body>\n</html>\n'
    )

    # ---- Data extraction (evaluated in Node) ----
    extract = r"""
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const esc = t => String(t);
""" + pre.group(0) + "\n".join(sections[k] for k in ["lists", "photos", "equip", "impl", "dims", "weights", "spots", "variants", "vehicle_vars", "dealer", "diag", "steps"]) + r"""
EQUIP.forEach(q => { delete q.idx; });
process.stdout.write(JSON.stringify({
  lists: LISTS, reminders: REMINDERS, motifs: MOTIFS, steps: STEPS, cats: CATS, equipment: EQUIP, diagnostics: SOUCIS,
  config: { OWN_ALIAS, IMPL, APP_VARS, IMPL_VISIBLE, HIDDEN_EQ, DIMS, WT, PLATE, VARIANTS },
  vehicle: { model: MODEL, weights: W_DEFAULT, extra: V114_EXTRA, vars: V114_VARS, spotOverrides: SPOT_V114, spots: SPOTS,
             photoIndex: PIT.filter(p => EQUIP.some(q => q.id === p.id)).map(p => ({ id: p.id, n: p.n })), photoCount: PH.length },
  dealer: DEALER,
  photos: PH, hero: HERO
}));
"""
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(extract)
        tmp = f.name
    try:
        out = subprocess.run(["node", tmp], capture_output=True, text=True, check=False)
    finally:
        os.unlink(tmp)
    if out.returncode != 0:
        die("l'extraction des données a échoué :\n" + out.stderr[-2000:])
    data = json.loads(out.stdout)

    # ---- Photos ----
    photo_dir = os.path.join(ROOT, "server", "seed", "photos")
    os.makedirs(photo_dir, exist_ok=True)
    for f in os.listdir(photo_dir):
        os.remove(os.path.join(photo_dir, f))

    def save_data_url(url, name):
        mm = re.match(r"data:image/(jpeg|png|webp);base64,(.*)", url, re.S)
        if not mm:
            die(f"photo illisible : {name}")
        ext = {"jpeg": "jpg"}.get(mm.group(1), mm.group(1))
        fname = f"{name}.{ext}"
        with open(os.path.join(photo_dir, fname), "wb") as fh:
            fh.write(base64.b64decode(mm.group(2)))
        return fname

    photos = data.pop("photos")
    hero = data.pop("hero")
    v = data["vehicle"]
    v["photos"] = [{"id": p["id"], "file": save_data_url(photos[p["n"]], p["id"])} for p in v.pop("photoIndex")]
    v.pop("photoCount")
    v["heroFile"] = save_data_url(hero, "accueil") if hero else None
    v.update({
        "heroPrefix": "Van", "heroName": "V114", "fullName": "Challenger V114 Road Edition 2027",
        "codePrefix": "V114", "planFile": None,
    })

    seed_path = os.path.join(ROOT, "server", "seed", "compagnon.json")
    with open(seed_path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)

    app_dir = os.path.join(ROOT, "public", "app")
    with open(os.path.join(app_dir, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(page)
    with open(os.path.join(app_dir, "compagnon.js"), "w", encoding="utf-8") as fh:
        fh.write("/* Compagnon de bord : moteur de l'application. Généré par tools/import-compagnon.py, ne pas modifier à la main. */\n")
        fh.write(s)

    print(f"OK : {len(data['equipment'])} équipements, {len(data['diagnostics'])} diagnostics, "
          f"{len(v['photos'])} photos du véhicule.")


if __name__ == "__main__":
    main()
