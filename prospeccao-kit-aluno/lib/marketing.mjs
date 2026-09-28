// O lead bom é o do meio: já entende de digital (tem site), mas o marketing está fraco.
// Quem já roda anúncio provavelmente tem alguém cuidando; quem não tem nada ainda não sabe que precisa.
// Tudo aqui sai do HTML da página inicial, por regex — não custa nada e não chama IA.

const ANO_ATUAL = new Date().getFullYear();

/** Lê a página inicial e devolve o que ela entrega sobre o marketing da empresa. */
export function sinaisMarketing(html) {
  const pixel_meta = /fbq\(|connect\.facebook\.net/i.test(html);
  // Só tag de ANÚNCIO conta. Google Analytics e o gtag solto vêm de fábrica em Wix, WordPress e
  // afins — contar isso marcou 37 de 46 clínicas como "já anuncia" no primeiro teste (14/set/2026).
  const pixel_google = /["'`]AW-\d{6,}|googleadservices\.com|googleads\.g\.doubleclick\.net/i.test(html);
  const analytics = /gtag\(|googletagmanager\.com|google-analytics\.com/i.test(html);
  const mobile = /<meta[^>]+name=["']?viewport\b/i.test(html);
  const botao_whatsapp = /wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com/i.test(html);

  // o maior ano colado no © é o do rodapé; ano calculado por JavaScript não aparece e fica nulo
  const anos = [...html.matchAll(/(?:©|&copy;|copyright)[^<]{0,40}?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)]
    .flatMap((m) => [m[1], m[2]]).filter(Boolean).map(Number).filter((a) => a <= ANO_ATUAL);
  const ano_copyright = anos.length ? Math.max(...anos) : null;
  const desatualizado = !mobile || (ano_copyright !== null && ano_copyright <= ANO_ATUAL - 2);

  return { pixel_meta, pixel_google, analytics, mobile, botao_whatsapp, ano_copyright, desatualizado };
}

/**
 * alta  — não anuncia e o site tem problema visível (desatualizado ou sem WhatsApp)
 * media — não anuncia, mas o site está em ordem
 * baixa — já tem pixel de anúncio (Meta ou conversão do Google Ads): alguém já cuida do marketing
 * Só vale para quem tem site vivo; quem não tem site é outra venda (a do site).
 */
export function oportunidade(m) {
  if (!m) return null;
  if (m.pixel_meta || m.pixel_google) return 'baixa';
  return m.desatualizado || !m.botao_whatsapp ? 'alta' : 'media';
}

/** Qual venda cabe no lead, e por quê — a leitura do site em uma frase. */
export function justificarOportunidade(situacao_site, m) {
  if (situacao_site === 'sem_site') return 'Sem site: não divulga site no Google. A venda é o site.';
  if (situacao_site === 'site_morto') return 'Site fora do ar: divulga um site no Google que não abre. A venda é refazer o site.';
  if (!m) return null;
  const nivel = oportunidade(m);
  const problemas = [];
  if (!m.mobile) problemas.push('sem versão para celular');
  if (m.ano_copyright && m.ano_copyright <= ANO_ATUAL - 2) problemas.push(`rodapé parado em ${m.ano_copyright}`);
  if (!m.botao_whatsapp) problemas.push('sem botão de WhatsApp');
  if (nivel === 'baixa') {
    const quem = [m.pixel_meta && 'Meta', m.pixel_google && 'Google Ads'].filter(Boolean).join(' e ');
    return `Oportunidade baixa: já tem pixel de anúncio (${quem}), então alguém já cuida do marketing.` +
      (problemas.length ? ` Mesmo assim o site tem: ${problemas.join(', ')}.` : '');
  }
  if (nivel === 'alta') return `Oportunidade alta: não anuncia (sem pixel) e o site tem problema — ${problemas.join(', ')}. Cabe tráfego e ajuste do site.`;
  return 'Oportunidade média: não anuncia (sem pixel), mas o site está em ordem. Cabe tráfego.';
}

export function explicar(m) {
  if (!m) return null;
  const partes = [];
  partes.push(m.pixel_meta || m.pixel_google
    ? `tem pixel (${[m.pixel_meta && 'Meta', m.pixel_google && 'Google'].filter(Boolean).join(' e ')})`
    : 'sem pixel de anúncio');
  if (!m.mobile) partes.push('sem versão para celular');
  if (m.ano_copyright && m.ano_copyright <= ANO_ATUAL - 2) partes.push(`copyright ${m.ano_copyright}`);
  partes.push(m.botao_whatsapp ? 'com botão de WhatsApp' : 'sem botão de WhatsApp');
  return partes.join(', ');
}
