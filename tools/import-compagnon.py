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
    # Comfort problems (a product to buy): « Notre conseil » instead of a probable cause.
    s = replace_once(s, '(s.urgent?"Danger : agissez maintenant":"Cause probable")', '(s.urgent?"Danger : agissez maintenant":r.achat?"Notre conseil":"Cause probable")')
    s = replace_once(s, '\'<p class="sub">Diagnostic probable, pas une certitude. En cas de doute, passez à l\\\'atelier.</p></div>\'', '(r.achat ? \'<p class="sub">Le magasin vous conseille le modèle adapté à votre véhicule.</p></div>\' : \'<p class="sub">Diagnostic probable, pas une certitude. En cas de doute, passez à l\\\'atelier.</p></div>\')')
    s = replace_once(s, 'else toast("Démo : la fiche produit s\'ouvrirait ici.");', 'else if(a.dataset.act==="shop"){window.CDB_CLOUD.partRequest(sj.eq||null, rr.prod.split(" (")[0], rr.achat ? "accessoire" : null)}')
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
    head = replace_once(head, ".lc-sub{font-size:13px;color:var(--muted)}", ".lc-sub{font-size:13px;color:var(--muted)}\n"
        ".loadcard{border-left:6px solid var(--ok);padding:14px;gap:8px;margin-top:4px}.loadcard.is-warn{border-left-color:var(--sign)}.loadcard.is-bad{border-left-color:var(--bad);background:var(--bad-bg)}\n"
        ".lc-h{font-size:17px;font-weight:700;color:var(--ink)}.lc-badge{font-size:13px;font-weight:700;border-radius:99px;padding:3px 10px;background:var(--ok-bg);color:var(--ok);white-space:nowrap}\n"
        ".lc-badge.is-warn{background:var(--warn-bg);color:var(--warn)}.lc-badge.is-bad{background:var(--bad);color:#fff}\n"
        ".lc-more{font-size:15px;font-weight:700;color:var(--accent)}\n"
        ".lc-v.ok,.lc-v.warn,.lc-v.bad{background:none;padding:0;border-radius:0}#waff .btn{flex:none;width:100%}.wtiny{font-size:12px;color:var(--muted);text-align:center;margin:10px 0 0}\n"
        ".affrow{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line)}.affrow:first-of-type{border-top:0}.affchk{flex:1;display:flex;align-items:center;gap:10px;font-size:16px;min-height:44px}.affchk input{width:24px;height:24px;accent-color:var(--accent);flex:none}.affrow .dimin input{width:70px}\n"
        "button.dim{border:0;text-align:left;font:inherit;color:inherit;cursor:pointer}.dim.on{outline:3px solid var(--accent)}.dimgo{font-size:13px;font-weight:700;color:var(--accent);margin-top:4px}.dimpanel{margin-top:10px}.dimpanel[hidden]{display:none}.dimclose{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.dimfld .dimin input{width:80px}\n"
        ".tipcats{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 12px}.tipcard{padding:0;overflow:hidden;margin-bottom:10px}.tiphead{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;color:var(--ink);text-align:left;font:inherit;padding:14px;min-height:60px;cursor:pointer}\n"
        ".tipt{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}.tipt b{font-size:17px;line-height:1.3}.tipcat{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}.tipby{font-size:13px;color:var(--muted)}.tipgo{font-size:24px;color:var(--accent);flex:none;width:28px;text-align:center}\n"
        ".tipimg{display:block;width:100%;max-height:260px;object-fit:cover;border-radius:12px;margin:8px 0}.tipcard .tipimg{border-radius:0;margin:0}.tipvid{position:relative;width:100%;aspect-ratio:16/9;background:#000}.tipvid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}\n"
        ".tiptext{padding:12px 14px 4px;margin:0;font-size:16px;line-height:1.5}.tipstore{margin:10px 14px 14px;padding:12px;border-radius:12px;background:var(--soft)}.tipstore p{margin:0 0 8px}.tipstore .btn{width:100%;flex:none}\n"
        ".tipshare{width:100%;flex:none;min-height:60px;font-size:18px;margin-top:8px}.tipform{display:flex;flex-direction:column;gap:10px;margin-top:8px}.tipform textarea{min-height:110px;font:inherit}.tipbtns{display:flex;gap:8px}\n"
        ".mission.feat{width:100%;font:inherit;cursor:pointer}.mission.feat .stamp{font-size:24px}.featpop{position:fixed;inset:0;z-index:60;background:rgba(5,20,25,.55);display:flex;align-items:center;justify-content:center;padding:16px}.featpop .card{max-width:440px;width:100%;max-height:85vh;overflow:auto;display:flex;flex-direction:column;gap:10px}.featpop .btn{flex:none}\n"
        ".affdel{border:0;background:none;color:var(--muted);font-size:18px;width:40px;height:40px}.affbtns,.affideas{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}")
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

    # ---- Usage statistics (anonymous): searches, problems opened, advice reached, store requests, equipment looked at ----
    T = 'window.CDB_TRACK&&window.CDB_TRACK'
    s = replace_once(s, 'res = res.filter(function(x){return x.k >= Math.max(top*0.55,1)}).slice(0,8).map(function(x){return x.s});',
        'res = res.filter(function(x){return x.k >= Math.max(top*0.55,1)}).slice(0,8).map(function(x){return x.s}); ' + T + '("search",{q:q,n:res.length});')
    s = replace_once(s, 'if(s){diag.i = +s.dataset.s; diag.ans = []; diag.auto = []; diag.h = []; renderDiagStep();',
        'if(s){diag.i = +s.dataset.s; diag.ans = []; diag.auto = []; diag.h = []; ' + T + '("diag",{id:SOUCIS[diag.i].id,label:SOUCIS[diag.i].label}); renderDiagStep();')
    s = replace_once(s, 'b.innerHTML = resultHTML(s,n,back,autoTxt,vnote);',
        'b.innerHTML = resultHTML(s,n,back,autoTxt,vnote); ' + T + '("result",{id:s.id,label:n.cause,prod:n.prod.indexOf("Aucun")===0?null:n.prod});')
    s = replace_once(s, 'else if(a.dataset.act==="shop"){window.CDB_CLOUD.partRequest(',
        'else if(a.dataset.act==="shop"){' + T + '("shop",{id:sj.id,label:sj.label,prod:rr.prod}); window.CDB_CLOUD.partRequest(')
    s = replace_once(s, """  function showItem(id){
    var it = eqById(id); if(!it) return;""", """  function showItem(id){
    var it = eqById(id); if(!it) return;
    """ + T + """("equip",{id:id,label:it.name});""")

    # ---- Weight: more visible on the home screen, and « Ce que j'emporte », the little notebook of the customer ----
    # Like the customer who writes everything in a notebook and adds it up before leaving: note once the weight of
    # each thing, then tick before each trip what goes in the vehicle.
    s = replace_once(s, 'function wtSave(){lsSet("cdb_wt",JSON.stringify(wt))}', r'''function wtSave(){lsSet("cdb_wt",JSON.stringify(wt))}
  function waff(){return Array.isArray(wt.aff) ? wt.aff : []}
  var AFF_IDEAS = [["Vélo",15],["Vélo électrique",25],["Valises et vêtements",40],["Nourriture et boissons",30],["Vaisselle et ustensiles",15],["Table et chaises de camping",12],["Barbecue ou plancha",10],["Câbles, cales et outils",15],["Jeux et affaires de plage",10],["Chien",20]];''')
    s = replace_once(s, '{n:"Bagages, vélos, matériel",kg:wv("bag")}', r'''(waff().length ? {n:"Ce que j'emporte ("+waff().filter(function(a){return a.on}).length+" coché"+(waff().filter(function(a){return a.on}).length>1?"s":"")+")",kg:waff().reduce(function(t,a){return t+(a.on?a.kg:0)},0)} : {n:"Bagages, vélos, matériel",kg:wv("bag")})''')
    s = replace_once(s, r'''    el.innerHTML = '<span class="lc-top"><span class="k2">Charge restante</span><span class="lc-v '+c.st+'">'+(c.rest<0?"−":"")+kg(Math.abs(c.rest))+'</span></span><span class="gauge" aria-hidden="true"><i class="'+c.st+'" style="width:'+c.pct.toFixed(0)+'%"></i></span><span class="lc-sub">Estimé '+kg(c.total)+' sur '+kg(c.ptac)+' autorisés. Modifier ›</span>';''',
    r'''    el.className = "loadcard is-"+c.st;
    el.innerHTML = '<span class="lc-top"><span class="lc-h">⚖️ Poids du véhicule</span><span class="lc-badge is-'+c.st+'">'+(c.st==="bad"?"Trop lourd":(c.st==="warn"?"Peu de marge":"Dans la limite"))+'</span></span>' +
      '<span class="lc-top"><span class="lc-v '+c.st+'">'+(c.rest<0?"−":"")+kg(Math.abs(c.rest))+'</span><span class="lc-sub">'+(c.rest<0?"de trop":"encore possibles")+'</span></span>' +
      '<span class="gauge" aria-hidden="true"><i class="'+c.st+'" style="width:'+c.pct.toFixed(0)+'%"></i></span>' +
      '<span class="lc-sub">Estimé '+kg(c.total)+' sur '+kg(c.ptac)+' autorisés.</span><span class="lc-more">Avant de partir : cochez ce que vous emportez ›</span>';''')
    s = replace_once(s, r'''      fld("w_bag","Bagages, vélos, matériel",wv("bag"),"kg","Pesez ou estimez : ça monte vite.") + '</div>' +''',
    r'''      (waff().length ? '' : fld("w_bag","Bagages, vélos, matériel",wv("bag"),"kg","Estimation globale. Pour être plus précis, détaillez ci-dessous ce que vous emportez.")) + '</div>' +
      '<h3 class="sech">Ce que j\'emporte</h3><div class="card" id="waff"></div>' +''')
    s = replace_once(s, "Estimation seulement. Seule une pesée fait foi. Dépasser le PTAC est interdit.", "Estimation à partir de ce que vous avez noté. Dépasser le PTAC est interdit.")
    s = replace_once(s, "Pesée : un pèse-caravane électronique (une mesure par essieu, moins de 150 € environ) ou un pont-bascule.<br><br>", "")
    s = replace_once(s, "par exemple avec une charge lourde à l’arrière. Pesez essieu par essieu.", "par exemple avec une charge lourde à l’arrière (vélos, soute). Répartissez les charges lourdes.")
    s = replace_once(s, "90 km/h sur autoroute.</small></div></details>';", "90 km/h sur autoroute.</small></div></details><p class=\"wtiny\">Pour un poids exact : un pont-bascule, par exemple dans une coopérative agricole.</p>';")
    s = replace_once(s, '''    renderHomeLoad();
  }
  $("#weightbody").addEventListener("input",function(e){
    var id = e.target.id; if(!id) return;''', r'''    renderHomeLoad();
  }
  function renderAff(){
    var el = $("#waff"); if(!el) return;
    var A = waff(), on = A.filter(function(a){return a.on}), h = '';
    if(A.length){
      h += '<p class="sub">Cochez ce qui part avec vous pour ce voyage.</p>' + A.map(function(a,i){
        return '<div class="affrow"><label class="affchk"><input type="checkbox" id="af_on_'+i+'"'+(a.on?' checked':'')+'><span>'+esc(a.n)+'</span></label>' +
          '<span class="dimin"><input id="af_kg_'+i+'" type="number" inputmode="numeric" min="0" max="999" step="1" value="'+a.kg+'" aria-label="Poids : '+esc(a.n)+'"> kg</span>' +
          '<button class="affdel" type="button" data-aff="del" data-i="'+i+'" aria-label="Retirer '+esc(a.n)+'">✕</button></div>';
      }).join("") + '<div class="ln tot"><span>Total coché</span><b id="afftot">'+kg(on.reduce(function(t,a){return t+a.kg},0))+'</b></div>' +
        '<div class="affbtns"><button class="lnk" type="button" data-aff="none">Tout décocher (nouveau voyage)</button><button class="lnk" type="button" data-aff="all">Tout cocher</button></div>';
    } else h += '<p class="sub">Comme un petit carnet : notez une fois le poids de vos affaires, puis cochez avant chaque départ ce que vous emportez. L\'application fait le calcul pour vous.</p>';
    var have = {}; A.forEach(function(a){have[a.n] = true});
    var ideas = AFF_IDEAS.filter(function(x){return !have[x[0]]});
    if(ideas.length) h += '<p class="eyebrow">Ajouter en un geste</p><div class="affideas">'+ideas.map(function(x){return '<button class="lnk" type="button" data-aff="idea" data-n="'+esc(x[0])+'" data-kg="'+x[1]+'">＋ '+esc(x[0])+' ('+x[1]+' kg)</button>'}).join("")+'</div>';
    h += '<details class="cat"'+(A.length?'':' open')+'><summary><span>＋ Autre chose</span></summary><div class="card">' +
      '<div class="fld"><label for="af_n">Quoi</label><input id="af_n" class="search" maxlength="60" placeholder="Kayak, groupe de froid, réserves…"></div>' +
      fld("af_k","Poids",'',"kg","Le poids de l'objet, ou une estimation.") +
      '<button class="btn" type="button" data-aff="add" style="width:100%">Ajouter à ma liste</button></div></details>';
    el.innerHTML = h;
  }
  function affAdd(n,k){
    n = String(n||"").trim().slice(0,60); k = Math.max(0,Math.min(999,Math.round(k||0)));
    if(!n){toast("Indiquez ce que vous emportez."); return false}
    wt.aff = waff().concat([{n:n,kg:k,on:true}]).slice(0,40); wtSave(); return true;
  }
  $("#weightbody").addEventListener("click",function(e){
    var b = e.target.closest("[data-aff]"); if(!b) return;
    var a = b.dataset.aff, A = waff().slice(), first = !A.length;
    if(a==="idea"){ if(!affAdd(b.dataset.n, +b.dataset.kg)) return; }
    else if(a==="add"){ if(!affAdd(($("#af_n")||{}).value, parseFloat(($("#af_k")||{}).value))) return; toast("Ajouté à votre liste."); }
    else if(a==="del"){ A.splice(+b.dataset.i,1); wt.aff = A; wtSave(); }
    else if(a==="none" || a==="all"){ A.forEach(function(x){x.on = a==="all"}); wt.aff = A; wtSave(); }
    if(first !== !waff().length) renderWeight(); else { renderAff(); renderWeightSummary(); }
  });
  $("#weightbody").addEventListener("input",function(e){
    var id = e.target.id; if(!id) return;
    var am = /^af_(on|kg)_(\d+)$/.exec(id);
    if(am){
      var A = waff(), x = A[+am[2]]; if(!x) return;
      if(am[1]==="on") x.on = e.target.checked; else x.kg = Math.max(0,Math.min(999,Math.round(parseFloat(e.target.value)||0)));
      wtSave(); renderWeightSummary();
      var t = $("#afftot"); if(t) t.textContent = kg(A.reduce(function(s,a){return s+(a.on?a.kg:0)},0));
      return;
    }''')
    s = replace_once(s, '''    $("#weightbody").innerHTML = h;
    renderWeightSummary();''', '''    $("#weightbody").innerHTML = h;
    renderAff();
    renderWeightSummary();''')

    # ---- Length and height: touch the figure to see which equipment adds to it, and adjust each size ----
    s = replace_once(s, '''    return '<div class="dim"><span class="k">'+icon+k+'</span>''', '''    return '<button type="button" class="dim'+(dimOpen===key?' on':'')+'" data-dimk="'+key+'" aria-expanded="'+(dimOpen===key)+'"><span class="k">'+icon+k+'</span>''')
    s = replace_once(s, ''''Base '+fm(base)+', sans équipement ajouté')+'</span></div>';
  }''', r''''Base '+fm(base)+', sans équipement ajouté')+'</span><span class="dimgo">Voir et ajuster ›</span></button>';
  }
  var dimOpen = null;
  // What adds to the length (or height): each piece of equipment checked, with its size, adjustable to the real one.
  function renderDimPanel(){
    var p = $("#dimpanel"); if(!p) return;
    p.hidden = !dimOpen; if(!dimOpen) return;
    var key = dimOpen, base = key==="l" ? MODEL.l : MODEL.h;
    var ids = Object.keys(DIMS).filter(function(id){return DIMS[id].t===key && own[id]});
    var h = '<p class="eyebrow">'+(key==="l"?"Ce qui dépasse à l'arrière":"Ce qui dépasse du toit")+'</p>' +
      '<div class="ln"><span>'+(key==="l"?"Longueur":"Hauteur")+' du véhicule, sans équipement</span><b>'+fm(base)+'</b></div>';
    if(ids.length){
      h += ids.map(function(id){
        return '<div class="fld dimfld"><label for="dp_'+id+'">'+esc((eqById(id)||{name:DIMS[id].n}).name)+'</label><span class="dimin"><input id="dp_'+id+'" type="number" inputmode="numeric" min="0" max="300" step="1" data-dp="'+id+'" value="'+dimVal(id)+'"> cm</span></div>';
      }).join("") + '<p class="sub">Mesurez sur votre véhicule et corrigez si besoin. Seul l\'équipement qui dépasse le plus compte : '+(key==="l"?"un porte-vélos et une boule d'attelage ne s'additionnent pas.":"une antenne et un coffre de toit ne s'additionnent pas.")+'</p>';
    } else h += '<p class="sub">Aucun équipement coché ne dépasse. Un porte-vélos, une boule d\'attelage, une antenne ou un coffre de toit se cochent dans « Mes équipements ».</p>';
    h += '<div class="dimclose"><button class="btn alt" type="button" data-dimclose="1">Fermer</button><button class="btn alt" type="button" data-go="equip">Mes équipements</button></div>';
    p.innerHTML = h;
  }''')
    s = replace_once(s, '''  function renderDims(){
    if(typeof renderHomeLoad==="function") renderHomeLoad();
    var el = $("#dims"); if(!el) return;''', '''  function renderDims(){
    if(typeof renderHomeLoad==="function") renderHomeLoad();
    var el = $("#dims"); if(!el) return;
    if(!$("#dimpanel")){
      var pn = document.createElement("div"); pn.id = "dimpanel"; pn.className = "card dimpanel"; pn.hidden = true;
      el.parentNode.insertBefore(pn, el.nextSibling);
      el.addEventListener("click",function(e){
        var b = e.target.closest("[data-dimk]"); if(!b) return;
        dimOpen = dimOpen===b.dataset.dimk ? null : b.dataset.dimk; renderDims(); renderDimPanel();
      });
      pn.addEventListener("click",function(e){
        if(e.target.closest("[data-dimclose]") || e.target.closest("[data-go]")){dimOpen = null; renderDims(); renderDimPanel()}
      });
      pn.addEventListener("input",function(e){
        var id = e.target.dataset.dp; if(!id) return;
        var n = parseFloat(e.target.value);
        if(isNaN(n) || n<0) delete dimv[id]; else dimv[id] = Math.min(300,Math.round(n));
        lsSet("cdb_dim",JSON.stringify(dimv)); renderDims();
        var di = $("#di_"+id); if(di) di.value = dimVal(id);
      });
    }''')
    # Changing a size in « Mes équipements » or checking a piece of equipment keeps the panel up to date.
    s = replace_once(s, '''    lsSet("cdb_dim",JSON.stringify(dimv)); renderDims();
  });''', '''    lsSet("cdb_dim",JSON.stringify(dimv)); renderDims(); renderDimPanel();
  });''')

    # ---- Weight: equipment fitted on the vehicle at the start (checked in the back-office) is already in the mass ----
    # Only what is added afterwards (at the handover or by the customer) adds its weight.
    s = replace_once(s, 'var opts = Object.keys(WT).filter(function(id){return own[id]}).map(', 'var FACT = {}; (DATA.vehicle.equipment||[]).forEach(function(i){FACT[i] = true});\n    var inc = Object.keys(WT).filter(function(id){return own[id] && FACT[id] && eqById(id)}).map(function(id){return eqById(id).name});\n    var opts = Object.keys(WT).filter(function(id){return own[id] && !FACT[id]}).map(')
    s = replace_once(s, 'return {opts:opts,lines:lines,', 'return {inc:inc,opts:opts,lines:lines,')
    s = replace_once(s, '<div class="empty"><p>Aucun équipement lourd coché. Les options de la liste « Mes équipements » ajoutent ici leur poids.</p>',
        '<div class="empty"><p>Aucun équipement ajouté depuis la livraison. Ce que vous ajoutez dans « Mes équipements » (porte-vélos, panneau solaire…) compte ici son poids.</p>')
    s = replace_once(s, '''    h += '<h3 class="sech">Détail du calcul</h3>''', '''    if(c.inc.length) h += '<p class="sub">Déjà compris dans la masse en ordre de marche (présents sur le véhicule à la livraison) : '+esc(c.inc.join(", "))+'.</p>';
    h += '<h3 class="sech">Détail du calcul</h3>''')
    # ---- « Conseils & Astuces » instead of the missions game, and the « À la une » banner of the home screen ----
    # Tips written in the back-office or shared by customers (published after reading), filtered by category.
    s = replace_once(s, 'game:"Missions"};', 'game:"Conseils & Astuces"};')
    a = s.index("  /* ---------- Missions ---------- */")
    b_end = '    if(e.target.closest("#replay")){resetGame(); renderGame()}\n  });\n'
    b = s.index(b_end, a) + len(b_end)
    s = s[:a] + r'''  /* ---------- Conseils & Astuces ---------- */
  var TIPS = DATA.tips || [], TCATS = DATA.tipCategories || [];
  var tipState = {cat:"", open:null, sharing:false, photo:null, sent:false, busy:false};
  function tipTrack(t){if(window.CDB_TRACK) window.CDB_TRACK("tip",{id:String(t.id),label:t.title})}
  function catName(id){var c = TCATS.filter(function(x){return x[0]===id})[0]; return c ? c[1] : ""}
  function tipMedia(t){
    if(t.videoUrl) return '<div class="tipvid"><iframe src="'+esc(t.videoUrl)+'" title="'+esc(t.title)+'" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
    if(t.imageUrl) return '<img class="tipimg" src="'+esc(t.imageUrl)+'" alt="">';
    return '';
  }
  function tipCard(t){
    var open = tipState.open === t.id;
    return '<article class="card tipcard'+(open?' open':'')+'" id="tip-'+t.id+'">' +
      '<button class="tiphead" type="button" data-tip="'+t.id+'" aria-expanded="'+open+'"><span class="tipt"><span class="tipcat">'+esc(catName(t.category))+'</span><b>'+esc(t.title)+'</b>'+(t.author?'<span class="tipby">L\'astuce de '+esc(t.author)+'</span>':'')+'</span><span class="tipgo" aria-hidden="true">'+(open?'−':'+')+'</span></button>' +
      (open ? tipMedia(t) + '<p class="tiptext">'+esc(t.body).replace(/\n/g,'<br>')+'</p>' +
        (t.storeTip ? '<div class="tipstore"><p class="eyebrow">🛒 Le conseil du magasin</p><p>'+esc(t.storeTip)+'</p>'+(window.CDB_CLOUD && window.CDB_CLOUD.partRequest ? '<button class="btn alt" type="button" data-tipshop="'+t.id+'">Demander au magasin</button>' : '')+'</div>' : '') : '') +
      '</article>';
  }
  function shareBlock(){
    if(!window.CDB_CLOUD || !window.CDB_CLOUD.shareTip) return '';
    if(tipState.sent) return '<div class="ok"><b>Merci pour votre astuce !</b> Elle sera relue par la concession, puis publiée pour les autres camping-caristes.</div><button class="lnk" type="button" id="tipagain">Partager une autre astuce</button>';
    if(!tipState.sharing) return '<button class="btn tipshare" type="button" id="tipshare">💬 Partager mon astuce</button>';
    return '<div class="card tipform"><h3>Partager mon astuce</h3>' +
      '<div class="fld"><label for="tp_t">Titre</label><input id="tp_t" class="search" maxlength="80" placeholder="Ex. : Ranger les cales sans les oublier"></div>' +
      '<div class="fld"><label for="tp_c">Thème</label><select id="tp_c" class="search">'+TCATS.map(function(c){return '<option value="'+esc(c[0])+'">'+esc(c[1])+'</option>'}).join("")+'</select></div>' +
      '<div class="fld"><label for="tp_b">Votre astuce</label><textarea id="tp_b" class="search" rows="5" maxlength="1500" placeholder="Expliquez simplement ce que vous faites."></textarea></div>' +
      '<div class="fld"><label for="tp_p">Une photo (facultatif)</label><input id="tp_p" type="file" accept="image/*">'+(tipState.photo?'<img class="tipimg" src="'+tipState.photo+'" alt="Votre photo">':'')+'</div>' +
      '<p class="sub">Votre astuce est relue avant d\'être publiée. Seul votre prénom apparaît.</p>' +
      '<div class="tipbtns"><button class="btn" type="button" id="tipsend"'+(tipState.busy?' disabled':'')+'>Envoyer</button><button class="btn alt" type="button" id="tipcancel">Annuler</button></div></div>';
  }
  function renderGame(){
    var b = $("#gamebody");
    var cats = TCATS.filter(function(c){return TIPS.some(function(t){return t.category===c[0]})});
    var list = TIPS.filter(function(t){return !tipState.cat || t.category===tipState.cat});
    var h = '<p class="sub">Les bons gestes, expliqués simplement par votre concession et par d\'autres camping-caristes. Touchez une astuce pour la lire.</p>';
    if(cats.length > 1) h += '<div class="tipcats"><button type="button" class="vchip" data-tcat="" aria-pressed="'+(!tipState.cat)+'">Tout</button>'+cats.map(function(c){return '<button type="button" class="vchip" data-tcat="'+esc(c[0])+'" aria-pressed="'+(tipState.cat===c[0])+'">'+esc(c[1])+'</button>'}).join("")+'</div>';
    h += list.length ? list.map(tipCard).join("") : '<div class="empty"><p>Aucune astuce pour le moment.</p></div>';
    h += shareBlock();
    b.innerHTML = h;
  }
  function openTip(id){
    var t = TIPS.filter(function(x){return x.id===id})[0];
    tipState.cat = ""; tipState.open = t ? id : null; go("game");
    if(t){tipTrack(t); var el = $("#tip-"+id); if(el && el.scrollIntoView) el.scrollIntoView({block:"start"})}
  }
  $("#gamebody").addEventListener("click",function(e){
    var h = e.target.closest("[data-tip]");
    if(h){var id = +h.dataset.tip; tipState.open = tipState.open===id ? null : id; if(tipState.open){var t = TIPS.filter(function(x){return x.id===id})[0]; if(t) tipTrack(t)} renderGame(); var el = $("#tip-"+id); if(el && tipState.open && el.scrollIntoView) el.scrollIntoView({block:"nearest"}); return}
    var c = e.target.closest("[data-tcat]");
    if(c){tipState.cat = c.dataset.tcat; tipState.open = null; renderGame(); return}
    var sh = e.target.closest("[data-tipshop]");
    if(sh){var ts = TIPS.filter(function(x){return x.id===+sh.dataset.tipshop})[0]; if(ts) window.CDB_CLOUD.partRequest(null, ts.title, "accessoire"); return}
    if(e.target.closest("#tipshare")){tipState.sharing = true; tipState.sent = false; renderGame(); var f = $("#tp_t"); if(f) f.focus(); return}
    if(e.target.closest("#tipcancel")){tipState.sharing = false; tipState.photo = null; renderGame(); return}
    if(e.target.closest("#tipagain")){tipState.sent = false; tipState.sharing = true; renderGame(); return}
    if(e.target.closest("#tipsend")){
      var data = {title:($("#tp_t").value||"").trim(), category:$("#tp_c").value, body:($("#tp_b").value||"").trim(), photo:tipState.photo};
      if(!data.title){toast("Donnez un titre à votre astuce."); return}
      if(data.body.length < 10){toast("Expliquez votre astuce en quelques mots."); return}
      tipState.busy = true; e.target.closest("#tipsend").disabled = true;
      window.CDB_CLOUD.shareTip(data).then(function(){tipState.busy = false; tipState.sharing = false; tipState.photo = null; tipState.sent = true; renderGame(); toast("Astuce envoyée, merci !")}).catch(function(err){tipState.busy = false; var sb = $("#tipsend"); if(sb) sb.disabled = false; toast(err && err.message ? err.message : "Envoi impossible, réessayez.")});
    }
  });
  $("#gamebody").addEventListener("change",function(e){
    if(e.target.id !== "tp_p" || !e.target.files || !e.target.files[0]) return;
    var keep = {t:$("#tp_t").value, c:$("#tp_c").value, b:$("#tp_b").value};
    window.CDB_CLOUD.compress(e.target.files[0]).then(function(url){tipState.photo = url; renderGame(); $("#tp_t").value = keep.t; $("#tp_c").value = keep.c; $("#tp_b").value = keep.b}).catch(function(){toast("Photo illisible, essayez-en une autre.")});
  });

  // « À la une »: the banner of the home screen, set in the back-office (a tip, a page of the app, a web page or an announcement).
  function renderFeatured(){
    var el = $("#featured"); if(!el) return;
    var f = DATA.featured;
    if(!f || !f.title){el.innerHTML = ""; return}
    el.innerHTML = '<button class="mission feat" type="button" id="featbtn"><span class="stamp" aria-hidden="true">'+esc(f.icon||"💡")+'</span><span class="mtxt"><small>À la une</small><strong>'+esc(f.title)+'</strong>'+(f.subtitle?'<span>'+esc(f.subtitle)+'</span>':'')+'</span><span class="go" aria-hidden="true">›</span></button>';
  }
  function featPopup(f){
    var m = document.createElement("div"); m.className = "featpop";
    m.innerHTML = '<div class="card" role="dialog" aria-modal="true" aria-label="'+esc(f.title)+'"><p class="eyebrow">'+esc(f.icon||"📣")+' À la une</p><h2>'+esc(f.title)+'</h2><p>'+esc(f.text||"").replace(/\n/g,'<br>')+'</p><button class="btn" type="button" data-featclose="1">Fermer</button></div>';
    m.addEventListener("click",function(e){if(e.target === m || e.target.closest("[data-featclose]")) m.remove()});
    document.body.appendChild(m);
  }
  document.addEventListener("click",function(e){
    if(!e.target.closest("#featbtn")) return;
    var f = DATA.featured; if(!f) return;
    if(f.action==="tip") openTip(f.tipId);
    else if(f.action==="screen"){ if(f.screen==="tips") go("game"); else if(f.screen==="carnet"){ if(window.CDB_CLOUD && window.CDB_CLOUD.openCarnet) window.CDB_CLOUD.openCarnet() } else if(titles[f.screen]) go(f.screen) }
    else if(f.action==="link" && f.url) window.open(f.url, "_blank", "noopener");
    else featPopup(f);
  });
  renderFeatured();
  // The banner for this customer today, asked again at each start (dates, time since the handover).
  window.CDB_SET_FEATURED = function(f){DATA.featured = f || null; renderFeatured()};
''' + s[b:]

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
    # « Mission du jour » → the « À la une » banner, set in the back-office; « Missions » → « Conseils & Astuces ».
    body_part = replace_once(body_part, '<button class="mission" data-go="game"><span class="stamp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg></span><span class="mtxt"><small>Mission du jour</small><strong>Préparer le départ</strong><span>3 minutes pour apprendre le bon ordre</span></span><span class="go" aria-hidden="true">›</span></button>', '<div id="featured"></div>')
    body_part = replace_once(body_part, '<button class="tile" data-go="game"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg><strong>Missions</strong><span>Apprendre en jouant</span></button>',
        '<button class="tile" data-go="game"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/></svg><strong>Conseils &amp; Astuces</strong><span>Les bons gestes, partagés</span></button>')
    body_part = replace_once(body_part, '<button data-go="game"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg>Missions</button>',
        '<button data-go="game"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/></svg>Astuces</button>')
    body_part = replace_once(body_part, '<!-- Missions -->', '<!-- Conseils & Astuces -->')
    # The maintenance moved to the « Carnet d'entretien » of the home screen (dates, reminders, appointment): no more tab here.
    body_part = replace_once(body_part, '\n        <button data-list="entretien" aria-pressed="false">Entretien</button>', '')
    body_part = replace_once(body_part, '<strong>Gestes du quotidien</strong><span>Arrivée, départ et entretien</span>', '<strong>Gestes du quotidien</strong><span>Arrivée et départ</span>')
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
