// Gera uma cópia do sistema contendo APENAS uma clínica, para entregar a ela sem expor dados das outras.
//   node scripts/export-brand.js dra-dentista [pasta-de-saida]
const fs = require('node:fs');
const path = require('node:path');

const id = process.argv[2];
const root = path.join(__dirname, '..');
if (!id || !fs.existsSync(path.join(root, 'brands', id, 'brand.json'))) {
  console.error('Uso: node scripts/export-brand.js <id-da-clinica> [pasta-de-saida]');
  console.error('Clínicas disponíveis:', fs.readdirSync(path.join(root, 'brands')).join(', '));
  process.exit(1);
}
const out = path.resolve(process.argv[3] || path.join(root, '..', `export-${id}`));
if (fs.existsSync(out)) { console.error(`A pasta ${out} já existe. Apague-a ou escolha outra.`); process.exit(1); }

const skip = new Set(['node_modules', 'data', '.git', 'scripts', 'docs']);
function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const src = path.join(from, e.name), dst = path.join(to, e.name);
    if (from === path.join(root, 'brands') && e.isDirectory() && e.name !== id) continue; // outras clínicas ficam de fora
    if (from === root && e.name === 'README.md') continue;
    if (e.isDirectory()) copy(src, dst); else fs.copyFileSync(src, dst);
  }
}
copy(root, out);

const brand = JSON.parse(fs.readFileSync(path.join(root, 'brands', id, 'brand.json'), 'utf8'));

// A cópia não leva os testes (eles citam as outras clínicas) nem o script de exportação.
fs.rmSync(path.join(out, 'test'), { recursive: true, force: true });
const rewrite = (file, fn) => { const f = path.join(out, file); fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8'))); };
rewrite('src/brand.js', t => t.replace(/oralvitta/g, id));
const fix = t => t.replace(/oralvitta-agendamento/g, `${id}-agendamento`).replace(/"name": "oralvitta"/g, `"name": "${id}-agendamento"`);
rewrite('package-lock.json', fix);
rewrite('package.json', t => {
  const j = JSON.parse(fix(t));
  j.description = `Sistema de agendamento odontológico - ${brand.fullName}`;
  delete j.scripts.test; delete j.scripts.export;
  return JSON.stringify(j, null, 2) + '\n';
});

fs.writeFileSync(path.join(out, 'README.md'), `# ${brand.fullName} — Sistema de agendamento

\`\`\`bash
npm install
npm start        # http://localhost:3000   (painel em /admin)
\`\`\`

Requer Node.js 22.13 ou superior. Na primeira execução o terminal mostra o usuário (\`admin\`) e uma senha gerada; anote e troque em Painel → Configurações.
Para definir a senha inicial: \`ADMIN_PASSWORD="sua-senha-longa" npm start\`.

Dados da clínica (nome, cores, logo, serviços iniciais): \`brands/${id}/\`. Depois que o banco é criado, tudo é editado pelo painel.
Variáveis opcionais: \`PORT\`, \`DB_FILE\`, \`TRUST_PROXY=true\` (atrás de HTTPS).
`);
console.log(`Pasta gerada em: ${out}`);
