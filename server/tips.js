'use strict';

// « Conseils & Astuces »: short tips (title, picture or video, text, optional « Le conseil du magasin ») written in the
// back-office, or shared by customers and published once read by an administrator or a content editor. And the
// « À la une » banner of the home screen, which opens a tip, a page of the app, a web page or an announcement.

const { getSetting, setSetting } = require('./db');

const CATEGORIES = [
  ['eau', 'Eau'],
  ['energie', 'Énergie'],
  ['gaz', 'Gaz'],
  ['entretien', 'Entretien'],
  ['hiver', 'Hiver'],
  ['route', 'Sur la route'],
  ['confort', 'Confort'],
];
const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c[0]));

// Pages of the app the banner can open (screen ids of public/app).
const SCREENS = [
  ['tips', 'Conseils & Astuces'],
  ['weight', 'Poids du véhicule'],
  ['carnet', 'Carnet d’entretien'],
  ['daily', 'Gestes du quotidien'],
  ['diag', 'J’ai un souci'],
  ['rdv', 'Rendez-vous atelier'],
  ['equip', 'Mes équipements'],
  ['what', 'C’est quoi, ça ?'],
];
const SCREEN_IDS = new Set(SCREENS.map((s) => s[0]));
const ICONS = ['💡', '❄️', '☀️', '💧', '🔥', '🔋', '🔧', '🚐', '🎁', '📣', '🛒', '⚠️'];

// Videos are only embedded (never stored on our server): YouTube or Vimeo, played without tracking cookies when possible.
function videoEmbed(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  let u;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      if (m) id = m[1];
    }
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/(\d{6,12})/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}

function tipOut(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    body: r.body,
    imageUrl: r.image_url || null,
    videoUrl: r.video_url || null,
    storeTip: r.store_tip || null,
    // A tip shared by a customer shows their first name only.
    author: r.customer_id ? r.author_name || 'Un client' : null,
  };
}

function publishedTips(db) {
  return db.prepare("SELECT * FROM tips WHERE status = 'published' ORDER BY sort DESC, id DESC").all().map(tipOut);
}

const DEFAULT_FEATURED = null;
function featuredOf(db) {
  try {
    return JSON.parse(getSetting(db, 'featured', 'null')) || DEFAULT_FEATURED;
  } catch {
    return DEFAULT_FEATURED;
  }
}

// What the banner may hold: title, subtitle, icon, and one action (tip, page of the app, web page, announcement).
function cleanFeatured(db, body) {
  if (!body || !String(body.title || '').trim()) return null;
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '');
  const action = ['tip', 'screen', 'link', 'popup'].includes(body.action) ? body.action : 'popup';
  const out = { title: str(body.title, 80), subtitle: str(body.subtitle, 140), icon: ICONS.includes(body.icon) ? body.icon : '💡', action };
  if (action === 'tip') {
    const id = Number(body.tipId);
    if (!db.prepare("SELECT 1 FROM tips WHERE id = ? AND status = 'published'").get(id)) throw new Error('Choisissez une astuce publiée');
    out.tipId = id;
  } else if (action === 'screen') {
    if (!SCREEN_IDS.has(body.screen)) throw new Error('Choisissez une page de l’application');
    out.screen = body.screen;
  } else if (action === 'link') {
    const url = str(body.url, 500);
    if (!/^https:\/\/[^\s]+$/i.test(url)) throw new Error('Le lien doit commencer par https://');
    out.url = url;
  } else {
    out.text = str(body.text, 1500);
    if (!out.text) throw new Error('Écrivez le texte de l’annonce');
  }
  return out;
}

function setFeatured(db, featured) {
  setSetting(db, 'featured', featured ? JSON.stringify(featured) : null);
}

// First tips of a new site, in our words. « Le conseil du magasin » is always a product sold in a camping-car accessory
// store, never a home remedy, never a reference.
const STARTER_TIPS = [
  {
    title: 'Protéger le circuit d’eau du gel',
    category: 'hiver',
    body: 'Avant les premières gelées, videz entièrement l’eau propre, le chauffe-eau et les canalisations. Laissez les robinets ouverts en position médiane et la vanne de vidange du chauffe-eau ouverte pendant tout l’hiver. Une seule nuit de gel suffit à fendre un tuyau ou le chauffe-eau.',
    storeTip: 'Une housse d’hivernage respirante protège le véhicule pendant tout le stockage, sans humidité.',
  },
  {
    title: 'Garder ses batteries en forme au garage',
    category: 'energie',
    body: 'Un véhicule immobilisé se décharge doucement, même tout éteint. Coupez le coupe-batterie et rechargez au moins une fois par mois. Une batterie laissée vide plusieurs semaines perd une partie de sa capacité pour toujours.',
    storeTip: 'Un chargeur de maintien branché sur le secteur garde les batteries pleines tout l’hiver, sans y penser.',
  },
  {
    title: 'Changer de bouteille de gaz en sécurité',
    category: 'gaz',
    body: 'Fermez le robinet de la bouteille vide, éteignez les appareils au gaz, puis dévissez le détendeur. Vérifiez le joint avant de le remettre sur la bouteille pleine. Ne fumez jamais et n’approchez aucune flamme pendant l’opération.',
    storeTip: 'Un inverseur automatique bascule tout seul sur la deuxième bouteille quand la première est vide : plus de douche froide.',
  },
  {
    title: 'Cassette WC : le bon geste',
    category: 'eau',
    body: 'Videz la cassette dès qu’elle est aux deux tiers, uniquement aux bornes prévues. Rincez-la à l’eau claire, puis remettez la bonne dose de produit avec un peu d’eau au fond avant de la remettre en place.',
    storeTip: 'Un produit spécial cassette WC limite les odeurs et dissout les matières. Il existe en version écologique.',
  },
  {
    title: 'Moins de buée le matin',
    category: 'confort',
    body: 'La nuit, à deux, on rejette près d’un litre d’eau en respirant. Laissez toujours un lanterneau entrouvert et ne bouchez jamais les aérations : c’est ce qui évite la buée et l’humidité dans la cellule.',
    storeTip: 'Un isolant extérieur de pare-brise garde la cabine plus chaude et supprime presque toute la buée sur les vitres.',
  },
  {
    title: 'Faire le tour avant de partir',
    category: 'route',
    body: 'Avant de démarrer, faites le tour du véhicule : câble électrique débranché, marchepied rentré, store fermé, lanterneaux fermés, antenne baissée et cales ramassées. Trente secondes qui évitent les mauvaises surprises.',
    storeTip: 'Des cales de nivellement avec poignée se rangent facilement et se voient de loin : on ne les oublie plus.',
  },
  {
    title: 'Entretenir les joints de portes et de baies',
    category: 'entretien',
    body: 'Les joints sèchent au soleil et au froid, puis laissent passer l’air et l’eau. Deux fois par an, nettoyez-les et nourrissez-les : les portes ferment mieux et les joints durent bien plus longtemps.',
    storeTip: 'Un soin spécial joints en caoutchouc les garde souples et étanches, été comme hiver.',
  },
  {
    title: 'Eaux grises sans odeur',
    category: 'eau',
    body: 'Videz les eaux grises souvent, même si le réservoir n’est pas plein, et rincez-le de temps en temps à l’eau claire. Les odeurs viennent des restes qui stagnent au fond.',
    storeTip: 'Un produit d’entretien pour réservoir d’eaux grises dissout les dépôts et supprime les odeurs.',
  },
];

function seedStarterTips(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM tips').get().n) return 0;
  const insert = db.prepare("INSERT INTO tips (title, category, body, store_tip, status, sort, published_at) VALUES (?, ?, ?, ?, 'published', 0, datetime('now'))");
  // Inserted last first: the newest is shown first, so the list keeps this order.
  [...STARTER_TIPS].reverse().forEach((t) => insert.run(t.title, t.category, t.body, t.storeTip));
  if (!featuredOf(db)) {
    const first = db.prepare('SELECT id FROM tips WHERE title = ?').get(STARTER_TIPS[0].title);
    setFeatured(db, { title: 'Avant l’hiver', subtitle: 'Protégez votre circuit d’eau du gel', icon: '❄️', action: 'tip', tipId: first.id });
  }
  return STARTER_TIPS.length;
}

module.exports = { CATEGORIES, CATEGORY_IDS, SCREENS, ICONS, videoEmbed, tipOut, publishedTips, featuredOf, cleanFeatured, setFeatured, seedStarterTips };
