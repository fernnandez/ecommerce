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
- [Segurança](#-segurança)
- [Notas Importantes](#-notas-importantes)
- [Implementações Futuras](#-implementações-futuras)

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

7. **Consultar Pedidos** (`GET /api/order`)
   - Retorna todos os pedidos do cliente autenticado
   - Lista ordenada por data (mais recentes primeiro)

8. **Consultar Assinaturas** (`GET /api/subscription`)
   - Retorna todas as assinaturas do cliente autenticado
   - Inclui informações de períodos e status

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

## ⚙️ Acionar Motor de Cobrança Recorrente (Manual)

O motor de cobrança recorrente processa automaticamente assinaturas vencidas diariamente às 00:00, mas também pode ser acionado manualmente via endpoint (apenas para usuários Admin).

**POST** `/api/subscription/process-billing`

**Autenticação:**
- Requer token JWT de usuário com role `ADMIN`

**💡 Dados de Teste (Fixtures):**

Ao rodar o projeto com `npm run db:reload:dev`, o banco é populado com dados de exemplo incluindo:

- **Usuário Admin**: `admin@system.com` (senha: `password123`)
- **Assinaturas disponíveis para teste**:
  - `activeMonthlySubscriptionJohn` - Status: `ACTIVE`, Next Billing: `2024-12-01`
    - Subscription ID: `SUB-001-JOHN-MONTHLY`
    - Cliente: John Silva (`john.silva@email.com`)
  - `pastDueYearlySubscriptionPeter` - Status: `PAST_DUE`, Next Billing: `2024-10-30` (vencida)
    - Subscription ID: `SUB-003-PETER-YEARLY`
    - Cliente: Peter Santos (`peter.santos@email.com`)
    - ⚠️ Esta assinatura não será processada pelo motor porque tem status `PAST_DUE` (apenas `ACTIVE` são processadas)

**Exemplo completo de teste:**

1. **Fazer login como Admin:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@system.com",
    "password": "password123"
  }'
```

2. **Copiar o `accessToken` da resposta e usar no endpoint de cobrança:**
```bash
curl -X POST http://localhost:3000/api/subscription/process-billing \
  -H "Authorization: Bearer seu-admin-token-jwt" \
  -H "Content-Type: application/json"
```

**Resposta de sucesso:**
```json
{
  "processed": 3,
  "successful": 2,
  "failed": 1,
  "results": [
    {
      "subscriptionId": "uuid-1",
      "success": true,
      "orderId": "order-uuid-1",
      "transactionId": "tx_123456"
    },
    {
      "subscriptionId": "uuid-2",
      "success": true,
      "orderId": "order-uuid-2",
      "transactionId": "tx_789012"
    },
    {
      "subscriptionId": "uuid-3",
      "success": false,
      "error": "Payment failed"
    }
  ]
}
```

**O que acontece quando o endpoint é chamado:**
1. Busca todas as assinaturas com `status = ACTIVE` e `nextBillingDate <= hoje`
2. Para cada assinatura vencida:
   - Cria uma nova transação e pedido
   - Processa o pagamento via gateway (mockado)
   - Atualiza status da assinatura:
     - `ACTIVE` se pagamento bem-sucedido
     - `PAST_DUE` se pagamento falhar
   - Cria novo período na assinatura
   - Atualiza `nextBillingDate` se bem-sucedido

**Nota:** Este endpoint é idempotente e seguro para chamadas múltiplas. Se uma assinatura já foi processada recentemente, ela será processada novamente apenas se sua `nextBillingDate` estiver vencida.

**⚠️ Importante:** Note que o endpoint processa apenas assinaturas com status `ACTIVE`. A assinatura `pastDueYearlySubscriptionPeter` nas fixtures tem status `PAST_DUE`, então não será processada automaticamente. Para testar com ela, você precisaria primeiro atualizar seu status para `ACTIVE` no banco de dados.

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

### Pedidos
- `GET /api/order` - Listar pedidos do cliente autenticado
- `GET /api/order/admin/all` - Listar todas as pedidos (Admin) ⚠️
- `GET /api/order/admin/:id` - Obter pedido por ID (Admin)

### Assinaturas
- `GET /api/subscription` - Listar assinaturas do cliente autenticado
- `GET /api/subscription/admin/all` - Listar todas as assinaturas (Admin) ⚠️
- `GET /api/subscription/admin/:id` - Obter assinatura por ID (Admin)
- `POST /api/subscription/process-billing` - Forçar cobrança de assinaturas vencidas (Admin)

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
npm run db:reload:test       # Recria schema e carrega fixtures de teste
```

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
- O motor de cobrança pode ser acionado manualmente via endpoint `POST /api/subscription/process-billing` (apenas Admin)

### ⚠️ Rotas `/admin/all` - Disclaimer

As rotas `GET /api/order/admin/all` e `GET /api/subscription/admin/all` **não estão otimizadas** para produção, pois foram implementadas a fins de **teste e homologação**. Estas rotas realizam consultas sem paginação e podem retornar grandes volumes de dados, impactando a performance em cenários com muitos registros.

**Recomendação:** Para uso em produção, estas rotas devem ser otimizadas com:
- Paginação (page, limit, offset)
- Filtros e busca
- Índices adequados no banco de dados
- Cache layer quando apropriado

## 🚀 Implementações Futuras

Esta seção documenta melhorias planejadas para escalar o produto quando necessário. Estas implementações não são críticas no momento atual, mas serão essenciais conforme a base de usuários e produtos crescer.

### 📄 Paginação e Cache Layer

**Motivação:** Com o crescimento da base de produtos, é primordial criar recursos de paginação e cache layer para rotas muito utilizadas, em especial rotas públicas.

**Implementações planejadas:**
- **Paginação**
  - Implementar paginação padrão em rotas de listagem (especialmente `GET /api/product`)
  - Parâmetros de query: `page`, `limit`, `offset`
  - Response com metadados: `total`, `page`, `limit`, `totalPages`
  
- **Cache Layer**
  - Implementar cache (Redis ) para rotas públicas de produtos
  - Estratégias de cache:
    - Cache de produtos por ID (TTL configurável)
    - Cache de listagens de produtos (invalidar em updates)
    - Cache de dados estáticos (categorias, etc.)
  - Middleware de cache com invalidação inteligente

### 🛡️ Rate Limiting Específico

**Motivação:** A definição de rate-limit específico para rotas mais utilizadas ou alvo requer análise prévia de observabilidade para identificar padrões de uso e rotas críticas.

**Implementações planejadas:**
- **Análise de Observabilidade** (pré-requisito)
  - Implementar logging estruturado para identificar rotas mais acessadas
  - Análise de padrões de tráfego e picos de uso
  - Identificação de rotas alvo de ataques ou abuso

- **Rate Limiting Estratégico**
  - Rate limits diferenciados por tipo de rota:
    - Rotas públicas (produtos): Limites mais permissivos
    - Rotas autenticadas: Limites intermediários
    - Rotas críticas (checkout, webhooks): Limites mais restritivos
  - Rate limiting por usuário (além de IP)
  - Sliding window ou token bucket algorithms
  - Headers informativos de rate limit (`X-RateLimit-*`)

### 📊 Observabilidade e Métricas

**Motivação:** Implementação de observabilidade completa para monitoramento, debugging e otimização de performance em produção.

**Stack sugerida:**
- **OpenTelemetry** - Instrumentação padrão para traces, métricas e logs
- **Jaeger** - Visualização e análise de traces distribuídos
- **Prometheus** - Coleta e armazenamento de métricas

**Implementações planejadas:**
- **Tracing Distribuído**
  - Instrumentação automática de requisições HTTP
  - Traces de operações de banco de dados
  - Traces de integrações externas (gateway de pagamento)
  - Correlation IDs entre serviços

- **Métricas**
  - Métricas de negócio:
    - Taxa de conversão (checkout)
    - Tempo médio de processamento de pedidos
    - Taxa de sucesso/falha de pagamentos
    - Volume de assinaturas criadas
  - Métricas técnicas:
    - Latência de endpoints (p95)
    - Throughput por endpoint
    - Taxa de erro por tipo
    - Uso de recursos (CPU, memória, DB connections)

- **Logging Estruturado**
  - Logs estruturados em JSON
  - Contexto adicional (user ID, request ID, etc.)
  - Níveis de log configuráveis por ambiente
  - Integração com sistemas de log aggregation

- **Health Checks Avançados**
  - Health checks de dependências (DB, Redis, etc.)
  - Métricas de saúde do sistema

**Benefícios esperados:**
- Identificação rápida de problemas em produção
- Otimização baseada em dados reais
- Planejamento de capacidade baseado em métricas
- Debugging eficiente de problemas distribuídos

---

**Desenvolvido por fernnandez**
