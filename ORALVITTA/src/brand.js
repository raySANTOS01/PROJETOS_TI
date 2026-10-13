// Cada clínica é uma "marca": nome, logo, cores, contatos e dados iniciais ficam em brands/<id>/.
// Escolha com BRAND=<id> (padrão: oralvitta). Cada marca usa seu próprio banco de dados.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'brands');

// Sem BRAND definido: usa a única clínica presente (cópia exportada) ou 'oralvitta'.
function defaultId() {
  const ids = fs.readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  return ids.length === 1 ? ids[0] : 'oralvitta';
}

function loadBrand(id = process.env.BRAND || defaultId()) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Marca inválida: ${id}`);
  const dir = path.join(ROOT, id);
  const file = path.join(dir, 'brand.json');
  if (!fs.existsSync(file)) throw new Error(`Marca não encontrada: brands/${id}/brand.json`);
  const brand = JSON.parse(fs.readFileSync(file, 'utf8'));
  brand.dir = dir;
  brand.imgDir = path.join(dir, 'img');
  return brand;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Trechos de HTML que substituem os marcadores {{...}} nas páginas.
function tokens(brand) {
  const mark = brand.logo.style === 'mark';
  const img = `<img src="/img/${esc(brand.logo.file)}" alt="${mark ? '' : esc(brand.name)}">`;
  const word = (small) => mark
    ? `<span class="word">${esc(brand.name)}${small ? `<small>${esc(small)}</small>` : ''}</span>` : '';
  return {
    FULL: esc(brand.fullName),
    NAME: esc(brand.name),
    CITY: esc(brand.city),
    FAVICON: `/img/${esc(brand.logo.favicon)}`,
    BRAND: img + word(brand.subtitle),
    BRAND_PANEL: img + word('Painel') + (mark ? '' : '<span class="panel-tag">Painel</span>'),
    BRAND_CLASS: mark ? 'brand' : 'brand brand-wide',
  };
}

function themeCss(brand) {
  const vars = Object.entries(brand.colors).map(([k, v]) => `  --${k}: ${v};`).join('\n');
  return `:root {\n${vars}\n}\n`;
}

module.exports = { loadBrand, tokens, themeCss };
