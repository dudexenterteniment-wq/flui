// Flui — dados: modelo inicial, salvar/carregar (Firebase ou local), backup
import { FIREBASE_CONFIG, FIREBASE_SDK } from './config.js?v=97';

export const COLECOES = ['categorias', 'lancamentos', 'cartoes', 'compras', 'recorrencias', 'metas'];
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const CORES = ['#268AFF', '#77C800', '#FF9600', '#CE82FF', '#FF4B4B', '#1CB0F6', '#FFC800', '#2BDCA0', '#FF86D0', '#8E6CFF', '#A5683B', '#58A700', '#0F6BD8', '#E5A200', '#7C8A9A', '#3BB9A0'];
export const BANCOS_CATALOGO = ['Nubank', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Caixa', 'Santander', 'Inter', 'C6 Bank', 'Mercado Pago', 'PicPay', 'PagBank', 'Neon', 'Next', 'BTG Pactual', 'XP', 'Banco Pan', 'BV', 'Original', 'Digio', 'Will Bank', 'Agibank', 'Safra', 'Sicoob', 'Sicredi', 'Banrisul', 'BRB', 'Banco do Nordeste', 'Nomad', 'Wise', 'RecargaPay', 'Méliuz', 'Iti'];
export const BANCOS_PADRAO = [];
export const FORMAS = ['Débito', 'Dinheiro', 'Transferência', 'Boleto', 'Outro'];

export function modeloInicial() {
  const c = (nome, tipo, orcamento = 0, i = 0) => ({ id: uid(), nome, tipo, orcamento, cor: CORES[i % CORES.length], arquivada: false });
  const desp = ['Combustível', 'Estacionamento', 'Comida fora', 'Mercado', 'Farmácia', 'Entretenimento', 'Academia', 'Assinaturas', 'Roupa', 'Presentes', 'Dízimo', 'Ofertas e doações', 'Contas de casa', 'Outros'];
  const ent = ['Salário', 'Entrada extra', 'Freela', 'Presente recebido', 'Reembolso', 'Venda', 'Rendimento'];
  const gua = ['Fundo de emergência', 'Investimentos'];
  let i = 0;
  return {
    versao: 1,
    settings: { nome: '', bancos: [...BANCOS_PADRAO], faturasPagas: {}, parcelasPagas: {}, pagamentosFatura: {}, alertasVistos: {}, onboarding: false },
    categorias: [...desp.map((n) => c(n, 'despesa', 0, i++)), ...gua.map((n) => c(n, 'guardar', 0, i++)), ...ent.map((n) => c(n, 'entrada', 0, i++))],
    lancamentos: [], cartoes: [], compras: [], recorrencias: [], metas: [],
  };
}

// ---------------- backends ----------------
class LocalBackend {
  constructor() { this.modo = 'local'; this.user = null; }
  async init(onUser) { this.onUser = onUser; const u = this._read('flui:user'); this.user = u; onUser(u); }
  _read(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
  _write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } }
  async signUp(email) { this.user = { uid: 'local-' + email, email }; this._write('flui:user', this.user); this.onUser(this.user); return this.user; }
  async signIn(email) { return this.signUp(email); }
  async ativarPush() { throw new Error('modo-teste'); }
  async lembrar() {}
  async signOut() { this.user = null; localStorage.removeItem('flui:user'); this.onUser(null); }
  async excluirConta() { localStorage.removeItem('flui:data:' + this.user.uid); await this.signOut(); }
  async resetPassword() { throw new Error('No modo de teste não há senha.'); }
  async loadAll() { return this._read('flui:data:' + this.user.uid); }
  async saveAll(st) { this._write('flui:data:' + this.user.uid, st); }
  async put(st) { await this.saveAll(st); }
  async del(st) { await this.saveAll(st); }
  async putSettings(st) { await this.saveAll(st); }
  async replaceAll(st) { await this.saveAll(st); }
}

class FirebaseBackend {
  constructor() { this.modo = 'nuvem'; this.user = null; }
  async init(onUser) {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(`${FIREBASE_SDK}/firebase-app.js`), import(`${FIREBASE_SDK}/firebase-auth.js`), import(`${FIREBASE_SDK}/firebase-firestore.js`)]);
    this.A = auth; this.F = fs;
    const app = initializeApp(FIREBASE_CONFIG); this.app = app;
    this.auth = auth.getAuth(app);
    try {
      this.db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    } catch { this.db = fs.getFirestore(app); }
    await auth.setPersistence(this.auth, auth.browserLocalPersistence);
    auth.onAuthStateChanged(this.auth, (u) => { this.user = u ? { uid: u.uid, email: u.email } : null; onUser(this.user); });
  }
  async signUp(email, senha) { const r = await this.A.createUserWithEmailAndPassword(this.auth, email, senha); return r.user; }
  async signIn(email, senha) { const r = await this.A.signInWithEmailAndPassword(this.auth, email, senha); return r.user; }
  async lembrar(sim) { await this.A.setPersistence(this.auth, sim ? this.A.browserLocalPersistence : this.A.browserSessionPersistence); }
  async signOut() { await this.A.signOut(this.auth); }
  // apaga todos os dados da pessoa e depois a conta (o Firebase pode pedir login recente)
  async excluirConta() {
    const { writeBatch, getDocs } = this.F; const refs = [];
    for (const c of [...COLECOES, 'meta']) (await getDocs(this._col(c))).docs.forEach((d) => refs.push(d.ref));
    for (let i = 0; i < refs.length; i += 400) { const b = writeBatch(this.db); refs.slice(i, i + 400).forEach((r) => b.delete(r)); await b.commit(); }
    await this.A.deleteUser(this.auth.currentUser);
  }
  // notificações: pega o token deste aparelho e guarda em users/{uid}/meta/push
  async ativarPush(vapidKey) {
    const msg = await import(`${FIREBASE_SDK}/firebase-messaging.js`);
    if (!(await msg.isSupported())) throw new Error('nao-suportado');
    const reg = await navigator.serviceWorker.ready;
    const token = await msg.getToken(msg.getMessaging(this.app), { vapidKey, serviceWorkerRegistration: reg });
    if (!token) throw new Error('sem-token');
    await this.F.setDoc(this._doc('meta', 'push'), { tokens: this.F.arrayUnion(token), atualizado: new Date().toISOString() }, { merge: true });
    return token;
  }
  async resetPassword(email) { await this.A.sendPasswordResetEmail(this.auth, email); }
  _col(c) { return this.F.collection(this.db, 'users', this.user.uid, c); }
  _doc(c, id) { return this.F.doc(this.db, 'users', this.user.uid, c, id); }
  async loadAll() {
    const { getDocs, getDoc } = this.F;
    const s = await getDoc(this._doc('meta', 'settings'));
    if (!s.exists()) return null;
    const st = { versao: 1, settings: s.data() };
    await Promise.all(COLECOES.map(async (c) => { const q = await getDocs(this._col(c)); st[c] = q.docs.map((d) => d.data()); }));
    return st;
  }
  async put(st, col, item) { await this.F.setDoc(this._doc(col, item.id), clean(item)); }
  async del(st, col, id) { await this.F.deleteDoc(this._doc(col, id)); }
  async putSettings(st) { await this.F.setDoc(this._doc('meta', 'settings'), clean(st.settings)); }
  async replaceAll(st) {
    const { writeBatch, getDocs } = this.F;
    const ops = [];
    for (const c of COLECOES) { const q = await getDocs(this._col(c)); q.docs.forEach((d) => ops.push(['del', d.ref])); }
    for (const c of COLECOES) for (const it of st[c] || []) ops.push(['set', this._doc(c, it.id), clean(it)]);
    ops.push(['set', this._doc('meta', 'settings'), clean(st.settings)]);
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(this.db);
      for (const [op, ref, data] of ops.slice(i, i + 400)) op === 'del' ? b.delete(ref) : b.set(ref, data);
      await b.commit();
    }
  }
  async saveAll(st) { await this.replaceAll(st); }
}
const clean = (o) => JSON.parse(JSON.stringify(o));

// ---------------- Store ----------------
export class Store {
  constructor() {
    const forceLocal = new URLSearchParams(location.search).has('local');
    this.backend = FIREBASE_CONFIG && !forceLocal ? new FirebaseBackend() : new LocalBackend();
    this.st = null; this.listeners = new Set(); this.erro = null;
  }
  get modo() { return this.backend.modo; }
  get user() { return this.backend.user; }
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  emit() { this.listeners.forEach((f) => f(this.st)); }
  async init(onUser) { await this.backend.init(onUser); }
  async carregar() {
    let st = await this.backend.loadAll();
    if (!st) { st = modeloInicial(); await this.backend.replaceAll(st); }
    for (const c of COLECOES) st[c] = st[c] || [];
    st.settings = { ...modeloInicial().settings, ...st.settings };
    this.st = st; this.emit(); return st;
  }
  async salvar(col, item) {
    const arr = this.st[col]; const i = arr.findIndex((x) => x.id === item.id);
    if (!item.id) item.id = uid();
    if (!item.criadoEm) item.criadoEm = new Date().toISOString();
    item.atualizadoEm = new Date().toISOString();
    if (i >= 0) arr[i] = item; else arr.push(item);
    this.emit();
    await this._try(() => this.backend.put(this.st, col, item));
    return item;
  }
  async remover(col, id) {
    this.st[col] = this.st[col].filter((x) => x.id !== id); this.emit();
    await this._try(() => this.backend.del(this.st, col, id));
  }
  async salvarSettings(patch) {
    this.st.settings = { ...this.st.settings, ...patch }; this.emit();
    await this._try(() => this.backend.putSettings(this.st));
  }
  async substituirTudo(st) {
    for (const c of COLECOES) st[c] = st[c] || [];
    st.settings = { ...modeloInicial().settings, ...(st.settings || {}) };
    this.st = st; this.emit();
    await this._try(() => this.backend.replaceAll(st));
  }
  async _try(f) {
    try { await f(); this.erro = null; } catch (e) { console.error(e); this.erro = e; window.dispatchEvent(new CustomEvent('flui:erro', { detail: e })); }
  }
  async juntarTudo(novo) {
    // categorias com o mesmo nome viram a mesma; o resto entra se ainda não existir
    const mapa = {};
    for (const c of novo.categorias || []) {
      const igual = this.st.categorias.find((x) => x.id === c.id || (x.nome === c.nome && x.tipo === c.tipo));
      if (igual) mapa[c.id] = igual.id; else await this.salvar('categorias', { ...c });
    }
    for (const col of COLECOES.filter((x) => x !== 'categorias')) {
      const ids = new Set((this.st[col] || []).map((x) => x.id));
      for (const it of novo[col] || []) { if (ids.has(it.id)) continue; await this.salvar(col, { ...it, ...(it.categoriaId && mapa[it.categoriaId] ? { categoriaId: mapa[it.categoriaId] } : {}) }); }
    }
  }
  exportar() { return JSON.stringify({ app: 'Flui', formato: 1, exportadoEm: new Date().toISOString(), dados: this.st }, null, 2); }
}

export function validarBackup(txt) {
  const j = JSON.parse(txt);
  if (!j || j.app !== 'Flui' || !j.dados) throw new Error('Esse arquivo não parece um backup do Flui.');
  const d = j.dados;
  for (const c of COLECOES) if (d[c] && !Array.isArray(d[c])) throw new Error(`Backup com formato inválido em "${c}".`);
  return d;
}
