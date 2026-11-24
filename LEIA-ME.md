# Flui — seu dinheiro, no seu ritmo

App de finanças pessoais (PWA). Cada pessoa cria a própria conta e vê só os próprios dados.

## Como funciona
- Telas: Início, Lançamentos, Cartões, Planejamento, Relatórios, Metas, Categorias, Configurações.
- Dados: Firebase (login por e-mail e senha + banco Firestore em São Paulo). Regras em `firestore.rules`.
- Sem Firebase (ou abrindo com `?local` no fim do endereço): modo de teste, dados só no navegador.

## Publicar
O app precisa ser servido por https (GitHub Pages, por exemplo). Depois de publicar,
adicione o domínio (ex.: `seuusuario.github.io`) em Firebase → Authentication → Configurações → Domínios autorizados.

## Regras financeiras
- Compra no cartão conta uma vez, como despesa da categoria, no mês de cada parcela. Pagar a fatura não cria despesa nova.
- Parcelas em centavos exatos: a última parcela ajusta a diferença (ex.: R$ 100 em 3x = 33,33 + 33,33 + 33,34).
- Custos fixos entram sozinhos entre o mês inicial e o final. O salário previsto não soma se o salário recebido for lançado no mesmo mês.

## Próxima versão (fase 2)
Notificações push com o app fechado, saldo negativo com juros/parcelamento, mascote definitivo.
