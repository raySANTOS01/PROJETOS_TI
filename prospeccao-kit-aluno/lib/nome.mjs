// O nome do Maps é vitrine, não nome: "DENTISTA CENTRO - Dr. Paulo Mendes Clínica OSPE - centro
// especializado em implantes e ortodontia". A abordagem precisa de duas coisas curtas:
//   nome_empresa → "Clínica OSPE"          ("esse número é da Clínica OSPE?")
//   nome_pessoa  → "Dr. Paulo Mendes"      ("falo com o Dr. Paulo?")
// Regex não separa marca de serviço ("OdontoRede Centro" é marca + unidade), então é trabalho de IA:
// da IA da conversa, pelo comando `ia` (lib/ia.mjs). O `nome` original fica intacto na tabela, para conferir.

export const REGRA_NOMES = `Cada item traz o nome de uma empresa como aparece no Google Maps, cheio de serviço, cidade e slogan.
Preencha resposta.empresa e resposta.pessoa.

empresa: o nome pelo qual a empresa é chamada ao telefone.
- Tire serviços, especialidades, cidade, bairro, slogan, "24 horas", "Ltda", "ME", "EIRELI" e tudo depois de "|" ou " - " que for descrição.
- Mantenha a marca e a unidade quando a unidade faz parte do nome de uma rede ("OdontoRede Centro").
- O teste é soar natural ao telefone: "é da KBT Odontologia?", nunca "é da KBT?". Palavra do ramo colada na marca,
  sem separador, faz parte do nome e fica: "KBT Odontologia", "MV Energia Solar", "Voltek Energia Solar",
  "SOLX Soluções em Energia Solar" vira "SOLX Energia Solar". Só sai o que vem depois de separador ou é lista de serviço.
- Nunca deixe em CAIXA ALTA: "RAIO SOLAR" vira "Raio Solar", "MAXSERVI ENERGIA" vira "Maxservi Energia".
  Só sigla de até 4 letras fica em maiúscula ("OSPE", "ACL", "GKS").
- Se o nome é só de um profissional, a empresa é o próprio profissional ("Dra. Ana Tavares").
- Se o nome é só uma descrição, sem marca nenhuma, repita a descrição mais curta que ainda identifica.

pessoa: o profissional citado pelo nome, com o título abreviado e ponto ("Dr.", "Dra."). Sem ninguém citado, null.
Não invente nome que não está no texto.`;
