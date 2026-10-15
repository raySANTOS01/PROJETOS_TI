// Campos do formulário de compra/homenagem, definidos por marca em brand.json (purchaseFields).
// O mesmo molde valida pedidos e agendamentos e alimenta o formulário do site e o painel.
const { getSettings } = require('./db');
const { HttpError, str } = require('./util');

const LEGACY = [
  { key: 'recipient', label: 'Nome de quem vai receber', required: false, max: 100 },
  { key: 'address', label: 'Endereço de entrega', required: true, max: 250 },
];

const paymentOptions = settings => String(settings.payment_methods || '').split('\n').map(s => s.trim()).filter(Boolean);

function fieldSpec(db, brand) {
  const settings = getSettings(db);
  const base = brand.purchaseFields.length ? brand.purchaseFields : LEGACY;
  return base.map(f => ({
    key: f.key, label: f.label, required: !!f.required, max: f.max || 200,
    type: f.type === 'payment' ? 'select' : 'text',
    options: f.type === 'payment' ? paymentOptions(settings) : undefined,
    suggestions: f.suggestions,
  }));
}

// Valida os campos recebidos em `body` e devolve { key: valor } só com os preenchidos.
function readDetails(spec, body, { required = true } = {}) {
  const out = {};
  for (const f of spec) {
    const v = str(body[f.key], f.max, { required: required && f.required, label: f.label });
    if (!v) continue;
    if (f.type === 'select' && !f.options.includes(v)) throw new HttpError(400, `${f.label}: escolha uma das opções.`);
    out[f.key] = v;
  }
  return out;
}

module.exports = { fieldSpec, readDetails };
