# 🛒 E-commerce API

API completa para gerenciamento de e-commerce com suporte a produtos, carrinho de compras, pedidos, assinaturas e cobrança recorrente.

## 📋 Índice

- [Tecnologias](#-tecnologias)
- [Funcionalidades](#-funcionalidades)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Executando o Projeto](#-executando-o-projeto)
- [Documentação Swagger](#-documentação-swagger)
  - [Gerando Collection do Postman](#gerando-collection-do-postman)
- [Endpoints Principais](#-endpoints-principais)
- [Testes e Simulações](#-testes-e-simulações)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Comandos Úteis](#-comandos-úteis)
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

- **Autenticação e Autorização**: Login com JWT, proteção de rotas com guards, controle de acesso baseado em roles (Admin/Cliente)
- **Gerenciamento de Produtos**: CRUD completo, produtos únicos e de assinatura (Admin apenas)
- **Carrinho de Compras**: Abrir/fechar carrinho, adicionar/remover itens, cálculo automático de total
- **Pagamentos**: Simulação de pagamento com cartão (60% aprovado, 20% pendente, 20% falhou)
- **Pedidos**: Criação automática no checkout, gerenciamento de status (PENDING, CONFIRMED, FAILED, CANCELLED)
- **Transações**: Registro completo de transações de pagamento com rastreamento de status
- **Assinaturas**: Criação e gerenciamento de assinaturas recorrentes com cobrança automática via scheduler
- **Webhooks**: Endpoint para eventos de pagamento com autenticação via `X-Webhook-Secret`
- **Rate Limiting**: Proteção contra abuso (100 requisições/minuto por IP)

## 📦 Instalação e Configuração

### Pré-requisitos

- Node.js >= 18.x
- PostgreSQL >= 15.x
- Docker e Docker Compose (opcional)

### Passo a Passo

1. **Instale as dependências**
   ```bash
   nvm use
   npm install
   ```

2. **Configure as variáveis de ambiente**

   Crie um arquivo `.env` na raiz do projeto:
   ```env
   NODE_ENV=development
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce
   PORT=3000
   JWT_SECRET=seu-jwt-secret-aqui
   JWT_EXPIRES_IN=24h
   WEBHOOK_SECRET=webhook-secret
   ```

3. **Inicie os serviços e configure o banco**
   ```bash
   docker-compose up -d
   npm run db:reload:dev  # Sincroniza schema e carrega fixtures
   ```

## 🏃 Executando o Projeto

### Desenvolvimento
```bash
npm run start:dev
```

A aplicação estará disponível em `http://localhost:3000`

## 📚 Documentação Swagger

Documentação interativa disponível em: **http://localhost:3000/api/docs**

### Fluxo Básico de Uso

1. **Criar Cliente** (`POST /api/customer/create`)
2. **Fazer Login** (`POST /api/auth/login`) - Copie o `accessToken`
3. **Autorizar no Swagger** - Use o token no botão "Authorize"
4. **Abrir Carrinho** (`POST /api/cart/open`)
5. **Adicionar Item** (`POST /api/cart/items`)
6. **Fazer Checkout** (`POST /api/cart/:id/checkout`)
7. **Consultar Pedidos** (`GET /api/order`) ou **Assinaturas** (`GET /api/subscription`)

### Gerando Collection do Postman

Você pode importar a documentação Swagger diretamente no Postman:

#### Método 1: Import via URL (Recomendado)

1. Abra o Postman
2. Clique em **Import** (canto superior esquerdo)
3. Selecione a aba **Link**
4. Cole a URL do JSON do Swagger:
   ```
   http://localhost:3000/api/docs-json
   ```
5. Clique em **Continue** e depois em **Import**

#### Método 2: Import via Arquivo

1. Com a aplicação rodando, baixe o JSON do Swagger:
   ```bash
   curl http://localhost:3000/api/docs-json -o swagger.json
   ```
2. No Postman, clique em **Import**
3. Arraste o arquivo `swagger.json` ou selecione-o manualmente
4. Clique em **Import**

#### Método 3: Via Interface Web do Swagger

1. Acesse `http://localhost:3000/api/docs`
2. No topo da página, procure pelo link ou botão de download do JSON
3. Baixe o arquivo e importe no Postman

#### Após a Importação

A collection será criada com:
- ✅ Todas as rotas organizadas por tags
- ✅ Variáveis de ambiente configuráveis (`baseUrl`)
- ✅ Autenticação JWT pré-configurada (variável `JWT-auth`)
- ✅ Headers de webhook pré-configurados

**Configurando Variáveis de Ambiente:**
- Crie um ambiente no Postman
- Configure a variável `baseUrl` com `http://localhost:3000`
- Para autenticação, após fazer login, copie o `accessToken` e configure na variável `JWT-auth`

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
- `GET /api/order/admin/all` - Listar todos os pedidos (Admin) ⚠️
- `GET /api/order/admin/:id` - Obter pedido por ID (Admin)

### Assinaturas
- `GET /api/subscription` - Listar assinaturas do cliente autenticado
- `GET /api/subscription/admin/all` - Listar todas as assinaturas (Admin) ⚠️
- `GET /api/subscription/admin/:id` - Obter assinatura por ID (Admin)
- `POST /api/subscription/process-billing` - Forçar cobrança de assinaturas vencidas (Admin)

### Webhooks
- `POST /api/webhooks/payment` - Receber webhook de pagamento
- `POST /api/webhooks/test/simulate` - Simular webhook (público)

### Rotas Admin

**Credenciais padrão (fixtures):**
- Email: `admin@system.com`
- Senha: `password123`

**Características:**
- Todas as rotas admin requerem token JWT válido e role `ADMIN`
- Parâmetro opcional `nested=false` para melhor performance (retorna apenas dados básicos)
- ⚠️ **Aviso**: Rotas `/admin/all` não possuem paginação (uso apenas para testes)

## 🧪 Testes e Simulações

### Executar Testes

```bash
npm run db:reload:test  # Configura banco de teste
npm test                # Executa todos os testes
npm run test:cov        # Com cobertura
```

### Simular Webhooks

**Endpoint:** `POST /api/webhooks/test/simulate`

```bash
curl -X POST http://localhost:3000/api/webhooks/test/simulate \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: webhook-secret" \
  -d '{
    "transactionId": "tx_abc123",
    "event": "payment_success"
  }'
```

**Eventos disponíveis:** `payment_success`, `payment_failed`, `payment_pending`

### Cobrança Recorrente de Assinaturas

O motor de cobrança processa automaticamente assinaturas vencidas (scheduler diário às 00:00). Também pode ser acionado manualmente:

**Endpoint:** `POST /api/subscription/process-billing` (Admin apenas)

**Como funciona:**
- Busca assinaturas com `status = ACTIVE` e `nextBillingDate <= hoje`
- Cria transação e pedido, processa pagamento (mockado)
- Atualiza status: `ACTIVE` (sucesso) ou `PAST_DUE` (falha)
- Cria novo período e atualiza `nextBillingDate`

**Fixtures de teste:**
- Execute `npm run db:reload:dev` para carregar assinaturas de exemplo
- Para testar, atualize `nextBillingDate` no banco para uma data passada

**Exemplo SQL:**
```sql
UPDATE subscription 
SET "nextBillingDate" = CURRENT_DATE - INTERVAL '1 day' 
WHERE "subscriptionId" = 'SUB-001-JOHN-MONTHLY';
```

## 📁 Estrutura do Projeto

```
ecommerce/
├── src/
│   ├── application/      # Camada de aplicação (Controllers)
│   ├── domain/           # Camada de domínio (Entities, Services)
│   ├── infra/            # Infraestrutura (Database, Auth, Config)
│   └── integration/      # Integrações externas
├── test/                 # Testes de integração
├── docker-compose.yml
└── package.json
```

## 🛠️ Comandos Úteis

### Desenvolvimento
```bash
npm run start:dev          # Modo desenvolvimento
npm run start:debug        # Modo debug
npm run build              # Compilar projeto
```

### Banco de Dados
```bash
npm run db:reload:dev      # Recria schema e carrega fixtures
npm run fixtures:load      # Carrega fixtures no banco
```

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
- O motor de cobrança pode ser acionado manualmente via endpoint (apenas Admin)

### ⚠️ Rotas `/admin/all` - Disclaimer

As rotas `GET /api/order/admin/all` e `GET /api/subscription/admin/all` **não estão otimizadas** para produção. Implementadas apenas para **teste e homologação**, realizam consultas sem paginação e podem retornar grandes volumes de dados.

**Recomendações para produção:**
- Paginação (page, limit, offset)
- Filtros e busca
- Índices adequados no banco de dados
- Cache layer quando apropriado

## 🚀 Implementações Futuras

Esta seção documenta melhorias planejadas para escalar o produto quando necessário. Estas implementações não são críticas no momento atual, mas serão essenciais conforme a base de usuários e produtos crescer.

### 📄 Paginação e Cache Layer
- Paginação padrão em rotas de listagem (`page`, `limit`, `offset`)
- Cache (Redis) para rotas públicas de produtos
- Estratégias de invalidação inteligente

### 🛡️ Rate Limiting Específico
- Análise prévia de observabilidade para identificar padrões
- Rate limits diferenciados por tipo de rota
- Rate limiting por usuário (além de IP)
- Headers informativos (`X-RateLimit-*`)

### 📊 Observabilidade e Métricas
**Stack sugerida:** OpenTelemetry, Jaeger, Prometheus

- **Tracing Distribuído**: Instrumentação automática de requisições HTTP, operações de DB e integrações externas
- **Métricas**: Taxa de conversão, latência (p95), throughput, taxa de erro, uso de recursos
- **Logging Estruturado**: Logs em JSON com contexto adicional (user ID, request ID)
- **Health Checks Avançados**: Verificação de dependências (DB, Redis, etc.)

**Benefícios esperados:**
- Identificação rápida de problemas em produção
- Otimização baseada em dados reais
- Planejamento de capacidade baseado em métricas
- Debugging eficiente de problemas distribuídos

---

**Desenvolvido por fernnandez**
