// Flui — telas e interação
import * as C from './calc.js';
import { Store, uid, FORMAS, validarBackup } from './store.js';
import { brl, brl0, pct, esc, parseValor, valorInput, ICON, MASCOTE, rosca, barras, toast } from './ui.js';

const store = new Store();
const $ = (s, el = document) => el.querySelector(s);
const hoje = new Date();
const ui = {
  rota: (location.hash || '#inicio').slice(1),
  periodo: { tipo: 'mes', ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, tri: Math.floor(hoje.getMonth() / 3) + 1, sem: hoje.getMonth() < 6 ? 1 : 2, de: C.addMes(C.mesAtual(), -2), ate: C.mesAtual() },
  filtroTipo: 'todos', busca: '', filtroCat: '', authModo: 'entrar', authErro: '', carregando: true, modal: null, installEvt: null,
};
try { const p = JSON.parse(sessionStorage.getItem('flui:periodo')); if (p) Object.assign(ui.periodo, p); } catch {}

const st = () => store.st;
const cat = (id) => st().categorias.find((c) => c.id === id);
const catNome = (id) => cat(id)?.nome || 'Sem categoria';
const catCor = (id) => cat(id)?.cor || '#AFB8C4';
const meses = () => C.mesesDoPeriodo(ui.periodo);
const mesRef = () => meses()[meses().length - 1];

// ======================= RENDER =======================
const NAV = [
  ['inicio', 'Início', ICON.inicio], ['lancamentos', 'Lançamentos', ICON.lanc], ['cartoes', 'Cartões', ICON.cartao],
  ['plano', 'Planejamento', ICON.plano], ['relatorios', 'Relatórios', ICON.relat], ['metas', 'Metas', ICON.metas],
  ['categorias', 'Categorias', ICON.cats], ['config', 'Configurações', ICON.config]];
const NAV_MOVEL = [['inicio', 'Início', ICON.inicio], ['lancamentos', 'Lançar', ICON.lanc], ['cartoes', 'Cartões', ICON.cartao], ['plano', 'Plano', ICON.plano], ['mais', 'Mais', ICON.mais]];

function render() {
  const root = $('#app');
  if (ui.carregando) { root.innerHTML = `<div class="entrada"><div class="entrada-box">${marca()}<p class="slogan">Carregando...</p></div></div>`; return; }
  if (!store.user) { root.innerHTML = telaEntrada(); return; }
  if (!st()) { root.innerHTML = `<div class="entrada"><div class="entrada-box">${marca()}<p class="slogan">Buscando seus dados...</p></div></div>`; return; }
  const rota = NAV.some((n) => n[0] === ui.rota) || ui.rota === 'mais' ? ui.rota : 'inicio';
  const tela = { inicio: telaInicio, lancamentos: telaLancamentos, cartoes: telaCartoes, plano: telaPlano, relatorios: telaRelatorios, metas: telaMetas, categorias: telaCategorias, config: telaConfig, mais: telaMais }[rota];
  root.innerHTML = `<div class="app">
    <aside class="lateral">${marca()}${NAV.map(([r, n, i]) => `<a class="nav-item ${r === rota ? 'ativo' : ''}" href="#${r}">${i}<span>${n}</span></a>`).join('')}
      <div style="margin-top:auto" class="mini">${store.modo === 'local' ? 'Modo de teste: dados só neste navegador' : esc(store.user.email)}</div></aside>
    <main class="principal"><div class="topo-movel">${marca(true)}<span class="sequencia">${seqHtml()}</span></div>${tela()}</main>
    <nav class="barra-inferior">${NAV_MOVEL.map(([r, n, i]) => `<a class="nav-item ${r === rota || (r === 'mais' && ['relatorios', 'metas', 'categorias', 'config'].includes(rota)) ? 'ativo' : ''}" href="#${r}">${i}<span>${n}</span></a>`).join('')}</nav>
    <button class="btn verde fab" data-a="novo-lanc" aria-label="Novo lançamento">+</button>
  </div>${ui.modal ? ui.modal.html : ''}`;
  if (ui.modal?.depois) ui.modal.depois();
}
const marca = (peq) => `<div class="marca"${peq ? ' style="padding:0"' : ''}><div class="marca-icone"${peq ? ' style="width:34px;height:34px;font-size:19px;border-radius:10px"' : ''}>F</div><div class="marca-nome"${peq ? ' style="font-size:24px"' : ''}>Flui</div></div>`;
function seqHtml() { const n = C.sequenciaRegistro(st()); return n > 1 ? `🔥 ${n} dias` : ''; }

// ---------------- entrada / login ----------------
function telaEntrada() {
  const criar = ui.authModo === 'criar';
  return `<div class="entrada"><form class="entrada-box" data-form="auth">
    ${marca()}<p class="slogan">Seu dinheiro, no seu ritmo.</p>
    ${store.modo === 'local' ? '<div class="selo">MODO DE TESTE · dados só neste navegador</div>' : ''}
    <div class="campo"><label>E-mail</label><input class="inp" name="email" type="email" autocomplete="email" required></div>
    ${store.modo === 'local' ? '' : `<div class="campo"><label>Senha</label><input class="inp" name="senha" type="password" autocomplete="${criar ? 'new-password' : 'current-password'}" minlength="6" required></div>`}
    ${ui.authErro ? `<div class="erro">${esc(ui.authErro)}</div>` : ''}
    <button class="btn cheio ${criar ? 'verde' : ''}" type="submit">${criar ? 'Criar minha conta' : 'Entrar'}</button>
    <div class="troca">${criar ? 'Já tem conta?' : 'Ainda não tem conta?'} <button type="button" data-a="auth-troca">${criar ? 'Entrar' : 'Criar conta'}</button></div>
    ${!criar && store.modo !== 'local' ? '<div class="troca"><button type="button" data-a="auth-senha">Esqueci minha senha</button></div>' : ''}
  </form></div>`;
}
const ERROS_AUTH = { 'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/wrong-password': 'Senha incorreta.', 'auth/user-not-found': 'Não achei uma conta com esse e-mail.', 'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Tente entrar.', 'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.', 'auth/invalid-email': 'Esse e-mail não parece válido.', 'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.', 'auth/network-request-failed': 'Sem internet no momento. Confira a conexão.' };

// ---------------- filtro de período ----------------
function filtroPeriodo() {
  const p = ui.periodo;
  const tipos = [['mes', 'Mês'], ['tri', 'Trimestre'], ['sem', 'Semestre'], ['ano', 'Ano'], ['custom', 'Personalizado']];
  return `<div class="periodo">
    ${p.tipo !== 'custom' ? `<button class="seta" data-a="per-ant" aria-label="Anterior">‹</button><div class="rotulo">${esc(cap(C.nomePeriodo(p)))}</div><button class="seta" data-a="per-prox" aria-label="Próximo">›</button>` :
      `<div class="chips">${mesSelect('per-de', p.de)} <span class="mini">até</span> ${mesSelect('per-ate', p.ate)}</div>`}
    <div class="chips">${tipos.map(([t, n]) => `<button class="chip ${p.tipo === t ? 'ativo' : ''}" data-a="per-tipo" data-v="${t}">${n}</button>`).join('')}</div>
  </div>`;
}
function mesSelect(nome, valor) {
  const [y, m] = (valor || C.mesAtual()).split('-').map(Number);
  const anos = []; for (let a = hoje.getFullYear() - 3; a <= hoje.getFullYear() + 4; a++) anos.push(a);
  return `<span style="display:inline-flex;gap:6px" data-mes="${nome}">
    <select class="inp" style="padding:8px 10px;width:auto" data-mes-m="${nome}">${C.MESES_CURTOS.map((n, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <select class="inp" style="padding:8px 10px;width:auto" data-mes-y="${nome}">${anos.map((a) => `<option ${a === y ? 'selected' : ''}>${a}</option>`).join('')}</select></span>`;
}
const lerMes = (nome, el = document) => { const m = $(`[data-mes-m="${nome}"]`, el); const y = $(`[data-mes-y="${nome}"]`, el); return m && y ? `${y.value}-${String(m.value).padStart(2, '0')}` : ''; };
function moverPeriodo(d) {
  const p = ui.periodo;
  if (p.tipo === 'mes') { const m = C.addMes(`${p.ano}-${String(p.mes).padStart(2, '0')}`, d); [p.ano, p.mes] = m.split('-').map(Number); }
  else if (p.tipo === 'tri') { p.tri += d; if (p.tri < 1) { p.tri = 4; p.ano--; } if (p.tri > 4) { p.tri = 1; p.ano++; } }
  else if (p.tipo === 'sem') { p.sem += d; if (p.sem < 1) { p.sem = 2; p.ano--; } if (p.sem > 2) { p.sem = 1; p.ano++; } }
  else if (p.tipo === 'ano') p.ano += d;
  salvarPeriodo();
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const salvarPeriodo = () => { try { sessionStorage.setItem('flui:periodo', JSON.stringify(ui.periodo)); } catch {} };

// ---------------- Início ----------------
function falaDoFlui(r, rows) {
  const nome = st().settings.nome ? `, ${esc(st().settings.nome)}` : '';
  const quase = rows.filter((x) => x.cat.tipo === 'despesa' && x.pct !== null && x.pct >= 0.85 && x.pct <= 1).sort((a, b) => b.pct - a.pct)[0];
  const passou = rows.filter((x) => x.cat.tipo === 'despesa' && x.pct !== null && x.pct > 1);
  if (!r.movs.some((x) => x.origem === 'lanc')) return `Oi${nome}! Ainda não tem nada lançado em ${esc(C.nomePeriodo(ui.periodo))}. Bora começar? É só tocar no <b>+</b>.`;
  if (r.saldo < 0) return `Esse período apertou um pouquinho, né${nome}? Calma. Vamos olhar juntos onde dá para ajustar.`;
  if (passou.length) return `Ops, ${esc(passou[0].cat.nome)} passou do combinado. Vamos reorganizar o restante do mês?`;
  if (quase) return `Olha quem está quase passando do limite! 👀 Você já usou ${Math.round(quase.pct * 100)}% do orçamento de ${esc(quase.cat.nome.toLowerCase())}. Vamos ficar de olho?`;
  if (r.guardado > 0) return `Você já guardou ${brl(r.guardado)} por aqui. Olha só como está avançando! 💚`;
  return `Tudo em dia por aqui${nome}. Continua registrando que eu fico de olho.`;
}
function avisos(rows) {
  const out = []; const vistos = st().settings.alertasVistos || {};
  if (ui.periodo.tipo === 'mes') {
    const m = mesRef();
    for (const x of rows) {
      if (x.cat.tipo !== 'despesa' || x.pct === null || x.pct < 0.85) continue;
      const k = `${m}|${x.cat.id}|${x.pct > 1 ? '100' : '85'}`; if (vistos[k]) continue;
      out.push(x.pct > 1
        ? { k, cor: 'vermelho', ic: '⚠️', txt: `Ops, <b>${esc(x.cat.nome)}</b> passou do combinado (${pct(x.pct)}). Vamos reorganizar o restante do mês?` }
        : { k, cor: 'laranja', ic: '👀', txt: `Olha quem está quase passando do limite! Você já usou <b>${pct(x.pct)}</b> do orçamento de ${esc(x.cat.nome.toLowerCase())}. Vamos ficar de olho?` });
    }
  }
  for (const v of C.proximosVencimentos(st(), hoje, 7)) {
    const k = `venc|${v.tipo}|${v.ref}|${v.mes || ''}`; if (vistos[k]) continue;
    const dias = Math.round((v.data - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 864e5);
    const quando = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
    out.push({ k, cor: 'azul', ic: '📅', txt: v.tipo === 'fatura' ? `Olha o cartão chegando! A <b>${esc(v.nome.toLowerCase())}</b> vence ${quando} (${brl(v.valor)}). Dá uma conferida?` : `Passando para lembrar: <b>${esc(v.nome)}</b> vence ${quando} (${brl(v.valor)}). Já deixou isso organizado?` });
  }
  return out;
}
function telaInicio() {
  const ms = meses(); const r = C.resumo(st(), ms); const rows = C.porCategoria(st(), ms);
  const vis = rows.filter((x) => x.orcado > 0 || x.real > 0);
  const desp = rows.filter((x) => x.cat.tipo === 'despesa' && x.real > 0).sort((a, b) => b.real - a.real);
  const totDesp = C.sum(desp, (x) => x.real);
  const ultimos = [...st().lancamentos].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).slice(0, 5);
  return `
  <h1>Início</h1>
  ${filtroPeriodo()}
  <div class="grade g4">
    ${kpi('Entrou', r.entradas, 'verde')}${kpi('Gastou', r.despesas, 'laranja')}${kpi('Guardou', r.guardado, 'azul')}
    <div class="kpi destaque ${r.saldo < 0 ? 'negativo' : ''}"><div class="rot">Sobrou</div><div class="val num">${brl(r.saldo)}</div></div>
  </div>
<!--kpi2-->  <div class="grade g2" style="margin-top:12px">
    <a class="kpi" href="#cartoes" style="text-decoration:none;color:inherit"><div class="rot" style="color:#9B5DE5">No cartão</div><div class="val num" style="font-size:20px">${brl(r.cartao)}</div><div class="mini">${r.despesas > 0 ? pct(r.cartao / r.despesas) + ' do que você gastou' : '&nbsp;'}</div></a>
    <div class="kpi"><div class="rot" style="color:var(--cinza)">A pagar</div><div class="val num" style="font-size:20px">${brl(r.pendente)}</div><div class="mini">fixos e faturas ainda não marcados como pagos</div></div>
  </div>
  <div class="flui-fala" style="margin-top:16px"><div class="mascote">${MASCOTE}</div><div class="balao">${falaDoFlui(r, rows)}</div></div>
  ${(() => { const av = avisos(rows); const mostra = ui.verAvisos ? av : av.slice(0, 2); return mostra.map((a) => `<div class="aviso ${a.cor}"><span class="ic">${a.ic}</span><span>${a.txt}</span><button class="fechar" data-a="aviso-ok" data-k="${esc(a.k)}" aria-label="Dispensar">×</button></div>`).join('') + (av.length > 2 && !ui.verAvisos ? `<button class="mais-opcoes" data-a="ver-avisos">+ ver mais ${av.length - 2} aviso(s)</button>` : ''); })()}
  <div class="grade g2 empilha" style="margin-top:4px">
    <div><h2>Orçamento × real</h2>
      ${vis.length ? `<div class="lista">${vis.map(orcLinha).join('')}</div>` : vazio('🎯', 'Defina quanto quer gastar em cada categoria em <a href="#plano">Planejamento</a>.')}
    </div>
    <div><h2>Para onde foi o dinheiro</h2>
      <div class="card">${desp.length ? `<div class="pizza-wrap">${rosca(desp.map((x) => ({ nome: x.cat.nome, valor: x.real, cor: x.cat.cor })), totDesp)}
        <div class="legenda">${desp.map((x) => `<div><span><span class="ponto" style="background:${x.cat.cor}"></span>${esc(x.cat.nome)}</span><span class="pc">${pct(x.real / totDesp)}</span></div>`).join('')}</div></div>` : vazio('🍩', 'Nenhum gasto neste período ainda.')}</div>
    </div>
  </div>
  <div class="linha-acao"><h2>Últimos lançamentos</h2><a class="btn fantasma" href="#lancamentos">Ver todos</a></div>
  ${ultimos.length ? `<div class="lista">${ultimos.map((l) => itemMov(movDeLanc(l))).join('')}</div>` : vazio('✍️', 'Seus lançamentos aparecem aqui.')}`;
}
const kpi = (rot, v, cor) => `<div class="kpi ${cor}"><div class="rot">${rot}</div><div class="val num">${brl(v)}</div></div>`;
const vazio = (ic, t) => `<div class="card vazio"><div class="grande">${ic}</div>${t}</div>`;
function orcLinha(x) {
  const p = x.pct; const g = x.cat.tipo === 'guardar';
  const cls = p === null ? 'neutro' : g ? (p >= 1 ? '' : 'azul') : p > 1 ? 'estourou' : p >= 0.85 ? 'alerta' : '';
  const w = p === null ? (x.real > 0 ? 100 : 0) : Math.min(100, Math.round(p * 100));
  return `<div class="orc" data-a="ver-cat" data-id="${x.cat.id}">
    <div class="linha1"><span><span class="ponto" style="background:${x.cat.cor}"></span>${esc(x.cat.nome)}${x.noCartao > 0 ? '<span class="tag roxo">cartão</span>' : ''}</span><span class="num">${brl(x.real)}</span></div>
    <div class="prog ${cls}"><i style="width:${w}%"></i></div>
    <div class="linha2"><span>${x.orcado > 0 ? `de ${brl(x.orcado)}` : 'sem orçamento'}</span><span class="${x.restante < 0 && x.orcado > 0 ? 'neg' : ''}">${x.orcado > 0 ? (g ? (x.restante > 0 ? `faltam ${brl(x.restante)}` : 'meta do mês batida! 💚') : x.restante > 0 ? `faltam ${brl(x.restante)}` : x.restante === 0 ? 'no limite' : `passou ${brl(-x.restante)}`) : ''}</span></div></div>`;
}

// ---------------- Lançamentos ----------------
function movDeLanc(l) { return C.movimentosDoMes({ ...st(), lancamentos: [l], compras: [], recorrencias: [] }, l.mes)[0]; }
function itemMov(x) {
  const cor = catCor(x.categoriaId); const ini = catNome(x.categoriaId).slice(0, 1).toUpperCase();
  const sinal = x.tipo === 'entrada' ? '+' : x.tipo === 'guardar' ? '' : '−';
  const corV = x.tipo === 'entrada' ? 'pos' : x.tipo === 'guardar' ? '' : '';
  const tags = [];
  if (x.origem === 'cartao') tags.push('<span class="tag roxo">cartão</span>');
  if (x.origem === 'fixo') tags.push('<span class="tag azul">fixo</span>');
  if (x.tipo === 'guardar') tags.push('<span class="tag azul">guardado</span>');
  if (x.status === 'pendente' || x.status === 'previsto' || x.status === 'a receber') tags.push(`<span class="tag laranja">${x.status}</span>`);
  const det = [catNome(x.categoriaId), x.forma, x.banco, x.data ? x.data.split('-').reverse().join('/') : ''].filter(Boolean).join(' · ');
  return `<div class="item" data-a="abrir-mov" data-origem="${x.origem}" data-id="${x.id}">
    <div class="bola" style="background:${cor}">${esc(ini)}</div>
    <div class="meio"><div class="titulo">${esc(x.descricao || catNome(x.categoriaId))}${tags.join('')}</div><div class="det">${esc(det)}</div></div>
    <div class="valor num ${corV}">${sinal} ${brl(x.valor)}</div></div>`;
}
function telaLancamentos() {
  const ms = meses();
  let movs = ms.flatMap((m) => C.movimentosDoMes(st(), m));
  if (ui.filtroTipo !== 'todos') movs = movs.filter((x) => x.tipo === ui.filtroTipo);
  if (ui.filtroCat) movs = movs.filter((x) => x.categoriaId === ui.filtroCat);
  if (ui.busca) { const b = ui.busca.toLowerCase(); movs = movs.filter((x) => (x.descricao + ' ' + catNome(x.categoriaId) + ' ' + (x.forma || '') + ' ' + (x.banco || '')).toLowerCase().includes(b)); }
  const porMes = ms.slice().reverse().map((m) => [m, movs.filter((x) => x.mes === m)]).filter(([, l]) => l.length);
  const tot = (t) => C.sum(movs.filter((x) => x.tipo === t), (x) => x.valor);
  return `
  <div class="linha-acao" style="margin-top:0"><h1>Lançamentos</h1><button class="btn verde" data-a="novo-lanc">+ Novo lançamento</button></div>
  ${filtroPeriodo()}
  <div class="chips" style="margin-bottom:10px">${[['todos', 'Tudo'], ['despesa', 'Despesas'], ['entrada', 'Entradas'], ['guardar', 'Guardado']].map(([t, n]) => `<button class="chip ${ui.filtroTipo === t ? 'ativo' : ''}" data-a="filtro-tipo" data-v="${t}">${n}</button>`).join('')}
    ${ui.filtroCat ? `<button class="chip ativo" data-a="filtro-cat-limpa">${esc(catNome(ui.filtroCat))} ×</button>` : ''}</div>
  <input class="inp" placeholder="Buscar por descrição, categoria, banco..." data-a="busca" value="${esc(ui.busca)}" style="margin-bottom:12px">
  <div class="mini" style="margin-bottom:4px">Entradas <b class="pos">${brl(tot('entrada'))}</b> · Despesas <b>${brl(tot('despesa'))}</b> · Guardado <b>${brl(tot('guardar'))}</b></div>
  ${porMes.length ? porMes.map(([m, l]) => `<div class="grupo-mes">${C.nomeMes(m, true)}</div><div class="lista">${l.map(itemMov).join('')}</div>`).join('') : vazio('🔎', 'Nada por aqui neste período.')}
  <p class="mini" style="margin-top:14px">Compras no cartão e custos fixos aparecem aqui automaticamente, com as etiquetas <span class="tag roxo">cartão</span> e <span class="tag azul">fixo</span>.</p>`;
}

// ---------------- Cartões ----------------
function telaCartoes() {
  const ms = meses();
  const cartoes = st().cartoes;
  const lista = [...cartoes, ...(st().compras.some((c) => !c.cartaoId) ? [{ id: '', nome: 'Sem cartão definido', cor: '#AFAFAF' }] : [])];
  const totMes = (cid, m) => C.fatura(st(), cid, m).total;
  return `
  <div class="linha-acao" style="margin-top:0"><h1>Cartões</h1><button class="btn verde" data-a="nova-compra">+ Compra no cartão</button></div>
  ${filtroPeriodo()}
  <div class="grade g2">${cartoes.map((c) => `<div class="cc" style="background:${c.cor || '#268AFF'}" data-a="editar-cartao" data-id="${c.id}">
      <div><div class="cc-nome">${esc(c.nome)}</div><div class="cc-det">${[c.banco, c.fechamento ? `fecha dia ${c.fechamento}` : '', c.vencimento ? `vence dia ${c.vencimento}` : ''].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div><div class="cc-det">Fatura de ${C.nomeMes(mesRef())}</div><div class="cc-val num">${brl(totMes(c.id, mesRef()))}</div>
      ${c.limite ? `<div class="cc-det">Limite disponível ${brl(c.limite - comprometido(c.id))} de ${brl(c.limite)}</div>` : ''}</div></div>`).join('')}
    <button class="card" style="border-style:dashed;cursor:pointer;font-weight:900;color:var(--azul);min-height:120px;background:#fff" data-a="novo-cartao">+ Adicionar cartão</button>
  </div>
  <h2>Faturas</h2>
  ${lista.length ? ms.slice().reverse().map((m) => {
    const fs = lista.map((c) => ({ c, f: C.fatura(st(), c.id, m) })).filter((x) => x.f.total > 0);
    if (!fs.length) return '';
    return `<div class="grupo-mes">${C.nomeMes(m, true)}</div>${fs.map(({ c, f }) => `<div class="card">
      <div class="linha-acao" style="margin:0 0 8px"><h3><span class="ponto" style="background:${c.cor || '#AFAFAF'}"></span>${esc(c.nome)}</h3><span class="num" style="font-weight:900;font-size:18px">${brl(f.total)}</span></div>
      <label class="chave"><input type="checkbox" data-a="fatura-paga" data-id="${c.id}" data-m="${m}" ${f.paga ? 'checked' : ''}> Fatura paga</label>
      <div class="lista" style="margin-top:10px">${f.itens.map(({ compra, parcela }) => `<div class="item" data-a="editar-compra" data-id="${compra.id}">
        <div class="bola" style="background:${catCor(compra.categoriaId)}">${esc(catNome(compra.categoriaId).slice(0, 1))}</div>
        <div class="meio"><div class="titulo">${esc(compra.descricao)}</div><div class="det">${esc(catNome(compra.categoriaId))}${parcela.de > 1 ? ` · parcela ${parcela.numero}/${parcela.de}` : ' · à vista'}</div></div>
        <div class="valor num">${brl(parcela.valor)}</div></div>`).join('')}</div></div>`).join('')}`;
  }).join('') || vazio('💳', 'Nenhuma fatura neste período.') : vazio('💳', 'Cadastre um cartão ou lance uma compra.')}
  <p class="mini" style="margin-top:14px">Cada compra conta uma vez só, como despesa na categoria dela, no mês de cada parcela. Marcar a fatura como paga não cria uma nova despesa.</p>`;
}
function comprometido(cartaoId) {
  const m0 = C.mesAtual(); let t = 0;
  for (const c of st().compras) if (c.cartaoId === cartaoId) for (const p of C.parcelasDaCompra(c)) if (C.difMeses(m0, p.mes) >= 0 && !(st().settings.faturasPagas || {})[`${cartaoId}|${p.mes}`]) t += C.cents(p.valor);
  return C.fromCents(t);
}

// ---------------- Planejamento ----------------
function telaPlano() {
  const sal = st().recorrencias.find((r) => r.tipo === 'entrada' && catNome(r.categoriaId) === 'Salário');
  const desp = st().categorias.filter((c) => !c.arquivada && c.tipo !== 'entrada');
  const totOrc = C.sum(desp, (c) => c.orcamento);
  const fixos = st().recorrencias.filter((r) => r !== sal);
  const m = C.mesAtual();
  return `
  <h1>Planejamento</h1><p class="sub">O que você combina com você mesma para cada mês.</p>
  <div class="card"><div class="linha-acao" style="margin:0"><div><h3>Salário por mês</h3><div class="mini">${sal ? `desde ${C.nomeMes(sal.inicio)}${sal.fim ? ` até ${C.nomeMes(sal.fim)}` : ''} · entra sozinho todo mês` : 'ainda não definido'}</div></div>
    <button class="btn ${sal ? 'branco' : ''} pequeno" data-a="${sal ? 'editar-fixo' : 'novo-salario'}" data-id="${sal?.id || ''}">${sal ? brl(sal.valor) : 'Definir'}</button></div>
    <p class="mini" style="margin:10px 0 0">Se num mês você lançar o salário recebido em Lançamentos, o previsto não é somado de novo.</p></div>
  <div class="linha-acao"><h2>Orçamento por categoria</h2><span class="mini">total ${brl(totOrc)} / mês${sal ? ` · sobra planejada <b class="${sal.valor - totOrc < 0 ? 'neg' : 'pos'}">${brl(sal.valor - totOrc)}</b>` : ''}</span></div>
  <div class="lista">${desp.map((c) => `<div class="item" style="cursor:default"><div class="bola" style="background:${c.cor}">${esc(c.nome.slice(0, 1))}</div>
    <div class="meio"><div class="titulo">${esc(c.nome)}</div><div class="det">${c.tipo === 'guardar' ? 'guardar' : 'despesa'}</div></div>
    <input class="inp num" style="width:130px;text-align:right" inputmode="decimal" placeholder="0,00" value="${c.orcamento ? valorInput(c.orcamento) : ''}" data-a="orc" data-id="${c.id}"></div>`).join('')}</div>
  <div class="linha-acao"><h2>Custos fixos e recorrentes</h2><button class="btn pequeno" data-a="novo-fixo">+ Novo fixo</button></div>
  ${fixos.length ? `<div class="lista">${fixos.map((r) => `<div class="item" data-a="editar-fixo" data-id="${r.id}">
    <div class="bola" style="background:${catCor(r.categoriaId)}">${esc(catNome(r.categoriaId).slice(0, 1))}</div>
    <div class="meio"><div class="titulo">${esc(r.nome || catNome(r.categoriaId))}${r.ativa === false ? '<span class="tag">pausado</span>' : ''}</div>
      <div class="det">${[catNome(r.categoriaId), `${C.nomeMes(r.inicio)} → ${r.fim ? C.nomeMes(r.fim) : 'sem fim'}`, r.diaVenc ? `vence dia ${r.diaVenc}` : '', r.banco].filter(Boolean).map(esc).join(' · ')}</div></div>
    <div style="text-align:right"><div class="valor num">${brl(r.valor)}</div>${C.recorrenciaNoMes(r, m) ? `<label class="chave mini" data-stop="1"><input type="checkbox" data-a="fixo-pago" data-id="${r.id}" data-m="${m}" ${(r.pagos || {})[m] ? 'checked' : ''}> pago em ${C.nomeMes(m)}</label>` : ''}</div></div>`).join('')}</div>` : vazio('🔁', 'Academia, assinaturas, dízimo... cadastre aqui o que se repete todo mês.')}
  <p class="mini" style="margin-top:12px">Os fixos entram sozinhos nos meses certos. Não precisa lançar de novo em Lançamentos.</p>`;
}

// ---------------- Relatórios ----------------
function telaRelatorios() {
  const ms = meses();
  const serie = (t) => ms.map((m) => C.resumo(st(), [m])[t]);
  const rows = C.porCategoria(st(), ms).filter((x) => x.real > 0 || x.orcado > 0);
  const desp = rows.filter((x) => x.cat.tipo === 'despesa' && x.real > 0).sort((a, b) => b.real - a.real);
  const tot = C.sum(desp, (x) => x.real);
  const cats = st().categorias.filter((c) => !c.arquivada);
  const linhas = cats.map((c) => ({ c, v: ms.map((m) => C.sum(C.movimentosDoMes(st(), m).filter((x) => x.categoriaId === c.id), (x) => x.valor)) })).filter((l) => l.v.some((x) => x > 0));
  const res = ms.map((m) => C.resumo(st(), [m]));
  return `
  <h1>Relatórios</h1>${filtroPeriodo()}
  <div class="card"><h3 style="margin-bottom:10px">Entradas × despesas</h3>${barras(ms, [{ nome: 'Entradas', cor: '#77C800', valores: serie('entradas') }, { nome: 'Despesas', cor: '#FF9600', valores: serie('despesas') }, { nome: 'Guardado', cor: '#268AFF', valores: serie('guardado') }])}</div>
  <div class="card"><h3 style="margin-bottom:10px">Despesas por categoria</h3>${desp.length ? `<div class="pizza-wrap">${rosca(desp.map((x) => ({ nome: x.cat.nome, valor: x.real, cor: x.cat.cor })), tot)}
    <div class="legenda">${desp.map((x) => `<div><span><span class="ponto" style="background:${x.cat.cor}"></span>${esc(x.cat.nome)}</span><span><b class="num">${brl(x.real)}</b> <span class="pc">${pct(x.real / tot)}</span></span></div>`).join('')}</div></div>` : vazio('🍩', 'Sem despesas no período.')}</div>
  <h2>Mês a mês</h2>
  <div class="rolagem"><table class="tabela"><thead><tr><th>Categoria</th>${ms.map((m) => `<th>${C.nomeMes(m)}</th>`).join('')}<th>Total</th><th>Média</th></tr></thead><tbody>
    ${linhas.map(({ c, v }) => `<tr><td><span class="ponto" style="background:${c.cor}"></span>${esc(c.nome)}</td>${v.map((x) => `<td class="num">${x ? brl(x) : '–'}</td>`).join('')}<td class="num"><b>${brl(C.sum(v))}</b></td><td class="num">${brl(C.sum(v) / ms.length)}</td></tr>`).join('')}
    ${[['Entradas', 'entradas'], ['Despesas', 'despesas'], ['Guardado', 'guardado'], ['Saldo', 'saldo'], ['No cartão', 'cartao']].map(([n, k]) => `<tr class="total"><td>${n}</td>${res.map((x) => `<td class="num ${k === 'saldo' && x[k] < 0 ? 'neg' : ''}">${brl(x[k])}</td>`).join('')}<td class="num">${brl(C.sum(res, (x) => x[k]))}</td><td class="num">${brl(C.sum(res, (x) => x[k]) / ms.length)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

// ---------------- Metas ----------------
function telaMetas() {
  return `<div class="linha-acao" style="margin-top:0"><h1>Metas</h1><button class="btn verde" data-a="nova-meta">+ Nova meta</button></div>
  <p class="sub">Viagem, casamento, reserva... o Flui acompanha com você.</p>
  ${st().metas.length ? st().metas.map((mt) => { const p = C.progressoMeta(st(), mt); return `<div class="card" data-a="editar-meta" data-id="${mt.id}" style="cursor:pointer">
    <div class="linha-acao" style="margin:0 0 10px"><h3>${esc(mt.nome)}</h3><span class="num" style="font-weight:900">${p.alvo ? pct(p.pct) : 'defina o valor'}</span></div>
    <div class="prog azul" style="height:18px"><i style="width:${Math.round(p.pct * 100)}%"></i></div>
    <div class="orc" style="padding:8px 0 0;border:none"><div class="linha2"><span>${brl(p.atual)}${p.alvo ? ` de ${brl(p.alvo)}` : ''}</span><span>${p.alvo ? `faltam ${brl(p.falta)}` : ''}${mt.dataAlvo ? ` · até ${C.nomeMes(mt.dataAlvo)}` : ''}</span></div></div>
    ${mt.dataAlvo && p.falta > 0 ? `<div class="mini" style="margin-top:6px">Para chegar a tempo: ${brl(p.falta / Math.max(1, C.difMeses(C.mesAtual(), mt.dataAlvo) + 1))} por mês</div>` : ''}</div>`; }).join('') : vazio('🎯', 'Crie sua primeira meta.')}`;
}

// ---------------- Categorias ----------------
function telaCategorias() {
  const grupo = (t, n) => { const cs = st().categorias.filter((c) => c.tipo === t); return `<div class="grupo-mes">${n}</div><div class="lista">${cs.map((c) => `<div class="item" data-a="editar-cat" data-id="${c.id}">
    <div class="bola" style="background:${c.cor}">${esc(c.nome.slice(0, 1))}</div><div class="meio"><div class="titulo">${esc(c.nome)}${c.arquivada ? '<span class="tag">arquivada</span>' : ''}</div><div class="det">${c.orcamento ? `orçamento ${brl(c.orcamento)}/mês` : ''}</div></div></div>`).join('')}</div>`; };
  return `<div class="linha-acao" style="margin-top:0"><h1>Categorias</h1><button class="btn pequeno" data-a="nova-cat">+ Nova</button></div>
  ${grupo('despesa', 'Despesas')}${grupo('guardar', 'Guardar')}${grupo('entrada', 'Entradas')}`;
}

// ---------------- Mais / Configurações ----------------
function telaMais() {
  return `<h1>Mais</h1><div class="lista" style="margin-top:12px">${[['relatorios', 'Relatórios', ICON.relat], ['metas', 'Metas', ICON.metas], ['categorias', 'Categorias', ICON.cats], ['config', 'Configurações e backup', ICON.config]].map(([r, n, i]) => `<a class="item" href="#${r}" style="text-decoration:none;color:inherit"><div class="bola" style="background:var(--azul)"><span style="width:24px;height:24px;display:block">${i}</span></div><div class="meio"><div class="titulo">${n}</div></div><div class="valor">›</div></a>`).join('')}</div>`;
}
function telaConfig() {
  const s = st().settings;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<h1>Configurações</h1>
  <div class="card"><h3>Sua conta</h3><p class="mini">${store.modo === 'local' ? 'Modo de teste: os dados ficam só neste navegador.' : `Conectada como <b>${esc(store.user.email)}</b>. Seus dados ficam salvos na sua conta e aparecem em qualquer aparelho em que você entrar.`}</p>
    <div class="campo"><label>Como o Flui te chama</label><input class="inp" data-a="nome" value="${esc(s.nome || '')}" placeholder="Seu nome"></div>
    <button class="btn branco pequeno" data-a="sair">Sair da conta</button></div>
  <div class="card"><h3>Bancos</h3><p class="mini">Aparecem como opção nos lançamentos, cartões e fixos. Nada é obrigatório.</p>
    <div class="cats" style="margin:10px 0">${(s.bancos || []).map((b) => `<button data-a="banco-del" data-v="${esc(b)}" title="Remover">${esc(b)} ×</button>`).join('')}</div>
    <div style="display:flex;gap:8px"><input class="inp" id="novo-banco" placeholder="Adicionar banco"><button class="btn pequeno" data-a="banco-add">Adicionar</button></div></div>
  <div class="card"><h3>Instalar na tela inicial</h3>
    ${ui.installEvt ? '<p class="mini">Seu navegador permite instalar o Flui como app.</p><button class="btn pequeno" data-a="instalar">Instalar o Flui</button>' :
      ios ? '<p class="mini">No iPhone: abra no <b>Safari</b>, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>' :
      '<p class="mini">No Android (Chrome): toque nos <b>três pontinhos</b> e em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>. No computador, use o ícone de instalar na barra de endereço.</p>'}</div>
  <div class="card"><h3>Backup</h3><p class="mini">Baixe uma cópia de tudo (arquivo .json) ou restaure uma cópia. Ao restaurar, o Flui baixa antes um backup do que existe hoje.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pequeno" data-a="exportar">Baixar backup</button><label class="btn branco pequeno" style="cursor:pointer">Restaurar backup<input type="file" accept=".json,application/json" data-a="importar" hidden></label></div></div>
  <div class="card"><h3>Notificações</h3><p class="mini">Por enquanto, os avisos de orçamento e vencimento aparecem quando você abre o Flui. As notificações com o app fechado chegam na próxima versão.</p></div>
  <p class="mini" style="text-align:center;margin-top:18px">Flui · versão 1.0</p>`;
}

// ======================= MODAIS =======================
function abrirModal(html, depois) { ui.modal = { html: `<div class="fundo-modal" data-a="fechar-fundo"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`, depois }; render(); }
function fecharModal() { ui.modal = null; render(); }
const topoModal = (t) => `<div class="modal-topo"><h2>${t}</h2><button class="x" type="button" data-a="fechar" aria-label="Fechar">×</button></div>`;
const selBanco = (nome, v) => `<select class="inp" name="${nome}"><option value="">—</option>${(st().settings.bancos || []).map((b) => `<option ${b === v ? 'selected' : ''}>${esc(b)}</option>`).join('')}${v && !(st().settings.bancos || []).includes(v) ? `<option selected>${esc(v)}</option>` : ''}</select>`;
const chipsCat = (tipo, sel) => `<div class="cats" data-cats>${st().categorias.filter((c) => c.tipo === tipo && (!c.arquivada || c.id === sel)).map((c) => `<button type="button" class="${c.id === sel ? 'ativo' : ''}" data-cat="${c.id}"><span class="ponto" style="background:${c.cor}"></span>${esc(c.nome)}</button>`).join('')}</div><input type="hidden" name="categoriaId" value="${sel || ''}">`;

function modalLanc(l = {}) {
  const tipo = l.tipo || 'despesa';
  const mes = l.mes || (ui.periodo.tipo === 'mes' ? mesRef() : C.mesAtual());
  const extras = !!(l.data || l.forma || l.banco || l.vencimento || l.obs || (l.status && !['pago', 'recebido'].includes(l.status)));
  abrirModal(`<form data-form="lanc" data-id="${l.id || ''}">${topoModal(l.id ? 'Editar lançamento' : 'Novo lançamento')}
    <div class="seg" data-seg="tipo">${[['despesa', 'Despesa'], ['entrada', 'Entrada'], ['guardar', 'Guardar']].map(([t, n]) => `<button type="button" class="t-${t} ${t === tipo ? 'ativo' : ''}" data-tipo="${t}">${n}</button>`).join('')}</div>
    <input type="hidden" name="tipo" value="${tipo}">
    <div class="campo"><input class="inp valor-grande num" name="valor" inputmode="decimal" placeholder="R$ 0,00" value="${l.valor ? valorInput(l.valor) : ''}" required autocomplete="off"></div>
    <div class="campo"><label>Categoria</label><div data-cats-wrap>${chipsCat(tipo, l.categoriaId)}</div></div>
    <div class="campo"><label>Descrição <span class="opc">opcional</span></label><input class="inp" name="descricao" value="${esc(l.descricao || '')}" placeholder="Ex.: almoço com a equipe"></div>
    <div class="campo"><label>Mês</label>${mesSelect('l-mes', mes)}</div>
    <button type="button" class="mais-opcoes" data-a="mais-opcoes">${extras ? '− Menos opções' : '+ Mais opções (data, forma, banco, vencimento)'}</button>
    <div data-extras class="${extras ? '' : 'oculto'}">
      <div class="duas"><div class="campo"><label>Data <span class="opc">opcional</span></label><input class="inp" type="date" name="data" value="${l.data || ''}"></div>
        <div class="campo"><label>Forma</label><select class="inp" name="forma"><option value="">—</option>${[...FORMAS, 'Cartão de crédito'].map((f) => `<option ${f === l.forma ? 'selected' : ''}>${f}</option>`).join('')}</select></div></div>
      <div class="duas"><div class="campo"><label>Banco <span class="opc">opcional</span></label>${selBanco('banco', l.banco)}</div>
        <div class="campo"><label>Vence em <span class="opc">opcional</span></label><input class="inp" type="date" name="vencimento" value="${l.vencimento || ''}"></div></div>
      <div class="campo"><label>Situação</label><select class="inp" name="status">${(tipo === 'entrada' ? [['recebido', 'Recebido'], ['a receber', 'A receber']] : [['pago', 'Pago'], ['pendente', 'Pendente']]).map(([v, n]) => `<option value="${v}" ${l.status === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="campo"><label>Observação <span class="opc">opcional</span></label><input class="inp" name="obs" value="${esc(l.obs || '')}"></div>
    </div>
    <div class="acoes">${l.id ? '<button type="button" class="btn branco" data-a="excluir-lanc">Excluir</button>' : ''}<button class="btn verde" type="submit">${l.id ? 'Salvar' : 'Lançar'}</button></div>
  </form>`, () => { const v = $('[name=valor]'); if (v && !l.id) v.focus(); });
}

function modalCompra(c = {}) {
  const cartoes = st().cartoes;
  abrirModal(`<form data-form="compra" data-id="${c.id || ''}">${topoModal(c.id ? 'Editar compra' : 'Compra no cartão')}
    <div class="campo"><label>Valor total</label><input class="inp valor-grande num" name="total" inputmode="decimal" placeholder="R$ 0,00" value="${c.total ? valorInput(c.total) : ''}" required autocomplete="off" data-a="prev-parc"></div>
    <div class="duas"><div class="campo"><label>Parcelas</label><input class="inp" name="parcelas" type="number" min="1" max="48" value="${c.parcelas || 1}" data-a="prev-parc"></div>
      <div class="campo"><label>Cartão</label><select class="inp" name="cartaoId"><option value="">Sem cartão definido</option>${cartoes.map((k) => `<option value="${k.id}" ${k.id === c.cartaoId || (!c.id && cartoes.length === 1) ? 'selected' : ''}>${esc(k.nome)}</option>`).join('')}</select></div></div>
    <div class="mini" data-prev style="margin:-6px 0 12px"></div>
    <div class="campo"><label>Descrição</label><input class="inp" name="descricao" value="${esc(c.descricao || '')}" required placeholder="Ex.: presente de Natal"></div>
    <div class="campo"><label>Categoria</label>${chipsCat('despesa', c.categoriaId)}</div>
    <div class="duas"><div class="campo"><label>1ª parcela em</label>${mesSelect('c-mes', c.mesPrimeira || (ui.periodo.tipo === 'mes' ? mesRef() : C.mesAtual()))}</div>
      <div class="campo"><label>Data da compra <span class="opc">opcional</span></label><input class="inp" type="date" name="data" value="${c.data || ''}"></div></div>
    <div class="acoes">${c.id ? '<button type="button" class="btn branco" data-a="excluir-compra">Excluir</button>' : ''}<button class="btn verde" type="submit">Salvar</button></div>
  </form>`, previaParcelas);
}
function previaParcelas() {
  const f = $('[data-form=compra]'); if (!f) return;
  const total = parseValor(f.total.value); const n = parseInt(f.parcelas.value, 10) || 1;
  const ps = C.parcelasDaCompra({ total, parcelas: n, mesPrimeira: '2000-01' });
  $('[data-prev]', f).textContent = total > 0 ? (n > 1 ? `${n}x de ${brl(ps[0].valor)}${ps[n - 1].valor !== ps[0].valor ? ` (última ${brl(ps[n - 1].valor)})` : ''}` : 'à vista') : '';
}

function modalCartao(c = {}) {
  const cores = ['#268AFF', '#8A05BE', '#FF7A00', '#EC0000', '#1CB0F6', '#58A700', '#3C3C3C', '#FFC800'];
  abrirModal(`<form data-form="cartao" data-id="${c.id || ''}">${topoModal(c.id ? 'Editar cartão' : 'Novo cartão')}
    <div class="campo"><label>Nome do cartão</label><input class="inp" name="nome" required value="${esc(c.nome || '')}" placeholder="Ex.: Nubank roxinho"></div>
    <div class="campo"><label>Banco <span class="opc">opcional</span></label>${selBanco('banco', c.banco)}</div>
    <div class="duas"><div class="campo"><label>Dia de fechamento <span class="opc">opcional</span></label><input class="inp" type="number" min="1" max="31" name="fechamento" value="${c.fechamento || ''}"></div>
      <div class="campo"><label>Dia de vencimento <span class="opc">opcional</span></label><input class="inp" type="number" min="1" max="31" name="vencimento" value="${c.vencimento || ''}"></div></div>
    <div class="campo"><label>Limite <span class="opc">opcional</span></label><input class="inp" name="limite" inputmode="decimal" value="${c.limite ? valorInput(c.limite) : ''}"></div>
    <div class="campo"><label>Cor</label><div class="cats">${cores.map((k) => `<button type="button" data-cor="${k}" class="${(c.cor || cores[0]) === k ? 'ativo' : ''}"><span class="ponto" style="background:${k};margin:0"></span></button>`).join('')}</div><input type="hidden" name="cor" value="${c.cor || cores[0]}"></div>
    <div class="acoes">${c.id ? '<button type="button" class="btn branco" data-a="excluir-cartao">Excluir</button>' : ''}<button class="btn verde" type="submit">Salvar</button></div></form>`);
}

function modalFixo(r = {}, salario = false) {
  const tipo = r.tipo || (salario ? 'entrada' : 'despesa');
  const catSal = st().categorias.find((c) => c.nome === 'Salário');
  abrirModal(`<form data-form="fixo" data-id="${r.id || ''}">${topoModal(salario ? 'Salário' : r.id ? 'Editar fixo' : 'Novo custo fixo')}
    <div class="seg" data-seg="tipo">${[['despesa', 'Despesa'], ['entrada', 'Entrada'], ['guardar', 'Guardar']].map(([t, n]) => `<button type="button" class="t-${t} ${t === tipo ? 'ativo' : ''}" data-tipo="${t}">${n}</button>`).join('')}</div>
    <input type="hidden" name="tipo" value="${tipo}">
    <div class="campo"><label>Valor por mês</label><input class="inp valor-grande num" name="valor" inputmode="decimal" placeholder="R$ 0,00" value="${r.valor ? valorInput(r.valor) : ''}" required></div>
    <div class="campo"><label>Nome</label><input class="inp" name="nome" value="${esc(r.nome || (salario ? 'Salário' : ''))}" placeholder="Ex.: Academia"></div>
    <div class="campo"><label>Categoria</label><div data-cats-wrap>${chipsCat(tipo, r.categoriaId || (salario ? catSal?.id : ''))}</div></div>
    <div class="duas"><div class="campo"><label>Começa em</label>${mesSelect('f-ini', r.inicio || C.mesAtual())}</div>
      <div class="campo"><label>Termina em <span class="opc">opcional</span></label><label class="chave mini" style="margin-bottom:6px"><input type="checkbox" name="semFim" ${r.id && !r.fim ? 'checked' : !r.id ? 'checked' : ''}> sem data para acabar</label>${mesSelect('f-fim', r.fim || C.addMes(C.mesAtual(), 11))}</div></div>
    <div class="duas"><div class="campo"><label>Dia de vencimento <span class="opc">opcional</span></label><input class="inp" type="number" min="1" max="31" name="diaVenc" value="${r.diaVenc || ''}"></div>
      <div class="campo"><label>Frequência</label><select class="inp" name="frequencia"><option value="mensal">Mensal</option><option value="anual" ${r.frequencia === 'anual' ? 'selected' : ''}>Anual</option></select></div></div>
    <div class="duas"><div class="campo"><label>Forma <span class="opc">opcional</span></label><select class="inp" name="forma"><option value="">—</option>${FORMAS.map((f) => `<option ${f === r.forma ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
      <div class="campo"><label>Banco <span class="opc">opcional</span></label>${selBanco('banco', r.banco)}</div></div>
    ${r.id ? `<label class="chave" style="margin-bottom:12px"><input type="checkbox" name="pausado" ${r.ativa === false ? 'checked' : ''}> Pausar este fixo</label>` : ''}
    <div class="campo"><label>Observação <span class="opc">opcional</span></label><input class="inp" name="obs" value="${esc(r.obs || '')}"></div>
    <div class="acoes">${r.id ? '<button type="button" class="btn branco" data-a="excluir-fixo">Excluir</button>' : ''}<button class="btn verde" type="submit">Salvar</button></div></form>`);
}

function modalCat(c = {}) {
  const cores = ['#268AFF', '#77C800', '#FF9600', '#CE82FF', '#FF4B4B', '#1CB0F6', '#FFC800', '#2BDCA0', '#FF86D0', '#8E6CFF', '#A5683B', '#7C8A9A'];
  abrirModal(`<form data-form="cat" data-id="${c.id || ''}">${topoModal(c.id ? 'Editar categoria' : 'Nova categoria')}
    <div class="campo"><label>Nome</label><input class="inp" name="nome" required value="${esc(c.nome || '')}"></div>
    <div class="campo"><label>Tipo</label><select class="inp" name="tipo">${[['despesa', 'Despesa'], ['guardar', 'Guardar'], ['entrada', 'Entrada']].map(([v, n]) => `<option value="${v}" ${c.tipo === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="campo"><label>Orçamento por mês <span class="opc">opcional</span></label><input class="inp" name="orcamento" inputmode="decimal" value="${c.orcamento ? valorInput(c.orcamento) : ''}"></div>
    <div class="campo"><label>Cor</label><div class="cats">${cores.map((k) => `<button type="button" data-cor="${k}" class="${(c.cor || cores[0]) === k ? 'ativo' : ''}"><span class="ponto" style="background:${k};margin:0"></span></button>`).join('')}</div><input type="hidden" name="cor" value="${c.cor || cores[0]}"></div>
    ${c.id ? `<label class="chave" style="margin-bottom:12px"><input type="checkbox" name="arquivada" ${c.arquivada ? 'checked' : ''}> Arquivar (some das opções, mas o histórico fica)</label>` : ''}
    <div class="acoes">${c.id ? '<button type="button" class="btn branco" data-a="excluir-cat">Excluir</button>' : ''}<button class="btn verde" type="submit">Salvar</button></div></form>`);
}

function modalMeta(m = {}) {
  abrirModal(`<form data-form="meta" data-id="${m.id || ''}">${topoModal(m.id ? 'Editar meta' : 'Nova meta')}
    <div class="campo"><label>Nome</label><input class="inp" name="nome" required value="${esc(m.nome || '')}" placeholder="Ex.: Viagem"></div>
    <div class="duas"><div class="campo"><label>Quanto quer juntar</label><input class="inp" name="alvo" inputmode="decimal" value="${m.alvo ? valorInput(m.alvo) : ''}"></div>
      <div class="campo"><label>Já tem guardado</label><input class="inp" name="valorInicial" inputmode="decimal" value="${m.valorInicial ? valorInput(m.valorInicial) : ''}"></div></div>
    <div class="campo"><label>Até quando <span class="opc">opcional</span></label><label class="chave mini" style="margin-bottom:6px"><input type="checkbox" name="semData" ${!m.dataAlvo ? 'checked' : ''}> sem data</label>${mesSelect('m-data', m.dataAlvo || C.addMes(C.mesAtual(), 12))}</div>
    <div class="campo"><label>Somar automaticamente o que eu guardar em <span class="opc">opcional</span></label><select class="inp" name="categoriaId"><option value="">—</option>${st().categorias.filter((c) => c.tipo === 'guardar').map((c) => `<option value="${c.id}" ${c.id === m.categoriaId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
    <div class="acoes">${m.id ? '<button type="button" class="btn branco" data-a="excluir-meta">Excluir</button>' : ''}<button class="btn verde" type="submit">Salvar</button></div></form>`);
}

function modalBoasVindas() {
  abrirModal(`<form data-form="boas-vindas"><div class="flui-fala"><div class="mascote">${MASCOTE}</div><div class="balao">Oi! Eu sou o Flui. Vou te ajudar a organizar entradas, gastos, cartão e metas, no seu ritmo.</div></div>
    <div class="campo"><label>Como posso te chamar?</label><input class="inp" name="nome" placeholder="Seu nome"></div>
    <div class="campo"><label>Quanto você recebe por mês? <span class="opc">opcional</span></label><input class="inp" name="salario" inputmode="decimal" placeholder="R$ 0,00"></div>
    <p class="mini">Já tem um backup do Flui? Dá para restaurar depois em Configurações → Backup.</p>
    <div class="acoes"><button class="btn verde" type="submit">Começar</button></div></form>`);
}

// ======================= EVENTOS =======================
document.addEventListener('click', async (e) => {
  const catBtn = e.target.closest('[data-cat]');
  if (catBtn) { const w = catBtn.closest('form'); w.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('ativo', b === catBtn)); w.categoriaId.value = catBtn.dataset.cat; return; }
  const corBtn = e.target.closest('[data-cor]');
  if (corBtn) { const w = corBtn.closest('form'); w.querySelectorAll('[data-cor]').forEach((b) => b.classList.toggle('ativo', b === corBtn)); w.cor.value = corBtn.dataset.cor; return; }
  const tipoBtn = e.target.closest('[data-seg=tipo] [data-tipo]');
  if (tipoBtn) {
    const f = tipoBtn.closest('form'); const t = tipoBtn.dataset.tipo; f.tipo.value = t;
    f.querySelectorAll('[data-tipo]').forEach((b) => b.classList.toggle('ativo', b === tipoBtn));
    const w = f.querySelector('[data-cats-wrap]'); if (w) w.innerHTML = chipsCat(t, '');
    const sel = f.status; if (sel) sel.innerHTML = (t === 'entrada' ? [['recebido', 'Recebido'], ['a receber', 'A receber']] : [['pago', 'Pago'], ['pendente', 'Pendente']]).map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    return;
  }
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (e.target.closest('[data-stop]') && el.tagName !== 'INPUT') return;
  const a = el.dataset.a; const id = el.dataset.id;
  if (a === 'fechar-fundo' && e.target !== el) return;
  if (['fatura-paga', 'fixo-pago', 'importar', 'busca', 'orc', 'nome', 'prev-parc'].includes(a)) return; // tratados em 'change'/'input'
  e.preventDefault();
  const S = st();
  switch (a) {
    case 'auth-troca': ui.authModo = ui.authModo === 'criar' ? 'entrar' : 'criar'; ui.authErro = ''; render(); break;
    case 'auth-senha': { const email = $('[name=email]').value.trim(); if (!email) { ui.authErro = 'Digite seu e-mail primeiro.'; render(); break; }
      try { await store.backend.resetPassword(email); ui.authErro = ''; toast('Enviamos um link para redefinir a senha.'); } catch (err) { ui.authErro = ERROS_AUTH[err.code] || err.message; render(); } break; }
    case 'fechar': case 'fechar-fundo': fecharModal(); break;
    case 'per-ant': moverPeriodo(-1); render(); break;
    case 'per-prox': moverPeriodo(1); render(); break;
    case 'per-tipo': ui.periodo.tipo = el.dataset.v; salvarPeriodo(); render(); break;
    case 'aviso-ok': await store.salvarSettings({ alertasVistos: { ...(S.settings.alertasVistos || {}), [el.dataset.k]: true } }); break;
    case 'novo-lanc': modalLanc(); break;
    case 'ver-avisos': ui.verAvisos = true; render(); break;
    case 'mais-opcoes': { const x = $('[data-extras]'); x.classList.toggle('oculto'); el.textContent = x.classList.contains('oculto') ? '+ Mais opções (data, forma, banco, vencimento)' : '− Menos opções'; break; }
    case 'abrir-mov': {
      const o = el.dataset.origem;
      if (o === 'lanc') modalLanc({ ...S.lancamentos.find((x) => x.id === id) });
      else if (o === 'cartao') modalCompra({ ...S.compras.find((x) => x.id === id) });
      else modalFixo({ ...S.recorrencias.find((x) => x.id === id) });
      break; }
    case 'ver-cat': ui.filtroCat = id; ui.filtroTipo = 'todos'; location.hash = '#lancamentos'; break;
    case 'filtro-tipo': ui.filtroTipo = el.dataset.v; render(); break;
    case 'filtro-cat-limpa': ui.filtroCat = ''; render(); break;
    case 'excluir-lanc': if (confirm('Excluir este lançamento?')) { await store.remover('lancamentos', $('[data-form=lanc]').dataset.id); fecharModal(); toast('Lançamento excluído.'); } break;
    case 'nova-compra': modalCompra(); break;
    case 'editar-compra': modalCompra({ ...S.compras.find((x) => x.id === id) }); break;
    case 'excluir-compra': if (confirm('Excluir esta compra e todas as parcelas?')) { await store.remover('compras', $('[data-form=compra]').dataset.id); fecharModal(); toast('Compra excluída.'); } break;
    case 'novo-cartao': modalCartao(); break;
    case 'editar-cartao': modalCartao({ ...S.cartoes.find((x) => x.id === id) }); break;
    case 'excluir-cartao': { const cid = $('[data-form=cartao]').dataset.id; const n = S.compras.filter((c) => c.cartaoId === cid).length;
      if (confirm(n ? `Esse cartão tem ${n} compra(s). Elas continuam, mas ficam como "sem cartão definido". Excluir?` : 'Excluir este cartão?')) {
        for (const c of S.compras.filter((c) => c.cartaoId === cid)) await store.salvar('compras', { ...c, cartaoId: '' });
        await store.remover('cartoes', cid); fecharModal(); } break; }
    case 'novo-fixo': modalFixo(); break;
    case 'novo-salario': modalFixo({}, true); break;
    case 'editar-fixo': modalFixo({ ...S.recorrencias.find((x) => x.id === id) }, catNome(S.recorrencias.find((x) => x.id === id)?.categoriaId) === 'Salário'); break;
    case 'excluir-fixo': if (confirm('Excluir este fixo? Ele deixa de aparecer em todos os meses.')) { await store.remover('recorrencias', $('[data-form=fixo]').dataset.id); fecharModal(); } break;
    case 'nova-cat': modalCat(); break;
    case 'editar-cat': modalCat({ ...S.categorias.find((x) => x.id === id) }); break;
    case 'excluir-cat': { const cid = $('[data-form=cat]').dataset.id; const usada = S.lancamentos.some((l) => l.categoriaId === cid) || S.compras.some((l) => l.categoriaId === cid) || S.recorrencias.some((l) => l.categoriaId === cid);
      if (usada) { alert('Essa categoria já tem lançamentos. Para não perder o histórico, use "Arquivar".'); break; }
      if (confirm('Excluir esta categoria?')) { await store.remover('categorias', cid); fecharModal(); } break; }
    case 'nova-meta': modalMeta(); break;
    case 'editar-meta': modalMeta({ ...S.metas.find((x) => x.id === id) }); break;
    case 'excluir-meta': if (confirm('Excluir esta meta?')) { await store.remover('metas', $('[data-form=meta]').dataset.id); fecharModal(); } break;
    case 'banco-add': { const v = $('#novo-banco').value.trim(); if (v && !S.settings.bancos.includes(v)) await store.salvarSettings({ bancos: [...S.settings.bancos, v] }); break; }
    case 'banco-del': if (confirm(`Remover "${el.dataset.v}" da lista? Lançamentos antigos mantêm o nome.`)) await store.salvarSettings({ bancos: S.settings.bancos.filter((b) => b !== el.dataset.v) }); break;
    case 'exportar': baixar(`flui-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportar()); toast('Backup baixado.'); break;
    case 'instalar': ui.installEvt.prompt(); ui.installEvt = null; break;
    case 'sair': if (confirm('Sair da conta neste aparelho?')) { await store.backend.signOut(); store.st = null; render(); } break;
    default: break;
  }
});

document.addEventListener('change', async (e) => {
  const el = e.target; const a = el.dataset.a; const S = st();
  if (el.matches('[data-mes-m^=per-], [data-mes-y^=per-]')) { ui.periodo.de = lerMes('per-de'); ui.periodo.ate = lerMes('per-ate'); salvarPeriodo(); render(); return; }
  if (a === 'fatura-paga') { const k = `${el.dataset.id || 'sem'}|${el.dataset.m}`; const fp = { ...(S.settings.faturasPagas || {}) }; if (el.checked) fp[k] = true; else delete fp[k]; await store.salvarSettings({ faturasPagas: fp }); toast(el.checked ? 'Fatura marcada como paga.' : 'Fatura em aberto.'); }
  if (a === 'fixo-pago') { const r = S.recorrencias.find((x) => x.id === el.dataset.id); const pagos = { ...(r.pagos || {}) }; if (el.checked) pagos[el.dataset.m] = true; else delete pagos[el.dataset.m]; await store.salvar('recorrencias', { ...r, pagos }); }
  if (a === 'orc') { const c = S.categorias.find((x) => x.id === el.dataset.id); await store.salvar('categorias', { ...c, orcamento: parseValor(el.value) }); toast('Orçamento salvo.'); }
  if (a === 'nome') await store.salvarSettings({ nome: el.value.trim() });
  if (a === 'importar' && el.files[0]) {
    try {
      const dados = validarBackup(await el.files[0].text());
      const n = (dados.lancamentos || []).length + (dados.compras || []).length;
      if (!confirm(`Restaurar este backup? Ele tem ${n} lançamentos e compras e vai SUBSTITUIR os dados atuais desta conta. Antes, vou baixar um backup do que existe hoje.`)) return;
      baixar(`flui-antes-de-restaurar-${new Date().toISOString().slice(0, 10)}.json`, store.exportar());
      await store.substituirTudo(dados); toast('Backup restaurado!', true); location.hash = '#inicio';
    } catch (err) { alert(err.message || 'Não consegui ler esse arquivo.'); } finally { el.value = ''; }
  }
});
document.addEventListener('input', (e) => {
  const a = e.target.dataset.a;
  if (a === 'busca') { ui.busca = e.target.value; const pos = e.target.selectionStart; render(); const b = $('[data-a=busca]'); b.focus(); b.setSelectionRange(pos, pos); }
  if (a === 'prev-parc') previaParcelas();
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target; const tipoF = f.dataset.form; const id = f.dataset.id || undefined; const S = st();
  const v = (n) => (f.elements[n] ? f.elements[n].value.trim() : '');
  if (tipoF === 'auth') {
    const email = v('email'), senha = v('senha'); ui.authErro = '';
    try { ui.authModo === 'criar' ? await store.backend.signUp(email, senha) : await store.backend.signIn(email, senha); }
    catch (err) { ui.authErro = ERROS_AUTH[err.code] || 'Não deu certo. Tente de novo.'; render(); }
    return;
  }
  if (tipoF === 'lanc') {
    const valor = parseValor(v('valor')); if (!(valor > 0)) return alert('Digite um valor maior que zero.');
    if (!v('categoriaId')) return alert('Escolha uma categoria.');
    if (v('forma') === 'Cartão de crédito' && !id) { const dados = { total: valor, parcelas: 1, descricao: v('descricao'), categoriaId: v('categoriaId'), mesPrimeira: lerMes('l-mes', f), data: v('data') }; fecharModal(); modalCompra(dados); toast('Compra no cartão vai na fatura. Confira e salve.'); return; }
    const antigo = S.lancamentos.find((x) => x.id === id) || {};
    const novo = !id;
    await store.salvar('lancamentos', { ...antigo, id, tipo: v('tipo'), valor, categoriaId: v('categoriaId'), descricao: v('descricao'), mes: lerMes('l-mes', f), data: v('data'), forma: v('forma'), banco: v('banco'), vencimento: v('vencimento'), status: v('status') || (v('tipo') === 'entrada' ? 'recebido' : 'pago'), obs: v('obs') });
    fecharModal(); toast(novo ? (v('tipo') === 'guardar' ? 'Guardado! Seu eu do futuro agradece. 💚' : 'Prontinho, lançado!') : 'Salvo!', novo);
  }
  if (tipoF === 'compra') {
    const total = parseValor(v('total')); if (!(total > 0)) return alert('Digite o valor total.');
    if (!v('categoriaId')) return alert('Escolha uma categoria.');
    const antigo = S.compras.find((x) => x.id === id) || {};
    await store.salvar('compras', { ...antigo, id, total, parcelas: Math.max(1, parseInt(v('parcelas'), 10) || 1), cartaoId: v('cartaoId'), descricao: v('descricao'), categoriaId: v('categoriaId'), mesPrimeira: lerMes('c-mes', f), data: v('data') });
    fecharModal(); toast('Compra salva!');
  }
  if (tipoF === 'cartao') {
    const antigo = S.cartoes.find((x) => x.id === id) || {};
    await store.salvar('cartoes', { ...antigo, id, nome: v('nome'), banco: v('banco'), fechamento: parseInt(v('fechamento'), 10) || '', vencimento: parseInt(v('vencimento'), 10) || '', limite: parseValor(v('limite')) || '', cor: v('cor') });
    fecharModal(); toast('Cartão salvo!');
  }
  if (tipoF === 'fixo') {
    const valor = parseValor(v('valor')); if (!(valor > 0)) return alert('Digite o valor.');
    if (!v('categoriaId')) return alert('Escolha uma categoria.');
    const inicio = lerMes('f-ini', f); const fim = f.semFim.checked ? '' : lerMes('f-fim', f);
    if (fim && C.difMeses(inicio, fim) < 0) return alert('O mês final precisa ser depois do inicial.');
    const antigo = S.recorrencias.find((x) => x.id === id) || {};
    await store.salvar('recorrencias', { ...antigo, id, tipo: v('tipo'), valor, nome: v('nome') || catNome(v('categoriaId')), categoriaId: v('categoriaId'), inicio, fim, diaVenc: parseInt(v('diaVenc'), 10) || '', frequencia: v('frequencia'), forma: v('forma'), banco: v('banco'), obs: v('obs'), ativa: !(f.pausado && f.pausado.checked), pagos: antigo.pagos || {} });
    fecharModal(); toast('Fixo salvo!');
  }
  if (tipoF === 'cat') {
    const antigo = S.categorias.find((x) => x.id === id) || {};
    await store.salvar('categorias', { ...antigo, id, nome: v('nome'), tipo: v('tipo'), orcamento: parseValor(v('orcamento')), cor: v('cor'), arquivada: !!(f.arquivada && f.arquivada.checked) });
    fecharModal();
  }
  if (tipoF === 'meta') {
    const antigo = S.metas.find((x) => x.id === id) || {};
    await store.salvar('metas', { ...antigo, id, nome: v('nome'), alvo: parseValor(v('alvo')), valorInicial: parseValor(v('valorInicial')), dataAlvo: f.semData.checked ? '' : lerMes('m-data', f), categoriaId: v('categoriaId'), desde: antigo.desde || C.mesAtual() });
    fecharModal(); toast('Meta salva! Bora conquistar. 🎯');
  }
  if (tipoF === 'boas-vindas') {
    const sal = parseValor(v('salario'));
    if (sal > 0) { const cs = S.categorias.find((c) => c.nome === 'Salário'); await store.salvar('recorrencias', { tipo: 'entrada', valor: sal, nome: 'Salário', categoriaId: cs?.id || '', inicio: C.mesAtual(), fim: '', frequencia: 'mensal', ativa: true, pagos: {} }); }
    await store.salvarSettings({ nome: v('nome'), onboarding: true });
    fecharModal(); toast(`Bem-vinda${v('nome') ? ', ' + v('nome') : ''}! Bora organizar.`, true);
  }
});

function baixar(nome, txt) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

window.addEventListener('hashchange', () => { ui.rota = location.hash.slice(1) || 'inicio'; ui.modal = null; render(); window.scrollTo(0, 0); });
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installEvt = e; });
window.addEventListener('flui:erro', () => toast('Não consegui salvar agora. Confira a internet; o Flui tenta de novo.'));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.modal) fecharModal(); });

// ======================= INÍCIO =======================
store.on(() => { if (!ui.modal) render(); });
(async () => {
  render();
  try {
    await store.init(async (user) => {
      ui.carregando = false;
      if (!user) { store.st = null; render(); return; }
      render();
      await store.carregar();
      render();
      if (!st().settings.onboarding) modalBoasVindas();
    });
  } catch (err) {
    console.error(err); ui.carregando = false;
    $('#app').innerHTML = `<div class="entrada"><div class="entrada-box">${marca()}<p class="erro">Não consegui iniciar o Flui. Confira a internet e recarregue a página.</p></div></div>`;
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
window.__flui = { store, C };
