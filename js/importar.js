// Leitura de extratos bancários (OFX e CSV) e sugestão de categoria. Funções puras.

const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const titulo = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

// ---------- OFX ----------
export function lerOFX(txt) {
  const tag = (bloco, t) => { const m = bloco.match(new RegExp(`<${t}>([^<\\r\\n]*)`, 'i')); return m ? m[1].trim() : ''; };
  const banco = tag(txt, 'ORG') || '';
  const fid = tag(txt, 'FID') || tag(txt, 'BANKID') || '';
  const itens = [];
  for (const m of txt.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)) {
    const b = m[1]; const d = tag(b, 'DTPOSTED');
    const valor = parseFloat(tag(b, 'TRNAMT').replace(',', '.'));
    if (!d || !Number.isFinite(valor)) continue;
    itens.push({ data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, valor, id: tag(b, 'FITID'), texto: tag(b, 'MEMO') || tag(b, 'NAME') });
  }
  return { formato: 'OFX', banco: nomeBanco(banco, fid), cartao: /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(txt), itens };
}

// ---------- CSV (Nubank: Data,Valor,Identificador,Descrição; aceita ; e vírgula decimal) ----------
function colunasCSV(l, sep) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < l.length; i++) { const ch = l[i];
    if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map((c) => c.trim());
}
export function lerCSV(txt) {
  const linhas = txt.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return { formato: 'CSV', banco: '', itens: [] };
  const sep = (linhas[0].match(/;/g) || []).length > (linhas[0].match(/,/g) || []).length ? ';' : ',';
  const cab = colunasCSV(linhas[0], sep).map((c) => semAcento(c));
  const iData = cab.findIndex((c) => c.startsWith('DATA') || c === 'DATE');
  const iValor = cab.findIndex((c) => c.startsWith('VALOR') || c === 'AMOUNT');
  const iId = cab.findIndex((c) => c.startsWith('IDENTIFICADOR') || c === 'ID');
  const iDesc = cab.findIndex((c) => c.startsWith('DESCRI') || c.startsWith('TITLE') || c.startsWith('HISTORICO') || c.startsWith('LANCAMENTO') || c.startsWith('ESTABELECIMENTO'));
  // fatura de cartão (Nubank: date,title,amount): compra vem positiva, pagamento negativo
  const cartao = cab.includes('TITLE') && cab.includes('AMOUNT');
  if (iData < 0 || iValor < 0) throw new Error('Não reconheci as colunas desse CSV. Tente o arquivo OFX do seu banco: ele funciona com quase todos.');
  const itens = [];
  for (const l of linhas.slice(1)) {
    // a descrição é a última coluna e pode ter o separador dentro: junta o que sobrar
    let cols = colunasCSV(l, sep);
    if (iDesc === cab.length - 1 && cols.length > cab.length) cols = [...cols.slice(0, cab.length - 1), cols.slice(cab.length - 1).join(sep)];
    const [dd, mm, aa] = (cols[iData] || '').split(/[/-]/);
    let v = (cols[iValor] || '').replace(/[R$\s]/g, '');
    v = /,\d{1,2}$/.test(v) || (sep === ';' && v.includes(',')) ? v.replace(/\./g, '').replace(',', '.') : v;
    const valor = parseFloat(v);
    if (!aa || !Number.isFinite(valor)) continue;
    const data = dd.length === 4 ? `${dd}-${mm}-${aa}` : `${aa.length === 2 ? '20' + aa : aa}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    const texto = iDesc >= 0 ? cols[iDesc] : '';
    itens.push({ data, valor: cartao ? -valor : valor, id: iId >= 0 ? cols[iId] : (cartao ? `cc-${data}-${valor}-${texto}` : ''), texto });
  }
  return { formato: 'CSV', banco: cab.includes('IDENTIFICADOR') || (cartao && cab.join(',') === 'DATE,TITLE,AMOUNT') ? 'Nubank' : '', cartao, itens };
}

function nomeBanco(org, fid) {
  const o = semAcento(org);
  if (o.includes('NU PAGAMENTOS') || fid === '260' || fid === '0260') return 'Nubank';
  const porCodigo = { '341': 'Itaú', '237': 'Bradesco', '033': 'Santander', '077': 'Inter', '104': 'Caixa', '001': 'Banco do Brasil', '380': 'PicPay', '336': 'C6 Bank', '323': 'Mercado Pago' }; const cod = String(fid || '').replace(/^0+(?=\d{3})/, '').padStart(3, '0'); if (porCodigo[cod]) return porCodigo[cod];
  if (o.includes('ITAU')) return 'Itaú'; if (o.includes('BRADESCO')) return 'Bradesco'; if (o.includes('SANTANDER')) return 'Santander';
  if (o.includes('PICPAY')) return 'PicPay'; if (o.includes('MERCADO PAGO') || o.includes('MERCADOPAGO')) return 'Mercado Pago'; if (o.includes('C6')) return 'C6 Bank';
  if (o.includes('INTER')) return 'Inter'; if (o.includes('CAIXA')) return 'Caixa'; if (o.includes('BANCO DO BRASIL')) return 'Banco do Brasil';
  return org ? titulo(org) : '';
}

// ---------- entender cada linha ----------
// devolve { tipo, descricao, forma, sugestao (nome de categoria), marcar, aviso }
export function entender(it) {
  const t = it.texto || ''; const T = semAcento(t); const entrada = it.valor > 0;
  const partes = t.split(' - ').map((x) => x.trim());
  let forma = ''; let descricao = titulo(t);
  if (T.startsWith('COMPRA NO DEBITO')) { forma = 'Débito'; descricao = titulo(partes.slice(1).join(' - ')); }
  else if (T.includes('PIX')) { forma = 'Débito'; descricao = (entrada ? 'Pix de ' : 'Pix para ') + titulo(partes[1] || ''); }
  else if (T.startsWith('TRANSFERENCIA')) { forma = 'Transferência'; descricao = (entrada ? 'Transferência de ' : 'Transferência para ') + titulo(partes[1] || ''); }
  else if (T.startsWith('PAGAMENTO DE BOLETO')) { forma = 'Boleto'; descricao = 'Boleto ' + titulo(partes.slice(1).join(' - ')); }
  descricao = descricao.replace(/^Ifd\*/i, 'iFood · ').replace(/\s+/g, ' ').trim();
  // casos especiais
  if (T.startsWith('PAGAMENTO DE FATURA')) return { tipo: 'despesa', descricao: 'Pagamento de fatura', forma: 'Débito', sugestao: '', marcar: false, aviso: 'Pagamento de fatura não é gasto novo: as compras do cartão já contam no Flui.' };
  if (/^APLICACAO (RDB|CDB)|CAIXINHA|GUARDADO/.test(T) && !entrada) return { tipo: 'guardar', descricao: 'Guardado no Nubank', forma: 'Transferência', sugestao: 'Investimentos', marcar: true };
  if (/^RESGATE/.test(T)) return { tipo: 'entrada', descricao: 'Resgate de investimento', forma: 'Transferência', sugestao: 'Rendimento', marcar: false, aviso: 'Resgate do seu próprio dinheiro guardado. Desmarcado para não contar como renda.' };
  // só o nome do lugar decide a categoria; Pix para pessoa física (CPF mascarado) fica em Outros
  const temPrefixo = /^(COMPRA NO DEBITO|TRANSFERENCIA|PAGAMENTO DE BOLETO)/.test(T);
  const lugar = semAcento(temPrefixo && partes.length > 1 ? partes[1] : t.replace(/ - Parcela \d+\/\d+$/i, '')); const pessoa = /•••/.test(t);
  return { tipo: entrada ? 'entrada' : 'despesa', descricao, forma, sugestao: entrada ? 'Entrada extra' : pessoa ? 'Outros' : sugerirCategoria(lugar), marcar: true };
}

const REGRAS = [
  ['Assinaturas', /NETFLIX|SPOTIFY|DEEZER|TIDAL|DISNEY|HBO ?MAX|HBOMAX|\bHBO\b|\bMAX\.COM|PRIME ?VIDEO|AMAZON ?PRIME|AMAZONPRIME|KINDLE UNL|AUDIBLE|APPLE\.COM|APPLE COM BILL|ITUNES|ICLOUD|GOOGLE ?ONE|GOOGLE \*?(YOUTUBE|STORAGE|PLAY)|YOUTUBE ?PREM|YOUTUBEPREM|UBER\W*ONE|GLOBOPLAY|GLOBO ?PLAY|PARAMOUNT|STAR ?PLUS|CRUNCHYROLL|MUBI|TELECINE|PREMIERE|DAZN|CANVA|ADOBE|NOTION|DROPBOX|CHATGPT|OPENAI|ANTHROPIC|CLAUDE\.AI|DUOLINGO|LIVECAREER|LINKEDIN|TINDER|BUMBLE|MICROSOFT ?365|MSFT|XBOX ?GAME ?PASS|PLAYSTATION ?(PLUS|NETWORK)|PSN|NINTENDO ONLINE|CLUBE ?IFOOD|IFOOD ?CLUB|RAPPI ?PRIME|MELI ?\+|MELIMAIS|NUBANK\+|NU ?MAIS|SKY ?\+|CLARO ?TV|VIVO ?PLAY|CONTA ?AZUL|TINDER|GRINDR/],
  ['Transporte', /\bUBER\b|\b99 ?(APP|POP|TAXI|RIDE|MOTO)|CABIFY|INDRIVE|METRO ?RIO|\bMETRO\b|SUPERVIA|\bBRT\b|RIOCARD|\bJAE\b|BILHETE UNICO|SPTRANS|PEDAGIO|SEM PARAR|VELOE|CONECTCAR|TAXI|BLABLA|ONIBUS|RODOVIARIA|BUSER|CLICKBUS|LATAM|GOL LINHAS|AZUL LINHAS|AZUL SEGUROS|CCR ?BARCAS|BARCAS|VLT|TRANSPORTE/],
  ['Comida fora', /IFD\*|IFOOD|99 ?FOOD|RAPPI|AIQFOME|ZE DELIVERY|LANCHE|LANCHONETE|ACAI|BURGER|BURGUER|\bBK\b|PIZZ|RESTAUR|CAFE|CAFETERIA|MACARRAO|BISCOIT|PADARIA|PANIFICADORA|PADOCA|CONFEITARIA|DOCERIA|SUSHI|TEMAKI|JAPONES|BAR |BAR$|BOTECO|BOTEQUIM|CHOPP|CERVEJ|SORVET|GELATO|CHIQUINHO|MC ?DONALD|MCDONALD|BOB.?S|SUBWAY|OUTBACK|MADERO|COCO BAMBU|GIRAFFAS|CHINA IN BOX|SPOLETO|HABIB|DOMINO|PIZZA HUT|KFC|POPEYES|STARBUCKS|JERONIMO|CACAU SHOW|KOPENHAGEN|CHURRAS|GRILL|STEAK|BISTRO|CANTINA|COMIDA|DELIVERY|TAPIOCA|CREPE|COXINHA|ESFIH|SALGAD|EMPADA|PASTEL|FOOD|BUFFET|GASTRONOMIA|ESPETINHO|HAMBURG/],
  ['Mercado', /ZONA SUL|MULTI ?FRUTI|HORTIFRUTI|HORTI|HIPER|SUPERMERC|SUPERMARKET|MERCADO(?! ?PAGO| ?LIVRE|\*MERCADOLIVRE)|MERCEARIA|CARREFOUR|PAO DE ACUCAR|GUANABARA|MUNDIAL|PREZUNIC|ASSAI|ATACAD|DEPOSITO|SENDAS|EXTRA |DIA BRASIL|\bDIA\b|SAMS CLUB|MAKRO|ST MARCHE|OBA |NATURAL DA TERRA|ZAFFARI|CONDOR|ANGELONI|SAVEGNAGO|MAMBO|HIROTA|NACIONAL|BIG |WALMART|SACOLAO|QUITANDA|FEIRA|EMPORIO|ACOUGUE|PEIXARIA|AMERICANAS|GRUPO MATEUS|BRASIL ATACAD|COSTCO|ADEGA|BEBIDAS/],
  ['Farmácia', /DROGA|FARMA|RAIA|PAGUE MENOS|VENANCIO|PACHECO|PANVEL|NISSEI|ARAUJO|ULTRAFARMA|DROGASIL|FARMACIA|MANIPULACAO/],
  ['Saúde', /CLINICA|HOSPITAL|LABORAT|DENTIST|ODONTO|CONSULTORIO|MEDIC|UNIMED|AMIL|SULAMERICA|BRADESCO SAUDE|HAPVIDA|NOTREDAME|DASA|FLEURY|SABIN|LAVOISIER|SERGIO FRANCO|BRONSTEIN|PSICOLOG|FISIOTERAP|NUTRICION|OTICA|ÓTICA|EXAME/],
  ['Combustível', /POSTO|SHELL|IPIRANGA|PETROBRAS|\bBR MANIA|\bALE COMB|COMBUST|AUTO POSTO|\bGNV\b|RAIZEN/],
  ['Estacionamento', /ESTACION|ESTAPAR|PARKING|\bPARK\b|MULTIPARK|INDIGO|ZONA AZUL|PARE BEM|ROTATIVO|VALET/],
  ['Academia', /SMART ?FIT|ACADEMIA|BODYTECH|SELFIT|BLUEFIT|BIO ?RITMO|GYMPASS|WELLHUB|TOTALPASS|CROSSFIT|PILATES|\bGYM\b|FITNESS|NATACAO|YOGA/],
  ['Dízimo', /IGREJA|ASSEMBLEIA|BATISTA|PAROQUIA|MITRA|MINISTERIO|COMUNIDADE EVANG|EVANGEL|CATEDRAL|SANTUARIO/],
  ['Ofertas e doações', /VAKINHA|DOACAO|DOAÇÃO|\bONG\b|CRUZ VERMELHA|UNICEF|MEDICOS SEM FRONTEIRAS|TETO|GRAACC|INSTITUTO/],
  ['Educação', /IBMEC|ESCOLA|COLEGIO|FACULDADE|UNIVERSIDADE|UNIVERS|CURSO|UDEMY|ALURA|COURSERA|DESCOMPLICA|ESTACIO|PUC|FGV|LIVRARIA|SARAIVA|LEITURA|AMAZON ?KINDLE|EDUCACIONAL|MATRICULA|MENSALIDADE/],
  ['Entretenimento', /CINEMA|CINEMARK|KINOPLEX|\bUCI\b|CINESYSTEM|CINEPOLIS|INGRESSO|SYMPLA|EVENTIM|TICKETMASTER|TICKET ?360|TEATRO|SHOW|STEAM|PLAYSTATION|XBOX|NINTENDO|EPIC GAMES|RIOT|BLIZZARD|BOLICHE|PARQUE|MUSEU|BOATE|BALADA|KARAOKE|ESCAPE/],
  ['Beleza', /SALAO|SALÃO|CABELEIR|BARBEARIA|BARBER|MANICURE|ESMALTERIA|ESTETICA|DEPILA|SOBRANCELHA|BOTICARIO|NATURA|SEPHORA|AVON|EUDORA|QUEM DISSE BERENICE|O BOTICARIO|PERFUMARIA|COSMETIC/],
  ['Roupa', /RENNER|RIACHUELO|C&A|\bCEA\b|ZARA|SHEIN|HERING|CENTAURO|NETSHOES|NIKE|ADIDAS|MARISA|FARM RIO|\bFARM\b|ANIMALE|AREZZO|SCHUTZ|PERNAMBUCANAS|YOUCOM|LEVIS|OSKLEN|REDLEY|RESERVA|HAVAIANAS|CALCADOS|CALÇADOS|MODA|BOUTIQUE|DAFITI|ZATTINI|CROCS|VANS|PUMA/],
  ['Compras online', /MERCADOLIVRE|MERCADO LIVRE|MAGALU|MAGAZINE LUIZA|AMAZON(?! ?PRIME| ?KINDLE)|AMZN|SHOPEE|ALIEXPRESS|TIKTOK ?SH|TEMU|SHEIN|CASAS BAHIA|PONTO FRIO|SUBMARINO|KABUM|AMERICANAS\.COM|EBN\*/],
  ['Pet', /PETZ|COBASI|PET ?SHOP|PETLOVE|VETERIN|\bPET\b|RACAO|RAÇÃO|AGROPECUARIA/],
  ['Viagem', /HOTEL|POUSADA|HOSTEL|AIRBNB|BOOKING|DECOLAR|123 ?MILHAS|HURB|CVC|MAXMILHAS|SMILES|TRIVAGO|EXPEDIA|RESORT/],
  ['Contas de casa', /LIGHT|ENEL|CEDAE|NATURGY|CEG |COMGAS|SABESP|COPASA|CEMIG|CPFL|CLARO|VIVO|TIM |OI FIBRA|\bOI\b|NET SERV|SKY |CONDOMIN|ALUGUEL|IMOBILI|EMP IMO|\bIMOVE|QUINTO ?ANDAR|IPTU|GAS |ULTRAGAZ|LIQUIGAS|SUPERGASBRAS|INTERNET|TELECOM/],
];
export function sugerirCategoria(T) {
  T = T.replace(/^(MP|PG|PAG|EC|EBN|PAYPAL|PICPAY|SUMUP|STONE|CIELO|PAGSEGURO|ZP|SP|LV)\s?\*\s?/, '');
  if (/\bUBER\b(?!\W*ONE)|\b99 ?(APP|POP|TAXI)|CABIFY/.test(T)) return 'Transporte';
  for (const [cat, re] of REGRAS) if (re.test(T)) return cat;
  return 'Outros';
}
// chave para lembrar escolhas: o "lugar" sem números e sem detalhes de conta
export function chaveRegra(texto) {
  const p = (texto || '').split(' - ');
  const base = semAcento(p[0].startsWith('Compra') || p[0].startsWith('Transfer') || p[0].startsWith('Pagamento de boleto') ? (p[1] || p[0]) : p[0]);
  return base.replace(/[0-9•.*/-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}
