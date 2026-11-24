// Flui — regras financeiras (funções puras, sem tela)
// Mês sempre no formato "AAAA-MM". Valores em reais (números), somados em centavos.

export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const cents = (v) => Math.round((Number(v) || 0) * 100);
export const fromCents = (c) => c / 100;
export const sum = (arr, f = (x) => x) => fromCents(arr.reduce((a, x) => a + cents(f(x)), 0));

export function mesAtual(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function addMes(m, n) {
  const [y, mo] = m.split('-').map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
export function difMeses(a, b) { // b - a
  const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
  return (yb * 12 + mb) - (ya * 12 + ma);
}
export function nomeMes(m, longo = false) {
  const [y, mo] = m.split('-').map(Number);
  return longo ? `${MESES_LONGOS[mo - 1]} de ${y}` : `${MESES_CURTOS[mo - 1]}/${String(y).slice(2)}`;
}
export function rangeMeses(de, ate) {
  const out = []; let m = de;
  while (difMeses(m, ate) >= 0 && out.length < 240) { out.push(m); m = addMes(m, 1); }
  return out;
}

// ---------- período ----------
// p = {tipo:'mes'|'tri'|'sem'|'ano'|'custom', ano, mes(1-12), tri(1-4), sem(1-2), de, ate}
export function mesesDoPeriodo(p) {
  const y = p.ano;
  const mm = (n) => `${y}-${String(n).padStart(2, '0')}`;
  switch (p.tipo) {
    case 'tri': return rangeMeses(mm((p.tri - 1) * 3 + 1), mm(p.tri * 3));
    case 'sem': return rangeMeses(mm((p.sem - 1) * 6 + 1), mm(p.sem * 6));
    case 'ano': return rangeMeses(mm(1), mm(12));
    case 'custom': return rangeMeses(p.de <= p.ate ? p.de : p.ate, p.de <= p.ate ? p.ate : p.de);
    default: return [mm(p.mes)];
  }
}
export function nomePeriodo(p) {
  switch (p.tipo) {
    case 'tri': return `${p.tri}º trimestre de ${p.ano}`;
    case 'sem': return `${p.sem}º semestre de ${p.ano}`;
    case 'ano': return `Ano de ${p.ano}`;
    case 'custom': { const ms = mesesDoPeriodo(p); return `${nomeMes(ms[0])} a ${nomeMes(ms[ms.length - 1])}`; }
    default: return nomeMes(`${p.ano}-${String(p.mes).padStart(2, '0')}`, true);
  }
}

// ---------- cartão: parcelas com centavos exatos ----------
export function parcelasDaCompra(c) {
  const n = Math.max(1, parseInt(c.parcelas, 10) || 1);
  const total = cents(c.total);
  const base = Math.floor(total / n);
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = i === n - 1 ? total - base * (n - 1) : base;
    out.push({ mes: addMes(c.mesPrimeira, i), numero: i + 1, de: n, valor: fromCents(v) });
  }
  return out;
}

// ---------- recorrências ----------
export function recorrenciaNoMes(r, m) {
  if (r.ativa === false) return false;
  if (!r.inicio || difMeses(r.inicio, m) < 0) return false;
  if (r.fim && difMeses(m, r.fim) < 0) return false;
  const freq = r.frequencia || 'mensal';
  if (freq === 'anual') return difMeses(r.inicio, m) % 12 === 0;
  return true; // mensal
}

// ---------- movimentos de um mês ----------
// Junta lançamentos, parcelas do cartão e recorrências num formato único.
export function movimentosDoMes(st, m) {
  const cat = indexCategorias(st);
  const out = [];
  for (const l of st.lancamentos) {
    if (l.mes !== m) continue;
    out.push({ origem: 'lanc', id: l.id, tipo: l.tipo, categoriaId: l.categoriaId, valor: Number(l.valor) || 0,
      descricao: l.descricao || '', status: l.status || (l.tipo === 'entrada' ? 'recebido' : 'pago'),
      forma: l.forma || '', banco: l.banco || '', vencimento: l.vencimento || '', data: l.data || '', mes: m });
  }
  for (const c of st.compras) {
    for (const p of parcelasDaCompra(c)) {
      if (p.mes !== m) continue;
      const paga = !!(st.faturasPagas || {})[`${c.cartaoId || 'sem'}|${m}`];
      out.push({ origem: 'cartao', id: c.id, tipo: 'despesa', categoriaId: c.categoriaId, valor: p.valor,
        descricao: c.descricao + (p.de > 1 ? ` (${p.numero}/${p.de})` : ''), status: paga ? 'pago' : 'pendente',
        cartaoId: c.cartaoId || '', forma: 'Cartão de crédito', mes: m });
    }
  }
  // entradas recorrentes não contam se já houver entrada lançada da mesma categoria no mês (evita salário duplicado)
  const entradasLancadas = new Set(st.lancamentos.filter((l) => l.mes === m && l.tipo === 'entrada').map((l) => l.categoriaId));
  const vinculadas = new Set(st.lancamentos.filter((l) => l.mes === m && l.recorrenciaId).map((l) => l.recorrenciaId));
  for (const r of st.recorrencias) {
    if (!recorrenciaNoMes(r, m)) continue;
    if (vinculadas.has(r.id)) continue;
    if (r.tipo === 'entrada' && entradasLancadas.has(r.categoriaId)) continue;
    const paga = !!(r.pagos || {})[m];
    out.push({ origem: 'fixo', id: r.id, tipo: r.tipo || (cat[r.categoriaId]?.tipo) || 'despesa', categoriaId: r.categoriaId,
      valor: Number(r.valor) || 0, descricao: r.nome || cat[r.categoriaId]?.nome || 'Fixo',
      status: paga ? (r.tipo === 'entrada' ? 'recebido' : 'pago') : 'previsto', diaVenc: r.diaVenc || '',
      forma: r.forma || '', banco: r.banco || '', mes: m });
  }
  return out;
}

export function indexCategorias(st) {
  const o = {}; for (const c of st.categorias) o[c.id] = c; return o;
}

// ---------- resumo de um conjunto de meses ----------
export function resumo(st, meses) {
  const movs = meses.flatMap((m) => movimentosDoMes(st, m));
  const por = (t) => movs.filter((x) => x.tipo === t);
  const entradas = sum(por('entrada'), (x) => x.valor);
  const despesas = sum(por('despesa'), (x) => x.valor);
  const guardado = sum(por('guardar'), (x) => x.valor);
  const cartao = sum(movs.filter((x) => x.origem === 'cartao'), (x) => x.valor);
  const pendente = sum(movs.filter((x) => x.tipo !== 'entrada' && (x.status === 'pendente' || x.status === 'previsto')), (x) => x.valor);
  const saldo = fromCents(cents(entradas) - cents(despesas) - cents(guardado));
  return { movs, entradas, despesas, guardado, cartao, pendente, saldo };
}

// orçamento x realizado por categoria (despesas e guardar)
export function porCategoria(st, meses) {
  const { movs } = resumo(st, meses);
  const rows = [];
  for (const c of st.categorias) {
    if (c.arquivada || c.tipo === 'entrada') continue;
    const ms = movs.filter((x) => x.categoriaId === c.id && x.tipo !== 'entrada');
    const real = sum(ms, (x) => x.valor);
    const noCartao = sum(ms.filter((x) => x.origem === 'cartao'), (x) => x.valor);
    const orc = fromCents(cents(c.orcamento) * meses.length);
    rows.push({ cat: c, orcado: orc, real, noCartao, restante: fromCents(cents(orc) - cents(real)),
      pct: orc > 0 ? real / orc : null });
  }
  const semCat = movs.filter((x) => x.tipo !== 'entrada' && !st.categorias.find((c) => c.id === x.categoriaId));
  if (semCat.length) {
    rows.push({ cat: { id: '', nome: 'Sem categoria', tipo: 'despesa', cor: '#AFB8C4' }, orcado: 0,
      real: sum(semCat, (x) => x.valor), noCartao: sum(semCat.filter((x) => x.origem === 'cartao'), (x) => x.valor), restante: 0, pct: null });
  }
  return rows;
}

// fatura de um cartão num mês
export function fatura(st, cartaoId, m) {
  const itens = [];
  for (const c of st.compras) {
    if ((c.cartaoId || '') !== (cartaoId || '')) continue;
    for (const p of parcelasDaCompra(c)) if (p.mes === m) itens.push({ compra: c, parcela: p });
  }
  return { itens, total: sum(itens, (x) => x.parcela.valor), paga: !!(st.faturasPagas || {})[`${cartaoId || 'sem'}|${m}`] };
}

// próximos vencimentos (fixos com dia, lançamentos pendentes com data, faturas com dia)
export function proximosVencimentos(st, hoje = new Date(), dias = 10) {
  const out = [];
  const lim = new Date(hoje); lim.setDate(lim.getDate() + dias);
  const d0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const ms = [mesAtual(hoje), addMes(mesAtual(hoje), 1)];
  const dataDe = (m, dia) => { const [y, mo] = m.split('-').map(Number); const ult = new Date(y, mo, 0).getDate(); return new Date(y, mo - 1, Math.min(dia, ult)); };
  for (const m of ms) {
    for (const r of st.recorrencias) {
      if (!r.diaVenc || !recorrenciaNoMes(r, m) || (r.pagos || {})[m] || r.tipo === 'entrada') continue;
      const d = dataDe(m, r.diaVenc);
      if (d >= d0 && d <= lim) out.push({ tipo: 'fixo', nome: r.nome, valor: r.valor, data: d, ref: r.id, mes: m });
    }
    for (const c of st.cartoes) {
      if (!c.vencimento) continue;
      const f = fatura(st, c.id, m);
      if (f.paga || f.total <= 0) continue;
      const d = dataDe(m, c.vencimento);
      if (d >= d0 && d <= lim) out.push({ tipo: 'fatura', nome: `Fatura ${c.nome}`, valor: f.total, data: d, ref: c.id, mes: m });
    }
  }
  for (const l of st.lancamentos) {
    if (!l.vencimento || l.status !== 'pendente') continue;
    const [y, mo, da] = l.vencimento.split('-').map(Number); const d = new Date(y, mo - 1, da);
    if (d >= d0 && d <= lim) out.push({ tipo: 'conta', nome: l.descricao || 'Conta', valor: l.valor, data: d, ref: l.id });
  }
  return out.sort((a, b) => a.data - b.data);
}

// metas: valor atual = valor inicial + o que foi guardado na categoria vinculada
export function progressoMeta(st, meta) {
  const guardado = meta.categoriaId
    ? sum(st.lancamentos.filter((l) => l.categoriaId === meta.categoriaId && l.tipo === 'guardar' && (!meta.desde || difMeses(meta.desde, l.mes) >= 0)), (l) => l.valor)
    : 0;
  const atual = fromCents(cents(meta.valorInicial) + cents(guardado));
  const alvo = Number(meta.alvo) || 0;
  return { atual, alvo, pct: alvo > 0 ? Math.min(1, atual / alvo) : 0, falta: Math.max(0, fromCents(cents(alvo) - cents(atual))) };
}

// dias seguidos com algum lançamento (incentivo estilo "sequência")
export function sequenciaRegistro(st, hoje = new Date()) {
  const dias = new Set(st.lancamentos.map((l) => (l.criadoEm || '').slice(0, 10)).filter(Boolean));
  let n = 0; const d = new Date(hoje);
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!dias.has(iso(d))) d.setDate(d.getDate() - 1);
  while (dias.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
