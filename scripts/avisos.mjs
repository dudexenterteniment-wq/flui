// Flui — avisos diários por notificação (roda no GitHub Actions, todo dia às 9h de Brasília).
// Precisa do segredo FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço do Firebase).
import { fatura, dataFechamento, dataVencimento, recorrenciaNoMes, mesAtual, addMes } from '../js/calc.js';

const json = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!json) { console.log('Sem FIREBASE_SERVICE_ACCOUNT: nada a enviar.'); process.exit(0); }
const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
const { getMessaging } = await import('firebase-admin/messaging');
initializeApp({ credential: cert(JSON.parse(json)) });
const db = getFirestore(); const fcm = getMessaging();

const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const agora = new Date(); const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
const dias = (d) => Math.round((d - hoje) / 864e5);
const mA = mesAtual(hoje);
const SO_TESTE = process.env.TESTE === '1';

const metaDocs = (await db.collectionGroup('meta').get()).docs;
// contas com exclusão pedida há 3 dias ou mais: apaga dados e login
const { getAuth } = await import('firebase-admin/auth'); const apagados = new Set();
for (const d of metaDocs.filter((x) => x.id === 'settings' && x.data().exclusaoEm && new Date(x.data().exclusaoEm) <= agora)) {
  const userRef = d.ref.parent.parent;
  await db.recursiveDelete(userRef); apagados.add(userRef.id);
  await getAuth().deleteUser(userRef.id).catch((e) => console.log('login já removido?', e.code));
  console.log(`Conta ${userRef.id} excluída (pedido de ${d.data().exclusaoEm}).`);
}
const pushDocs = metaDocs.filter((d) => d.id === 'push' && !apagados.has(d.ref.parent.parent.id));
console.log(`Aparelhos cadastrados em ${pushDocs.length} conta(s).`);
for (const pd of pushDocs) {
  const userRef = pd.ref.parent.parent; const tokens = pd.data().tokens || [];
  if (!tokens.length) continue;
  const col = async (c) => (await userRef.collection(c).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const st = { cartoes: await col('cartoes'), compras: await col('compras'), recorrencias: await col('recorrencias'), lancamentos: [],
    settings: (await userRef.collection('meta').doc('settings').get()).data() || {} };
  const msgs = [];
  if (SO_TESTE) msgs.push({ title: 'Flui', body: 'Tudo certo! As notificações do Flui estão funcionando. 💚', link: './#inicio' });
  for (const c of st.cartoes) {
    if (c.tipo === 'debito') continue; const nome = c.apelido || c.banco || c.nome || 'cartão';
    for (const m of [addMes(mA, -1), mA, addMes(mA, 1)]) {
      const f = fatura(st, c.id, m); if (f.total <= 0 || f.aberto <= 0) continue;
      const fe = dataFechamento(c, m); const ve = dataVencimento(c, m);
      if (fe && dias(fe) === 1) msgs.push({ title: `Fatura ${nome} fecha amanhã`, body: `Até agora: ${brl(f.total)}. Confira suas compras no Flui.`, link: './#cartoes' });
      if (ve && dias(ve) === 2) msgs.push({ title: `Fatura ${nome} vence em 2 dias`, body: `Faltam ${brl(f.aberto)} para pagar.`, link: './#cartoes' });
      if (ve && dias(ve) === 0) msgs.push({ title: `Fatura ${nome} vence hoje`, body: `Faltam ${brl(f.aberto)}. Não esquece! 💳`, link: './#cartoes' });
    }
  }
  for (const r of st.recorrencias) {
    if (r.tipo !== 'entrada' || r.ativa === false || !r.diaVenc || !recorrenciaNoMes(r, mA)) continue;
    const ult = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    if (Math.min(+r.diaVenc, ult) === hoje.getDate()) msgs.push({ title: `Dia de receber: ${r.nome || 'salário'} 💰`, body: 'Separe primeiro seus investimentos e coloque as contas em dia.', link: './#plano' });
  }
  for (const m of msgs) {
    const r = await fcm.sendEachForMulticast({ tokens, data: { title: m.title, body: m.body, link: m.link }, webpush: { headers: { Urgency: 'high', TTL: '86400' } } });
    const ruins = r.responses.map((x, i) => (!x.success && /registration-token-not-registered|invalid-argument|invalid-registration/.test(x.error?.code || '') ? tokens[i] : null)).filter(Boolean);
    if (ruins.length) await pd.ref.update({ tokens: FieldValue.arrayRemove(...ruins) });
    console.log(`${userRef.id}: "${m.title}" → ${r.successCount} ok, ${r.failureCount} falhas`);
  }
}
