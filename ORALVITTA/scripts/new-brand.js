// Cria um projeto novo a partir do molde:  npm run novo -- <id> "Nome do Negócio" "Cidade"
const fs = require('node:fs');
const path = require('node:path');

const [id, name, city = ''] = process.argv.slice(2);
if (!id || !name || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Uso: npm run novo -- <id-em-minusculas-com-hifen> "Nome do Negócio" "Cidade"');
  process.exit(1);
}
const root = path.join(__dirname, '..', 'brands');
const dest = path.join(root, id);
if (fs.existsSync(dest)) { console.error(`Já existe: brands/${id}`); process.exit(1); }

const brand = JSON.parse(fs.readFileSync(path.join(root, '_modelo', 'brand.json'), 'utf8'));
Object.assign(brand, { id, name, subtitle: city, fullName: city ? `${name} ${city}` : name, city });
fs.mkdirSync(path.join(dest, 'img'), { recursive: true });
fs.writeFileSync(path.join(dest, 'brand.json'), JSON.stringify(brand, null, 2) + '\n');
console.log(`Criado brands/${id}/brand.json`);
console.log(`Próximos passos: coloque logo/favicon/fotos em brands/${id}/img/, edite o brand.json e rode:`);
console.log(`  BRAND=${id} npm start`);
