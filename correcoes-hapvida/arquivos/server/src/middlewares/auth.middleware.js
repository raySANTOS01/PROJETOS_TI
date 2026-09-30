// Middleware simples de autenticacao: valida o token JWT enviado no
// header Authorization (emitido em /api/auth/login) e injeta o id do
// corretor logado em req.corretorId. Usado tanto pelas rotas de vendas
// quanto pelo dashboard da TV - so entra com email e senha de corretor.
import jwt from 'jsonwebtoken';
import { prisma } from '../prismaClient.js';

export async function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Acesso restrito. Faca login com seu email e senha.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Confere no banco (nao so no token, que vale ate 30 dias): conta
    // desativada, rejeitada ou removida perde o acesso na hora.
    const corretor = await prisma.corretor.findUnique({
      where: { id: payload.corretorId },
      select: { id: true, ativo: true, status: true },
    });
    if (!corretor || !corretor.ativo || corretor.status !== 'APROVADO') {
      return res.status(401).json({ erro: 'Sessao expirada ou invalida. Faca login novamente.' });
    }
    req.corretorId = corretor.id;
    next();
  } catch (erro) {
    return res.status(401).json({ erro: 'Sessao expirada ou invalida. Faca login novamente.' });
  }
}

// Middleware usado nas rotas de administracao (/api/admin/*). Roda
// DEPOIS de "autenticar" e confere no banco (nao so no token) se o
// corretor logado tem papel ADMIN e continua aprovado/ativo - assim,
// se um admin for rebaixado, o acesso cai na hora, mesmo com um token
// antigo ainda valido.
export async function exigirAdmin(req, res, next) {
  try {
    const corretor = await prisma.corretor.findUnique({ where: { id: req.corretorId } });
    if (!corretor || corretor.papel !== 'ADMIN' || corretor.status !== 'APROVADO' || !corretor.ativo) {
      return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
    }
    next();
  } catch (erro) {
    console.error('Erro ao validar permissao de administrador:', erro);
    return res.status(500).json({ erro: 'Nao foi possivel validar sua permissao.' });
  }
}

// Middleware extra pra rotas de dado mais sensivel, restritas a um
// subconjunto dos admins (ex: só sócios veem confirmação de pagamentos).
// Roda DEPOIS de exigirAdmin. paginasPermitidas === null (padrao) = admin
// sem restrição extra configurada, ve tudo; só bloqueia quando existe uma
// lista definida e ela não inclui essa página.
export function exigirPagina(chave) {
  return async function (req, res, next) {
    try {
      const corretor = await prisma.corretor.findUnique({ where: { id: req.corretorId } });
      if (!corretor) {
        return res.status(403).json({ erro: 'Acesso restrito.' });
      }
      if (Array.isArray(corretor.paginasPermitidas) && !corretor.paginasPermitidas.includes(chave)) {
        return res.status(403).json({ erro: 'Você não tem acesso a esta página.' });
      }
      next();
    } catch (erro) {
      console.error('Erro ao validar permissao de pagina:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel validar sua permissao.' });
    }
  };
}