// Flui — telas e interação
import * as C from './calc.js?v=126';
import { ICS, ICONE_POR_NOME, svgIcone } from './icones.js?v=126';
import { VAPID_KEY } from './config.js?v=126';
import { lerOFX, lerCSV, entender, chaveRegra } from './importar.js?v=126';
import { Store, uid, FORMAS, validarBackup, BANCOS_CATALOGO } from './store.js?v=126';
import { brl, brl0, pct, esc, parseValor, valorInput, ICON, MASCOTE, rosca, barras, toast } from './ui.js?v=126';

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
const ICONES_ESCOLHA = Object.keys(ICS);
const iconeKey = (c) => (c && ICS[c.icone] ? c.icone : ICONE_POR_NOME[c?.nome]) || 'caixa';
const catIcone = (c, tam = 22) => svgIcone(iconeKey(c), tam);
const bolaCat = (c, extra = '') => `<div class="bola" style="background:${c?.cor || '#AFB8C4'};${extra}">${catIcone(c)}</div>`;
const catCor = (id) => cat(id)?.cor || '#AFB8C4';
const meses = () => C.mesesDoPeriodo(ui.periodo);
const mesRef = () => meses()[meses().length - 1];

// ======================= RENDER =======================
const NAV = [
  ['inicio', 'Início', ICON.inicio], ['lancamentos', 'Lançamentos', ICON.lanc], ['cartoes', 'Cartões', ICON.cartao],
  ['plano', 'Planejamento', ICON.plano], ['relatorios', 'Análise', ICON.relat], ['metas', 'Metas', ICON.metas],
  ['categorias', 'Categorias e bancos', ICON.cats], ['config', 'Configurações', ICON.config]];
const NAV_MOVEL = [['inicio', 'Início', ICON.inicio], ['lancamentos', 'Lançar', ICON.lanc], ['relatorios', 'Análise', ICON.relat], ['cartoes', 'Cartões', ICON.cartao], ['plano', 'Plano', ICON.plano]];

function render() {
  const root = $('#app');
  if (ui.carregando) { root.innerHTML = `<div class="entrada"><div class="entrada-box"><img class="entrada-mascote" src="icons/mascote.svg?v=126" alt="">${marca()}<p class="slogan">Carregando...</p></div></div>`; return; }
  if (!store.user) { root.innerHTML = telaEntrada(); return; }
  if (!st()) { root.innerHTML = `<div class="entrada"><div class="entrada-box"><img class="entrada-mascote" src="icons/mascote.svg?v=126" alt="">${marca()}<p class="slogan">Buscando seus dados...</p></div></div>`; return; }
  const rota = NAV.some((n) => n[0] === ui.rota) || ui.rota === 'mais' ? ui.rota : 'inicio';
  const tela = { inicio: telaInicio, lancamentos: telaLancamentos, cartoes: telaCartoes, plano: telaPlano, relatorios: telaRelatorios, metas: telaMetas, categorias: telaCategorias, config: telaConfig, mais: telaMais }[rota];
  root.innerHTML = `<div class="app">
    <aside class="lateral">${marca()}${NAV.map(([r, n, i]) => `<a class="nav-item ${r === rota ? 'ativo' : ''}" href="#${r}">${i}<span>${n}</span></a>`).join('')}
      <div style="margin-top:auto" class="mini">${store.modo === 'local' ? 'Modo de teste: dados só neste navegador' : esc(store.user.email)}</div></aside>
    <main class="principal"><div class="topo-movel"><a href="#mais" class="marca-link ${['mais', 'metas', 'categorias', 'config'].includes(rota) ? 'ativo' : ''}" aria-label="Menu">${marca(true)}<span class="marca-seta">▾</span></a><span style="display:flex;align-items:center;gap:10px">${sino()}</span></div><div class="topo-desk">${sino()}</div>${tela()}</main>
    <nav class="barra-inferior">${NAV_MOVEL.map(([r, n, i]) => `<a class="nav-item ${r === 'relatorios' ? 'nav-destaque' : ''} ${r === rota ? 'ativo' : ''}" href="#${r}">${r === 'relatorios' ? `<i class="nd-bola">${i}</i>` : i}<span>${n}</span></a>`).join('')}</nav>
    ${['inicio', 'lancamentos'].includes(rota) ? '<button class="btn verde fab" data-a="novo-lanc" aria-label="Novo lançamento">+</button>' : ''}
  </div>${ui.modal ? ui.modal.html : ''}`;
  if (ui.modal?.depois) ui.modal.depois();
  desenharTour();
}
const SINO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>';
function sino() { const n = avisos().length; return `<button class="sino" data-a="notificacoes" aria-label="Notificações${n ? ` (${n})` : ''}">${SINO}${n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : ''}</button>`; }
function modalNotificacoes() {
  const av = avisos();
  abrirModal(`${topoModal('Notificações')}${av.length ? av.map((a) => `<div class="aviso ${a.cor}"><span class="ic">${a.ic}</span><span>${a.txt}</span><button class="fechar" data-a="aviso-ok" data-k="${esc(a.k)}" aria-label="Dispensar">×</button></div>`).join('') + '<p class="mini">Toque no × para dispensar um aviso.</p>' : `<div class="flui-fala"><div class="mascote">${MASCOTE}</div><div class="balao">Tudo tranquilo por aqui! Quando algo precisar da sua atenção, eu aviso.</div></div>`}`);
}
const marca = (peq) => `<div class="marca"${peq ? ' style="padding:0"' : ''}><div class="marca-icone"${peq ? ' style="width:34px;height:34px;font-size:19px;border-radius:10px"' : ''}><img src="icons/icon.svg?v=126" alt=""></div><div class="marca-nome"${peq ? ' style="font-size:24px"' : ''}>Flu<span class="i-verde">ı</span></div></div>`;
function seqHtml() { const n = C.sequenciaRegistro(st()); return n > 1 ? `🔥 ${n} dias` : ''; }

// ---------------- entrada / login ----------------
const lerLocal = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const gravarLocal = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} };
function telaEntrada() {
  const criar = ui.authModo === 'criar';
  return `<div class="entrada"><form class="entrada-box" data-form="auth">
    <img class="entrada-mascote" src="icons/mascote.svg?v=126" alt="">${marca()}<p class="slogan">Seu dinheiro, no seu ritmo.</p>
    ${store.modo === 'local' ? '<div class="selo">MODO DE TESTE · dados só neste navegador</div>' : ''}
    <div class="campo"><label>E-mail</label><input class="inp" name="email" id="login-email" type="email" autocomplete="username email" value="${esc(lerLocal('flui:email') || '')}" required></div>
    ${store.modo === 'local' ? '' : `<div class="campo"><label>Senha</label><input class="inp" name="senha" type="password" autocomplete="${criar ? 'new-password' : 'current-password'}" minlength="6" required></div>`}
    <label class="chave" style="margin:2px 0 14px"><input type="checkbox" name="lembrar" ${lerLocal('flui:lembrar') === '0' ? '' : 'checked'}> Lembrar de mim neste aparelho</label>
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
  const tipos = [['mes', 'Mês'], ['ano', 'Ano'], ['custom', 'Personalizado']];
  if (p.tipo === 'tri' || p.tipo === 'sem') p.tipo = 'mes';
  return `<div class="periodo">
    <div class="seg-periodo">${tipos.map(([t, n]) => `<button class="${p.tipo === t ? 'ativo' : ''}" data-a="per-tipo" data-v="${t}">${n}</button>`).join('')}</div>
    ${p.tipo !== 'custom' ? `<div class="per-nav"><button class="seta" data-a="per-ant" aria-label="Anterior">‹</button><div class="rotulo">${esc(cap(C.nomePeriodo(p)))}</div><button class="seta" data-a="per-prox" aria-label="Próximo">›</button></div>` :
      `<div class="per-nav per-custom"><span class="per-lin"><span class="mini">De</span>${mesSelect('per-de', p.de)}</span><span class="per-lin"><span class="mini">até</span>${mesSelect('per-ate', p.ate)}</span></div>`}
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
function avisos() {
  const out = []; const vistos = st().settings.alertasVistos || {};
  const rows = C.porCategoria(st(), [C.mesAtual()]);
  {
    const m = C.mesAtual();
    for (const x of rows) {
      if (x.cat.tipo !== 'despesa' || x.pct === null || x.pct < 0.85) continue;
      const k = `${m}|${x.cat.id}|${x.pct > 1 ? '100' : '85'}`; if (vistos[k]) continue;
      out.push(x.pct > 1
        ? { k, cor: 'vermelho', ic: '⚠️', txt: `Ops, <b>${esc(x.cat.nome)}</b> passou do combinado (${pct(x.pct)}). Vamos reorganizar o restante do mês?` }
        : { k, cor: 'laranja', ic: '👀', txt: `Olha quem está quase passando do limite! Você já usou <b>${pct(x.pct)}</b> do orçamento de ${esc(x.cat.nome.toLowerCase())}. Vamos ficar de olho?` });
    }
  }
  for (const { cartao, m, f, fechou, venceu, vence } of C.faturasParaDecidir(st(), hoje)) if (!vistos[`dec|${cartao.id}|${m}`]) out.push({ k: `dec|${cartao.id}|${m}`, cor: venceu ? 'vermelho' : 'amarelo', ic: venceu ? '⚠️' : '💳', txt: venceu ? `A fatura <b>${esc(nomeCartao(cartao))}</b> de ${C.MESES_LONGOS[+m.slice(5) - 1]} <b>venceu dia ${vence.getDate()} de ${C.MESES_LONGOS[vence.getMonth()]}</b> com ${brl(f.aberto)} em aberto. <a href="#cartoes" data-a="decidir-fatura" data-id="${cartao.id}" data-m="${m}">Escolher o que fazer</a>` : `A fatura <b>${esc(nomeCartao(cartao))}</b> de ${C.MESES_LONGOS[+m.slice(5) - 1]} fechou dia ${fechou.getDate()} de ${C.MESES_LONGOS[fechou.getMonth()]}${vence ? ` e vence dia ${vence.getDate()}` : ''}, com ${brl(f.aberto)} em aberto. <a href="#cartoes" data-a="decidir-fatura" data-id="${cartao.id}" data-m="${m}">Escolher o que fazer</a>` });
  for (const v of C.proximosVencimentos(st(), hoje, 7)) {
    const k = `venc|${v.tipo}|${v.ref}|${v.mes || ''}`; if (vistos[k]) continue;
    const dias = Math.round((v.data - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 864e5);
    const quando = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
    out.push({ k, cor: 'azul', ic: '📅', txt: v.tipo === 'fatura' ? `Olha o cartão chegando! A <b>${esc(v.nome.toLowerCase())}</b> vence ${quando} (${brl(v.valor)}). Dá uma conferida?` : `Passando para lembrar: <b>${esc(v.nome)}</b> vence ${quando} (${brl(v.valor)}). Já deixou isso organizado?` });
  }
  return out;
}
function telaInicio() {
  const ms = [C.mesAtual()]; const r = C.resumo(st(), ms); const rows = C.porCategoria(st(), ms);
  const vis = rows.filter((x) => x.cat.tipo === 'despesa' && x.orcado > 0).sort((a, b) => (b.real / b.orcado) - (a.real / a.orcado));
  const passaram = vis.filter((x) => x.real > x.orcado).length;
  const desp = rows.filter((x) => x.cat.tipo === 'despesa' && x.real > 0).sort((a, b) => b.real - a.real);
  const totDesp = C.sum(desp, (x) => x.real);
  const ultimos = [...st().lancamentos].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).slice(0, 5);
  const leg = ui.legendaToda ? desp : desp.slice(0, 4);
  return `
  <h1 class="titulo-pag">Início</h1>
  ${st().settings.exclusaoEm ? `<div class="aviso-fatura vencida"><div class="af-txt"><b>Sua conta será excluída em ${new Date(st().settings.exclusaoEm).toLocaleDateString('pt-BR')}</b><div class="mini">Depois disso, os dados são apagados para sempre.</div></div><button class="btn branco pequeno" data-a="cancelar-exclusao">Cancelar exclusão</button></div>` : ''}
  <div class="topo-saldo">
    ${(() => { const sc = C.saldoConta(st()); return `<button class="kpi-saldo ${sc < 0 ? 'negativo' : ''}" data-a="saldo-conta"><div class="rot">Na conta</div><div class="val num">${brl(sc)}</div></button>`; })()}
    <div class="kpi-apagar ${r.pendente > 0 ? 'tem' : ''}"><div class="rot">A pagar</div><div class="val num">${brl(r.pendente)}</div></div>
  </div>
  ${(() => { const falta = r.pendente - C.saldoConta(st()); return falta > 0.005 ? `<div class="aviso-falta">Faltam <b>${brl(falta)}</b> na conta para pagar tudo deste mês</div>` : ''; })()}
  <div class="card bloco-pizza"><div class="linha-acao" style="margin:0 0 8px"><h3>Para onde foi o dinheiro</h3><a class="link-mais" href="#relatorios">Análise ›</a></div>
    ${desp.length ? `<div class="pizza-wrap">${rosca(desp.map((x) => ({ nome: x.cat.nome, valor: x.real, cor: x.cat.cor })), totDesp)}
      <div class="legenda">${leg.map((x) => `<div><span><span class="ponto" style="background:${x.cat.cor}"></span>${esc(x.cat.nome)}</span><span class="pc">${pct(x.real / totDesp)}</span></div>`).join('')}
      ${desp.length > 4 ? `<button class="link-mais" data-a="legenda-toggle" style="justify-self:start">${ui.legendaToda ? 'Ver menos' : `Ver mais (${desp.length - 4})`}</button>` : ''}</div></div>` : '<p class="mini" style="margin:0">Nenhum gasto neste período ainda.</p>'}</div>
  <div class="linha-acao"><h3>Últimos lançamentos</h3><a class="link-mais" href="#lancamentos">Ver todos ›</a></div>
  ${ultimos.length ? `<div class="lista">${ultimos.slice(0, 3).map((l) => itemMov(movDeLanc(l))).join('')}</div>` : '<p class="mini">Seus lançamentos aparecem aqui.</p>'}
`;
}
const kpiIr = (rot, v, cor, ir) => `<button class="kpi ${cor} kpi-ir" data-a="kpi-ir" data-v="${ir}"><div class="rot">${rot}</div><div class="val num">${brl(v)}</div></button>`;
const kpi = (rot, v, cor) => `<div class="kpi ${cor}"><div class="rot">${rot}</div><div class="val num">${brl(v)}</div></div>`;
const vazio = (ic, t) => `<div class="card vazio"><div class="grande">${ic}</div>${t}</div>`;
function orcLinha(x) {
  const p = x.orcado > 0 ? x.real / x.orcado : 0;
  const cls = p > 1 ? 'estourou' : p >= 0.85 ? 'alerta' : '';
  const msg = p > 1 ? `<span class="neg">Passou ${brl(x.real - x.orcado)}</span>` : x.real === x.orcado ? '<span style="color:#C76E00">Chegou no limite</span>' : `Ainda pode gastar <b>${brl(x.orcado - x.real)}</b>`;
  return `<div class="orc" data-a="ver-cat" data-id="${x.cat.id}">
    <div class="linha1"><span><span class="ponto" style="background:${x.cat.cor}"></span>${esc(x.cat.nome)}</span><span class="num"><b>${brl0(x.real)}</b> <span class="mini">de ${brl0(x.orcado)}</span></span></div>
    <div class="prog ${cls}"><i style="width:${Math.min(100, Math.round(p * 100))}%"></i></div>
    <div class="linha2"><span>${msg}</span><span>${Math.round(p * 100)}%</span></div></div>`;
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
  if (x.status === 'pendente' || (x.status === 'previsto' && x.tipo === 'despesa')) tags.push('<span class="tag laranja">a pagar</span>');
  if (x.status === 'a receber') tags.push('<span class="tag laranja">a receber</span>');
  const det = [catNome(x.categoriaId), x.forma, x.banco, x.data ? x.data.split('-').reverse().join('/') : ''].filter(Boolean).join(' · ');
  return `<div class="item" data-a="abrir-mov" data-origem="${x.origem}" data-id="${x.id}">
    ${bolaCat(cat(x.categoriaId) || { nome: catNome(x.categoriaId), cor })}
    <div class="meio"><div class="titulo">${esc(x.descricao || catNome(x.categoriaId))}${tags.join('')}</div><div class="det">${esc(det)}</div></div>
    <div class="valor num ${corV}">${sinal} ${brl(x.valor)}</div></div>`;
}
function telaLancamentos() {
  const ms = meses();
  let movs = ms.flatMap((m) => C.movimentosDoMes(st(), m));
  if (ui.filtroTipo === 'fixos') movs = movs.filter((x) => x.origem === 'fixo');
  else if (ui.filtroTipo !== 'todos') movs = movs.filter((x) => x.tipo === ui.filtroTipo);
  if (ui.filtroCat) movs = movs.filter((x) => x.categoriaId === ui.filtroCat);
  if (ui.busca) { const b = ui.busca.toLowerCase(); movs = movs.filter((x) => (x.descricao + ' ' + catNome(x.categoriaId) + ' ' + (x.forma || '') + ' ' + (x.banco || '')).toLowerCase().includes(b)); }
  const chave = (x) => [x.data || (x.criadoEm || '').slice(0, 10), x.criadoEm || ''];
  const recentes = (a, b) => { const [da, ca] = chave(a), [db, cb] = chave(b); return db.localeCompare(da) || cb.localeCompare(ca); };
  const porMes = ms.slice().reverse().map((m) => [m, movs.filter((x) => x.mes === m).sort(recentes)]).filter(([, l]) => l.length);
  const tot = (t) => C.sum(movs.filter((x) => x.tipo === t), (x) => x.valor);
  return `
  <div class="titulo-linha"><h1>Lançamentos</h1><button class="link-importar" data-a="importar-extrato">Importar extrato</button></div>
  ${filtroPeriodo()}
  <hr class="fina">
  <div class="filtros-linha"><button class="lupa ${ui.buscaAberta || ui.busca ? 'ativo' : ''}" data-a="abrir-busca" aria-label="Buscar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button><div class="chips chips-tipo">${[['todos', 'Tudo'], ['despesa', 'Despesas'], ['entrada', 'Entradas'], ['guardar', 'Guardado'], ['fixos', 'Fixos']].map(([t, n]) => `<button class="chip ${ui.filtroTipo === t ? 'ativo' : ''}" data-a="filtro-tipo" data-v="${t}">${n}</button>`).join('')}
    ${ui.filtroCat ? `<button class="chip ativo" data-a="filtro-cat-limpa">${esc(catNome(ui.filtroCat))} ×</button>` : ''}</div></div>
  ${ui.filtroTipo === 'fixos' ? '<div class="fixos-dica"><span></span><span style="display:flex;gap:6px"><button class="btn verde pequeno" data-a="novo-salario">+ Renda</button><button class="btn pequeno" data-a="novo-fixo">+ Fixo</button></span></div>' : ''}
  ${ui.buscaAberta || ui.busca ? `<input class="inp" placeholder="Buscar..." data-a="busca" value="${esc(ui.busca)}" style="margin-bottom:12px">` : ''}
  ${porMes.length ? porMes.map(([m, l]) => `<div class="grupo-mes">${C.nomeMes(m, true)}</div><div class="lista">${l.map(itemMov).join('')}</div>`).join('') : vazio('🔎', 'Nada por aqui neste período.')}
  `;
}

// ---------------- Cartões ----------------
function telaCartoes() {
  const ms = meses();
  const cartoes = st().cartoes;
  const semCartao = st().compras.some((c) => !c.cartaoId);
  const todos = [...cartoes, ...(semCartao ? [{ id: '', nome: 'Sem cartão definido', cor: '#AFAFAF', tipo: 'credito' }] : [])];
  if (!todos.some((c) => c.id === ui.cartaoSel)) ui.cartaoSel = todos[0]?.id;
  const sel = todos.find((c) => c.id === ui.cartaoSel);
  const temCred = (c) => ehCredito(c); const temDeb = (c) => c.id && (c.tipo === 'debito' || c.tipo === 'ambos');
  if (sel) { const abas = [temCred(sel) && 'fatura', temDeb(sel) && 'debito'].filter(Boolean); if (!abas.includes(ui.abaCartao)) ui.abaCartao = abas[0]; }
  const totMes = (cid, m) => C.fatura(st(), cid, m).total;
  const debitos = (c) => ms.flatMap((m) => C.movimentosDoMes(st(), m)).filter((x) => x.tipo !== 'entrada' && (x.forma === 'Débito' || x.forma === 'Pix') && c.banco && x.banco === c.banco);
  const convite = (c) => temCred(c) && temDeb(c) ? 'Ver fatura e débito' : temDeb(c) ? 'Ver débito' : 'Ver fatura';
  let painel = '';
  if (sel) {
    const abas = [temCred(sel) && ['fatura', 'Fatura (crédito)'], temDeb(sel) && ['debito', 'Débito']].filter(Boolean);
    const cab = `<div class="linha-acao" style="margin:26px 0 12px"><h2 style="margin:0"><span class="ponto" style="background:${sel.cor || '#AFAFAF'}"></span>${esc(nomeCartao(sel))}</h2></div>
      ${abas.length > 1 ? `<div class="seg abas-cartao" style="margin-bottom:14px">${abas.map(([k, n]) => `<button type="button" class="t-neutro ${ui.abaCartao === k ? 'ativo' : ''}" data-a="aba-cartao" data-v="${k}">${n}</button>`).join('')}</div>` : ''}`;
    if (ui.abaCartao === 'debito') {
      const ds = debitos(sel); const tot = C.sum(ds.map((x) => x.valor));
      painel = cab + `<div class="card"><div class="linha-acao" style="margin:0 0 10px"><h3>Gastos no débito</h3><span class="num" style="font-weight:900;font-size:18px">${brl(tot)}</span></div>
        ${ds.length ? `<div class="lista">${ds.map(itemMov).join('')}</div>` : `<p class="mini">Nada no débito neste período.</p>`}</div>`;
    } else {
      const fs = ms.slice().reverse().map((m) => ({ m, f: C.fatura(st(), sel.id, m) })).filter((x) => x.f.total > 0);
      painel = cab + (fs.length ? fs.map(({ m, f }) => `<div class="grupo-mes">${C.nomeMes(m, true)}</div>${blocoFatura(sel, f, m)}`).join('') : vazio('💳', 'Nenhuma fatura neste período.'))
;
    }
  }
  return `
  <div class="linha-acao" style="margin-top:0"><h1>Cartões</h1><button class="btn verde pequeno" data-a="nova-compra">+ Compra no cartão</button></div>
  ${bannerFaturas()}
  ${filtroPeriodo()}

  <div class="cartoes-fila">${todos.map((c) => `<div class="cc cartao ${c.id === ui.cartaoSel ? 'sel' : ''}" style="background:${c.cor || '#268AFF'}" data-a="ver-cartao" data-id="${c.id}" role="button" aria-pressed="${c.id === ui.cartaoSel}">
      <div class="cc-l1"><span class="cc-nome">${esc(nomeCartao(c))}</span>${c.id ? `<button class="cc-editar" data-a="editar-cartao" data-id="${c.id}" aria-label="Editar cartão">✎</button>` : ''}</div>
      <div class="cc-tipo">${c.id ? esc(nomeTipoCartao(c.tipo)) : 'Sem cartão'}</div><span class="cc-chip"></span>
      <div class="cc-l3">${temCred(c) ? `<span class="cc-venc">${c.vencimento ? `Vence ${c.vencimento} ${C.MESES_CURTOS[+C.addMes(mesRef(), 1).slice(5) - 1]}` : 'Fatura'}</span>${(() => { const fz = C.fatura(st(), c.id, mesRef()); return fz.total <= 0 ? '<span class="cc-venc">sem compras</span>' : fz.aberto <= 0 ? '<span class="cc-val">Paga ✓</span>' : `<span class="cc-val num"><small>falta</small>${brl(fz.aberto)}</span>`; })()}` : '<span class="cc-venc">Ver débito ›</span>'}</div></div>`).join('')}
    <button class="cc cartao cc-novo" data-a="novo-cartao">+ Adicionar cartão</button>
  </div>
  ${todos.length ? painel : vazio('💳', 'Cadastre um cartão ou lance uma compra.')}`;
}
function bannerFaturas() {
  const ocultas = ui.faturasOcultas ||= new Set();
  return C.faturasParaDecidir(st(), hoje).filter(({ cartao, m }) => !ocultas.has(`${cartao.id}|${m}`)).map(({ cartao, m, f, fechou, venceu, vence }) => `<div class="aviso-fatura ${venceu ? 'vencida' : ''}">
    <div class="af-txt"><b>Fatura ${esc(nomeCartao(cartao))} de ${C.MESES_LONGOS[+m.slice(5) - 1]} ${venceu ? `venceu dia ${vence.getDate()}` : `fechou dia ${fechou.getDate()} ${C.MESES_CURTOS[fechou.getMonth()]}`}</b><div class="mini">${!venceu && vence ? `vence ${vence.getDate()} ${C.MESES_CURTOS[vence.getMonth()]} · ` : ''}${brl(f.aberto)} em aberto</div></div>
    <button class="btn verde pequeno" data-a="decidir-fatura" data-id="${cartao.id}" data-m="${m}">Escolher</button>
    <button class="af-x" data-a="ocultar-aviso-fatura" data-k="${cartao.id}|${m}" aria-label="Fechar aviso">×</button></div>`).join('');
}
const textoDecisao = (d, m) => d.acao === 'paguei' ? 'Você marcou que pagou esta fatura.'
  : d.acao === 'passar' ? `${brl(d.principal)} passou para a fatura de ${C.nomeMes(C.addMes(m, 1))}${d.juros > 0 ? `, com ${brl(d.juros)} de juros` : ''}.`
  : `${brl(d.principal)} parcelado em ${d.parcelas}x de ${brl(d.parcela)} a partir de ${C.nomeMes(C.addMes(m, 1))}${d.juros > 0 ? ` (${brl(d.juros)} de juros no total)` : ' (sem juros)'}.`;
function blocoFatura(c, f, m) {
  const k = `${c.id || 'sem'}|${m}`; const aberta = (ui.faturasAbertas ||= new Set()).has(k); const n = f.itens.length;
  return `<div class="card fatura ${aberta ? 'aberta' : ''}">
    <div class="fatura-topo">
    <div class="linha-acao" style="margin:0 0 4px"><h3><span class="ponto" style="background:${c.cor || '#AFAFAF'}"></span>${esc(nomeCartao(c))}${c.vencimento ? `<span class="mini" style="font-weight:700;margin-left:6px">vence ${c.vencimento} ${C.MESES_CURTOS[+C.addMes(m, 1).slice(5) - 1]}</span>` : ''}</h3><span class="fat-valores"><span class="num fat-total">${brl(f.total)}</span>${f.pago > 0 ? `<span class="num fat-pago">${brl(f.pago)} pago</span>` : ''}</span></div>
    <div class="prog ${f.paga ? '' : 'azul'}" style="margin:8px 0 6px"><i style="width:${f.total ? Math.round((f.pago / f.total) * 100) : 0}%"></i></div>
    <div class="mini" style="display:flex;justify-content:flex-end;margin-bottom:10px"><span>${f.decisao && f.decisao.acao !== 'paguei' && f.aberto <= 0 ? `<b style="color:var(--azul)">${f.decisao.acao === 'passar' ? 'Passou para o próximo mês' : 'Parcelada'}</b>` : f.paga ? '<b class="pos">Fatura paga ✓</b>' : `<b class="neg">Falta ${brl(f.aberto)}</b>`}</span></div>
    </div>
    <div class="pagar-fatura">
      <label><span>Quanto falta pagar <small style="text-transform:none;font-weight:600">(como está no app do banco)</small></span><input class="inp num" inputmode="decimal" placeholder="R$ 0,00" value="${f.paga ? '' : valorInput(Math.max(0, f.aberto))}" data-valor-fatura="${k}" data-total="${f.total}"></label>
      <button class="btn pequeno" data-a="fatura-valor" data-k="${k}">Salvar</button>
      ${f.paga ? `<button class="btn branco pequeno" data-a="fatura-valor-limpa" data-k="${k}">Desfazer</button>` : `<button class="btn verde pequeno" data-a="fatura-tudo-pago" data-k="${k}" data-id="${c.id}" data-m="${m}">Paguei tudo</button>`}
    </div>
    <div class="fatura-ver" data-a="fatura-toggle" data-k="${k}">${aberta ? 'Esconder compras' : `Ver ${n} ${n === 1 ? 'compra' : 'compras'}`}<span class="seta">▾</span></div>
    <div class="fatura-corpo ${aberta ? '' : 'oculto'}">
    <div class="lista" style="margin-top:10px">${f.itens.map(({ compra, parcela }) => `<div class="item" ${compra.transferencia ? 'style="cursor:default"' : compra.fixo ? `data-a="editar-fixo" data-id="${compra.recId}"` : `data-a="editar-compra" data-id="${compra.id}"`}>
      <div class="meio"><div class="titulo">${esc(compra.descricao)}</div><div class="det">${compra.transferencia ? 'veio da fatura anterior · não é gasto novo' : esc(catNome(compra.categoriaId))}${compra.fixo ? ' · fixo todo mês' : parcela.de > 1 ? ` · parcela ${parcela.numero}/${parcela.de}` : ' · à vista'}</div></div>
      <div class="valor num">${brl(parcela.valor)}</div></div>`).join('')}</div>
    </div>
    ${f.decisao ? `<div class="decisao-info"><span>${textoDecisao(f.decisao, m)}</span><button class="btn fantasma pequeno" data-a="desfazer-decisao" data-id="${c.id}" data-m="${m}">Desfazer</button></div>`
      : f.aberto > 0 ? `<button class="btn-parcelar" data-a="decidir-fatura" data-id="${c.id}" data-m="${m}">Não deu para pagar tudo? <b>Passar ou parcelar ›</b></button>` : ''}
    </div>`;
}
function comprometido(cartaoId) {
  const m0 = C.mesAtual(); let t = 0;
  for (const c of st().compras) if (c.cartaoId === cartaoId) for (const p of C.parcelasDaCompra(c)) if (C.difMeses(m0, p.mes) >= 0 && !(st().settings.faturasPagas || {})[`${cartaoId}|${p.mes}`]) t += C.cents(p.valor);
  return C.fromCents(t);
}

// ---------------- Planejamento ----------------
function telaPlano() {
  const m = C.mesAtual();
  const todasRendas = st().recorrencias.filter((r) => r.tipo === 'entrada');
  const sucessor = (r) => r.fim && todasRendas.find((x) => x !== r && x.categoriaId === r.categoriaId && (x.nome || '') === (r.nome || '') && x.inicio === C.addMes(r.fim, 1));
  const anterior = (r) => todasRendas.find((x) => x !== r && sucessor(x) === r);
  const rendas = todasRendas.filter((r) => (!r.fim || C.difMeses(m, r.fim) >= 0) && !sucessor(r)).sort((a, b) => b.valor - a.valor);
  const fixos = st().recorrencias.filter((r) => r.tipo !== 'entrada' && (!r.fim || C.difMeses(m, r.fim) >= 0)).sort((a, b) => b.valor - a.valor);
  const noMes = (r) => C.recorrenciaNoMes(r, m) && r.ativa !== false;
  // por mês: tudo que está valendo ou vai começar (mesmo que comece no mês que vem); anual conta 1/12
  const porMes = (r) => (r.frequencia === 'anual' ? r.valor / 12 : r.valor);
  const entra = C.sum(rendas.filter((r) => r.ativa !== false), porMes); const sai = C.sum(fixos.filter((r) => r.ativa !== false), porMes);
  const aba = ui.abaPlano || 'limites';
  const abas = `<div class="seg abas-plano">${[['limites', 'Limites'], ['fixos', 'Renda e fixos']].map(([k, n]) => `<button type="button" class="t-neutro ${aba === k ? 'ativo' : ''}" data-a="aba-plano" data-v="${k}">${n}</button>`).join('')}</div>`;
  if (aba === 'fixos') {
    const linhaFixo = (r, entrada) => `<div class="item" data-a="editar-fixo" data-id="${r.id}">${bolaCat(cat(r.categoriaId) || { nome: r.nome, cor: entrada ? '#77C800' : '#AFB8C4' }, 'width:34px;height:34px;border-radius:10px')}
      <div class="meio"><div class="titulo">${esc(r.nome || catNome(r.categoriaId))}${r.ativa === false ? '<span class="tag">pausado</span>' : ''}</div>
        <div class="det">${anterior(r) && C.difMeses(m, r.inicio) > 0 ? `desde ${C.nomeMes(r.inicio)} (era ${brl0(anterior(r).valor)})` : C.difMeses(m, r.inicio) > 0 ? 'começa ' + C.nomeMes(r.inicio) : 'todo mês'}${r.fim ? ` · até ${C.nomeMes(r.fim)}` : ''}${entrada && r.diaVenc ? ` · cai dia ${r.diaVenc}` : ''}</div></div>
      <div style="text-align:right"><div class="valor num ${entrada ? 'pos' : ''}">${entrada ? '+' : '−'}${brl(r.valor)}</div>${!entrada && r.tipo !== 'guardar' && r.forma !== 'Crédito' && noMes(r) ? `<label class="chave mini" data-stop="1"><input type="checkbox" data-a="fixo-pago" data-id="${r.id}" data-m="${m}" ${(r.pagos || {})[m] ? 'checked' : ''}> pago</label>` : ''}</div></div>`;
    return `<h1>Planejamento</h1>${abas}
    <div class="mini" style="margin:-2px 0 6px;font-weight:800">Por mês</div><div class="resumo-fixos"><div><span>Entra</span><b class="pos num">${brl0(entra)}</b></div><div><span>Sai</span><b class="num">${brl0(sai)}</b></div><div><span>Sobra</span><b class="num ${entra - sai < 0 ? 'neg' : ''}">${brl0(entra - sai)}</b></div></div>
    <div class="card bloco-fixo entra"><div class="linha-acao" style="margin:0 0 8px"><h3>Entra todo mês</h3><button class="btn verde pequeno" data-a="novo-salario">+ Renda</button></div>
      ${rendas.length ? `<div class="lista rendas">${rendas.map((r) => linhaFixo(r, true)).join('')}</div>` : '<p class="mini" style="margin:0">Salário, freela fixo...</p>'}</div>
    <div class="card bloco-fixo sai"><div class="linha-acao" style="margin:0 0 8px"><h3>Sai todo mês</h3><button class="btn pequeno" data-a="novo-fixo">+ Fixo</button></div>
      ${fixos.length ? `<div class="lista rendas">${fixos.map((r) => linhaFixo(r, false)).join('')}</div>` : '<p class="mini" style="margin:0">Academia, assinaturas, dízimo...</p>'}</div>`;
  }
  const rows = C.porCategoria(st(), [m]);
  const ordem = (a, b) => { const pa = a.orcado > 0 ? a.real / a.orcado : -1, pb = b.orcado > 0 ? b.real / b.orcado : -1; return pb - pa || ordemCat(a.cat, b.cat); };
  const desp = rows.filter((x) => x.cat.tipo === 'despesa').sort((a, b) => ordemCat(a.cat, b.cat)); const gua = rows.filter((x) => x.cat.tipo === 'guardar').sort((a, b) => ordemCat(a.cat, b.cat));
  const comLim = desp.filter((x) => x.orcado > 0); const passou = comLim.filter((x) => x.real > x.orcado).length;
  const totOrc = C.sum(comLim, (x) => x.orcado); const totReal = C.sum(comLim, (x) => x.real);
  const linhaLim = (x) => `<div class="lim-linha">${bolaCat(x.cat)}<div class="meio"><div class="titulo" style="margin:0">${esc(x.cat.nome)}</div></div>
      <label class="lim-campo"><input class="inp num lim-inp" inputmode="decimal" placeholder="—" value="${x.cat.orcamento ? valorInput(x.cat.orcamento) : ''}" data-a="orc" data-id="${x.cat.id}" aria-label="Limite de ${esc(x.cat.nome)}"></label></div>`;
  return `<h1>Planejamento</h1>${abas}
  <div class="lim-titulo"><h3>Quanto quero gastar</h3>${passou ? `<a class="tag-neg" href="#relatorios" data-a="ver-passou">${passou} ${passou > 1 ? 'passaram' : 'passou'} do limite ›</a>` : comLim.length ? '<span class="tag-pos">tudo dentro</span>' : ''}</div>
  <button class="btn branco pequeno ver-gastos" data-a="ver-passou">Ver quanto gastei ›</button>
  <div class="grupo-mes lim-cab"><span>Gastos</span><span>Limite por mês</span></div>
  <div class="lista lim-lista">${desp.map(linhaLim).join('')}</div>
  ${gua.length ? `<div class="grupo-mes lim-cab"><span>Guardar</span><span>Meta por mês</span></div><div class="lista lim-lista">${gua.map(linhaLim).join('')}</div>` : ''}`;
}

// ---------------- Relatórios ----------------
function telaRelatorios() {
  const S = st(); const ms = meses(); const ult = ms[ms.length - 1]; const cur = C.mesAtual();
  const r = C.resumo(S, ms);
  const P = (v) => `${Math.round(v * 100)}%`;
  const mesNome = (m) => C.nomeMes(m, true).split(' ')[0];
  if (!(r.entradas > 0 || r.despesas > 0)) return `<h1>Análise</h1>${filtroPeriodo()}${vazio('📊', 'Lance algumas coisas para ver sua análise aqui.')}`;
  // 1. destaque principal
  const sobra = r.entradas - r.despesas - r.guardado;
  const noAtual = ms.length === 1 && ult === cur;
  const livre = noAtual ? C.saldoConta(S) - r.pendente : sobra;
  const gP = r.entradas > 0 && r.guardado > 0 ? ` · guardou ${P(r.guardado / r.entradas)} do que entrou` : '';
  const [big, frase, tom] = noAtual
    ? (livre < 0 ? [`−${brl(-livre)}`, `vai faltar para pagar o que falta este mês${gP}`, 'vermelho'] : [brl(livre), `livres depois de pagar tudo deste mês${gP}`, 'verde'])
    : (sobra < 0 ? [`−${brl(-sobra)}`, `gastou mais do que entrou${gP}`, 'vermelho'] : [brl(sobra), `sobrou do que entrou${gP}`, 'verde']);
  const heroi = `<div class="an-heroi ${tom}"><div class="an-big num">${big}</div><div class="an-frase">${frase}</div>
    <div class="an-trio">${[['Entrou', r.entradas, 'entrada'], ['Gastou', r.despesas, 'despesa'], ['Guardou', r.guardado, 'metas']].map(([n, v, ir]) => `<button data-a="kpi-ir" data-v="${ir}" class="${ir === 'despesa' && (livre < 0 || r.despesas + r.guardado > r.entradas) ? 'gasto-alto' : ''}"><span>${n}</span><b class="num">${brl(v)}</b></button>`).join('')}</div></div>`;
  // 2. para onde foi (top 3)
  const desp = C.porCategoria(S, ms).filter((x) => x.cat.tipo === 'despesa' && x.real > 0).sort((a, b) => b.real - a.real);
  const totD = C.sum(desp, (x) => x.real) || 1;
  const est = desp.filter((x) => x.orcado > 0 && x.real > x.orcado);
  const top = desp.slice(0, ui.anTodas ? 99 : 3).map((x) => { const passou = x.orcado > 0 && x.real > x.orcado; const max = Math.max(desp[0].real, x.orcado || 0);
    return `<button class="an-cat" data-a="filtro-cat-ir" data-id="${x.cat.id}">${bolaCat(x.cat, 'width:36px;height:36px;border-radius:11px')}<div class="meio"><div class="an-cat-l"><span>${esc(x.cat.nome)}</span><b class="num ${passou ? 'neg' : ''}">${brl(x.real)}</b></div>
      <div class="an-barra"><i style="width:${x.real / max * 100}%;background:${passou ? 'var(--vermelho)' : x.cat.cor}"></i>${x.orcado > 0 ? `<em style="left:${x.orcado / max * 100}%"></em>` : ''}</div>
      ${passou ? `<div class="an-passou">Passou ${brl(x.real - x.orcado)} do limite</div>` : ''}</div></button>`; }).join('');
  const onde = desp.length ? `<div class="card an-card"><div class="an-cab"><div><div class="an-big2 num">${P(desp[0].real / totD)}</div><div class="an-frase2">dos gastos foram em <b>${esc(desp[0].cat.nome)}</b></div></div>
    ${est.length ? `<span class="an-alerta">${est.length} passou do limite</span>` : ''}</div><div class="an-cats">${top}</div>
    ${desp.length > 3 ? `<button class="link-mais an-mais" data-a="an-todas">${ui.anTodas ? 'Ver menos' : `Ver todas (${desp.length})`}</button>` : ''}</div>` : '';
  // 3. destaques
  const linhas = [];
  if (ms.length === 1) { const ant = C.addMes(ult, -1); const ra = C.resumo(S, [ant]);
    const nAnt = C.movimentosDoMes(S, ant).filter((x) => x.tipo === 'despesa').length;
    if (ra.despesas > 0 && r.despesas > 0 && nAnt >= 5 && ra.despesas >= r.despesas * 0.25) { const d = r.despesas / ra.despesas - 1; const dif = r.despesas - ra.despesas;
      linhas.push([Math.abs(d) < 0.03 ? 'Igual' : Math.abs(d) > 1 ? `${dif > 0 ? '+' : '−'}${brl(Math.abs(dif))}` : `${d > 0 ? '+' : '−'}${P(Math.abs(d))}`, d > 0.03 ? 'neg' : 'pos', Math.abs(d) < 0.03 ? `gastos parecidos com ${mesNome(ant)}` : `de gastos ${d > 0 ? 'a mais' : 'a menos'} que em ${mesNome(ant)}`]); } }
  const fixos = C.sum(ms.flatMap((m) => C.movimentosDoMes(S, m)).filter((x) => x.origem === 'fixo' && x.tipo === 'despesa'), (x) => x.valor);
  if (r.entradas > 0 && fixos > 0) linhas.push([P(fixos / r.entradas), fixos / r.entradas > 0.6 ? 'neg' : 'lar', 'da renda já vai para contas fixas']);
  if (r.pendente > 0) linhas.push([brl(r.pendente), 'neg', 'ainda a pagar']);
  const dest = linhas.length ? `<div class="card an-card"><div class="an-rot">Destaques</div>${linhas.map(([n, c, t]) => `<div class="an-dest"><b class="num ${c}">${n}</b><span>${t}</span></div>`).join('')}</div>` : '';
  // evolução (escondida)
  let seis = C.rangeMeses(C.addMes(ult, -5), ult); let rs = seis.map((m) => C.resumo(S, [m]));
  while (seis.length > 2 && !(rs[0].entradas || rs[0].despesas)) { seis = seis.slice(1); rs = rs.slice(1); }
  const mx = Math.max(1, ...rs.map((x) => Math.max(x.entradas, x.despesas)));
  const evo = seis.length >= 2 ? (ui.anEvo ? `<div class="card an-card"><div class="an-rot">Evolução</div><div class="an-evo">${seis.map((m, k) => `<div class="an-evo-col"><div class="an-evo-barras"><i style="height:${rs[k].entradas / mx * 100}%;background:#77C800"></i><i style="height:${rs[k].despesas / mx * 100}%;background:#FF9600"></i></div><span>${C.MESES_CURTOS[Number(m.slice(5, 7)) - 1]}</span></div>`).join('')}</div>
      <div class="an-leg"><span><i style="background:#77C800"></i>Entrou</span><span><i style="background:#FF9600"></i>Gastou</span></div><button class="link-mais an-mais" data-a="an-evo">Esconder</button></div>`
    : `<button class="btn branco an-ver-evo" data-a="an-evo">Ver evolução dos meses</button>`) : '';
  return `<h1>Análise</h1>${filtroPeriodo()}${heroi}${onde}${dest}${evo}`;
}
function telaMetas() {
  return `<div class="linha-acao" style="margin-top:0"><h1>Metas</h1><button class="btn verde pequeno" data-a="nova-meta">+ Nova meta</button></div>
  
  ${st().metas.length ? st().metas.map((mt) => { const p = C.progressoMeta(st(), mt); const cm = cat(mt.categoriaId); return `<div class="card">
    <div class="linha-acao" style="margin:0 0 10px"><h3 style="display:flex;align-items:center;gap:10px">${cm ? bolaCat(cm, 'width:32px;height:32px;border-radius:10px') : ''}${esc(mt.nome)}</h3><span style="display:flex;align-items:center;gap:8px"><span class="num" style="font-weight:900">${p.alvo ? pct(p.pct) : ''}</span><button class="cc-editar meta-editar" data-a="editar-meta" data-id="${mt.id}" aria-label="Editar meta">✎</button></span></div>
    ${p.alvo ? '' : `<div class="meta-alvo"><label><small>Já tenho</small><input class="inp num" inputmode="decimal" placeholder="R$ 0,00" value="${mt.valorInicial ? valorInput(mt.valorInicial) : ''}" data-meta-ini="${mt.id}"></label><label><small>Quero juntar</small><input class="inp num" inputmode="decimal" placeholder="R$ 0,00" data-meta-alvo="${mt.id}"></label><button class="btn pequeno" data-a="meta-alvo-ok" data-id="${mt.id}">Salvar</button></div>`}
    <div class="prog" style="height:18px"><i style="width:${Math.round(p.pct * 100)}%"></i></div>
    <div class="orc" style="padding:8px 0 0;border:none"><div class="linha2"><span>${brl(p.atual)}${p.alvo ? ` de ${brl(p.alvo)}` : ''}</span><span>${p.alvo ? `faltam ${brl(p.falta)}` : ''}${mt.dataAlvo ? ` · até ${C.nomeMes(mt.dataAlvo)}` : ''}</span></div></div>
    ${mt.dataAlvo && p.falta > 0 ? `<div class="mini" style="margin-top:6px">Para chegar a tempo: ${brl(p.falta / Math.max(1, C.difMeses(C.mesAtual(), mt.dataAlvo) + 1))} por mês</div>` : ''}</div>`; }).join('') : vazio('🎯', 'Crie sua primeira meta.')}`;
}

// ---------------- Categorias ----------------
function telaCategorias() {
  const grupo = (t, n) => { const cs = st().categorias.filter((c) => c.tipo === t).sort(ordemCat); return `<div class="grupo-mes">${n}</div><div class="lista">${cs.map((c) => `<div class="item" data-a="editar-cat" data-id="${c.id}">
    ${bolaCat(c)}<div class="meio"><div class="titulo">${esc(c.nome)}${c.arquivada ? '<span class="tag">arquivada</span>' : ''}</div><div class="det">${c.orcamento ? `orçamento ${brl(c.orcamento)}/mês` : ''}</div></div></div>`).join('')}</div>`; };
  const aba = ui.abaCats || 'cats';
  const abas = `<div class="seg abas-cats">${[['cats', 'Categorias'], ['bancos', 'Meus bancos']].map(([k, n]) => `<button type="button" class="t-neutro ${aba === k ? 'ativo' : ''}" data-a="aba-cats" data-v="${k}">${n}</button>`).join('')}</div>`;
  if (aba === 'bancos') return `<h1>Categorias e bancos</h1>${abas}
    <div class="card"><p class="mini" style="margin:0 0 10px">Marque os bancos que você usa.</p>${chipsBancos(st().settings.bancos || [])}
    <div style="display:flex;gap:8px;margin-top:12px"><input autocapitalize="sentences" class="inp" id="novo-banco" placeholder="Não achou? Digite o nome"><button class="btn pequeno" data-a="banco-add">Adicionar</button></div></div>`;
  return `<div class="linha-acao" style="margin-top:0"><h1>Categorias e bancos</h1><button class="btn pequeno" data-a="nova-cat">+ Nova</button></div>${abas}
  ${grupo('despesa', 'Despesas')}${grupo('guardar', 'Guardar')}${grupo('entrada', 'Entradas')}`;
}

// ---------------- Mais / Configurações ----------------
function blocoPush() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'indisponivel';
  if (store.modo === 'local') return '<p class="mini">Indisponível no modo de teste.</p>';
  if (!VAPID_KEY) return '<p class="mini">Em breve: avisos de fatura e do dia do salário no celular.</p>';
  if (ios && !instalado) return '<p class="mini">No iPhone, instale o Flui na tela de início (Compartilhar → Adicionar à Tela de Início) e abra por lá para ativar.</p>';
  if (perm === 'denied') return '<p class="mini">As notificações estão bloqueadas nas configurações do celular para este app.</p>';
  if (perm === 'granted' && st().settings.pushAtivo) return '<p class="mini"><b class="pos">Ativadas neste aparelho ✓</b> Fatura fechando, vencendo e o dia do salário.</p><button class="btn branco pequeno" data-a="push-ativar">Ativar de novo</button>';
  return '<p class="mini">Aviso quando a fatura fecha, quando vai vencer e no dia do salário.</p><button class="btn verde pequeno" data-a="push-ativar">Ativar notificações</button>';
}
function telaMais() {
  return `<h1>Mais</h1><div class="lista" style="margin-top:12px">${[['metas', 'Metas', ICON.metas], ['categorias', 'Categorias e bancos', ICON.cats], ['config', 'Configurações', ICON.config]].map(([r, n, i]) => `<a class="item" href="#${r}" style="text-decoration:none;color:inherit"><div class="bola" style="background:var(--azul)"><span style="width:24px;height:24px;display:block">${i}</span></div><div class="meio"><div class="titulo">${n}</div></div><div class="valor">›</div></a>`).join('')}<button class="item" data-a="ver-tour" style="border-top:2px solid var(--linha);width:100%;background:none;border:none;font:inherit;text-align:left;cursor:pointer;color:inherit"><div class="bola" style="background:var(--azul)"><span style="width:24px;height:24px;display:block"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5h.01"/></svg></span></div><div class="meio"><div class="titulo">Ajuda</div><div class="det">Ver o tour do app</div></div><div class="valor">›</div></button></div>`;
}
function telaConfig() {
  const s = st().settings;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<h1>Configurações</h1>

  <div class="card"><h3>Sua conta</h3><p class="mini">${store.modo === 'local' ? 'Modo de teste: os dados ficam só neste navegador.' : `Conectada como <b>${esc(store.user.email)}</b>. Seus dados ficam salvos na sua conta e aparecem em qualquer aparelho em que você entrar.`}</p>
    <div class="campo"><label>Como o Flui te chama</label><input autocapitalize="sentences" class="inp" data-a="nome" value="${esc(s.nome || '')}" placeholder="Seu nome"></div>
    <button class="btn branco pequeno" data-a="sair">Sair da conta</button></div>
  <div class="card"><h3>Instalar na tela inicial</h3>
    ${ui.installEvt ? '<p class="mini">Seu navegador permite instalar o Flui como app.</p><button class="btn pequeno" data-a="instalar">Instalar o Flui</button>' :
      ios ? '<p class="mini">No iPhone: abra no <b>Safari</b>, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>' :
      '<p class="mini">No Android (Chrome): toque nos <b>três pontinhos</b> e em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>. No computador, use o ícone de instalar na barra de endereço.</p>'}</div>
  <div class="card"><h3>Backup</h3><p class="mini">Guarde uma cópia dos seus dados.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn verde pequeno" data-a="baixar-planilha">Baixar planilha (Excel)</button><button class="btn pequeno" data-a="exportar">Baixar backup</button><label class="btn branco pequeno" style="cursor:pointer">Restaurar backup<input type="file" data-a="importar" class="arquivo-oculto"></label></div></div>
  <div class="card"><h3>Apagar dados</h3><p class="mini">Apague tudo, um mês ou uma importação que deu errado.</p><button class="btn branco pequeno" data-a="zerar" style="color:var(--vermelho)">Apagar dados</button></div>
  <div class="card"><h3>Notificações</h3>${blocoPush()}</div>
  ${store.modo === 'local' ? '' : '<button class="btn-excluir" data-a="excluir-conta">Excluir minha conta</button>'}
  <p class="mini" style="text-align:center;margin-top:18px">Flui · versão 1.0</p>`;
}

// ======================= MODAIS =======================
function abrirModal(html, depois) { ui.modal = { html: `<div class="fundo-modal" data-a="fechar-fundo"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`, depois }; render(); }
function fecharModal() { ui.modal = null; render(); }
const topoModal = (t) => `<div class="modal-topo"><h2>${t}</h2><button class="x" type="button" data-a="fechar" aria-label="Fechar">×</button></div>`;
const selBanco = (nome, v) => { const bs = st().settings.bancos || []; if (!v && bs.length === 1) v = bs[0];
  if (!bs.length && !v) return `<input type="hidden" name="${nome}" value=""><div class="mini" style="padding:10px 0">Você ainda não escolheu seus bancos. <a href="#categorias" data-a="fechar-ir-config">Escolher meus bancos</a></div>`;
  return `<select class="inp" name="${nome}"><option value="">—</option>${bs.map((b) => `<option ${b === v ? 'selected' : ''}>${esc(b)}</option>`).join('')}${v && !bs.includes(v) ? `<option selected>${esc(v)}</option>` : ''}</select>`; };
const chipsBancos = (sel) => { const todos = [...new Set([...BANCOS_CATALOGO, ...sel])]; return `<div class="cats" data-bancos>${todos.map((b) => `<button type="button" class="${sel.includes(b) ? 'ativo' : ''}" data-banco-tg="${esc(b)}">${sel.includes(b) ? '✓ ' : ''}${esc(b)}</button>`).join('')}</div>`; };
const FIM = ['Outros', 'Fatura do cartão'];
const ordemCat = (a, b) => (FIM.indexOf(a.nome) - FIM.indexOf(b.nome)) || a.nome.localeCompare(b.nome, 'pt-BR');
const chipsCat = (tipo, sel) => `<div class="cats" data-cats>${st().categorias.filter((c) => c.tipo === tipo && (!c.arquivada || c.id === sel)).sort(ordemCat).map((c) => `<button type="button" class="${c.id === sel ? 'ativo' : ''}" data-cat="${c.id}"><span class="cat-ic" style="background:${c.cor}">${catIcone(c, 14)}</span>${esc(c.nome)}</button>`).join('')}<button type="button" data-a="cat-nova" data-tipo-cat="${tipo}" style="border-style:dashed;color:var(--azul)">+ Adicionar</button></div><input type="hidden" name="categoriaId" value="${sel || ''}">`;

const chipsStatus = (tipo, sel) => { if (tipo === 'guardar') return '<input type="hidden" name="status" value="pago">';
  const ops = tipo === 'entrada' ? [['recebido', 'Recebido'], ['a receber', 'Vou receber']] : [['pago', 'Pago'], ['pendente', 'Vou pagar']];
  const v = ops.some((o) => o[0] === sel) ? sel : ops[0][0];
  return `<label>Situação</label><div class="seg seg-status">${ops.map(([k, n]) => `<button type="button" class="t-neutro ${k === v ? 'ativo' : ''}" data-status="${k}">${n}</button>`).join('')}</div><input type="hidden" name="status" value="${v}">`; };
function modalLanc(l = {}) {
  const tipo = l.tipo || 'despesa';
  const mes = l.mes || C.mesAtual();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const dataPadrao = l.data || (l.mes ? (l.mes === C.mesAtual() ? hojeISO : `${l.mes}-01`) : (mes === C.mesAtual() ? hojeISO : `${mes}-01`));
  abrirModal(`<form data-form="lanc" data-id="${l.id || ''}">${topoModal(l.id ? 'Editar lançamento' : 'Novo lançamento')}
    <div class="seg" data-seg="tipo">${[['despesa', 'Despesa'], ['entrada', 'Entrada'], ['guardar', 'Guardar']].map(([t, n]) => `<button type="button" class="t-${t} ${t === tipo ? 'ativo' : ''}" data-tipo="${t}">${n}</button>`).join('')}</div>
    <input type="hidden" name="tipo" value="${tipo}">
    <div class="campo"><input class="inp valor-grande num" name="valor" inputmode="decimal" placeholder="R$ 0,00" value="${l.valor ? valorInput(l.valor) : ''}" required autocomplete="off"></div>
    <div class="campo"><label>Categoria</label><div data-cats-wrap>${chipsCat(tipo, l.categoriaId)}</div></div>
    <div class="campo"><label>Descrição <span class="opc">opcional</span></label><input autocapitalize="sentences" class="inp" name="descricao" value="${esc(l.descricao || '')}" placeholder="Ex.: almoço com a equipe"></div>
    <div class="campo"><label>Como pagou?</label><div class="cats">${['Débito', 'Crédito', 'Dinheiro', 'Outro'].map((f) => `<button type="button" data-forma="${f}" class="${((l.forma === 'Pix' ? 'Débito' : l.forma) || '') === f ? 'ativo' : ''}">${f}</button>`).join('')}</div><input type="hidden" name="forma" value="${esc(l.forma === 'Pix' ? 'Débito' : l.forma || '')}"></div>
    <div class="campo"><label>Banco <span class="opc">opcional</span></label>${selBanco('banco', l.banco)}</div>
    <div data-credito class="${l.forma === 'Crédito' && !l.id ? '' : 'oculto'}" style="border:2px solid var(--linha);border-radius:16px;padding:12px;margin-bottom:14px">
      <div class="duas"><div class="campo"><label>Parcelas</label><input class="inp" type="number" min="1" max="48" name="parcelas" value="1" data-a="prev-parc-l"></div>
        <div class="campo"><label>Cartão</label>${selCartao('', true)}</div></div>
      <div class="mini" data-prev-l></div><div class="mini" style="margin-top:4px">Vai para a fatura do cartão, uma parcela por mês a partir do mês escolhido.</div></div>
    <div class="campo"><label>Mês</label>${mesSelect('l-mes', l.mes || mes)}</div>
    <div class="campo" data-status-wrap>${chipsStatus(tipo, l.status)}</div>
    <div class="campo ${tipo === 'despesa' && l.status === 'pendente' ? '' : 'oculto'}" data-venc><label>Vence em <span class="opc">opcional</span></label><input class="inp" type="date" name="vencimento" value="${l.vencimento || ''}"></div>
    ${l.id ? '' : `<label class="chave" style="margin:-4px 0 10px"><input type="checkbox" name="repete" data-a="repete-tg"> Repete todo mês</label>
    <div data-repete class="oculto repete-box"><div class="campo" style="margin:0"><label>Até quando?</label>
      <label class="chave mini" style="margin-bottom:6px"><input type="checkbox" name="repeteSemFim" checked data-a="repete-fim-tg"> Sem data para acabar</label>
      <div data-repete-fim class="oculto">${mesSelect('l-fim', C.addMes(mes, 11))}</div></div></div>`}
    <div class="acoes">${l.id ? '<button type="button" class="btn branco" data-a="excluir-lanc">Excluir</button>' : ''}<button class="btn verde" type="submit">${l.id ? 'Salvar' : 'Lançar'}</button></div>
  </form>`, () => { const v = $('[name=valor]'); if (v && !l.id) v.focus(); });
}

function modalCompra(c = {}) {
  const cartoes = st().cartoes;
  abrirModal(`<form data-form="compra" data-id="${c.id || ''}">${topoModal(c.id ? 'Editar compra' : 'Compra no cartão')}
    <div class="campo"><label>Valor total</label><input class="inp valor-grande num" name="total" inputmode="decimal" placeholder="R$ 0,00" value="${c.total ? valorInput(c.total) : ''}" required autocomplete="off" data-a="prev-parc"></div>
    <div class="duas"><div class="campo"><label>Parcelas</label><input class="inp" name="parcelas" type="number" min="1" max="48" value="${c.parcelas || 1}" data-a="prev-parc"></div>
      <div class="campo"><label>Cartão</label>${selCartao(c.cartaoId, !c.id)}</div></div>
    <div class="mini" data-prev style="margin:-6px 0 12px"></div>
    <div class="campo"><label>Descrição</label><input autocapitalize="sentences" class="inp" name="descricao" value="${esc(c.descricao || '')}" required placeholder="Ex.: presente de Natal"></div>
    <div class="campo"><label>Categoria</label><div data-cats-wrap>${chipsCat('despesa', c.categoriaId)}</div></div>
    <div class="duas"><div class="campo"><label>1ª parcela em</label>${mesSelect('c-mes', c.mesPrimeira || (ui.periodo.tipo === 'mes' ? mesRef() : C.mesAtual()))}</div>
      <div class="campo"><label>Data da compra <span class="opc">opcional</span></label><input class="inp" type="date" name="data" value="${c.data || ''}"></div></div>
    <div class="acoes">${c.id ? '<button type="button" class="btn branco" data-a="excluir-compra">Excluir</button>' : ''}<button class="btn verde" type="submit">Salvar</button></div>
  </form>`, previaParcelas);
}
function previaParcelasL() {
  const f = $('[data-form=lanc]'); if (!f || !f.parcelas) return;
  const total = parseValor(f.valor.value); const n = parseInt(f.parcelas.value, 10) || 1;
  const ps = C.parcelasDaCompra({ total, parcelas: n, mesPrimeira: '2000-01' });
  $('[data-prev-l]', f).innerHTML = total > 0 ? `<b>${n > 1 ? `${n}x de ${brl(ps[0].valor)}${ps[n - 1].valor !== ps[0].valor ? ` (última ${brl(ps[n - 1].valor)})` : ''}` : 'À vista no crédito'}</b>` : '';
}
function previaParcelas() {
  const f = $('[data-form=compra]'); if (!f) return;
  const total = parseValor(f.total.value); const n = parseInt(f.parcelas.value, 10) || 1;
  const ps = C.parcelasDaCompra({ total, parcelas: n, mesPrimeira: '2000-01' });
  $('[data-prev]', f).textContent = total > 0 ? (n > 1 ? `${n}x de ${brl(ps[0].valor)}${ps[n - 1].valor !== ps[0].valor ? ` (última ${brl(ps[n - 1].valor)})` : ''}` : 'à vista') : '';
}

const COR_BANCO = { 'Nubank': '#8A05BE', 'Itaú': '#EC7000', 'Bradesco': '#CC092F', 'Banco do Brasil': '#0038A8', 'Caixa': '#005CA9', 'Santander': '#EC0000', 'Inter': '#FF7A00', 'C6 Bank': '#242424', 'Mercado Pago': '#00A6E2', 'PicPay': '#11C76F' };
const TIPOS_CARTAO = [['credito', 'Crédito'], ['debito', 'Débito'], ['ambos', 'Débito e crédito']];
const nomeCartao = (c) => c.apelido || c.banco || c.nome || 'Cartão';
const ehCredito = (c) => !c.tipo || c.tipo === 'credito' || c.tipo === 'ambos';
const nomeTipoCartao = (t) => (TIPOS_CARTAO.find((x) => x[0] === t) || TIPOS_CARTAO[0])[1];
function selCartao(sel, novo) {
  const cs = st().cartoes.filter(ehCredito);
  if (cs.length === 1 && (novo || !sel || sel === cs[0].id)) return `<input type="hidden" name="cartaoId" value="${cs[0].id}"><div class="inp" style="background:#fff">${esc(nomeCartao(cs[0]))}</div>`;
  return `<select class="inp" name="cartaoId"><option value="">Sem cartão definido</option>${cs.map((k) => `<option value="${k.id}" ${k.id === sel ? 'selected' : ''}>${esc(nomeCartao(k))}</option>`).join('')}</select>`;
}
const CORES_CARTAO = ['#8A05BE', '#EC7000', '#CC092F', '#0038A8', '#005CA9', '#FF7A00', '#242424', '#00B1EA', '#11C76F', '#268AFF', '#77C800', '#FF9600', '#FF4B4B', '#FF86D0', '#A5683B', '#7C8A9A'];
function modalCartao(c = {}) {
  const tipo = c.tipo || 'credito'; const cor = c.cor || COR_BANCO[c.banco] || '#268AFF';
  const cores = [...new Set([cor, ...CORES_CARTAO])];
  abrirModal(`<form data-form="cartao" data-id="${c.id || ''}">${topoModal(c.id ? 'Editar cartão' : 'Novo cartão')}
    <div class="cc cc-previa" data-cc-previa style="background:${cor};margin-bottom:16px"><div><div class="cc-nome" data-cc-previa-nome>${esc(c.id ? nomeCartao(c) : 'Seu cartão')}</div><div class="cc-det">prévia</div></div></div>
    <div class="campo"><label>Banco</label>${selBanco('banco', c.banco || c.nome)}</div>
    <div class="campo"><label>Nome do cartão <span class="opc">opcional</span></label><input autocapitalize="sentences" class="inp" name="apelido" maxlength="30" placeholder="Ex.: Nubank pessoal, Itaú da empresa" value="${esc(c.apelido || '')}"></div>
    <div class="campo"><label>Cor</label><div class="cats" data-cores-cartao ${c.cor ? 'data-manual="1"' : ''}>${cores.map((k) => `<button type="button" data-cor="${k}" class="${cor === k ? 'ativo' : ''}" aria-label="Cor ${k}"><span class="ponto" style="background:${k};margin:0"></span></button>`).join('')}</div><input type="hidden" name="cor" value="${cor}"></div>
    <div class="campo"><label>Tipo</label><div class="seg" data-seg="tipocartao">${TIPOS_CARTAO.map(([t, n]) => `<button type="button" class="t-neutro ${t === tipo ? 'ativo' : ''}" data-tipocartao="${t}">${n}</button>`).join('')}</div><input type="hidden" name="tipo" value="${tipo}"></div>
    <div class="${tipo === 'debito' ? 'oculto' : ''}" data-venc-cartao><div class="duas"><div class="campo"><label>Dia que a fatura fecha</label><input class="inp" type="number" min="1" max="31" inputmode="numeric" name="fechamento" placeholder="Ex.: 26" value="${c.fechamento || ''}"></div>
      <div class="campo"><label>Dia que a fatura vence</label><input class="inp" type="number" min="1" max="31" inputmode="numeric" name="vencimento" placeholder="Ex.: 3" value="${c.vencimento || ''}"></div></div>
      <p class="mini" style="margin:-4px 0 14px">Eu aviso quando fechar e antes de vencer.</p></div>
    <div class="acoes">${c.id ? '<button type="button" class="btn branco" data-a="excluir-cartao">Excluir</button>' : ''}<button class="btn verde" type="submit">Salvar</button></div></form>`);
}

function modalFixo(r = {}, salario = false) {
  const tipo = r.tipo || (salario ? 'entrada' : 'despesa');
  const catSal = st().categorias.find((c) => c.nome === 'Salário');
  abrirModal(`<form data-form="fixo" data-id="${r.id || ''}">${topoModal(salario ? (r.id ? 'Editar renda' : 'Nova renda fixa') : r.id ? 'Editar fixo' : 'Novo custo fixo')}
    <div class="seg" data-seg="tipo">${[['despesa', 'Despesa'], ['entrada', 'Entrada'], ['guardar', 'Guardar']].map(([t, n]) => `<button type="button" class="t-${t} ${t === tipo ? 'ativo' : ''}" data-tipo="${t}">${n}</button>`).join('')}</div>
    <input type="hidden" name="tipo" value="${tipo}">
    <div class="campo"><label>Valor por mês</label><input class="inp valor-grande num" name="valor" inputmode="decimal" placeholder="R$ 0,00" value="${r.valor ? valorInput(r.valor) : ''}" data-orig="${r.valor || ''}" required></div>
    ${r.id ? `<div data-desde class="oculto repete-box"><div class="campo" style="margin:0"><label>Novo valor vale a partir de</label>${mesSelect('f-desde', C.difMeses(r.inicio || C.mesAtual(), C.mesAtual()) > 0 ? C.mesAtual() : (r.inicio || C.mesAtual()))}<p class="mini" style="margin:6px 0 0">Os meses antes continuam com ${brl(r.valor)}.</p></div></div>` : ''}
    <div class="campo"><label>Nome</label><input autocapitalize="sentences" class="inp" name="nome" value="${esc(r.nome || (salario ? 'Salário' : ''))}" placeholder="Ex.: Academia"></div>
    <div class="campo"><label>Categoria</label><div data-cats-wrap>${chipsCat(tipo, r.categoriaId || (salario ? catSal?.id : ''))}</div></div>
    <div class="duas"><div class="campo"><label>Começa em</label>${mesSelect('f-ini', r.inicio || C.mesAtual())}</div>
      <div class="campo"><label>Termina em <span class="opc">opcional</span></label><label class="chave mini" style="margin-bottom:6px"><input type="checkbox" name="semFim" ${r.id && !r.fim ? 'checked' : !r.id ? 'checked' : ''}> sem data para acabar</label>${mesSelect('f-fim', r.fim || C.addMes(C.mesAtual(), 11))}</div></div>
    <div class="duas"><div class="campo ${tipo === 'entrada' ? '' : 'oculto'}" data-dia-renda><label>Dia que recebe <span class="opc">opcional</span></label><input class="inp" type="number" min="1" max="31" inputmode="numeric" name="diaVenc" placeholder="Ex.: 5" value="${tipo === 'entrada' ? (r.diaVenc || '') : ''}"></div>
      <div class="campo"><label>Frequência</label><select class="inp" name="frequencia"><option value="mensal">Mensal</option><option value="anual" ${r.frequencia === 'anual' ? 'selected' : ''}>Anual</option></select></div></div>
    <div class="duas"><div class="campo"><label>Forma <span class="opc">opcional</span></label><select class="inp" name="forma" data-a="forma-fixo"><option value="">—</option>${['Débito', 'Crédito', 'Dinheiro', 'Boleto', 'Outro'].map((f) => `<option ${f === (r.forma === 'Pix' ? 'Débito' : r.forma) ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
      <div class="campo"><label>Banco <span class="opc">opcional</span></label>${selBanco('banco', r.banco)}</div></div>
    <div class="campo ${r.forma === 'Crédito' ? '' : 'oculto'}" data-fixo-cartao><label>Cartão</label>${selCartao(r.cartaoId || '', !r.id)}<p class="mini" style="margin:6px 0 0">Entra todo mês na fatura deste cartão.</p></div>
    ${r.id ? `<label class="chave" style="margin-bottom:12px"><input type="checkbox" name="pausado" ${r.ativa === false ? 'checked' : ''}> Pausar este fixo</label>` : ''}
    <div class="campo"><label>Observação <span class="opc">opcional</span></label><input autocapitalize="sentences" class="inp" name="obs" value="${esc(r.obs || '')}"></div>
    <div class="acoes">${r.id ? '<button type="button" class="btn branco" data-a="excluir-fixo">Excluir</button>' : ''}<button class="btn verde" type="submit">Salvar</button></div></form>`);
}

function modalCat(c = {}) {
  const cores = ['#268AFF', '#77C800', '#FF9600', '#CE82FF', '#FF4B4B', '#1CB0F6', '#FFC800', '#2BDCA0', '#FF86D0', '#8E6CFF', '#A5683B', '#7C8A9A'];
  abrirModal(`<form data-form="cat" data-id="${c.id || ''}">${topoModal(c.id ? 'Editar categoria' : 'Nova categoria')}
    <div class="campo"><label>Nome</label><input autocapitalize="sentences" class="inp" name="nome" required value="${esc(c.nome || '')}"></div>
    <div class="campo"><label>Tipo</label><select class="inp" name="tipo">${[['despesa', 'Despesa'], ['guardar', 'Guardar'], ['entrada', 'Entrada']].map(([v, n]) => `<option value="${v}" ${c.tipo === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="campo"><label>Orçamento por mês <span class="opc">opcional</span></label><input class="inp" name="orcamento" inputmode="decimal" value="${c.orcamento ? valorInput(c.orcamento) : ''}"></div>
    <div class="campo"><label>Símbolo</label><div class="icones-escolha">${ICONES_ESCOLHA.map((k) => `<button type="button" data-icone="${k}" class="${iconeKey(c) === k ? 'ativo' : ''}" aria-label="${k}">${svgIcone(k, 22)}</button>`).join('')}</div><input type="hidden" name="icone" value="${esc(iconeKey(c))}"></div>
    <div class="campo"><label>Cor</label><div class="cats">${cores.map((k) => `<button type="button" data-cor="${k}" class="${(c.cor || cores[0]) === k ? 'ativo' : ''}"><span class="ponto" style="background:${k};margin:0"></span></button>`).join('')}</div><input type="hidden" name="cor" value="${c.cor || cores[0]}"></div>
    ${c.id ? `<label class="chave" style="margin-bottom:12px"><input type="checkbox" name="arquivada" ${c.arquivada ? 'checked' : ''}> Arquivar (some das opções, mas o histórico fica)</label>` : ''}
    <div class="acoes">${c.id ? '<button type="button" class="btn branco" data-a="excluir-cat">Excluir</button>' : ''}<button class="btn verde" type="submit">Salvar</button></div></form>`);
}

function modalMeta(m = {}) {
  abrirModal(`<form data-form="meta" data-id="${m.id || ''}">${topoModal(m.id ? 'Editar meta' : 'Nova meta')}
    <div class="campo"><label>Nome</label><input autocapitalize="sentences" class="inp" name="nome" required value="${esc(m.nome || '')}" placeholder="Ex.: Viagem"></div>
    <div class="duas"><div class="campo"><label>Quanto quer juntar</label><input class="inp" name="alvo" inputmode="decimal" value="${m.alvo ? valorInput(m.alvo) : ''}"></div>
      <div class="campo"><label>Já tem guardado</label><input class="inp" name="valorInicial" inputmode="decimal" value="${m.valorInicial ? valorInput(m.valorInicial) : ''}"></div></div>
    <div class="campo"><label>Até quando <span class="opc">opcional</span></label><label class="chave mini" style="margin-bottom:6px"><input type="checkbox" name="semData" ${!m.dataAlvo ? 'checked' : ''}> sem data</label>${mesSelect('m-data', m.dataAlvo || C.addMes(C.mesAtual(), 12))}</div>
    <div class="campo"><label>Somar automaticamente o que eu guardar em <span class="opc">opcional</span></label><select class="inp" name="categoriaId"><option value="">—</option>${st().categorias.filter((c) => c.tipo === 'guardar').map((c) => `<option value="${c.id}" ${c.id === m.categoriaId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
    <div class="acoes">${m.id ? '<button type="button" class="btn branco" data-a="excluir-meta">Excluir</button>' : ''}<button class="btn verde" type="submit">Salvar</button></div></form>`);
}

function modalDecisao(cid, m) {
  const c = st().cartoes.find((x) => x.id === cid) || { id: '', nome: 'Sem cartão definido' }; const f = C.fatura(st(), cid, m); const ab = f.aberto;
  abrirModal(`<form data-form="decisao" data-id="${cid}" data-m="${m}" data-aberto="${ab}">${topoModal(`Fatura ${esc(nomeCartao(c))} · ${C.nomeMes(m)}`)}
    <p style="margin:0 0 14px">Ficaram <b class="num">${brl(ab)}</b> em aberto. O que aconteceu?</p>
    <div class="opcoes-dec">
      <button type="button" class="op-dec" data-dec="paguei"><span class="op-ic">✓</span><span><b>Já paguei</b><small>Marca a fatura inteira como paga</small></span></button>
      <button type="button" class="op-dec" data-dec="passar"><span class="op-ic">→</span><span><b>Passar para o próximo mês</b><small>O que falta entra na fatura de ${C.nomeMes(C.addMes(m, 1))}</small></span></button>
      <button type="button" class="op-dec" data-dec="parcelar"><span class="op-ic">÷</span><span><b>Parcelar</b><small>Divide em parcelas, com ou sem juros</small></span></button>
    </div>
    <input type="hidden" name="acao" value="">
    <div data-dec-campos="passar" class="oculto"><div class="campo"><label>Juros e encargos cobrados <span class="opc">opcional</span></label><input class="inp" name="jurosPassar" inputmode="decimal" placeholder="R$ 0,00"></div></div>
    <div data-dec-campos="parcelar" class="oculto"><div class="duas"><div class="campo"><label>Quantas parcelas?</label><input class="inp" type="number" min="2" max="48" inputmode="numeric" name="nParc" value="3"></div>
      <div class="campo"><label>Valor de cada parcela (com juros)</label><input class="inp" name="vParc" inputmode="decimal" placeholder="${valorInput(ab / 3)}"></div></div></div>
    <div class="previa-dec mini" data-previa-dec></div>
    <div class="acoes"><button class="btn verde" type="submit" disabled>Confirmar</button></div></form>`);
}
function previaDecisao(f) {
  const ab = +f.dataset.aberto; const acao = f.acao.value; const out = f.querySelector('[data-previa-dec]'); const prox = C.nomeMes(C.addMes(f.dataset.m, 1));
  if (acao === 'paguei') out.innerHTML = `A fatura fica marcada como paga (${brl(ab)}).`;
  else if (acao === 'passar') { const j = parseValor(f.jurosPassar.value) || 0; out.innerHTML = `Na fatura de ${prox} entram <b>${brl(ab)}</b>${j > 0 ? ` + <b>${brl(j)}</b> de juros = <b>${brl(ab + j)}</b>` : ''}.`; }
  else if (acao === 'parcelar') { const n = Math.max(2, parseInt(f.nParc.value, 10) || 2); f.vParc.placeholder = valorInput(ab / n); const p = parseValor(f.vParc.value) || Math.round((ab / n) * 100) / 100; const tot = Math.round(p * n * 100) / 100; const j = Math.max(0, Math.round((tot - ab) * 100) / 100);
    out.innerHTML = `${n}x de <b>${brl(p)}</b> a partir de ${prox}. Total <b>${brl(tot)}</b>, sendo <b>${brl(j)}</b> de juros.${tot < ab - 0.01 ? ' <span style="color:var(--vermelho)">As parcelas somam menos do que o valor em aberto.</span>' : ''}`; }
  else out.innerHTML = '';
}
async function catJuros() {
  let c = st().categorias.find((x) => x.nome === 'Juros e tarifas');
  if (!c) c = await store.salvar('categorias', { nome: 'Juros e tarifas', tipo: 'despesa', orcamento: 0, cor: '#FF4B4B', arquivada: false });
  return c;
}
function metaHint(form) {
  const wrap = form.querySelector('[data-cats-wrap]') || form.querySelector('[data-cats]'); if (!wrap) return;
  let h = form.querySelector('.meta-hint'); const c = cat(form.categoriaId?.value);
  const meta = c && c.tipo === 'guardar' ? st().metas.find((m) => m.categoriaId === c.id) : null;
  if (!meta) { h?.remove(); return; }
  if (!h) { h = document.createElement('div'); h.className = 'meta-hint'; wrap.after(h); }
  const p = C.progressoMeta(st(), meta);
  h.innerHTML = `${svgIcone('alvo', 16)}<span>Vai para a meta <b>${esc(meta.nome)}</b>: ${brl(p.atual)}${p.alvo ? ` de ${brl(p.alvo)}` : ' guardados até agora'}</span>`;
}
// requestSubmit não existe em iPhones mais antigos (Safari < 16)
function enviarForm(f) { if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
// ---------------- importar extrato ----------------
// o banco tem conta e cartão de crédito? então precisa dos dois arquivos para ficar completo
function statusImport(b) {
  const S = st(); const temCred = S.cartoes.some((k) => ehCredito(k) && (k.banco || k.nome) === b);
  const ult = (t) => (S.settings.importacoes || []).filter((x) => x.banco === b && x.tipo === t).map((x) => x.mes).sort().pop() || '';
  return { temCred, conta: ult('conta'), fatura: ult('fatura') };
}
// depois de importar a fatura: confirmar com o app do banco quanto falta (o saldo da fatura anterior não vem no arquivo)
function conferirFatura(cid, m, msg, banco) {
  const S = st(); const k = S.cartoes.find((x) => x.id === cid) || null; banco = banco || k?.banco || k?.nome || '';
  const kc = k || S.cartoes.find((x) => ehCredito(x) && (x.banco || x.nome) === banco);
  const mAtual = kc ? mesDaCompra(kc, new Date().toISOString().slice(0, 10)) : null; const f = kc ? C.fatura(S, kc.id, mAtual) : null;
  abrirModal(`<form data-form="conferir-fatura" data-id="${kc?.id || ''}" data-m="${mAtual || ''}" data-banco="${esc(banco)}">${topoModal('Conferir com o banco')}
    <p style="margin:0 0 6px"><b>${esc(msg)}</b></p>
    <p class="mini" style="margin:0 0 12px">Abra o app do ${esc(banco || 'banco')} e confira. Se algum valor estiver diferente, corrija aqui. O Flui ajusta o resto.</p>
    <div class="campo"><label>Quanto tem na conta agora</label><input class="inp valor-grande num" name="saldo" inputmode="decimal" value="${valorInput(C.saldoConta(S))}" autocomplete="off"></div>
    ${kc ? `<div class="campo"><label>Quanto falta pagar da fatura atual${C.dataVencimento(kc, mAtual) ? ` (vence ${C.dataVencimento(kc, mAtual).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })})` : ''}</label><input class="inp valor-grande num" name="falta" inputmode="decimal" value="${valorInput(Math.max(0, f.aberto))}" autocomplete="off"></div>` : ''}
    <div class="acoes"><button type="button" class="btn branco" data-a="conferir-depois" data-v="${esc(banco)}">Depois</button><button class="btn verde">Confirmar</button></div></form>`);
}
// assinaturas que apareceram na fatura: pergunta se vira gasto fixo no cartão (e até quando)
const NOMES_ASSIN = [[/UBER\W*ONE/i, 'Uber One'], [/NETFLIX/i, 'Netflix'], [/SPOTIFY/i, 'Spotify'], [/HBO/i, 'HBO Max'], [/LIVECAREER/i, 'LiveCareer'], [/DISNEY/i, 'Disney+'],
  [/PRIME ?VIDEO|AMAZON ?PRIME|AMAZONPRIME/i, 'Amazon Prime'], [/YOUTUBE/i, 'YouTube Premium'], [/GLOBO ?PLAY/i, 'Globoplay'], [/ICLOUD|APPLE/i, 'Apple / iCloud'], [/GOOGLE ?ONE/i, 'Google One'],
  [/CANVA/i, 'Canva'], [/CHATGPT|OPENAI/i, 'ChatGPT'], [/CLAUDE|ANTHROPIC/i, 'Claude'], [/DUOLINGO/i, 'Duolingo'], [/DEEZER/i, 'Deezer'], [/PARAMOUNT/i, 'Paramount+'], [/CRUNCHYROLL/i, 'Crunchyroll'],
  [/CLUBE ?IFOOD|IFOOD ?CLUB/i, 'Clube iFood'], [/MELI/i, 'Meli+'], [/ADOBE/i, 'Adobe'], [/LINKEDIN/i, 'LinkedIn'], [/MICROSOFT|MSFT/i, 'Microsoft 365'], [/SMART ?FIT/i, 'Smart Fit']];
const nomeAssin = (t) => (NOMES_ASSIN.find(([re]) => re.test(t)) || [])[1] || t.replace(/ - Parcela \d+\/\d+$/i, '').replace(/^[A-Z]{2,4}\s?\*/i, '').trim();
function perguntarAssinaturas(banco) {
  const lst = (ui.assinaturas || []).filter((a, i, arr) => arr.findIndex((x) => chaveRegra(x.texto) === chaveRegra(a.texto)) === i); if (!lst.length) return false;
  ui.assinaturas = lst;
  abrirModal(`<form data-form="assinaturas" data-banco="${esc(banco)}">${topoModal('Assinaturas')}
    <p style="margin:0 0 12px">Achei estas assinaturas na fatura. Quer que elas entrem sozinhas todo mês, como gasto fixo no cartão?</p>
    ${lst.map((a, i) => `<div class="assin-linha"><label class="chave"><input type="checkbox" name="a${i}" checked> <b>${esc(a.nome)}</b> <span class="num">${brl(a.valor)}/mês</span></label>
      <div class="assin-ate"><span class="mini">até</span><input class="inp" type="month" name="ate${i}" min="${C.addMes(a.mes, 1)}" value="${a.parc ? C.addMes(a.mes, +a.parc[2] - +a.parc[1]) : ''}"><span class="mini">(vazio = sem data para acabar)</span></div></div>`).join('')}
    <div class="acoes"><button type="button" class="btn branco" data-a="assin-pular" data-v="${esc(banco)}">Agora não</button><button class="btn verde">Salvar</button></div></form>`);
  return true;
}
function avisoCompleto(b, feito, msg) {
  const st2 = statusImport(b); const falta = feito === 'conta' ? (st2.temCred && st2.fatura < st2.conta ? 'fatura' : '') : (st2.conta < st2.fatura ? 'conta' : '');
  if (!falta) { toast(msg, true); return; }
  abrirModal(`<div class="flui-fala"><div class="mascote">${MASCOTE}</div><div class="balao"><b>${esc(msg)}</b><br>Para o ${esc(b)} ficar completo, importe também ${falta === 'fatura' ? 'a <b>fatura do cartão</b>: as compras no crédito não vêm no extrato da conta.' : 'o <b>extrato da conta</b>: débito, Pix e transferências não vêm na fatura.'}</div></div>
    <div class="acoes"><button class="btn branco" data-a="fechar">Depois</button><button class="btn verde" data-a="imp-de-novo" data-v="${esc(b)}">Importar agora</button></div>`);
}
function modalImportar() {
  const S = st(); const d = ui.impDestino || '';
  const bancos = [...new Set([...(S.settings.bancos || []), ...S.cartoes.map((k) => k.banco || k.nome).filter(Boolean)])];
  abrirModal(`${topoModal('Importar extrato')}
    <p style="margin:0 0 10px;font-weight:800">De qual banco?</p>
    <div class="imp-bancos">${bancos.map((b) => `<button type="button" class="imp-banco ${d === b ? 'ativo' : ''}" data-a="imp-dest" data-v="${esc(b)}"><span class="imp-dest-cor" style="background:${COR_BANCO[b] || S.cartoes.find((k) => (k.banco || k.nome) === b)?.cor || '#AFB8C4'}"></span>${esc(b)}</button>`).join('')}</div>
    ${d ? `<label class="btn cheio" style="cursor:pointer;display:block;text-align:center;margin-top:16px">Escolher arquivo<input type="file" data-a="arquivo-extrato" class="arquivo-oculto"></label>
      <p class="mini" style="margin-top:8px">Pode ser o extrato da conta ou a fatura do cartão: o Flui reconhece sozinho. Use o arquivo <b>OFX</b> (ou CSV).</p>
      ${d === 'Nubank' ? `<div class="tut-nu">
        <details><summary>Como baixar o <b>extrato da conta</b> no Nubank</summary><ol>
          <li>No app do Nubank, toque em <b>Saldo principal</b>.</li><li>Toque nos <b>três pontinhos</b> no canto de cima.</li><li>Toque em <b>Pedir extrato</b>.</li>
          <li>Escolha o mês e toque em <b>Exportar Extrato</b>.</li><li>Chega no seu e-mail: baixe o arquivo <b>.ofx</b> e escolha ele aqui.</li></ol></details>
        <details><summary>Como baixar a <b>fatura do cartão</b> no Nubank</summary><ol>
          <li>No app do Nubank, toque em <b>Cartão de crédito</b>.</li><li>Toque em <b>Acessar fatura</b>.</li><li>Escolha o mês lá em cima e toque no ícone de <b>compartilhar</b> (canto de cima, à direita).</li>
          <li>Escolha <b>OFX</b> (ou CSV). O PDF não funciona com fatura aberta.</li><li>Chega no seu e-mail: baixe o arquivo e escolha ele aqui.</li></ol></details></div>` : ''}
      ${(() => { const x = statusImport(d); if (!x.temCred) return ''; const it = (ok, t, m) => `<div class="imp-ck ${ok ? 'ok' : ''}"><span>${ok ? '✓' : ''}</span>${t}${m ? ` <small>até ${C.nomeMes(m)}</small>` : ''}</div>`;
        return `<div class="imp-completo"><b>Para o ${esc(d)} ficar completo, importe os dois:</b>${it(!!x.conta, 'Extrato da conta', x.conta)}${it(!!x.fatura, 'Fatura do cartão', x.fatura)}</div>`; })()}` : ''}`);
}
function guardarPreferido(S) {
  const cont = {}; for (const x of [...S.lancamentos, ...S.recorrencias]) if (x.tipo === 'guardar' || S.categorias.find((c) => c.id === x.categoriaId)?.tipo === 'guardar') cont[x.categoriaId] = (cont[x.categoriaId] || 0) + 1;
  const id = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]?.[0]; return S.categorias.find((c) => c.id === id && c.tipo === 'guardar' && !c.arquivada) || null;
}
// fechamento do cartão (se não tiver, 7 dias antes do vencimento, como no Nubank)
function diasCartao(k) { const V = parseInt(k?.vencimento, 10) || 0; const F = parseInt(k?.fechamento, 10) || (V ? (V > 7 ? V - 7 : V + 23) : 0); return { V, F }; }
// em qual fatura (mês) cai uma compra feita na data d
function mesDaCompra(k, d) { const { V, F } = diasCartao(k); const m = d.slice(0, 7); const dia = +d.slice(8, 10); if (!F) return m;
  return F < V ? (dia >= F ? m : C.addMes(m, -1)) : (dia >= F ? C.addMes(m, 1) : m); }
// qual fatura um pagamento feito na data d quita: a que já fechou (se pagou até o vencimento) ou a que está aberta
function mesDoPagamento(k, d) { const { V, F } = diasCartao(k); if (!V) return C.addMes(d.slice(0, 7), -1);
  const kk = { ...k, fechamento: F, vencimento: V }; const D = new Date(d + 'T12:00:00');
  let ult = null; for (let i = -3; i <= 1; i++) { const m = C.addMes(d.slice(0, 7), i); if (C.dataFechamento(kk, m) < D) ult = m; }
  if (!ult) return d.slice(0, 7); const venc = C.dataVencimento(kk, ult); return D <= new Date(venc.getTime() + 3 * 864e5) ? ult : C.addMes(ult, 1); }
const mesmoPag = (a, b) => a.cartaoId === b.cartaoId && Math.abs(a.valor - b.valor) < 0.005 && Math.abs(new Date(a.data) - new Date(b.data)) <= 864e5;
function realocarPagamentos() {
  const S = st(); const lista = S.settings.pagImportadosLista || []; const man = S.settings.pagManual || {};
  const cards = new Set(lista.map((p) => p.cartaoId));
  const daCarta = (k) => cards.has(k.split('|')[0]) && !man[k];
  const pg = Object.fromEntries(Object.entries(S.settings.pagamentosFatura || {}).filter(([k]) => !daCarta(k)));
  const fp = Object.fromEntries(Object.entries(S.settings.faturasPagas || {}).filter(([k]) => !daCarta(k)));
  const aloc = {}; const unicos = lista.filter((p, i) => lista.findIndex((x) => mesmoPag(x, p)) === i).sort((a, b) => a.data.localeCompare(b.data));
  const add = (key, v) => { aloc[key] = Math.round(((aloc[key] || 0) + v) * 100) / 100; };
  const abertoCom = (cid, m) => C.fatura({ ...S, settings: { ...S.settings, pagamentosFatura: { ...pg, ...aloc }, faturasPagas: fp } }, cid, m);
  for (const p of unicos) { const k = S.cartoes.find((x) => x.id === p.cartaoId); if (!k) continue; const m = mesDoPagamento(k, p.data); const key = `${k.id}|${m}`; if (man[key]) continue;
    const prox = C.addMes(m, 1); const f = abertoCom(k.id, m);
    // é a fatura fechada, o Flui sabe quanto ela tinha e o pagamento passou disso: o excedente adianta a próxima
    if (f.total > 0 && p.valor > f.aberto + 0.005) {
      const parte = Math.max(0, f.aberto); if (parte > 0.005) add(key, parte); const k2 = `${k.id}|${prox}`; if (!man[k2]) add(k2, p.valor - parte); }
    else add(key, p.valor); }
  return store.salvarSettings({ pagamentosFatura: { ...pg, ...aloc }, faturasPagas: fp, pagAlocado: aloc });
}
async function prepararImportacao(dados) {
  // se o extrato tem transporte (Uber, metrô...) e a pessoa não tem essa categoria, cria
  if (!st().categorias.some((c) => c.nome === 'Transporte' && c.tipo === 'despesa') && dados.itens.some((it) => entender(it).sugestao === 'Transporte'))
    await store.salvar('categorias', { nome: 'Transporte', tipo: 'despesa', orcamento: 0, cor: '#1CB0F6', arquivada: false });
  const S = st(); const regras = S.settings.regrasImport || {};
  const porNome = (nome, tipo) => S.categorias.find((c) => c.nome === nome && c.tipo === tipo && !c.arquivada);
  const rendaDoMes = (mes, valor) => S.recorrencias.find((r) => r.tipo === 'entrada' && C.recorrenciaNoMes(r, mes) && Math.abs(r.valor - valor) < 0.005);
  const jaIds = new Set([...S.lancamentos, ...S.compras].map((l) => l.importId).filter(Boolean));
  const outrosIds = new Set(S.categorias.filter((c) => c.nome === 'Outros').map((c) => c.id)); const aprendido = {};
  for (const x of [...S.lancamentos, ...S.compras]) { if (!x.categoriaId || outrosIds.has(x.categoriaId)) continue; const k = chaveRegra(x.descricao || ''); if (k) aprendido[k] = x.categoriaId; }
  const linhas = dados.itens.map((it) => {
    const e = entender(it); const mes = it.data.slice(0, 7); const valor = Math.abs(it.valor);
    const regra = regras[chaveRegra(it.texto)] || aprendido[chaveRegra(it.texto)] || aprendido[chaveRegra(e.descricao || '')]; const cRegra = regra && S.categorias.find((c) => c.id === regra && c.tipo === e.tipo);
    const renda = e.tipo === 'entrada' ? rendaDoMes(mes, valor) : null;
    let cat = cRegra || (e.tipo === 'guardar' ? guardarPreferido(S) : null) || (renda ? S.categorias.find((c) => c.id === renda.categoriaId) : null) || porNome(e.sugestao, e.tipo)
      || (e.tipo === 'despesa' ? porNome('Outros', 'despesa') : S.categorias.find((c) => c.tipo === e.tipo && !c.arquivada));
    const ja = it.id && jaIds.has(it.id);
    const parecido = !ja && (dados.cartao ? S.compras.some((c) => !c.importId && Math.abs((Number(c.total) || 0) - valor) < 0.005 && Math.abs(C.difMeses(c.mesPrimeira, mes)) <= 1) : S.lancamentos.some((l) => l.mes === mes && l.tipo === e.tipo && Math.abs((Number(l.valor) || 0) - valor) < 0.005 && !l.importId));
    const pagFatura = dados.cartao && e.tipo !== 'despesa';
    const jaFixo = dados.cartao && e.tipo === 'despesa' && S.recorrencias.some((r) => r.forma === 'Crédito' && r.ativa !== false && C.recorrenciaNoMes(r, mes) && (chaveRegra(r.nome || '') === chaveRegra(it.texto) || chaveRegra(r.obsImport || '') === chaveRegra(it.texto)));
    return { ...it, ...e, mes, valorAbs: valor, catId: cat?.id || '', recorrenciaId: renda?.id || '', marcado: e.marcar && !ja && !parecido && !pagFatura && !jaFixo, ja, jaFixo,
      aviso: ja ? 'Já importado antes.' : jaFixo ? 'Já está nos seus fixos.' : pagFatura ? (/pagamento/i.test(it.texto || '') ? 'Pagamento: vai abater a fatura, não é compra.' : 'Estorno: não entra como compra.') : parecido ? 'Parece que você já lançou este valor neste mês.' : e.aviso || '' };
  });
  const banco = dados.banco || (S.settings?.bancos?.length === 1 ? S.settings.bancos[0] : '');
  const cc = dados.cartao ? (S.cartoes.find((k) => k.tipo !== 'debito' && (k.banco || k.nome) === banco) || S.cartoes.find((k) => k.tipo !== 'debito')) : null;
  ui.importacao = { banco, formato: dados.formato, linhas, cartao: !!dados.cartao, destino: cc ? 'cc:' + cc.id : 'conta:' + banco };
}
function modalRevisarImport() {
  const im = ui.importacao; const S = st();
  const opts = (tipo, sel) => {
    if (tipo === 'guardar') { // guardado: escolher a meta ou o investimento para onde foi
      const cats = S.categorias.filter((c) => c.tipo === 'guardar' && !c.arquivada).sort(ordemCat); const comMeta = cats.filter((c) => S.metas.some((mt) => mt.categoriaId === c.id)); const sem = cats.filter((c) => !comMeta.includes(c));
      const o = (c, t) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(t)}</option>`;
      return (comMeta.length ? `<optgroup label="Metas">${comMeta.map((c) => o(c, S.metas.find((mt) => mt.categoriaId === c.id)?.nome || c.nome)).join('')}</optgroup>` : '') + (sem.length ? `<optgroup label="Investimentos e outros">${sem.map((c) => o(c, c.nome)).join('')}</optgroup>` : '');
    }
    return S.categorias.filter((c) => c.tipo === tipo && !c.arquivada).sort(ordemCat).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}</option>`).join(''); };
  const n = im.linhas.filter((l) => l.marcado).length;
  abrirModal(`<form data-form="importar">${topoModal('Conferir importação')}
    <div class="imp-onde" data-imp-destino>${(im.destino || '').startsWith('cc:') ? `Fatura do cartão <b>${esc(nomeCartao(S.cartoes.find((k) => 'cc:' + k.id === im.destino) || {}))}</b>` : `Conta <b>${esc(im.banco || 'sem banco')}</b>`}</div>
    <p class="mini" style="margin:0 0 10px">${im.linhas.length} movimentações (${im.formato}). Desmarque o que não quiser e ajuste as categorias.</p>
    <div class="imp-lista">${im.linhas.map((l, i) => `<div class="imp-linha ${l.marcado ? '' : 'off'}">
      <input type="checkbox" data-imp-ok="${i}" ${l.marcado ? 'checked' : ''} ${l.ja ? 'disabled' : ''} aria-label="Importar">
      <div class="imp-meio"><div class="imp-desc">${esc(l.descricao)}</div>
        <div class="mini">${l.data.split('-').reverse().join('/')} · ${esc(l.forma || '')}${l.aviso ? ` · <span class="imp-aviso">${esc(l.aviso)}</span>` : ''}</div>
        ${l.ja ? '' : `${l.tipo === 'guardar' ? '<div class="imp-para">Para onde foi?</div>' : ''}<select class="inp imp-cat ${l.tipo === 'guardar' ? 'guardar' : ''}" data-imp-cat="${i}">${opts(l.tipo, l.catId)}</select>`}</div>
      <div class="imp-valor num ${l.tipo === 'entrada' ? 'pos' : ''}">${l.tipo === 'entrada' ? '+' : '−'}${brl(l.valorAbs)}</div></div>`).join('')}</div>
    <div class="acoes"><button type="button" class="btn branco" data-a="fechar">Cancelar</button><button class="btn verde" type="submit" data-imp-btn>Importar ${n}</button></div></form>`);
}
// ---------------- tour rápido ----------------
const TOUR = [
  { rota: 'plano', alvo: '[data-a=aba-plano][data-v=fixos]', tit: 'Comece pelos fixos', txt: 'Coloque seu salário e o que sai todo mês. Eles entram sozinhos.' },
  { rota: 'plano', alvo: '[data-a=orc]', tit: 'Defina seus limites', txt: 'Quanto quer gastar por mês em cada categoria.' },
  { rota: 'inicio', alvo: '.fab', tit: 'Lance em segundos', txt: 'Toque no + para registrar um gasto, uma entrada ou algo que guardou.' },
  { rota: 'lancamentos', alvo: '[data-a=importar-extrato]', tit: 'Importe o extrato', txt: 'O Flui lê o extrato do seu banco e lança tudo para você.' },
  { rota: 'cartoes', alvo: '.cc, [data-a=novo-cartao]', tit: 'Seus cartões', txt: 'Toque no cartão para ver a fatura e quanto falta pagar.' },
  { rota: 'relatorios', alvo: '.an-heroi, h1', tit: 'Veja sua análise', txt: 'Quanto sobrou, para onde foi o dinheiro e o que pede atenção.' },
  { rota: 'metas', alvo: '.card', tit: 'Suas metas', txt: 'Tudo o que você guarda vai enchendo suas metas.' },
];
function perguntarTour(nome) {
  abrirModal(`<div class="flui-fala"><div class="mascote">${MASCOTE}</div><div class="balao">Tudo pronto${nome ? ', ' + esc(nome) : ''}! Quer um tour rápido pelo app? Leva menos de 1 minuto.</div></div>
    <div class="acoes"><button class="btn branco" data-a="tour-nao">Agora não</button><button class="btn verde" data-a="tour-sim">Quero o tour</button></div>`);
}
function desenharTour() {
  document.querySelector('.tour')?.remove();
  if (ui.tour == null || ui.modal) return;
  const p = TOUR[ui.tour]; if (!p) { ui.tour = null; return; }
  if (ui.rota !== p.rota) { if (location.hash === '#' + p.rota) { ui.rota = p.rota; render(); } else location.hash = '#' + p.rota; return; }
  const alvo = document.querySelector(p.alvo);
  const box = document.createElement('div'); box.className = 'tour';
  const ultimo = ui.tour === TOUR.length - 1;
  box.innerHTML = `<div class="tour-luz"></div><div class="tour-balao"><i class="tour-seta"></i><div class="tour-tit">${p.tit}</div><div class="tour-txt">${p.txt}</div>
    <div class="tour-acoes"><button data-a="tour-sair">Pular</button><span class="tour-pontos">${TOUR.map((_, k) => `<i class="${k === ui.tour ? 'on' : ''}"></i>`).join('')}</span><button class="ok" data-a="tour-prox">${ultimo ? 'Começar' : 'Próximo'}</button></div></div>`;
  document.body.appendChild(box);
  const pos = () => {
    const r = alvo ? alvo.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0, bottom: innerHeight / 2, right: innerWidth / 2 };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const raio = Math.min(110, Math.max(34, Math.max(r.width, r.height) / 2 + 14));
    const luz = box.querySelector('.tour-luz'); Object.assign(luz.style, { left: `${cx - raio}px`, top: `${cy - raio}px`, width: `${raio * 2}px`, height: `${raio * 2}px` });
    const b = box.querySelector('.tour-balao'); const embaixo = cy < innerHeight * 0.55; const seta = box.querySelector('.tour-seta');
    const top = embaixo ? Math.min(cy + raio + 14, innerHeight - b.offsetHeight - 12) : Math.max(12, cy - raio - b.offsetHeight - 14);
    b.style.top = `${top}px`; const bl = b.getBoundingClientRect().left;
    seta.className = 'tour-seta ' + (embaixo ? 'cima' : 'baixo'); seta.style.left = `${Math.max(18, Math.min(b.offsetWidth - 36, cx - bl - 9))}px`;
  };
  if (alvo) alvo.scrollIntoView({ block: 'center' }); setTimeout(pos, 60); pos();
}
// lembrete ao abrir: falta o mínimo (renda fixa, um fixo, limites, cartão)
function faltasSetup() {
  const S = st();
  return [
    { ok: S.recorrencias.some((r) => r.tipo === 'entrada'), txt: 'Sua renda fixa', ir: 'renda' },
    { ok: S.recorrencias.some((r) => r.tipo !== 'entrada'), txt: 'Um gasto fixo', ir: 'fixo' },
    { ok: S.categorias.some((c) => c.tipo === 'despesa' && c.orcamento > 0), txt: 'Seus limites de gasto', ir: 'limites' },
    { ok: S.cartoes.length > 0, txt: 'Seu cartão', ir: 'cartao' },
  ];
}
function lembreteSetup() {
  if (st().settings.lembreteSetupOff || ui.lembreteVisto) return;
  const itens = faltasSetup(); if (itens.every((x) => x.ok)) return;
  ui.lembreteVisto = true;
  abrirModal(`<div class="flui-fala"><div class="mascote">${MASCOTE}</div><div class="balao">Falta pouco para o Flui ficar com a sua cara!</div></div>
    <div class="lista checklist">${itens.map((x) => `<div class="item ${x.ok ? 'ok' : ''}" ${x.ok ? '' : `data-a="setup-ir" data-v="${x.ir}"`}><span class="ck">${x.ok ? '✓' : ''}</span><div class="meio"><div class="titulo">${x.txt}</div></div>${x.ok ? '' : '<span class="link-mais">Fazer ›</span>'}</div>`).join('')}</div>
    <div class="acoes"><button class="btn branco pequeno" data-a="setup-nunca">Não mostrar de novo</button><button class="btn verde pequeno" data-a="fechar">Agora não</button></div>`);
}
const OB_PASSOS = 5;
function modalBoasVindas() {
  const fala = (t) => `<div class="flui-fala"><div class="mascote">${MASCOTE}</div><div class="balao">${t}</div></div>`;
  abrirModal(`<form data-form="boas-vindas" data-passo="1">
    <div class="ob-topo"><button type="button" class="ob-voltar oculto" data-a="ob-voltar" aria-label="Voltar">‹</button><div class="ob-barra"><span style="width:25%"></span></div></div>
    <section data-ob="1">${fala('Oi! Eu sou o Flui. Vou te fazer 5 perguntinhas rápidas para deixar tudo pronto para você.')}
      <div class="campo"><label>Como posso te chamar?</label><input autocapitalize="sentences" class="inp" name="nome" placeholder="Seu nome" autocomplete="given-name"></div></section>
    <section data-ob="2" class="oculto">${fala('Quanto você recebe por mês? Assim eu já te mostro quanto sobra.')}
      <div class="campo"><label>Salário ou renda fixa por mês</label><input class="inp" name="salario" inputmode="decimal" placeholder="R$ 0,00"></div>
      <div class="campo"><label>Que dia costuma cair? <span class="opc">opcional</span></label><input class="inp" type="number" min="1" max="31" name="diaSalario" placeholder="Ex.: 5"></div>
      <p class="mini">Não tem renda fixa? Pode pular.</p></section>
    <section data-ob="3" class="oculto">${fala('Quais bancos você usa? Só eles vão aparecer nas listas do app.')}
      <div class="campo">${chipsBancos([])}</div>
      <div style="display:flex;gap:8px"><input autocapitalize="sentences" class="inp" data-ob-banco-novo placeholder="Não achou? Digite o nome"><button type="button" class="btn pequeno" data-a="ob-banco-add">Adicionar</button></div></section>
    <section data-ob="4" class="oculto">${fala('Com o que você costuma gastar? Deixe marcado só o que faz sentido para você.')}
      <div class="campo"><div class="cats" data-ob-cats>${st().categorias.filter((c) => c.tipo === 'despesa' && !c.arquivada).sort(ordemCat).map((c) => `<button type="button" class="ativo" data-ob-cat="${c.id}">${catIcone(c, 16)} ${esc(c.nome)}</button>`).join('')}</div></div>
      <div style="display:flex;gap:8px"><input autocapitalize="sentences" class="inp" data-ob-cat-nova placeholder="Falta alguma? Digite o nome"><button type="button" class="btn pequeno" data-a="ob-cat-add">Adicionar</button></div></section>
    <section data-ob="5" class="oculto">${fala('Quais desses têm cartão? Escolha se é crédito, débito ou os dois. Me conta o dia que a fatura vence que eu te aviso antes.')}
      <div data-ob-cartoes></div></section>
    <div class="acoes"><button type="button" class="btn branco" data-a="ob-pular">Pular</button><button type="button" class="btn verde" data-a="ob-prox">Continuar</button></div></form>`);
}
function obCartoes(f) {
  const bancos = [...f.querySelectorAll('[data-banco-tg].ativo')].map((b) => b.dataset.bancoTg);
  const box = f.querySelector('[data-ob-cartoes]');
  const antes = {}; box.querySelectorAll('[data-ob-cc]').forEach((r) => { antes[r.dataset.obCc] = { on: r.querySelector('input[type=checkbox]').checked, dia: r.querySelector('input[type=number]').value, tipo: r.querySelector('[data-ob-tipo]').value }; });
  box.innerHTML = bancos.length ? bancos.map((b) => { const a = antes[b] || {}; return `<div class="ob-cc ${a.on ? 'on' : ''}" data-ob-cc="${esc(b)}"><label><input type="checkbox" ${a.on ? 'checked' : ''}> <b>${esc(b)}</b></label><select class="inp ob-tipo" data-ob-tipo>${TIPOS_CARTAO.map(([v, n]) => `<option value="${v}" ${(a.tipo || 'credito') === v ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="mini">vence dia</span><input class="inp" type="number" min="1" max="31" inputmode="numeric" placeholder="—" value="${esc(a.dia || '')}" data-ob-dia></div>`; }).join('') + '<p class="mini">Não tem cartão? É só tocar em Concluir.</p>'
    : '<p class="mini">Nenhum banco marcado. Dá para cadastrar cartões depois.</p>';
}
function obIr(f, n) {
  n = Math.max(1, Math.min(OB_PASSOS, n)); f.dataset.passo = n;
  if (n === 5) obCartoes(f);
  f.querySelectorAll('[data-ob]').forEach((s) => s.classList.toggle('oculto', +s.dataset.ob !== n));
  f.querySelector('.ob-barra span').style.width = `${(n / OB_PASSOS) * 100}%`;
  f.querySelector('.ob-voltar').classList.toggle('oculto', n === 1);
  f.querySelector('[data-a=ob-prox]').textContent = n === OB_PASSOS ? 'Concluir' : 'Continuar';
  f.querySelector('[data-a=ob-pular]').classList.toggle('oculto', n === 1);
  const foco = f.querySelector(`[data-ob="${n}"] input.inp:not([disabled])`); if (foco && n < 3) foco.focus();
}

// ======================= EVENTOS =======================
document.addEventListener('click', async (e) => {
  const catBtn = e.target.closest('[data-cat]');
  if (catBtn) { const w = catBtn.closest('form'); w.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('ativo', b === catBtn)); w.categoriaId.value = catBtn.dataset.cat; metaHint(w); return; }
  if (e.target.matches('[data-a=repete-tg]')) { e.target.closest('form').querySelector('[data-repete]').classList.toggle('oculto', !e.target.checked); return; }
  if (e.target.matches('[data-a=repete-fim-tg]')) { e.target.closest('form').querySelector('[data-repete-fim]').classList.toggle('oculto', e.target.checked); return; }
  const stBtn = e.target.closest('[data-status]');
  if (stBtn) { const f = stBtn.closest('form'); f.status.value = stBtn.dataset.status; f.querySelectorAll('[data-status]').forEach((b) => b.classList.toggle('ativo', b === stBtn)); f.querySelector('[data-venc]')?.classList.toggle('oculto', stBtn.dataset.status !== 'pendente'); return; }
  const icBtn = e.target.closest('[data-icone]');
  if (icBtn) { const w = icBtn.closest('form'); w.querySelectorAll('[data-icone]').forEach((b) => b.classList.toggle('ativo', b === icBtn)); w.icone.value = icBtn.dataset.icone; return; }
  const corBtn = e.target.closest('[data-cor]');
  if (corBtn) { const w = corBtn.closest('form'); w.querySelectorAll('[data-cor]').forEach((b) => b.classList.toggle('ativo', b === corBtn)); w.cor.value = corBtn.dataset.cor;
    const pv = w.querySelector('[data-cc-previa]'); if (pv) { pv.style.background = corBtn.dataset.cor; w.querySelector('[data-cores-cartao]').dataset.manual = '1'; } return; }
  const tipoBtn = e.target.closest('[data-seg=tipo] [data-tipo]');
  if (tipoBtn) {
    const f = tipoBtn.closest('form'); const t = tipoBtn.dataset.tipo; f.tipo.value = t;
    f.querySelectorAll('[data-tipo]').forEach((b) => b.classList.toggle('ativo', b === tipoBtn));
    const w = f.querySelector('[data-cats-wrap]'); if (w) w.innerHTML = chipsCat(t, ''); f.querySelector('.meta-hint')?.remove();
    const cr = f.querySelector('[data-credito]'); if (cr) cr.classList.toggle('oculto', !(f.forma && f.forma.value === 'Crédito' && !f.dataset.id && t === 'despesa'));
    const sw = f.querySelector('[data-status-wrap]'); if (sw) sw.innerHTML = chipsStatus(t, '');
    const vc = f.querySelector('[data-venc]'); if (vc) vc.classList.add('oculto');
    const dr = f.querySelector('[data-dia-renda]'); if (dr) dr.classList.toggle('oculto', t !== 'entrada');
    const mo = f.querySelector('[data-a=mais-opcoes]'); if (mo && mo.textContent.startsWith('+')) mo.textContent = t === 'despesa' ? '+ Mais opções (data, vencimento, observação)' : '+ Mais opções (data, observação)';
    if (t === 'guardar' && !st().settings.dicaGuardar) { let d = f.querySelector('.dica-guardar'); if (!d) { d = document.createElement('div'); d.className = 'dica-guardar'; d.innerHTML = `${svgIcone('alvo', 18)}<span><b>O que você guarda vai para as Metas.</b> Cada categoria de guardar tem uma meta. Lá você define quanto quer juntar e acompanha a barra enchendo.</span>`; f.querySelector('[data-seg]')?.after(d); } store.salvarSettings({ dicaGuardar: true }); }
    const sel = f.status; if (sel) sel.innerHTML = (t === 'entrada' ? [['recebido', 'Recebido'], ['a receber', 'A receber']] : [['pago', 'Pago'], ['pendente', 'Pendente']]).map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    return;
  }
  const fBtn = e.target.closest('[data-forma]');
  if (fBtn) { const f = fBtn.closest('form'); const novo = f.forma.value === fBtn.dataset.forma ? '' : fBtn.dataset.forma; f.forma.value = novo;
    f.querySelectorAll('[data-forma]').forEach((b) => b.classList.toggle('ativo', b.dataset.forma === novo));
    const cr = f.querySelector('[data-credito]'); if (cr) cr.classList.toggle('oculto', !(novo === 'Crédito' && !f.dataset.id && f.tipo.value === 'despesa')); previaParcelasL(); return; }
  const decBtn = e.target.closest('[data-dec]');
  if (decBtn) { const f = decBtn.closest('form'); f.acao.value = decBtn.dataset.dec; f.querySelectorAll('[data-dec]').forEach((b) => b.classList.toggle('ativo', b === decBtn));
    f.querySelectorAll('[data-dec-campos]').forEach((x) => x.classList.toggle('oculto', x.dataset.decCampos !== decBtn.dataset.dec)); f.querySelector('button[type=submit]').disabled = false; previaDecisao(f); return; }
  const obF = e.target.closest('form[data-form=boas-vindas]');
  if (obF) {
    const ccBox = e.target.closest('[data-ob-cc]');
    if (ccBox && e.target.matches('input[type=checkbox]')) { const on = e.target.checked; ccBox.classList.toggle('on', on); if (on) ccBox.querySelector('input[type=number]').focus(); return; }
    if (ccBox && e.target.matches('[data-ob-dia]')) { const cb = ccBox.querySelector('input[type=checkbox]'); if (!cb.checked) { cb.checked = true; ccBox.classList.add('on'); } return; }
    const ob = e.target.closest('[data-a^=ob-]')?.dataset.a; const n = +obF.dataset.passo;
    if (ob === 'ob-voltar') return obIr(obF, n - 1);
    if (ob === 'ob-pular') { if (n === 2) { obF.salario.value = ''; obF.diaSalario.value = ''; } if (n === 5) obF.querySelectorAll('[data-ob-cc] input[type=checkbox]').forEach((c) => { c.checked = false; }); return n === OB_PASSOS ? enviarForm(obF) : obIr(obF, n + 1); }
    if (ob === 'ob-prox') { if (n === 2 && obF.salario.value && !(parseValor(obF.salario.value) > 0)) return alert('Digite um valor válido ou toque em Pular.'); return n === OB_PASSOS ? enviarForm(obF) : obIr(obF, n + 1); }
    const catB = e.target.closest('[data-ob-cat]'); if (catB) { catB.classList.toggle('ativo'); return; }
    if (ob === 'ob-cat-add') { const inp = obF.querySelector('[data-ob-cat-nova]'); const v = inp.value.trim(); if (!v) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'ativo'; b.dataset.obCatNova = v; b.textContent = v; b.addEventListener('click', () => b.classList.toggle('ativo')); obF.querySelector('[data-ob-cats]').appendChild(b); inp.value = ''; return; }
    if (ob === 'ob-banco-add') { const inp = obF.querySelector('[data-ob-banco-novo]'); const v = inp.value.trim(); if (!v) return; const ex = [...obF.querySelectorAll('[data-banco-tg]')].find((b) => b.dataset.bancoTg.toLowerCase() === v.toLowerCase());
      if (ex) { ex.classList.add('ativo'); ex.textContent = '✓ ' + ex.dataset.bancoTg; } else { const b = document.createElement('button'); b.type = 'button'; b.className = 'ativo'; b.dataset.bancoTg = v; b.textContent = '✓ ' + v; obF.querySelector('[data-bancos]').appendChild(b); }
      inp.value = ''; return; }
  }
  const bTg = e.target.closest('[data-banco-tg]');
  if (bTg) { const b = bTg.dataset.bancoTg; const sel = st().settings.bancos || []; const novo = sel.includes(b) ? sel.filter((x) => x !== b) : [...sel, b];
    if (bTg.closest('form')) { bTg.classList.toggle('ativo'); bTg.textContent = (bTg.classList.contains('ativo') ? '✓ ' : '') + b; return; }
    await store.salvarSettings({ bancos: novo }); return; }
  const tcBtn = e.target.closest('[data-tipocartao]');
  if (tcBtn) { const f = tcBtn.closest('form'); f.tipo.value = tcBtn.dataset.tipocartao; f.querySelectorAll('[data-tipocartao]').forEach((b) => b.classList.toggle('ativo', b === tcBtn)); f.querySelector('[data-venc-cartao]')?.classList.toggle('oculto', tcBtn.dataset.tipocartao === 'debito'); return; }
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (e.target.closest('[data-stop]') && el.tagName !== 'INPUT') return;
  const a = el.dataset.a; const id = el.dataset.id;
  if (a === 'fechar-fundo' && (e.target !== el || el.querySelector('[data-form=boas-vindas]'))) return;
  if (['fatura-tudo', 'item-pago', 'fixo-pago', 'importar', 'arquivo-extrato', 'busca', 'orc', 'nome', 'prev-parc'].includes(a)) return; // tratados em 'change'/'input'
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
    case 'aviso-ok': await store.salvarSettings({ alertasVistos: { ...(S.settings.alertasVistos || {}), [el.dataset.k]: true } }); modalNotificacoes(); break;
    case 'notificacoes': modalNotificacoes(); break;
    case 'limites-toggle': ui.limitesTodos = !ui.limitesTodos; render(); break;
    case 'novo-lanc': modalLanc(); break;
    case 'mais-opcoes-cartao': { const x = $('[data-extras]'); x.classList.toggle('oculto'); el.textContent = x.classList.contains('oculto') ? '+ Dia de vencimento da fatura (opcional)' : '− Menos opções'; break; }
    case 'mais-opcoes': { const x = $('[data-extras]'); x.classList.toggle('oculto'); el.textContent = x.classList.contains('oculto') ? '+ Mais opções (data, vencimento, observação)' : '− Menos opções'; break; }
    case 'abrir-mov': {
      const o = el.dataset.origem;
      if (o === 'lanc') modalLanc({ ...S.lancamentos.find((x) => x.id === id) });
      else if (o === 'cartao') modalCompra({ ...S.compras.find((x) => x.id === id) });
      else modalFixo({ ...S.recorrencias.find((x) => x.id === id) });
      break; }
    case 'ver-cat': ui.filtroCat = id; ui.filtroTipo = 'todos'; location.hash = '#lancamentos'; break;
    case 'an-evo': ui.anEvo = !ui.anEvo; render(); break;
    case 'an-todas': ui.anTodas = !ui.anTodas; render(); break;
    case 'filtro-cat-ir': ui.manterPeriodo = true; ui.filtroCat = el.dataset.id; ui.filtroTipo = 'todos'; location.hash = '#lancamentos'; break;
    case 'kpi-ir': ui.manterPeriodo = el.dataset.v !== 'metas'; if (el.dataset.v === 'metas') location.hash = '#metas'; else { ui.filtroTipo = el.dataset.v; location.hash = '#lancamentos'; } break;
    case 'abrir-busca': if (ui.buscaAberta || ui.busca) { ui.buscaAberta = false; ui.busca = ''; render(); } else { ui.buscaAberta = true; render(); setTimeout(() => $('[data-a=busca]')?.focus(), 30); } break;
    case 'filtro-tipo': ui.filtroTipo = el.dataset.v; render(); break;
    case 'filtro-cat-limpa': ui.filtroCat = ''; render(); break;
    case 'excluir-lanc': if (confirm('Excluir este lançamento?')) { await store.remover('lancamentos', $('[data-form=lanc]').dataset.id); fecharModal(); toast('Lançamento excluído.'); } break;
    case 'nova-compra': modalCompra(); break;
    case 'editar-compra': modalCompra({ ...S.compras.find((x) => x.id === id) }); break;
    case 'excluir-compra': if (confirm('Excluir esta compra e todas as parcelas?')) { await store.remover('compras', $('[data-form=compra]').dataset.id); fecharModal(); toast('Compra excluída.'); } break;
    case 'ver-cartao': ui.cartaoSel = el.dataset.id; render(); document.querySelector('.abas-cartao, [data-painel-cartao]')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); break;
    case 'aba-cartao': ui.abaCartao = el.dataset.v; render(); break;
    case 'decidir-fatura': modalDecisao(el.dataset.id || '', el.dataset.m); break;
    case 'desfazer-decisao': { const k = `${el.dataset.id || 'sem'}|${el.dataset.m}`; const ds = { ...(S.settings.faturaDecisoes || {}) }; const d = ds[k]; if (!d) break;
      if (!confirm('Desfazer a escolha desta fatura? Ela volta a ficar em aberto.')) break;
      if (d.jurosCompraId) await store.remover('compras', d.jurosCompraId);
      const patch = {}; if (d.acao === 'paguei') { const fp = { ...(S.settings.faturasPagas || {}) }; delete fp[k]; patch.faturasPagas = fp; }
      delete ds[k]; await store.salvarSettings({ ...patch, faturaDecisoes: ds }); toast('Escolha desfeita.'); render(); break; }
    case 'fatura-toggle': { const sF = (ui.faturasAbertas ||= new Set()); if (sF.has(el.dataset.k)) sF.delete(el.dataset.k); else sF.add(el.dataset.k); render(); break; }
    case 'importar-extrato': ui.impDestino = ''; modalImportar(); break;
    case 'conferir-depois': fecharModal(); if (!perguntarAssinaturas(el.dataset.v)) avisoCompleto(el.dataset.v, ui.ultimoTipo || 'fatura', 'Importado!'); break;
    case 'assin-pular': ui.assinaturas = []; fecharModal(); avisoCompleto(el.dataset.v, 'fatura', 'Fatura importada!'); break;
    case 'imp-de-novo': ui.impDestino = el.dataset.v; modalImportar(); break;
    case 'imp-dest': ui.impDestino = el.dataset.v; modalImportar(); break;
    case 'meta-alvo-ok': { const inp = document.querySelector(`[data-meta-alvo="${id}"]`); const v = parseValor(inp?.value); if (!(v > 0)) { inp?.focus(); break; }
      const ini = parseValor(document.querySelector(`[data-meta-ini="${id}"]`)?.value) || 0;
      const mt = S.metas.find((x) => x.id === id); await store.salvar('metas', { ...mt, alvo: v, valorInicial: ini }); toast('Meta definida! Agora é ver a barra encher.', true); break; }
    case 'aba-cats': ui.abaCats = el.dataset.v; render(); break;
    case 'tour-sim': ui.modal = null; ui.abaPlano = 'limites'; ui.tour = 0; ui.rota = ''; desenharTour(); break;
    case 'tour-nao': fecharModal(); ui.abaPlano = 'fixos'; location.hash = '#plano'; toast('Comece colocando sua renda e seus fixos.', true); break;
    case 'tour-prox': ui.tour++; if (ui.tour >= TOUR.length) { ui.tour = null; document.querySelector('.tour')?.remove(); ui.abaPlano = 'fixos'; location.hash = '#plano'; render(); toast('Agora é com você: comece pela renda e pelos fixos!', true); } else desenharTour(); break;
    case 'tour-sair': ui.tour = null; document.querySelector('.tour')?.remove(); break;
    case 'ver-tour': ui.abaPlano = 'limites'; ui.tour = 0; ui.rota = ''; desenharTour(); break;
    case 'limites-plano': ui.limitesPlano = !ui.limitesPlano; render(); break;
    case 'ocultar-aviso-fatura': (ui.faturasOcultas ||= new Set()).add(el.dataset.k); render(); break;
    case 'aba-plano': ui.abaPlano = el.dataset.v; render(); break;
    case 'aba-analise': ui.abaAnalise = el.dataset.v; render(); break;
    case 'ver-passou': location.hash = '#relatorios'; break;
    case 'setup-ir': { const v = el.dataset.v; ui.modal = null;
      if (v === 'renda') { ui.abaPlano = 'fixos'; location.hash = '#plano'; setTimeout(() => modalFixo({}, true), 80); }
      else if (v === 'fixo') { ui.abaPlano = 'fixos'; location.hash = '#plano'; setTimeout(() => modalFixo(), 80); }
      else if (v === 'limites') { ui.abaPlano = 'limites'; location.hash = '#plano'; }
      else { location.hash = '#cartoes'; setTimeout(() => modalCartao(), 80); }
      break; }
    case 'setup-nunca': await store.salvarSettings({ lembreteSetupOff: true }); fecharModal(); toast('Combinado, não aparece mais.'); break;
    case 'push-ativar': {
      try { if (typeof Notification === 'undefined') throw new Error('nao-suportado');
        const ok = await Notification.requestPermission(); if (ok !== 'granted') { toast('Sem permissão, não dá para avisar.'); render(); break; }
        await store.backend.ativarPush(VAPID_KEY); await store.salvarSettings({ pushAtivo: true }); toast('Notificações ativadas! 🔔', true);
      } catch (err) { toast(err.message === 'nao-suportado' ? 'Este navegador não aceita notificações.' : 'Não consegui ativar agora. Tente de novo.'); }
      render(); break; }
    case 'restaurar-juntar': { const d = ui.restaurar; if (!d) break; fecharModal(); await store.juntarTudo(d); ui.restaurar = null; toast('Pronto, juntei os dados!', true); location.hash = '#inicio'; break; }
    case 'restaurar-substituir': { const d = ui.restaurar; if (!d) break; if (!confirm('Isso apaga os dados atuais e fica só com o arquivo. Antes, vou baixar uma cópia do que existe hoje. Continuar?')) break;
      baixar(`flui-antes-de-restaurar-${new Date().toISOString().slice(0, 10)}.json`, store.exportar()); fecharModal(); await store.substituirTudo(d); ui.restaurar = null; toast('Backup restaurado!', true); location.hash = '#inicio'; break; }
    case 'baixar-planilha': baixarPlanilha(); break;
    case 'excluir-conta': abrirModal(`<div class="excluir-box"><h3>Excluir sua conta?</h3>
        <p>Tem certeza? Seus dados ficam guardados por <b>3 dias</b>. Depois disso, a conta e tudo o que está nela são <b>apagados para sempre</b>.</p>
        <p class="mini">Se mudar de ideia nesses 3 dias, é só entrar de novo e tocar em "Cancelar exclusão". Antes, você pode baixar sua planilha em Backup.</p>
        <div class="acoes"><button class="btn branco" data-a="fechar">Voltar</button><button class="btn vermelho-btn" data-a="excluir-confirmar">Sim, excluir</button></div></div>`); break;
    case 'excluir-confirmar': { const quando = new Date(Date.now() + 3 * 864e5).toISOString(); await store.salvarSettings({ exclusaoEm: quando }); fecharModal();
      alert(`Pronto. Sua conta será excluída em ${new Date(quando).toLocaleDateString('pt-BR')}. Até lá, é só entrar de novo para cancelar.`); await store.backend.signOut(); break; }
    case 'cancelar-exclusao': await store.salvarSettings({ exclusaoEm: '' }); toast('Exclusão cancelada. Que bom que você ficou! 💚', true); render(); break;
    case 'saldo-conta': { const sc = C.saldoConta(st());
      abrirModal(`${topoModal('Saldo na conta')}<form data-form="saldo-conta"><p style="margin:0 0 12px">O Flui calcula: tudo que entrou menos tudo que você pagou e guardou. Se não bater com o banco, coloque aqui o valor certo e ele segue contando a partir dele.</p>
        <div class="campo"><label>Saldo no banco hoje</label><input class="inp valor-grande num" name="valor" inputmode="decimal" placeholder="R$ 0,00" value="${sc === null ? '' : valorInput(sc)}" required autocomplete="off"></div>
        <button class="btn verde" style="width:100%">Salvar</button></form>`); break; }
    case 'zerar': { const imps = (st().settings.importacoes || []).slice().reverse(); const antigas = st().lancamentos.some((l) => l.importId && !l.lote);
      abrirModal(`${topoModal('Apagar dados')}<p style="margin:0 0 12px">O que você quer apagar?</p>
        <div class="opcoes-dec">
        <button type="button" class="op-dec" data-a="zerar-tipo" data-v="mes"><span class="op-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></span><span><b>Um mês</b><small>Lançamentos, compras no cartão e pagamentos daquele mês</small></span></button>
        <button type="button" class="op-dec" data-a="zerar-tipo" data-v="imp" ${imps.length || antigas ? '' : 'disabled'}><span class="op-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg></span><span><b>Uma importação</b><small>${imps.length || antigas ? 'Desfaz um extrato importado' : 'Você ainda não importou nada'}</small></span></button>
        <button type="button" class="op-dec" data-a="zerar-tipo" data-v="tudo"><span class="op-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></span><span><b>Tudo</b><small>Começar do zero. Categorias, bancos e cartões ficam.</small></span></button></div>
        <div data-zerar-box></div>`); break; }
    case 'zerar-tipo': { const box = $('[data-zerar-box]'); const t = el.dataset.v; const imps = (st().settings.importacoes || []).slice().reverse(); const antigas = st().lancamentos.filter((l) => l.importId && !l.lote).length;
      box.innerHTML = t === 'mes' ? `<div class="campo" style="margin-top:12px"><label>Qual mês?</label><input class="inp" type="month" data-zerar-mes value="${C.mesAtual()}"></div><button class="btn vermelho-btn" style="width:100%" data-a="zerar-ok" data-v="mes">Apagar este mês</button>`
        : t === 'imp' ? `<div class="lista" style="margin-top:12px">${imps.map((x) => `<button class="item" data-a="zerar-ok" data-v="imp" data-id="${x.id}" style="width:100%;background:none;border:none;border-top:2px solid var(--linha);font:inherit;text-align:left;cursor:pointer;color:inherit"><div class="meio"><div class="titulo">${esc(x.arquivo)}</div><div class="det">${new Date(x.quando).toLocaleDateString('pt-BR')} · ${x.qtd} itens · ${esc(x.onde || '')}</div></div><div class="valor neg">Apagar</div></button>`).join('')}
          ${antigas ? `<button class="item" data-a="zerar-ok" data-v="imp" data-id="antigas" style="width:100%;background:none;border:none;border-top:2px solid var(--linha);font:inherit;text-align:left;cursor:pointer;color:inherit"><div class="meio"><div class="titulo">Importações antigas</div><div class="det">${antigas} lançamentos importados antes desta opção existir</div></div><div class="valor neg">Apagar</div></button>` : ''}</div>`
        : `<p style="margin:12px 0" class="mini">Antes de apagar, o Flui baixa um backup para você poder voltar atrás.</p><button class="btn vermelho-btn" style="width:100%" data-a="zerar-ok" data-v="tudo">Apagar tudo</button>`; break; }
    case 'zerar-ok': { const S = st(); const t = el.dataset.v; let lanc = [], comp = [], extra = {}, desc = '';
      if (t === 'mes') { const m = $('[data-zerar-mes]').value; if (!m) break; lanc = S.lancamentos.filter((l) => l.mes === m); comp = S.compras.filter((c) => c.mesPrimeira === m);
        const tira = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.endsWith('|' + m))); extra = { pagamentosFatura: tira(S.settings.pagamentosFatura), faturasPagas: tira(S.settings.faturasPagas), faturaDecisoes: tira(S.settings.faturaDecisoes) }; desc = C.nomeMes(m, true); }
      else if (t === 'imp') { const id = el.dataset.id; lanc = S.lancamentos.filter((l) => id === 'antigas' ? l.importId && !l.lote : l.lote === id); comp = S.compras.filter((c) => c.lote === id); extra = { importacoes: (S.settings.importacoes || []).filter((x) => x.id !== id), pagImportadosLista: (S.settings.pagImportadosLista || []).filter((x) => x.lote !== id) }; desc = 'essa importação'; }
      else { lanc = S.lancamentos; comp = S.compras; desc = 'TUDO'; }
      const n = lanc.length + comp.length + (t === 'tudo' ? S.recorrencias.length : 0);
      if (!confirm(`Apagar ${desc}? São ${n} itens. Não dá para desfazer${t === 'tudo' ? ' (mas vou baixar um backup antes)' : ''}.`)) break;
      if (t === 'tudo') { baixar(`flui-antes-de-apagar-${new Date().toISOString().slice(0, 10)}.json`, store.exportar());
        for (const r of S.recorrencias) await store.remover('recorrencias', r.id); for (const mt of S.metas) await store.salvar('metas', { ...mt, valorInicial: 0 });
        extra = { pagamentosFatura: {}, faturasPagas: {}, faturaDecisoes: {}, parcelasPagas: {}, importacoes: [], saldoBase: null, pagImportadosLista: [], pagAlocado: {} }; }
      for (const l of lanc) await store.remover('lancamentos', l.id); for (const c of comp) await store.remover('compras', c.id);
      if (Object.keys(extra).length) await store.salvarSettings(extra);
      if (t === 'imp') await realocarPagamentos();
      { const S2 = st(); const vivos = new Set([...S2.lancamentos, ...S2.compras].map((x) => x.lote).filter(Boolean)); const li = (S2.settings.importacoes || []).filter((x) => vivos.has(x.id)); if (li.length !== (S2.settings.importacoes || []).length) await store.salvarSettings({ importacoes: li }); }
      fecharModal(); toast(`Pronto, apaguei ${n} itens.`, true); render(); break; }
    case 'legenda-toggle': ui.legendaToda = !ui.legendaToda; render(); break;
    case 'novo-cartao': modalCartao(); break;
    case 'editar-cartao': modalCartao({ ...S.cartoes.find((x) => x.id === id) }); break;
    case 'excluir-cartao': { const cid = $('[data-form=cartao]').dataset.id; const n = S.compras.filter((c) => c.cartaoId === cid).length;
      if (confirm(n ? `Esse cartão tem ${n} compra(s). Elas continuam, mas ficam como "sem cartão definido". Excluir?` : 'Excluir este cartão?')) {
        for (const c of S.compras.filter((c) => c.cartaoId === cid)) await store.salvar('compras', { ...c, cartaoId: '' });
        await store.remover('cartoes', cid); fecharModal(); } break; }
    case 'novo-fixo': modalFixo(); break;
    case 'novo-salario': modalFixo({}, true); break;
    case 'editar-fixo': modalFixo({ ...S.recorrencias.find((x) => x.id === id) }, S.recorrencias.find((x) => x.id === id)?.tipo === 'entrada'); break;
    case 'excluir-fixo': if (confirm('Excluir este fixo? Ele deixa de aparecer em todos os meses.')) { await store.remover('recorrencias', $('[data-form=fixo]').dataset.id); fecharModal(); } break;
    case 'nova-cat': modalCat(); break;
    case 'editar-cat': modalCat({ ...S.categorias.find((x) => x.id === id) }); break;
    case 'excluir-cat': { const cid = $('[data-form=cat]').dataset.id; const usada = S.lancamentos.some((l) => l.categoriaId === cid) || S.compras.some((l) => l.categoriaId === cid) || S.recorrencias.some((l) => l.categoriaId === cid);
      if (usada) { alert('Essa categoria já tem lançamentos. Para não perder o histórico, use "Arquivar".'); break; }
      if (confirm('Excluir esta categoria?')) { await store.remover('categorias', cid); fecharModal(); } break; }
    case 'nova-meta': modalMeta(); break;
    case 'editar-meta': modalMeta({ ...S.metas.find((x) => x.id === id) }); break;
    case 'excluir-meta': if (confirm('Excluir esta meta?')) { await store.remover('metas', $('[data-form=meta]').dataset.id); fecharModal(); } break;
    case 'fatura-valor': { const k = el.dataset.k; const inp = document.querySelector(`[data-valor-fatura="${k}"]`); const falta = parseValor(inp?.value);
      if (isNaN(falta) || falta < 0) { toast('Digite quanto falta pagar.'); break; }
      const v = Math.max(0, Math.round((+inp.dataset.total - falta) * 100) / 100); const pf = { ...(S.settings.pagamentosFatura || {}) }; pf[k] = v;
      await store.salvarSettings({ pagamentosFatura: pf, pagManual: { ...(S.settings.pagManual || {}), [k]: true } }); toast(`Pronto: pago ${brl(v)}, falta ${brl(falta)}.`, true); render(); break; }
    case 'fatura-tudo-pago': { const f0 = C.fatura(S, el.dataset.id || '', el.dataset.m); const pf = { ...(S.settings.pagamentosFatura || {}), [el.dataset.k]: f0.total };
      await store.salvarSettings({ pagamentosFatura: pf, pagManual: { ...(S.settings.pagManual || {}), [el.dataset.k]: true } }); toast('Fatura paga!', true); render(); break; }
    case 'fatura-valor-limpa': { const pm = { ...(S.settings.pagManual || {}) }; delete pm[el.dataset.k]; await store.salvarSettings({ pagManual: pm }); const pf = { ...(S.settings.pagamentosFatura || {}), [el.dataset.k]: 0 }; const fp = { ...(S.settings.faturasPagas || {}) }; delete fp[el.dataset.k]; await store.salvarSettings({ pagamentosFatura: pf, faturasPagas: fp }); render(); break; }
    case 'cat-nova': {
      const w = el.closest('[data-cats-wrap]'); if (!w) break;
      el.outerHTML = `<span style="display:inline-flex;gap:6px;align-items:center" data-cat-nova-box><input autocapitalize="sentences" class="inp" style="padding:7px 12px;width:170px" placeholder="Nome da categoria" data-cat-nova-nome data-tipo-cat="${el.dataset.tipoCat}"><button type="button" class="btn pequeno verde" data-a="cat-nova-ok">OK</button></span>`;
      w.querySelector('[data-cat-nova-nome]').focus(); break; }
    case 'cat-nova-ok': {
      const w = el.closest('[data-cats-wrap]'); const inp = w.querySelector('[data-cat-nova-nome]'); const nome = inp.value.trim();
      if (!nome) { inp.focus(); break; }
      const tipo = inp.dataset.tipoCat;
      const existe = S.categorias.find((c) => c.nome.toLowerCase() === nome.toLowerCase() && c.tipo === tipo);
      const PAL = ['#268AFF', '#77C800', '#FF9600', '#CE82FF', '#FF4B4B', '#1CB0F6', '#FFC800', '#2BDCA0', '#FF86D0', '#8E6CFF', '#A5683B', '#3BB9A0'];
      const nova = existe || await store.salvar('categorias', { nome, tipo, orcamento: 0, cor: PAL[S.categorias.length % PAL.length], arquivada: false });
      const form = w.closest('form'); w.innerHTML = chipsCat(tipo, nova.id); form.categoriaId.value = nova.id; if (tipo === 'guardar') await garantirMetas(); metaHint(form);
      toast(existe ? 'Essa categoria já existia, selecionei ela.' : `Categoria "${nome}" criada!`); break; }
    case 'banco-add': { const v = $('#novo-banco').value.trim(); if (v && !(S.settings.bancos || []).includes(v)) await store.salvarSettings({ bancos: [...(S.settings.bancos || []), v] }); break; }
    case 'fechar-ir-config': ui.modal = null; ui.abaCats = 'bancos'; location.hash = '#categorias'; render(); break;
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
  if (a === 'item-pago') { const k = `${el.dataset.id}|${el.dataset.m}`; const pp = { ...(S.settings.parcelasPagas || {}) }; if (el.checked) pp[k] = true; else delete pp[k];
    const c = S.compras.find((x) => x.id === el.dataset.id); const fk = `${c?.cartaoId || 'sem'}|${el.dataset.m}`; const fp = { ...(S.settings.faturasPagas || {}) }; if (!el.checked) delete fp[fk];
    await store.salvarSettings({ parcelasPagas: pp, faturasPagas: fp }); render(); }
  if (a === 'fatura-tudo') { const cid = el.dataset.id || ''; const m = el.dataset.m; const f = C.fatura(S, cid, m); const pp = { ...(S.settings.parcelasPagas || {}) }; const fp = { ...(S.settings.faturasPagas || {}) };
    for (const it of f.itens) { const k = `${it.compra.id}|${m}`; if (el.checked) pp[k] = true; else delete pp[k]; }
    if (el.checked) fp[`${cid || 'sem'}|${m}`] = true; else delete fp[`${cid || 'sem'}|${m}`];
    await store.salvarSettings({ parcelasPagas: pp, faturasPagas: fp }); toast(el.checked ? 'Fatura inteira marcada como paga! 💚' : 'Fatura em aberto.', el.checked); render(); }
  if (a === 'fatura-paga') { const k = `${el.dataset.id || 'sem'}|${el.dataset.m}`; const fp = { ...(S.settings.faturasPagas || {}) }; if (el.checked) fp[k] = true; else delete fp[k]; await store.salvarSettings({ faturasPagas: fp }); toast(el.checked ? 'Fatura marcada como paga.' : 'Fatura em aberto.'); }
  if (a === 'fixo-pago') { const r = S.recorrencias.find((x) => x.id === el.dataset.id); const pagos = { ...(r.pagos || {}) }; if (el.checked) pagos[el.dataset.m] = true; else delete pagos[el.dataset.m]; await store.salvar('recorrencias', { ...r, pagos }); }
  if (a === 'orc') { const c = S.categorias.find((x) => x.id === el.dataset.id); await store.salvar('categorias', { ...c, orcamento: parseValor(el.value) }); toast('Orçamento salvo.'); }
  if (a === 'nome') await store.salvarSettings({ nome: el.value.trim() });
  if (a === 'importar' && el.files[0]) {
    try {
      const dados = validarBackup(await el.files[0].text());
      const n = (dados.lancamentos || []).length + (dados.compras || []).length;
      ui.restaurar = dados;
      abrirModal(`${topoModal('Restaurar backup')}<p style="margin:0 0 14px">Esse arquivo tem <b>${n}</b> lançamentos e compras. O que você quer fazer?</p>
        <div class="opcoes-dec"><button type="button" class="op-dec" data-a="restaurar-juntar"><span class="op-ic">+</span><span><b>Juntar com o que já tenho</b><small>Mantém seus dados e acrescenta o que é novo</small></span></button>
        <button type="button" class="op-dec" data-a="restaurar-substituir"><span class="op-ic">↺</span><span><b>Ficar só com o arquivo</b><small>Apaga o que tem hoje e usa só o backup</small></span></button></div>`);
    } catch (err) { alert(err.message || 'Não consegui ler esse arquivo.'); } finally { el.value = ''; }
  }
});
function limparValor(t) {
  let v = t.value.replace(/[^\d,]/g, ''); const i = v.indexOf(',');
  if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, '').slice(0, 2);
  return v;
}
const ehTextoLivre = (t) => (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && (!t.getAttribute('type') || t.type === 'text'))) && !t.matches('[inputmode=decimal],[data-a=busca],[name=email]');
function previaCartao(f) {
  const pv = f.querySelector('[data-cc-previa]'); if (!pv) return;
  const banco = f.banco?.value || ''; f.querySelector('[data-cc-previa-nome]').textContent = f.apelido.value.trim() || banco || 'Seu cartão';
  const box = f.querySelector('[data-cores-cartao]');
  if (!box.dataset.manual && COR_BANCO[banco]) { const k = COR_BANCO[banco]; f.cor.value = k; pv.style.background = k; box.querySelectorAll('[data-cor]').forEach((b) => b.classList.toggle('ativo', b.dataset.cor === k)); }
}
document.addEventListener('change', (e) => { const f = e.target.closest('form[data-form=cartao]'); if (f) previaCartao(f); if (e.target.matches('[data-a=forma-fixo]')) e.target.closest('form').querySelector('[data-fixo-cartao]')?.classList.toggle('oculto', e.target.value !== 'Crédito'); });
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.matches('[data-a=arquivo-extrato]') && t.files[0]) {
    const arq = t.files[0]; const nome = arq.name.toLowerCase();
    try {
      if (nome.endsWith('.pdf')) throw new Error('PDF não dá para importar. No seu banco, baixe o extrato em OFX (ou CSV).');
      const txt = arq.text ? await arq.text() : await new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsText(arq); });
      const dados = /<OFX>|OFXHEADER/i.test(txt) ? lerOFX(txt) : lerCSV(txt);
      if (!dados.itens.length) throw new Error('Não encontrei movimentações nesse arquivo.');
      await prepararImportacao(dados); ui.importacao.arquivo = arq.name; if (ui.impDestino) { const b = ui.impDestino; ui.importacao.banco = b;
        if (dados.cartao) { const S = st(); let k = S.cartoes.find((x) => ehCredito(x) && (x.banco || x.nome) === b);
          if (!k) { k = await store.salvar('cartoes', { nome: b, banco: b, tipo: 'credito', vencimento: '', cor: COR_BANCO[b] || '#268AFF' }); toast(`Criei o cartão ${b}. Depois coloque o dia do vencimento em Cartões.`); }
          ui.importacao.destino = 'cc:' + k.id; } else ui.importacao.destino = 'conta:' + b; } modalRevisarImport();
    } catch (err) { alert(err.message || 'Não consegui ler esse arquivo.'); } finally { t.value = ''; }
    return;
  }
  if (t.matches('[data-imp-ok]')) { const l = ui.importacao.linhas[+t.dataset.impOk]; l.marcado = t.checked; t.closest('.imp-linha').classList.toggle('off', !t.checked);
    $('[data-imp-btn]').textContent = `Importar ${ui.importacao.linhas.filter((x) => x.marcado).length}`; return; }
  if (t.matches('[data-imp-cat]')) { const ls = ui.importacao.linhas; const l = ls[+t.dataset.impCat]; l.catId = t.value; l.mudou = true; const k = chaveRegra(l.texto); let n = 0;
    ls.forEach((x, i) => { if (x !== l && x.tipo === l.tipo && chaveRegra(x.texto) === k) { x.catId = t.value; x.mudou = true; const sel = document.querySelector(`[data-imp-cat="${i}"]`); if (sel) sel.value = t.value; n++; } });
    if (n) toast(`Mudei também ${n} parecido${n > 1 ? 's' : ''}.`); return; }
});
document.addEventListener('input', (e) => {
  if (e.target.matches('[data-form=fixo] [name=valor]')) { const f = e.target.closest('form'); const d = f.querySelector('[data-desde]'); if (d) d.classList.toggle('oculto', Math.abs(parseValor(e.target.value) - Number(e.target.dataset.orig || 0)) < 0.005); }
  if (e.target.matches('[data-ob-dia]')) { const r = e.target.closest('[data-ob-cc]'); const cb = r.querySelector('input[type=checkbox]'); cb.checked = !!e.target.value; r.classList.toggle('on', cb.checked); }
  if (e.target.closest('form[data-form=decisao]')) setTimeout(() => previaDecisao(e.target.closest('form')), 0);
  if (e.target.closest('form[data-form=cartao]')) setTimeout(() => previaCartao(e.target.closest('form')), 0);
  if (e.target.matches('input[inputmode=decimal]')) { const t = e.target; const novo = limparValor(t); if (novo !== t.value) { const pos = Math.max(0, (t.selectionStart || 0) - (t.value.length - novo.length)); t.value = novo; try { t.setSelectionRange(pos, pos); } catch (_) {} } }
  else if (ehTextoLivre(e.target)) { const t = e.target; const v = t.value; const m = v.match(/^(\s*)(\p{Ll})/u); if (m) { const pos = t.selectionStart; t.value = m[1] + m[2].toUpperCase() + v.slice(m[0].length); try { t.setSelectionRange(pos, pos); } catch (_) {} } }
  const a = e.target.dataset.a;
  if (a === 'busca') { ui.busca = e.target.value; const pos = e.target.selectionStart; render(); const b = $('[data-a=busca]'); b.focus(); b.setSelectionRange(pos, pos); }
  if (a === 'prev-parc') previaParcelas();
  if (a === 'prev-parc-l' || (e.target.name === 'valor' && e.target.closest('[data-form=lanc]'))) previaParcelasL();
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target; const tipoF = f.dataset.form; const id = f.dataset.id || undefined; const S = st();
  const v = (n) => (f.elements[n] ? f.elements[n].value.trim() : '');
  if (tipoF === 'auth') {
    const email = v('email'), senha = v('senha'); ui.authErro = ''; const lembrar = !!f.lembrar?.checked;
    gravarLocal('flui:lembrar', lembrar ? '1' : '0'); gravarLocal('flui:email', lembrar ? email.trim() : null);
    try { await store.backend.lembrar?.(lembrar); } catch (_) {}
    try { ui.authModo === 'criar' ? await store.backend.signUp(email, senha) : await store.backend.signIn(email, senha); }
    catch (err) { ui.authErro = ERROS_AUTH[err.code] || 'Não deu certo. Tente de novo.'; render(); }
    return;
  }
  if (tipoF === 'lanc') {
    const valor = parseValor(v('valor')); if (!(valor > 0)) return alert('Digite um valor maior que zero.');
    if (!v('categoriaId')) return alert('Escolha uma categoria.');
    if (!id && f.repete?.checked && v('forma') !== 'Crédito') {
      const inicio = lerMes('l-mes', f); const fim = f.repeteSemFim.checked ? '' : lerMes('l-fim', f);
      if (fim && C.difMeses(inicio, fim) < 0) return alert('O mês final precisa ser depois do inicial.');
      await store.salvar('recorrencias', { tipo: v('tipo'), valor, nome: v('descricao') || catNome(v('categoriaId')), categoriaId: v('categoriaId'), inicio, fim, diaVenc: '', frequencia: 'mensal', forma: v('forma'), banco: v('banco'), obs: v('obs'), ativa: true, pagos: {} });
      fecharModal(); toast(fim ? `Vai se repetir até ${C.nomeMes(fim)}.` : 'Vai se repetir todo mês.', true); return; }
    if (v('forma') === 'Crédito' && !id && v('tipo') === 'despesa') {
      const n = Math.max(1, parseInt(v('parcelas'), 10) || 1);
      await store.salvar('compras', { total: valor, parcelas: n, cartaoId: v('cartaoId'), descricao: v('descricao') || catNome(v('categoriaId')), categoriaId: v('categoriaId'), mesPrimeira: lerMes('l-mes', f), data: '' });
      fecharModal(); toast(n > 1 ? `Lançado no crédito em ${n}x!` : 'Lançado no crédito!', true); return; }
    const antigo = S.lancamentos.find((x) => x.id === id) || {};
    const novo = !id;
    await store.salvar('lancamentos', { ...antigo, id, tipo: v('tipo'), valor, categoriaId: v('categoriaId'), descricao: v('descricao'), mes: lerMes('l-mes', f), data: antigo.data || '', forma: v('forma'), banco: v('banco'), vencimento: v('tipo') !== 'despesa' ? '' : v('vencimento'), status: v('status') || (v('tipo') === 'entrada' ? 'recebido' : 'pago'), obs: antigo.obs || '' });
    fecharModal(); toast(novo ? (v('tipo') === 'guardar' ? 'Guardado! Seu eu do futuro agradece. 💚' : 'Prontinho, lançado!') : 'Salvo!', novo);
  }
  if (tipoF === 'compra') {
    const total = parseValor(v('total')); if (!(total > 0)) return alert('Digite o valor total.');
    if (!v('categoriaId')) return alert('Escolha uma categoria.');
    const antigo = S.compras.find((x) => x.id === id) || {};
    await store.salvar('compras', { ...antigo, id, total, parcelas: Math.max(1, parseInt(v('parcelas'), 10) || 1), cartaoId: v('cartaoId'), descricao: v('descricao'), categoriaId: v('categoriaId'), mesPrimeira: lerMes('c-mes', f), data: v('data') });
    fecharModal(); toast('Compra salva!');
  }
  if (tipoF === 'assinaturas') {
    let n = 0; for (const [i, a] of (ui.assinaturas || []).entries()) { if (!f.elements['a' + i]?.checked) continue;
      await store.salvar('recorrencias', { tipo: 'despesa', nome: a.nome, valor: a.valor, categoriaId: a.catId, inicio: C.addMes(a.mes, 1), fim: v('ate' + i) || '', frequencia: 'mensal', forma: 'Crédito', cartaoId: a.cartaoId, banco: '', obs: '', obsImport: a.texto, ativa: true, pagos: {} }); n++; }
    ui.assinaturas = []; fecharModal(); avisoCompleto(f.dataset.banco, 'fatura', n ? `${n} assinatura${n > 1 ? 's' : ''} agora ${n > 1 ? 'são fixas' : 'é fixa'} no cartão.` : 'Fatura importada!'); return;
  }
  if (tipoF === 'conferir-fatura') {
    const cid = f.dataset.id; const m = f.dataset.m; const saldo = parseValor(v('saldo'));
    if (cid && f.elements.falta) { const falta = parseValor(v('falta')); const k = `${cid}|${m}`; const fat = C.fatura(st(), cid, m);
      if (!isNaN(falta) && Math.abs(falta - Math.max(0, fat.aberto)) > 0.005) await store.salvarSettings({ pagamentosFatura: { ...(st().settings.pagamentosFatura || {}), [k]: Math.max(0, Math.round((fat.total - falta) * 100) / 100) }, pagManual: { ...(st().settings.pagManual || {}), [k]: true } }); }
    // o saldo por último (o valor pago da fatura muda a conta)
    if (!isNaN(saldo) && Math.abs(saldo - C.saldoConta(st())) > 0.005) await store.salvarSettings({ saldoBase: { valor: saldo, ref: C.realizadoConta(st()), em: new Date().toISOString() } });
    const bb = f.dataset.banco; fecharModal(); if (!perguntarAssinaturas(bb)) avisoCompleto(bb, ui.ultimoTipo || 'fatura', 'Tudo conferido!'); return;
  }
  if (tipoF === 'saldo-conta') {
    const valor = parseValor(v('valor')); if (isNaN(valor)) return;
    await store.salvarSettings({ saldoBase: { valor, ref: C.realizadoConta(S), em: new Date().toISOString() } }); fecharModal(); toast('Saldo atualizado!', true); render(); return;
  }
  if (tipoF === 'cartao') {
    const antigo = S.cartoes.find((x) => x.id === id) || {};
    if (!v('banco')) return alert('Escolha o banco.');
    const salvo = await store.salvar('cartoes', { ...antigo, id, nome: v('banco'), banco: v('banco'), tipo: v('tipo') || 'credito', vencimento: parseInt(v('vencimento'), 10) || '', fechamento: parseInt(v('fechamento'), 10) || '', apelido: v('apelido').trim(), cor: v('cor') || COR_BANCO[v('banco')] || '#268AFF' });
    const semCartao = S.compras.filter((c) => !c.cartaoId);
    if (ehCredito(salvo) && S.cartoes.filter(ehCredito).length === 1 && semCartao.length && confirm(`Você tem ${semCartao.length} compra(s) sem cartão definido. Colocar no ${nomeCartao(salvo)}?`)) {
      for (const c of semCartao) await store.salvar('compras', { ...c, cartaoId: salvo.id });
      toast(`${semCartao.length} compra(s) foram para o ${nomeCartao(salvo)}.`);
    }
    fecharModal(); toast('Cartão salvo!');
  }
  if (tipoF === 'fixo') {
    const valor = parseValor(v('valor')); if (!(valor > 0)) return alert('Digite o valor.');
    if (!v('categoriaId')) return alert('Escolha uma categoria.');
    const inicio = lerMes('f-ini', f); const fim = f.semFim.checked ? '' : lerMes('f-fim', f);
    if (fim && C.difMeses(inicio, fim) < 0) return alert('O mês final precisa ser depois do inicial.');
    const antigo = S.recorrencias.find((x) => x.id === id) || {};
    const desdeBox = f.querySelector('[data-desde]');
    if (id && desdeBox && !desdeBox.classList.contains('oculto')) {
      const desde = lerMes('f-desde', f);
      if (C.difMeses(antigo.inicio, desde) > 0 && (!fim || C.difMeses(desde, fim) >= 0)) {
        const pagosAntes = {}; const pagosDepois = {}; for (const [m, ok] of Object.entries(antigo.pagos || {})) (C.difMeses(desde, m) >= 0 ? pagosDepois : pagosAntes)[m] = ok;
        await store.salvar('recorrencias', { ...antigo, fim: C.addMes(desde, -1), pagos: pagosAntes });
        await store.salvar('recorrencias', { tipo: v('tipo'), valor, nome: v('nome') || catNome(v('categoriaId')), categoriaId: v('categoriaId'), inicio: desde, fim, diaVenc: v('tipo') === 'entrada' ? (parseInt(v('diaVenc'), 10) || '') : '', frequencia: v('frequencia'), forma: v('forma'), cartaoId: v('forma') === 'Crédito' ? v('cartaoId') : '', banco: v('banco'), obs: v('obs'), ativa: !(f.pausado && f.pausado.checked), pagos: pagosDepois });
        fecharModal(); toast(`Novo valor a partir de ${C.nomeMes(desde)}. Os meses antes não mudaram.`, true); return;
      }
    }
    await store.salvar('recorrencias', { ...antigo, id, tipo: v('tipo'), valor, nome: v('nome') || catNome(v('categoriaId')), categoriaId: v('categoriaId'), inicio, fim, diaVenc: v('tipo') === 'entrada' ? (parseInt(v('diaVenc'), 10) || '') : '', frequencia: v('frequencia'), forma: v('forma'), cartaoId: v('forma') === 'Crédito' ? v('cartaoId') : '', banco: v('banco'), obs: v('obs'), ativa: !(f.pausado && f.pausado.checked), pagos: antigo.pagos || {} });
    fecharModal(); toast('Fixo salvo!');
  }
  if (tipoF === 'cat') {
    const antigo = S.categorias.find((x) => x.id === id) || {};
    await store.salvar('categorias', { ...antigo, id, nome: v('nome'), tipo: v('tipo'), orcamento: parseValor(v('orcamento')), cor: v('cor'), icone: v('icone'), arquivada: !!(f.arquivada && f.arquivada.checked) });
    await garantirMetas(); fecharModal();
  }
  if (tipoF === 'meta') {
    const antigo = S.metas.find((x) => x.id === id) || {};
    await store.salvar('metas', { ...antigo, id, nome: v('nome'), alvo: parseValor(v('alvo')), valorInicial: parseValor(v('valorInicial')), dataAlvo: f.semData.checked ? '' : lerMes('m-data', f), categoriaId: v('categoriaId'), desde: antigo.desde || C.mesAtual() });
    fecharModal(); toast('Meta salva! Bora conquistar. 🎯');
  }
  if (tipoF === 'importar') {
    const im = ui.importacao; const sel = im.linhas.filter((l) => l.marcado && !l.ja);
    if (!sel.length) return alert('Nenhuma movimentação marcada.');
    const btn = $('[data-imp-btn]'); btn.disabled = true; btn.textContent = 'Importando...';
    const lote = 'imp-' + Date.now(); const registrar = (qtd, onde, banco, tipo, mes) => store.salvarSettings({ importacoes: [...(st().settings.importacoes || []), { id: lote, arquivo: im.arquivo || 'extrato', quando: new Date().toISOString(), qtd, onde, banco, tipo, mes }] });
    const mesDe = (ls) => ls.map((l) => l.mes).sort().pop() || C.mesAtual();
    const dest = im.destino || ''; const ccId = dest.startsWith('cc:') ? dest.slice(3) : ''; let bancoConta = dest.startsWith('conta:') ? dest.slice(6) : im.banco;
    if (ccId && !im.cartao) { // extrato da conta (débito/Pix) num cartão: o cartão passa a ser débito e crédito
      const k = S.cartoes.find((x) => x.id === ccId); if (k) { if (k.tipo !== 'ambos') { await store.salvar('cartoes', { ...k, tipo: 'ambos' }); toast(`${nomeCartao(k)} agora é débito e crédito.`); } bancoConta = k.banco || k.nome || bancoConta; }
    } else if (ccId) {
      const compras = sel.filter((l) => l.tipo === 'despesa');
      const conta = {}; for (const l of im.linhas.filter((x) => x.tipo === 'despesa')) conta[l.mes] = (conta[l.mes] || 0) + 1;
      const kSel = S.cartoes.find((x) => x.id === ccId); const conta2 = {}; for (const l of im.linhas.filter((x) => x.tipo === 'despesa')) { const mm = mesDaCompra(kSel, l.data); conta2[mm] = (conta2[mm] || 0) + 1; }
      const mesFat = Object.entries(conta2).sort((a, b) => b[1] - a[1])[0]?.[0] || C.mesAtual();
      const lista = [...(S.settings.pagImportadosLista || [])]; const jaPg = new Set(lista.map((x) => x.id)); let nPgF = 0;
      for (const l of im.linhas.filter((x) => x.tipo !== 'despesa' && /pagamento/i.test(x.texto || x.descricao || ''))) { const id = l.id || `pgf-${l.data}-${l.valorAbs}`; const novo = { id, valor: l.valorAbs, data: l.data, cartaoId: ccId, lote }; if (jaPg.has(id) || lista.some((x) => mesmoPag(x, novo))) continue; lista.push(novo); nPgF++; }
      if (nPgF) await store.salvarSettings({ pagImportadosLista: lista });
      for (const l of compras) {
        await store.salvar('compras', { total: l.valorAbs, parcelas: 1, cartaoId: ccId, descricao: l.descricao, categoriaId: l.catId, mesPrimeira: mesDaCompra(S.cartoes.find((x) => x.id === ccId), l.data), data: l.data, importId: l.id || '', lote }); }
      const regras = { ...(S.settings.regrasImport || {}) }; for (const l of im.linhas.filter((x) => x.mudou && x.catId)) regras[chaveRegra(l.texto)] = l.catId;
      await store.salvarSettings({ regrasImport: regras }); await realocarPagamentos(); const kk = S.cartoes.find((x) => x.id === ccId); const bk = kk?.banco || kk?.nome || ''; const catAss = S.categorias.find((c) => c.nome === 'Assinaturas' && c.tipo === 'despesa');
      ui.assinaturas = catAss ? compras.filter((l) => l.catId === catAss.id).map((l) => ({ nome: nomeAssin(l.texto || l.descricao), parc: (l.texto || '').match(/Parcela (\d+)\/(\d+)/i), texto: l.texto, valor: l.valorAbs, mes: mesDaCompra(kSel, l.data), cartaoId: ccId, catId: catAss.id })) : [];
      await registrar(compras.length, 'cartão', bk, 'fatura', mesFat); ui.importacao = null; fecharModal(); ui.ultimoTipo = 'fatura'; conferirFatura(ccId, mesFat, `${compras.length} compras lançadas no cartão!`); return;
    }
    im.banco = bancoConta;
    { const k = S.cartoes.find((x) => (x.banco || x.nome) === bancoConta && x.tipo === 'credito'); if (k && sel.some((l) => /D[ée]bito|Pix/i.test(l.forma || '') || /pix|d[ée]bito/i.test(l.descricao || ''))) await store.salvar('cartoes', { ...k, tipo: 'ambos' }); }
    // pagamentos de fatura que vieram no extrato da conta: viram "valor pago" da fatura do cartão desse banco (sem virar gasto)
    const kc = S.cartoes.find((x) => ehCredito(x) && (x.banco || x.nome) === bancoConta) || (S.cartoes.filter(ehCredito).length === 1 ? S.cartoes.find(ehCredito) : null);
    let nPag = 0;
    if (kc) { const lista = [...(S.settings.pagImportadosLista || [])]; const ja = new Set(lista.map((x) => x.id));
      for (const l of im.linhas.filter((x) => x.descricao === 'Pagamento de fatura' && x.tipo === 'despesa' && !x.ja)) {
        const id = l.id || `pg-${l.data}-${l.valorAbs}`; l.marcado = false; const novo = { id, valor: l.valorAbs, data: l.data, cartaoId: kc.id, lote }; if (ja.has(id) || lista.some((x) => mesmoPag(x, novo))) continue; lista.push(novo); nPag++; }
      if (nPag) { await store.salvarSettings({ pagImportadosLista: lista }); await realocarPagamentos(); } }
    for (const l of sel.filter((x) => x.marcado)) await store.salvar('lancamentos', { tipo: l.tipo, valor: l.valorAbs, categoriaId: l.catId, descricao: l.descricao, mes: l.mes, data: l.data, forma: l.forma, banco: im.banco, vencimento: '', status: l.tipo === 'entrada' ? 'recebido' : 'pago', obs: '', importId: l.id || '', lote, ...(l.recorrenciaId ? { recorrenciaId: l.recorrenciaId } : {}) });
    const regras = { ...(S.settings.regrasImport || {}) }; for (const l of im.linhas.filter((x) => x.mudou && x.catId)) regras[chaveRegra(l.texto)] = l.catId;
    const bancos = S.settings.bancos || []; await store.salvarSettings({ regrasImport: regras, ...(im.banco && !bancos.includes(im.banco) ? { bancos: [...bancos, im.banco] } : {}) });
    await registrar(sel.length, 'conta ' + (bancoConta || ''), bancoConta, 'conta', mesDe(sel)); ui.importacao = null; fecharModal(); ui.ultimoTipo = 'conta'; ui.assinaturas = []; conferirFatura('', '', `${sel.filter((x) => x.marcado).length} lançamentos importados!`, bancoConta); return;
  }
  if (tipoF === 'decisao') {
    const cid = id; const m = f.dataset.m; const k = `${cid || 'sem'}|${m}`; const ab = +f.dataset.aberto; const acao = v('acao'); const prox = C.addMes(m, 1);
    const ds = { ...(S.settings.faturaDecisoes || {}) };
    if (acao === 'paguei') { await store.salvarSettings({ pagManual: { ...(S.settings.pagManual || {}), [k]: true } }); const fp = { ...(S.settings.faturasPagas || {}), [k]: true }; ds[k] = { acao, principal: ab, em: new Date().toISOString() }; await store.salvarSettings({ faturasPagas: fp, faturaDecisoes: ds }); fecharModal(); toast('Fatura paga! 💚', true); return; }
    let juros = 0; let n = 1; let parcela = ab;
    if (acao === 'passar') juros = parseValor(v('jurosPassar')) || 0;
    if (acao === 'parcelar') { n = parseInt(v('nParc'), 10); if (!(n >= 2 && n <= 48)) return alert('Escolha de 2 a 48 parcelas.');
      parcela = parseValor(v('vParc')) || Math.round((ab / n) * 100) / 100; const tot = Math.round(parcela * n * 100) / 100;
      if (tot < ab - 0.01) return alert('As parcelas somam menos do que o valor em aberto. Confira o valor de cada parcela.'); juros = Math.round((tot - ab) * 100) / 100; }
    let jurosCompraId = '';
    if (juros > 0.009) { const cj = await catJuros(); const cp = await store.salvar('compras', { descricao: `Juros da fatura de ${C.nomeMes(m)}`, total: juros, parcelas: n, cartaoId: cid, categoriaId: cj.id, mesPrimeira: prox, data: '', automatica: true }); jurosCompraId = cp.id; }
    ds[k] = { acao, principal: ab, parcelas: n, parcela, juros, jurosCompraId, em: new Date().toISOString() };
    await store.salvarSettings({ faturaDecisoes: ds }); fecharModal();
    toast(acao === 'passar' ? `Passou para a fatura de ${C.nomeMes(prox)}.` : `Parcelado em ${n}x.`); return;
  }
  if (tipoF === 'boas-vindas') {
    if (+f.dataset.passo < OB_PASSOS) return obIr(f, +f.dataset.passo + 1);
    const sal = parseValor(v('salario')); const dia = parseInt(v('diaSalario'), 10);
    if (sal > 0) { const cs = S.categorias.find((c) => c.nome === 'Salário'); await store.salvar('recorrencias', { tipo: 'entrada', valor: sal, nome: 'Salário', categoriaId: cs?.id || '', inicio: C.mesAtual(), fim: '', diaVenc: dia >= 1 && dia <= 31 ? dia : '', frequencia: 'mensal', forma: '', banco: '', obs: '', ativa: true, pagos: {} }); }
    const bancos = [...f.querySelectorAll('[data-banco-tg].ativo')].map((b) => b.dataset.bancoTg);
    for (const r of f.querySelectorAll('[data-ob-cc]')) {
      if (!r.querySelector('input[type=checkbox]').checked) continue;
      const b = r.dataset.obCc; const d = parseInt(r.querySelector('input[type=number]').value, 10);
      await store.salvar('cartoes', { nome: b, banco: b, tipo: r.querySelector('[data-ob-tipo]').value || 'credito', vencimento: d >= 1 && d <= 31 ? d : '', cor: COR_BANCO[b] || '#268AFF' });
    }
    for (const b of f.querySelectorAll('[data-ob-cat]:not(.ativo)')) { const c = S.categorias.find((x) => x.id === b.dataset.obCat); if (c) await store.salvar('categorias', { ...c, arquivada: true }); }
    let k = 0; for (const b of f.querySelectorAll('[data-ob-cat-nova].ativo')) { const nome = b.dataset.obCatNova; if (!S.categorias.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) await store.salvar('categorias', { nome, tipo: 'despesa', orcamento: 0, cor: ['#268AFF', '#77C800', '#FF9600', '#CE82FF', '#FF4B4B', '#1CB0F6'][(S.categorias.length + k++) % 6], arquivada: false }); }
    await store.salvarSettings({ nome: v('nome'), onboarding: true, bancos });
    perguntarTour(v('nome'));
  }

});

// ajustes automáticos para contas antigas (rodam para qualquer usuário ao abrir)
// toda categoria de "guardar" vira uma meta (uma vez só; se a pessoa apagar a meta, não recria)
async function garantirMetas() {
  const S = st(); const feitas = { ...(S.settings.metasAuto || {}) }; let mudou = false;
  for (const c of S.categorias.filter((x) => x.tipo === 'guardar' && !x.arquivada)) {
    if (feitas[c.id]) continue; feitas[c.id] = true; mudou = true;
    if (!S.metas.some((m) => m.categoriaId === c.id)) await store.salvar('metas', { nome: c.nome, alvo: 0, valorInicial: 0, dataAlvo: '', categoriaId: c.id, desde: '' });
  }
  if (mudou) await store.salvarSettings({ metasAuto: feitas });
}
async function migrar() {
  // importações: compras no mês da fatura certa (pelo fechamento) e pagamentos na fatura certa
  if (st().settings.importRegra !== 5) { const S = st();
    for (const c of S.compras.filter((x) => x.importId && x.data && x.cartaoId)) { const k = S.cartoes.find((x) => x.id === c.cartaoId); const m = k ? mesDaCompra(k, c.data) : c.mesPrimeira; if (m !== c.mesPrimeira) await store.salvar('compras', { ...c, mesPrimeira: m }); }
    if ((S.settings.pagImportadosLista || []).length) await realocarPagamentos();
    await store.salvarSettings({ importRegra: 5 }); }
  await garantirMetas();
  // Pix vira Débito em todo lugar (mesmo dinheiro da conta)
  for (const col of ['lancamentos', 'recorrencias']) for (const x of st()[col].filter((i) => i.forma === 'Pix')) await store.salvar(col, { ...x, forma: 'Débito' });
  const S = st(); const velha = S.categorias.find((c) => c.nome === 'Fatura do cartão');
  if (velha) {
    let outros = S.categorias.find((c) => c.nome === 'Outros' && c.tipo === 'despesa');
    if (!outros) outros = await store.salvar('categorias', { nome: 'Outros', tipo: 'despesa', orcamento: 0, cor: '#7C8A9A', arquivada: false });
    for (const col of ['lancamentos', 'compras', 'recorrencias']) for (const x of S[col].filter((i) => i.categoriaId === velha.id)) await store.salvar(col, { ...x, categoriaId: outros.id });
    await store.remover('categorias', velha.id);
  }
}
function baixarPlanilha() {
  const S = st(); const todos = [...S.lancamentos.map((l) => l.mes), ...S.compras.map((c) => c.mesPrimeira), ...S.recorrencias.map((r) => r.inicio)].filter(Boolean).sort();
  const ini = todos[0] || C.mesAtual(); const fim = C.mesAtual();
  const num = (v) => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
  const cel = (x) => { const t = String(x ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const tipoNome = { entrada: 'Entrada', despesa: 'Despesa', guardar: 'Guardar' }; const origem = { lanc: 'Lançamento', cartao: 'Cartão de crédito', fixo: 'Fixo' };
  const linhas = [['Mês', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Como pagou', 'Banco', 'Cartão', 'Origem', 'Situação']];
  for (const m of C.rangeMeses(ini, fim)) for (const x of C.movimentosDoMes(S, m)) {
    const k = x.cartaoId ? S.cartoes.find((c) => c.id === x.cartaoId) : null;
    linhas.push([C.nomeMes(m, true), tipoNome[x.tipo] || x.tipo, catNome(x.categoriaId), x.descricao, num(x.valor), x.forma, x.banco, k ? nomeCartao(k) : '', origem[x.origem] || x.origem, x.status]);
  }
  const csv = '\uFEFF' + linhas.map((l) => l.map(cel).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `flui-${ini}-a-${fim}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('Planilha baixada! Abre no Excel ou no Google Planilhas.', true);
}
function baixar(nome, txt) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

const periodoHoje = () => { const h = new Date(); return { tipo: 'mes', ano: h.getFullYear(), mes: h.getMonth() + 1, tri: Math.floor(h.getMonth() / 3) + 1, sem: h.getMonth() < 6 ? 1 : 2, de: C.addMes(C.mesAtual(), -2), ate: C.mesAtual() }; };
window.addEventListener('hashchange', () => { const nova = location.hash.slice(1) || 'inicio';
  // cada tela abre no mês atual; só mantém o período quando veio de um toque na Análise
  if (nova !== ui.rota) { if (ui.manterPeriodo) ui.manterPeriodo = false; else ui.periodo = periodoHoje(); }
  ui.rota = nova; ui.modal = null; render(); window.scrollTo(0, 0); });
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installEvt = e; });
window.addEventListener('flui:erro', () => toast('Não consegui salvar agora. Confira a internet; o Flui tenta de novo.'));
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest('form[data-form=boas-vindas]') && e.target.matches('input')) { e.preventDefault(); const f = e.target.closest('form'); if (e.target.matches('[data-ob-banco-novo]')) f.querySelector('[data-a=ob-banco-add]').click(); else f.querySelector('[data-a=ob-prox]').click(); return; }
  if (e.key === 'Escape' && ui.modal && !$('[data-form=boas-vindas]')) fecharModal(); if (e.key === 'Enter' && e.target.matches('[data-cat-nova-nome]')) { e.preventDefault(); e.target.parentElement.querySelector('[data-a=cat-nova-ok]').click(); } });

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
      if (st().settings.exclusaoEm && new Date(st().settings.exclusaoEm) <= new Date()) { try { await store.backend.excluirConta(); } catch (_) { await store.backend.signOut(); } return; }
      await migrar();
      if (!st().settings.onboarding) modalBoasVindas();
      else lembreteSetup();
    });
  } catch (err) {
    console.error(err); ui.carregando = false;
    $('#app').innerHTML = `<div class="entrada"><div class="entrada-box"><img class="entrada-mascote" src="icons/mascote.svg?v=126" alt="">${marca()}<p class="erro">Não consegui iniciar o Flui. Confira a internet e recarregue a página.</p></div></div>`;
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    // versão nova: assim que o service worker novo assume, recarrega uma vez sozinho
    const tinhaControle = !!navigator.serviceWorker.controller; let recarregou = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (tinhaControle && !recarregou) { recarregou = true; location.reload(); } });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); }); }).catch(() => {});
  }
})();
window.__flui = { store, C };
