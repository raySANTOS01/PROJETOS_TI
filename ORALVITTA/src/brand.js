// Cada site é uma "marca": nome, logo, cores, fontes, textos, contatos e dados iniciais ficam em brands/<id>/.
// Escolha com BRAND=<id>. Cada marca usa seu próprio banco de dados. Veja brands/_modelo/ para o molde.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.BRANDS_DIR || path.join(__dirname, '..', 'brands');
const listIds = () => fs.existsSync(ROOT)
  ? fs.readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name) : [];

// Sem BRAND definido: usa a única marca presente (cópia exportada) ou 'oralvitta'.
function defaultId() {
  const ids = listIds();
  return ids.length === 1 ? ids[0] : 'oralvitta';
}

const DEFAULT_COPY = {
  eyebrow: 'Odontologia em {city}',
  heroTitle: 'Agende sua consulta com facilidade.',
  heroLead: 'Escolha o serviço, veja os horários realmente disponíveis e reserve o seu na hora, em poucos passos.',
  servicesEyebrow: 'Serviços',
  servicesTitle: 'Cuidado completo para toda a família',
  servicesLead: 'Do atendimento de urgência à odontopediatria: escolha o serviço e já veja os horários livres.',
};
const DEFAULT_DESIGN = {
  fonts: { display: ['Cormorant Garamond', '500;600;700'], body: ['Inter', '300;400;500;600'] },
  tone: 'light', hero: 'split', radius: 10, buttons: 'pill',
};

function loadBrand(id = process.env.BRAND || defaultId()) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Marca inválida: ${id}`);
  const dir = path.join(ROOT, id);
  const file = path.join(dir, 'brand.json');
  if (!fs.existsSync(file)) throw new Error(`Marca não encontrada: ${file}`);
  const brand = JSON.parse(fs.readFileSync(file, 'utf8'));
  brand.dir = dir;
  brand.imgDir = path.join(dir, 'img');
  brand.vertical ??= 'clinica';
  brand.copy = { ...DEFAULT_COPY, ...brand.copy };
  brand.design = { ...DEFAULT_DESIGN, ...brand.design, fonts: { ...DEFAULT_DESIGN.fonts, ...(brand.design || {}).fonts } };
  brand.gallery ??= [];
  brand.purchaseFields ??= [];
  brand.vocab = { appt: 'consulta', appts: 'consultas', ...brand.vocab };
  const hasImg = f => fs.existsSync(path.join(brand.imgDir, f));
  if (brand.design.hero === 'image' && !hasImg('hero.jpg')) {
    throw new Error(`${id}: design.hero = "image" exige o arquivo brands/${id}/img/hero.jpg`);
  }
  for (const f of [...(brand.logo.style === 'text' ? [] : [brand.logo.file]), brand.logo.favicon, ...brand.gallery, ...(brand.about?.image ? [brand.about.image] : [])]) {
    if (!hasImg(f)) throw new Error(`${id}: imagem não encontrada: brands/${id}/img/${f}`);
  }
  return brand;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fill = (t, brand) => t.replace('{city}', brand.city);

function fontsLink(brand) {
  const q = Object.values(brand.design.fonts).filter(Boolean)
    .map(([family, weights]) => `family=${family.replace(/ /g, '+')}:wght@${weights}`).join('&');
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

// Trechos de HTML que substituem os marcadores {{...}} nas páginas.
const HEART = '<svg class="heart" viewBox="0 0 32 29" aria-hidden="true"><path d="M16 28C6 20 1 14.700 1 8.800 1 4.600 4.200 1.500 8.200 1.500c3 0 5.600 1.700 7.800 4.800 2.200-3.100 4.800-4.800 7.800-4.800 4 0 7.200 3.100 7.200 7.300C31 14.700 26 20 16 28z" fill="currentColor"/></svg>';

function tokens(brand) {
  const mark = brand.logo.style === 'mark';
  const text = brand.logo.style === 'text';
  const img = text
    ? `<span class="brand-text">${HEART}<span class="script">${esc(brand.name.split(' ')[0])}</span><span class="rest">${esc(brand.name.split(' ').slice(1).join(' '))}</span></span>`
    : `<img src="/img/${esc(brand.logo.file)}" alt="${mark ? '' : esc(brand.name)}">`;
  const word = small => mark
    ? `<span class="word">${esc(brand.name)}${small ? `<small>${esc(small)}</small>` : ''}</span>` : '';
  const c = brand.copy;
  return {
    FULL: esc(brand.fullName),
    NAME: esc(brand.name),
    CITY: esc(brand.city),
    FAVICON: `/img/${esc(brand.logo.favicon)}`,
    FONTS_LINK: esc(fontsLink(brand)),
    BODY_CLASS: `hero-${brand.design.hero} tone-${brand.design.tone}`,
    BRAND: img + word(brand.subtitle),
    BRAND_PANEL: img + word('Painel') + (mark ? '' : '<span class="panel-tag">Painel</span>'),
    BRAND_CLASS: mark ? 'brand' : text ? 'brand brand-text-wrap' : 'brand brand-wide',
    HERO_EYEBROW: esc(fill(c.eyebrow, brand)),
    HERO_TITLE: esc(c.heroTitle),
    HERO_LEAD: esc(c.heroLead),
    SERVICES_EYEBROW: esc(c.servicesEyebrow),
    SERVICES_TITLE: esc(c.servicesTitle),
    SERVICES_LEAD: esc(c.servicesLead),
    APPT: esc(brand.vocab.appt),
    APPTS: esc(brand.vocab.appts),
    APPT_CAP: esc(cap(brand.vocab.appt)),
    APPTS_CAP: esc(cap(brand.vocab.appts)),
    WHATSAPP: esc(brand.clinic.whatsapp),
    PHONE: esc(brand.clinic.phone),
    INSTAGRAM: esc(brand.clinic.instagram || ''),
    FACEBOOK: esc(brand.clinic.facebook || ''),
  };
}

function themeCss(brand) {
  const d = brand.design;
  const vars = Object.entries(brand.colors).map(([k, v]) => `  --${k}: ${v};`);
  vars.push(`  --font-display: '${d.fonts.display[0]}', Georgia, serif;`);
  vars.push(`  --font-body: '${d.fonts.body[0]}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;`);
  if (d.fonts.accent) vars.push(`  --font-accent: '${d.fonts.accent[0]}', cursive;`);
  vars.push(`  --radius: ${Number(d.radius)}px;`);
  vars.push(`  --btn-radius: ${d.buttons === 'pill' ? '999px' : d.buttons === 'square' ? '2px' : '8px'};`);
  if (d.hero === 'image') vars.push("  --hero-img: url('/img/hero.jpg');");
  let css = `:root {\n${vars.join('\n')}\n}\n`;
  if (d.tone === 'dark') {
    // O painel administrativo continua claro e neutro, mesmo em sites com tema escuro.
    css += `body.admin {
  --white: #fff; --mist-50: #f5f8fa; --mist-100: #e9eff3; --mist-200: #d8e2e8; --line: #d6e0e6;
  --ink: #1c2a33; --ink-soft: #5a6b76; --navy-800: #17303f; --navy-900: #102431;
  --band: #17303f; --on-band: #fff; --btn-hover: #17303f; --on-primary: #fff;
}\n`;
  }
  return css;
}

module.exports = { loadBrand, tokens, themeCss, listIds };
