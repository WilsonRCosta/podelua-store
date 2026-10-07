# Pó de Lua — loja online

Loja online de cerâmica artesanal, decoração e bijutaria.

Frontend responsivo em HTML/CSS/JavaScript, backend em Node/Express, catálogo gerido através do Airtable.

## Estrutura

```text
podelua-store/
├── server.js
├── public/
│   ├── index.html
│   ├── product.html
│   ├── success.html
│   ├── cancel.html
│   ├── partials/
│   ├── css/
│   ├── js/
│   └── images/
├── .env.example
├── package.json
└── README.md
```

## Instalar

```bash
npm install
```

## Configurar

Copia `.env.example` para `.env`:

```bash
cp .env.example .env
```

Preenche:

```env
PORT=3000

AIRTABLE_BASE_ID=...
AIRTABLE_PRODUCTS_TABLE=...
AIRTABLE_TOKEN=...
```

## Desenvolvimento

```bash
npm start
```

Abrir:

```text
http://localhost:3000
```

## Catálogo

Os produtos são geridos no **Airtable**.

Cada produto deve ter:

* `name` (único)
* `categories`
* `price`
* `description`
* `long_description`
* `colors`
* `images`
* `active`

Apenas produtos com `active` ativado aparecem na loja.

As imagens são armazenadas diretamente como attachments no Airtable.

## Deploy

O projeto pode ser alojado na **Vercel**.

As variáveis do `.env` devem ser adicionadas nas Environment Variables do projeto na Vercel.

O catálogo pode ser atualizado diretamente no Airtable sem fazer um novo deploy.
