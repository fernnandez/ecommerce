# 🛒 E-commerce API

API completa para gerenciamento de e-commerce com suporte a produtos, carrinho de compras, pedidos, assinaturas e cobrança recorrente.

## 📋 Índice

- [Tecnologias](#-tecnologias)
- [Funcionalidades](#-funcionalidades)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Executando o Projeto](#-executando-o-projeto)
- [Documentação Swagger](#-documentação-swagger)
- [Simulando Webhooks](#-simulando-webhooks)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Endpoints Principais](#-endpoints-principais)
- [Comandos Úteis](#-comandos-úteis)
- [Testes](#-testes)

## 🚀 Tecnologias

- **NestJS** - Framework Node.js
- **TypeORM** - ORM para TypeScript
- **PostgreSQL** - Banco de dados relacional
- **JWT** - Autenticação
- **Swagger** - Documentação da API
- **Docker** - Containerização
- **TypeScript** - Linguagem principal

## ✨ Funcionalidades

- **Autenticação e Autorização**
  - Login com JWT
  - Proteção de rotas com guards
  - Controle de acesso baseado em roles (Admin/Cliente)

- **Gerenciamento de Produtos**
  - CRUD completo de produtos
  - Produtos únicos e de assinatura
  - Controle por roles (apenas Admin)

- **Carrinho de Compras**
  - Abrir/fechar carrinho
  - Adicionar/remover itens
  - Cálculo automático de total

- **Pedidos**
  - Criação automática no checkout
  - Gerenciamento de status (PENDING, CONFIRMED, FAILED, CANCELLED)
  - Integração com gateway de pagamento mock

- **Transações**
  - Registro de todas as transações de pagamento
  - Rastreamento de status (CREATED, PROCESSING, PAID, FAILED, REFUSED)
  - Histórico completo

- **Assinaturas**
  - Criação de assinaturas para produtos recorrentes
  - Gerenciamento de períodos
  - Cobrança recorrente automática (via scheduler)

- **Webhooks**
  - Endpoint para receber eventos de pagamento
  - Autenticação via `X-Webhook-Secret`
  - Processamento de eventos: `payment_success`, `payment_failed`, `payment_pending`
  - Endpoint de simulação para testes

- **Rate Limiting**
  - Proteção contra abuso de API
  - 100 requisições por minuto por IP


## 📦 Instalação

### Pré-requisitos

- Node.js >= 18.x
- PostgreSQL >= 15.x
- Docker e Docker Compose (opcional, para facilitar setup)

### Passo a Passo

1. **Clone o repositório**
   ```bash
   git clone <repository-url>
   cd ecommerce
   ```

2. **Configure a versão do node e instale as dependências**
  ```bash
   nvm use

  npm install
   ```

3. **Configure as variáveis de ambiente**

   Crie um arquivo `.env` na raiz do projeto:
   ```env
   NODE_ENV=development
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce
   PORT=3000
   JWT_SECRET=seu-jwt-secret-aqui
   JWT_EXPIRES_IN=24h
   WEBHOOK_SECRET=webhook-secret
   ```

4. **Inicie os serviços com Docker**
   ```bash
   docker-compose up -d
   ```

5. **Configure o banco de dados**
   ```bash
   # Sincroniza o schema e carrega fixtures
   npm run db:reload:dev
   ```

## 🏃 Executando o Projeto

### Desenvolvimento
```bash
npm run start:dev
```

A aplicação estará disponível em `http://localhost:3000`


## 📚 Documentação Swagger

A documentação interativa da API está disponível em:

**http://localhost:3000/api/docs**

### Exemplo de Fluxo Completo no Swagger

1. **Criar Cliente** (`POST /api/customer/create`)
   ```json
   {
     "name": "João Silva",
     "email": "joao@example.com",
     "password": "senha123",
     "cpf": "12345678900",
     "phone": "11999999999"
   }
   ```

2. **Fazer Login** (`POST /api/auth/login`)
   ```json
   {
     "email": "joao@example.com",
     "password": "senha123"
   }
   ```
   - Copie o `accessToken` retornado

3. **Autorizar no Swagger**
   - Use o token copiado no botão "Authorize"

4. **Abrir Carrinho** (`POST /api/cart/open`)

5. **Adicionar Item** (`POST /api/cart/items`)
   ```json
   {
     "productId": "uuid-do-produto",
     "quantity": 1
   }
   ```

6. **Fazer Checkout** (`POST /api/cart/:id/checkout`)
   ```json
   {
     "paymentMethod": "card"
   }
   ```

## 🔔 Simulando Webhooks

### Método 1: Endpoint de Simulação (Recomendado)

Use o endpoint de simulação que constrói automaticamente o payload:

**POST** `/api/webhooks/test/simulate`

```json
{
  "transactionId": "transaction-id-do-gateway",
  "event": "payment_success"
}
```

**Eventos disponíveis:**
- `payment_success` - Pagamento aprovado
- `payment_failed` - Pagamento falhou
- `payment_pending` - Pagamento pendente

**Autenticação:**
Este endpoint é público para fins de teste (não requer autenticação JWT).

**Headers obrigatórios:**
```
X-Webhook-Secret: webhook-secret
```

ou

```
Authorization: Bearer webhook-secret
```

**Payload:**
```json
{
  "event": "payment_success",
  "transactionId": "tx_123456789",
  "orderId": "order-uuid",
  "customerId": "customer-uuid",
  "amount": 99.90,
  "currency": "BRL",
  "paymentMethod": "card",
  "timestamp": "2024-01-15T10:30:00Z",
  "metadata": {
    "cartId": "cart-uuid"
  }
}
```

### Exemplo com cURL

```bash
# Simulação simples
curl -X POST http://localhost:3000/api/webhooks/test/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "tx_abc123",
    "event": "payment_success"
  }'
```

### Fluxo Completo de Teste

1. **Criar um pedido via checkout**
   - Isso criará uma transaction com status inicial

2. **Obter o transactionId**
   - Você pode buscar a transaction no banco ou via endpoint

3. **Simular webhook**
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/test/simulate \
     -H "Content-Type: application/json" \
     -d '{
       "transactionId": "seu-transaction-id",
       "event": "payment_success"
     }'
   ```

4. **Verificar resultado**
   - A order será atualizada para `CONFIRMED`
   - A transaction será atualizada para `PAID`
   - Se houver produtos de assinatura, subscriptions serão criadas

## 📁 Estrutura do Projeto

```
ecommerce/
├── src/
│   ├── application/      # Camada de aplicação (Controllers)
│   │   ├── auth/
│   │   ├── cart/
│   │   ├── customer/
│   │   ├── product/
│   │   └── webhook/
│   ├── domain/           # Camada de domínio (Entities, Services)
│   │   ├── cart/
│   │   ├── customer/
│   │   ├── order/
│   │   ├── product/
│   │   ├── subscription/
│   │   └── user/
│   ├── infra/            # Infraestrutura (Database, Auth, Config)
│   │   ├── auth/
│   │   ├── configuration/
│   │   └── database/
│   ├── integration/      # Integrações externas
│   │   └── charge/
│   └── config/           # Arquivos de configuração
├── test/                 # Testes de integração
│   ├── integration/
│   └── helper/
├── docker-compose.yml    # Configuração Docker
└── package.json
```

## 🔌 Endpoints Principais

### Autenticação
- `POST /api/auth/login` - Login (público)
- `GET /api/auth/me` - Obter perfil do usuário autenticado

### Cliente
- `POST /api/customer/create` - Criar cliente (público)

### Carrinho
- `POST /api/cart/open` - Abrir carrinho
- `GET /api/cart` - Obter carrinho aberto
- `POST /api/cart/items` - Adicionar item
- `DELETE /api/cart/items/:itemId` - Remover item
- `POST /api/cart/:id/checkout` - Finalizar compra
- `POST /api/cart/close` - Fechar carrinho

### Produtos
- `POST /api/product` - Criar produto (Admin)
- `GET /api/product` - Listar produtos
- `GET /api/product/:id` - Obter produto
- `PATCH /api/product/:id` - Atualizar produto (Admin)
- `DELETE /api/product/:id` - Deletar produto (Admin)

### Webhooks
- `POST /api/webhooks/payment` - Receber webhook de pagamento
- `POST /api/webhooks/test/simulate` - Simular webhook (público)

## 🛠️ Comandos Úteis

### Desenvolvimento
```bash
npm run start:dev          # Inicia em modo desenvolvimento
npm run start:debug        # Inicia em modo debug
npm run build               # Compila o projeto
```

### Banco de Dados
```bash
npm run db:reload:dev       # Recria schema e carrega fixtures
npm run fixtures:load       # Carrega fixtures no banco
npm run fixtures:reset     # Reseta banco e carrega fixtures
```

### Testes
```bash
npm test                    # Executa todos os testes
npm run test:cov            # Executa testes com cobertura
```

## 🧪 Testes

O projeto possui testes de integração para os principais fluxos:

- Autenticação
- Criação de clientes
- Gerenciamento de carrinho
- Criação de pedidos
- Processamento de webhooks
- Assinaturas e cobrança recorrente

### Executar Testes
```bash
# Todos os testes
npm test

# Com cobertura
npm run test:cov
```

### Configuração de Testes

Os testes usam um banco de dados separado (definido via `NODE_ENV=test`). Certifique-se de que as variáveis de ambiente de teste estão configuradas corretamente.

## 🔒 Segurança

- **Rate Limiting**: 100 requisições/minuto por IP
- **Autenticação JWT**: Tokens com expiração configurável
- **Validação de Dados**: class-validator em todos os DTOs
- **Proteção de Rotas**: Guards baseados em roles
- **Webhook Auth**: Autenticação via header `X-Webhook-Secret`
- **Proteção contra Duplicidade**: Verificação de transactions em processamento

## 📝 Notas Importantes

- O gateway de pagamento é **mockado** (não realiza cobranças reais)
- As fixtures são carregadas automaticamente com dados de exemplo
- O scheduler de cobrança recorrente roda diariamente às 00:00

---

**Desenvolvido por fernnandez**
