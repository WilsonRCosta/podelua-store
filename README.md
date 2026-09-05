# Pó de Lua — loja online

Loja de cerâmica artesanal, decoração e bijutaria. Frontend responsivo (funciona
como site e como "app" no telemóvel) + servidor Node/Express com checkout Stripe.

## Estrutura

```
podelua-store/
├── server.js              servidor Express + rotas Stripe
├── data/products.json      catálogo (fonte única de verdade para preços)
├── public/
│   ├── index.html          loja
│   ├── success.html        confirmação pós-pagamento
│   ├── cancel.html         pagamento cancelado
│   ├── css/styles.css
│   ├── js/app.js           lógica da loja + carrinho
│   ├── js/products.js      renderização das "fotos" CSS dos produtos
│   └── images/logo.png, mark.png   o teu logótipo
└── .env.example
```

## 1. Instalar

```bash
cd podelua-store
npm install
```

## 2. Correr sem Stripe (só para ver a loja)

```bash
npm start
```

Abre **http://localhost:3000**. A loja, o carrinho e os filtros funcionam
normalmente. O botão "Finalizar compra" mostra um aviso a pedir para configurares
o Stripe, em vez de tentar cobrar algo.

## 3. Ativar o checkout Stripe (modo de teste)

1. Cria uma conta grátis em [stripe.com](https://stripe.com) se ainda não tiveres.
2. Vai a **https://dashboard.stripe.com/test/apikeys** e copia:
   - a **Secret key** (começa por `sk_test_...`)
   - a **Publishable key** (começa por `pk_test_...`)
3. Copia o ficheiro de exemplo e cola as tuas chaves:

   ```bash
   cp .env.example .env
   ```

   Edita `.env`:

   ```
   STRIPE_SECRET_KEY=sk_test_a_tua_chave
   STRIPE_PUBLISHABLE_KEY=pk_test_a_tua_chave
   PORT=3000
   DOMAIN=http://localhost:3000
   ```

4. Reinicia o servidor:

   ```bash
   npm start
   ```

5. Adiciona peças ao carrinho, clica **Finalizar compra** e serás redirecionado
   para a página de checkout da Stripe (ambiente de teste — nenhum dinheiro
   real é movido).

### Cartão de teste

No checkout da Stripe, usa qualquer:
- Número: `4242 4242 4242 4242`
- Validade: qualquer data futura
- CVC: quaisquer 3 dígitos
- Código postal: qualquer

O pagamento é aprovado automaticamente e serás reencaminhado para
`success.html`, com um resumo da encomenda.

## Editar o catálogo

Todos os produtos vivem em `data/products.json` — nome, categoria, preço
(em cêntimos), descrição, e dois campos que controlam a "foto" gerada em CSS:

- `shape`: silhueta (`vase`, `bowl`, `earring-hoop`, `pendant`, `ring`, …)
- `tone`: paleta de gradiente (`clay`, `stone`, `cream`, `gold`, `sea`)

Basta editar este ficheiro e recarregar a página — o servidor lê-o em tempo real.

Para usar fotografias reais dos teus produtos em vez das formas em CSS, adiciona
um campo `"image": "/images/produto-x.jpg"` a cada item, coloca as imagens em
`public/images/`, e troca `renderCardArt(p)` em `public/js/products.js` por uma
tag `<img>` simples.

## Produção

Este projeto está pronto para desenvolvimento local. Antes de publicar a loja:

- Usa as tuas chaves Stripe **live** (`sk_live_...`) só depois de testares tudo.
- Configura um **webhook** Stripe para confirmares encomendas de forma fiável
  em vez de depender apenas do redirecionamento do browser.
- Serve o site com HTTPS (a Stripe exige-o em produção).
- Muda `DOMAIN` no `.env` para o teu domínio real.
