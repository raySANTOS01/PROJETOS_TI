// Upload da foto de perfil do corretor. Salva o arquivo em disco
// (pasta /server/uploads) e o server.js serve essa pasta como estatica
// em /uploads, entao o fotoUrl salvo no banco aponta direto pra la.
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const PASTA_UPLOADS = path.resolve('uploads');
if (!fs.existsSync(PASTA_UPLOADS)) {
  fs.mkdirSync(PASTA_UPLOADS, { recursive: true });
}

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

// A extensao do arquivo salvo vem do tipo validado, NUNCA do nome enviado
// pelo cliente - senao um "x.html" com tipo image/png seria salvo e
// servido como pagina HTML pela pasta /uploads.
const EXTENSAO_POR_TIPO = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};
const TAMANHO_MAXIMO = 3 * 1024 * 1024; // 3MB

const armazenamento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PASTA_UPLOADS),
  filename: (req, file, cb) => {
    const extensao = EXTENSAO_POR_TIPO[file.mimetype];
    // req.corretorId ja existe aqui porque a rota roda "autenticar" antes deste middleware
    cb(null, `corretor-${req.corretorId}-${Date.now()}${extensao}`);
  },
});

const uploadFoto = multer({
  storage: armazenamento,
  limits: { fileSize: TAMANHO_MAXIMO },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error('Formato invalido. Envie uma imagem JPG, PNG ou WEBP.'));
    }
    cb(null, true);
  },
}).single('foto');


export function uploadFotoMiddleware(req, res, next) {
  uploadFoto(req, res, (erro) => {
    if (erro instanceof multer.MulterError && erro.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ erro: 'Imagem muito grande. O limite e 3MB.' });
    }
    if (erro) {
      return res.status(400).json({ erro: erro.message || 'Nao foi possivel enviar a imagem.' });
    }
    next();
  });
}

// Upload de documento anexo ao cadastro de cliente (RG, comprovante,
// contrato social etc.) - aceita PDF ou imagem, limite maior que a foto
// de perfil porque scans/fotos de documento costumam pesar mais.
//
// IMPORTANTE: fica numa pasta SEPARADA da foto de perfil e NAO e servida
// como estatica/publica (diferente de /uploads). Documento de cliente e
// dado sensivel - so sai por uma rota autenticada (ver documentos.routes.js).
export const PASTA_DOCUMENTOS = path.resolve('documentos-privados');
if (!fs.existsSync(PASTA_DOCUMENTOS)) {
  fs.mkdirSync(PASTA_DOCUMENTOS, { recursive: true });
}

const TIPOS_DOCUMENTO_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const TAMANHO_MAXIMO_DOCUMENTO = 8 * 1024 * 1024; // 8MB por arquivo
const MAX_DOCUMENTOS = 15; // limite de imagens/arquivos por solicitação

const armazenamentoDocumentos = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PASTA_DOCUMENTOS),
  filename: (req, file, cb) => {
    const extensao = EXTENSAO_POR_TIPO[file.mimetype];
    // sufixo aleatorio alem do timestamp - varios arquivos do mesmo
    // envio podem cair no mesmo milissegundo e colidir sem isso
    const sufixo = Math.random().toString(36).slice(2, 8);
    cb(null, `documento-${req.corretorId}-${Date.now()}-${sufixo}${extensao}`);
  },
});

const uploadDocumentos = multer({
  storage: armazenamentoDocumentos,
  limits: { fileSize: TAMANHO_MAXIMO_DOCUMENTO },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_DOCUMENTO_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error('Formato invalido. Envie PDF, JPG, PNG ou WEBP.'));
    }
    cb(null, true);
  },
}).array('documentos', MAX_DOCUMENTOS);

export function uploadDocumentosMiddleware(req, res, next) {
  uploadDocumentos(req, res, (erro) => {
    if (erro instanceof multer.MulterError && erro.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ erro: 'Um dos arquivos é muito grande. O limite é 8MB por arquivo.' });
    }
    if (erro instanceof multer.MulterError && erro.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ erro: `Você pode enviar no máximo ${MAX_DOCUMENTOS} arquivos de uma vez.` });
    }
    if (erro) {
      return res.status(400).json({ erro: erro.message || 'Nao foi possivel enviar o arquivo.' });
    }
    next();
  });
}