# 📋 Análise de Funcionalidades e Regras de Negócio - E-Commerce

**Data da Análise**: Análise atual do código-fonte
**Objetivo**: Mapear funcionalidades implementadas, regras de negócio e identificar o que está faltando

---

## 🎯 Funcionalidades Implementadas

### ✅ Autenticação e Autorização
- **Login** (`POST /api/auth/login`)
  - Autenticação via email/senha
  - Retorna JWT token
  - Validação de credenciais
- **Perfil do Usuário** (`GET /api/auth/me`)
  - Retorna dados do usuário autenticado
  - Requer autenticação

**Regras de Negócio:**
- Senha é hashada com bcrypt
- JWT com expiração configurável
- Roles: ADMIN (todos os customers criados são ADMIN atualmente)

---

### ✅ Gestão de Clientes (Customer)
- **Criação de Cliente** (`POST /api/customer/create`)
  - Cria customer e user associado
  - Validação de CPF (Identification Value Object)
  - Previne duplicação de CPF e email

**Regras de Negócio:**
- ✅ CPF validado (dígitos verificadores)
- ✅ CPF único no sistema
- ✅ Email único no sistema
- ✅ Todos os customers criados recebem role ADMIN
- ❌ **FALTA**: Atualização de dados do customer
- ❌ **FALTA**: Consulta de customer por ID
- ❌ **FALTA**: Listagem de customers (para admin)

---

### ✅ Gestão de Produtos (Product)
- **Criar Produto** (`POST /api/product`) - Requer ADMIN
- **Listar Produtos** (`GET /api/product`)
- **Buscar Produto** (`GET /api/product/:id`)
- **Atualizar Produto** (`PATCH /api/product/:id`)
- **Deletar Produto** (`DELETE /api/product/:id`) - Soft delete

**Tipos de Produtos:**
- `SINGLE`: Produto único (compra única)
- `SUBSCRIPTION`: Produto de assinatura (recorrente)

**Regras de Negócio:**
- ✅ Soft delete implementado
- ✅ Produtos de subscription devem ter periodicity definida
- ✅ Produtos single não podem ter periodicity
- ❌ **FALTA**: Validação de periodicity obrigatória ao criar produto subscription
- ❌ **FALTA**: Filtros/paginação na listagem
- ❌ **FALTA**: Busca por nome/tipo
- ❌ **FALTA**: Validação de preço mínimo (evitar valores negativos ou zero)

---

### ✅ Gestão de Carrinho (Cart)
- **Abrir Carrinho** (`POST /api/cart/open`)
  - Retorna carrinho aberto existente ou cria novo
- **Consultar Carrinho** (`GET /api/cart`)
  - Retorna carrinho aberto do customer autenticado
- **Adicionar Item** (`POST /api/cart/items`)
  - Adiciona produto ao carrinho
  - Incrementa quantidade se produto já existe
- **Remover Item** (`DELETE /api/cart/items/:itemId`)
  - Remove item específico do carrinho
- **Fechar Carrinho** (`POST /api/cart/close`)
  - Fecha carrinho para checkout
- **Checkout** (`POST /api/cart/:id/checkout`)
  - Finaliza compra
  - Cria order e transaction
  - Processa pagamento via gateway

**Regras de Negócio:**
- ✅ Um customer tem apenas um carrinho aberto por vez
- ✅ Carrinho sem itens não pode ser fechado
- ✅ Carrinho com total zero/negativo não pode ser fechado
- ✅ Produtos de subscription só podem ter quantity = 1
- ✅ Produtos de subscription não podem ser adicionados duplicados
- ✅ Produtos de subscription devem ter periodicity definida no produto
- ✅ Produtos single não podem ter periodicity
- ✅ Total do carrinho é calculado automaticamente
- ✅ Checkout fecha o carrinho automaticamente
- ✅ Checkout permite retry (reutiliza order existente)
- ❌ **FALTA**: Atualizar quantidade de item (atualmente só adiciona/remove)
- ❌ **FALTA**: Limpar carrinho (remover todos os itens)

---

### ✅ Gestão de Pedidos (Order)
**Endpoints:** ❌ **NENHUM ENDPOINT PÚBLICO IMPLEMENTADO**

**Services Disponíveis:**
- `createOrder()` - Criado durante checkout
- `createRecurringOrder()` - Criado durante cobrança recorrente
- `findOneOrFail()` - Busca order por ID
- `updateStatus()` - Atualiza status do order
- `updateTransactionStatus()` - Atualiza status da transaction

**Status de Order:**
- `PENDING`: Aguardando pagamento
- `CONFIRMED`: Pagamento confirmado
- `FAILED`: Pagamento falhou
- `CANCELLED`: Pedido cancelado

**Origens de Order:**
- `CART`: Vem de checkout de carrinho
- `SUBSCRIPTION`: Vem de cobrança recorrente

**Regras de Negócio:**
- ✅ Order criada durante checkout
- ✅ Order reutilizada se já existe para o mesmo cart
- ✅ Order para subscription não tem cart associado
- ✅ Status mapeado do charge provider
- ✅ Subscription criada automaticamente se produtos são subscription
- ✅ Transaction criada automaticamente
- ❌ **FALTA**: Endpoint `GET /api/order` - Listar orders do customer
- ❌ **FALTA**: Endpoint `GET /api/order/:id` - Detalhes do order
- ❌ **FALTA**: Endpoint `POST /api/order/:id/cancel` - Cancelar order
- ❌ **FALTA**: Filtros por status/data
- ❌ **FALTA**: Histórico de orders

---

### ✅ Gestão de Assinaturas (Subscription)
**Endpoints:** ❌ **NENHUM ENDPOINT PÚBLICO IMPLEMENTADO**

**Services Disponíveis:**
- `create()` - Criada automaticamente no checkout se há produtos subscription
- `findOneOrFail()` - Busca subscription por ID
- `findDueSubscriptions()` - Busca subscriptions vencidas (para cobrança)
- `updateStatus()` - Atualiza status
- `updateNextBillingDate()` - Atualiza próxima data de cobrança
- `createPeriod()` - Cria período de cobrança
- `findAndUpdateSubscriptionByTransaction()` - Atualiza baseado em transaction

**Status de Subscription:**
- `ACTIVE`: Ativa e paga
- `PENDING`: Aguardando pagamento inicial
- `PAST_DUE`: Pagamento em atraso
- `CANCELED`: Cancelada

**Periodicidades:**
- `MONTHLY`: Mensal
- `QUARTERLY`: Trimestral
- `YEARLY`: Anual

**Regras de Negócio:**
- ✅ Subscription criada automaticamente quando order tem produtos subscription
- ✅ Subscription só é criada se pagamento foi PAID, CREATED ou PROCESSING
- ✅ Customer não pode ter subscription ativa duplicada do mesmo produto
- ✅ Próxima data de cobrança calculada automaticamente
- ✅ Status atualizado baseado em status da transaction
- ✅ Cobrança recorrente automática via scheduler (diária à meia-noite)
- ✅ Períodos de cobrança rastreados (SubscriptionPeriod)
- ❌ **FALTA**: Endpoint `GET /api/subscription` - Listar subscriptions do customer
- ❌ **FALTA**: Endpoint `GET /api/subscription/:id` - Detalhes da subscription
- ❌ **FALTA**: Endpoint `POST /api/subscription/:id/cancel` - Cancelar subscription
- ❌ **FALTA**: Endpoint `GET /api/subscription/:id/periods` - Histórico de períodos
- ❌ **FALTA**: Regra de cancelamento (quando pode cancelar?)

---

### ✅ Cobrança Recorrente (Recurring Billing)
**Funcionalidade:** Sistema automatizado (não tem endpoint público)

**Fluxo:**
1. Scheduler executa diariamente à meia-noite (`@Cron`)
2. Busca subscriptions com `nextBillingDate <= hoje` e status `ACTIVE`
3. Para cada subscription:
   - Processa cobrança via charge provider
   - Cria order e transaction
   - Cria período de subscription
   - Atualiza status e próxima data de cobrança

**Regras de Negócio:**
- ✅ Processamento em lote
- ✅ Erro em uma subscription não interrompe as outras
- ✅ Logs detalhados
- ✅ Status atualizado baseado no resultado da cobrança
- ✅ PAST_DUE se cobrança falha

---

### ✅ Webhooks de Pagamento
- **Webhook de Pagamento** (`POST /api/webhooks/payment`)
  - Recebe eventos do gateway de pagamento
  - Eventos: `payment_success`, `payment_failed`, `payment_pending`
  - Endpoint público (não requer autenticação)

**Regras de Negócio:**
- ✅ Webhook duplicado é ignorado (transaction já tem status esperado)
- ✅ Atualiza status do order e transaction
- ✅ Atualiza subscription se transaction estiver associada
- ✅ Logging de erros
- ✅ Validação de transaction e order existentes

---

## 🚨 Funcionalidades Faltantes (Prioridade Alta)

### 1. **Gestão de Pedidos - Endpoints Públicos** 🔴
**Impacto:** Customer não consegue consultar seus pedidos

- [ ] `GET /api/order` - Listar orders do customer autenticado
  - Filtrar por status
  - Ordenar por data (mais recente primeiro)
  - Paginação
- [ ] `GET /api/order/:id` - Detalhes completos do order
  - Incluir items do cart
  - Incluir transactions
  - Verificar se order pertence ao customer
- [ ] `POST /api/order/:id/cancel` - Cancelar order
  - Regras: Só pode cancelar se status é PENDING
  - Atualizar status para CANCELLED
  - Reverter subscription se houver

### 2. **Gestão de Assinaturas - Endpoints Públicos** 🔴
**Impacto:** Customer não consegue consultar/gerenciar suas assinaturas

- [ ] `GET /api/subscription` - Listar subscriptions do customer
  - Filtrar por status
  - Ordenar por data
- [ ] `GET /api/subscription/:id` - Detalhes da subscription
  - Incluir períodos
  - Verificar ownership
- [ ] `POST /api/subscription/:id/cancel` - Cancelar subscription
  - Regras de cancelamento
  - Atualizar status
  - Não processar mais cobranças
- [ ] `GET /api/subscription/:id/periods` - Histórico de períodos

### 3. **Melhorias no Carrinho** 🟡
- [ ] `PATCH /api/cart/items/:itemId` - Atualizar quantidade
  - Permitir alterar quantity diretamente
- [ ] `DELETE /api/cart/clear` - Limpar todos os itens do carrinho
- [ ] Validação: quantidade máxima por produto

### 4. **Melhorias em Produtos** 🟡
- [ ] Validação: periodicity obrigatória para produtos subscription
- [ ] Validação: preço deve ser > 0
- [ ] Filtros na listagem: por tipo, nome, faixa de preço
- [ ] Paginação na listagem

### 5. **Gestão de Perfil do Customer** 🟡
- [ ] `GET /api/customer/profile` - Ver perfil
- [ ] `PATCH /api/customer/profile` - Atualizar dados (nome, telefone)
- [ ] `PATCH /api/customer/password` - Alterar senha

---

## 🟢 Funcionalidades Faltantes (Prioridade Média)

### 6. **Notificações**
- [ ] Sistema de notificações por email
  - Confirmação de pedido
  - Falha no pagamento
  - Cobrança recorrente processada
  - Subscription cancelada

### 7. **Relatórios e Analytics** (Admin)
- [ ] Dashboard de vendas
- [ ] Relatório de subscriptions
- [ ] Relatório de receitas

### 8. **Gestão de Estoque** (se aplicável)
- [ ] Controle de estoque por produto
- [ ] Reserva de estoque durante checkout
- [ ] Alerta de estoque baixo

---

## 📐 Regras de Negócio Críticas Implementadas

### ✅ Validações de CPF
- Dígitos verificadores validados
- CPF não pode ter todos dígitos iguais
- Normalização automática (remove caracteres especiais)

### ✅ Regras de Carrinho
- Um customer = um carrinho aberto
- Produtos subscription: quantity = 1, não duplicar
- Total calculado automaticamente

### ✅ Regras de Checkout
- Carrinho deve estar fechado
- Carrinho não pode estar vazio
- Total > 0
- Order reutilizada se já existe para mesmo cart

### ✅ Regras de Subscription
- Customer não pode ter subscription ativa duplicada do mesmo produto
- Subscription só criada se pagamento bem-sucedido ou pendente
- Próxima data calculada automaticamente

### ✅ Regras de Cobrança Recorrente
- Processa apenas subscriptions ACTIVE com nextBillingDate <= hoje
- Erro individual não interrompe lote
- Status atualizado baseado no resultado

---

## 🔧 Melhorias Técnicas Recomendadas

### 1. **Validações Faltantes**
- [ ] Validar periodicity obrigatória ao criar produto subscription
- [ ] Validar preço > 0 em produtos
- [ ] Validar quantidade máxima ao adicionar item ao carrinho

### 2. **Tratamento de Erros**
- [ ] Mensagens de erro mais descritivas
- [ ] Códigos de erro padronizados

### 3. **Performance**
- [ ] Paginação em todas as listagens
- [ ] Índices no banco de dados
- [ ] Cache para produtos mais acessados

### 4. **Segurança**
- [ ] Rate limiting nos endpoints
- [ ] Validação de webhook (assinatura)
- [ ] Refresh token

---

## 📊 Resumo do Estado Atual

### ✅ Funcionalidades Core Implementadas
- Autenticação e autorização
- Gestão de produtos (CRUD completo)
- Gestão de carrinho (completo)
- Checkout e criação de orders
- Sistema de subscriptions
- Cobrança recorrente automatizada
- Webhooks de pagamento

### ❌ Funcionalidades Críticas Faltantes
- **Consultas públicas de orders** (customer não vê seus pedidos)
- **Consultas públicas de subscriptions** (customer não vê suas assinaturas)
- **Cancelamento de orders e subscriptions**
- **Atualização de perfil do customer**

### 🎯 Prioridade de Implementação
1. **Alta**: Endpoints de Order e Subscription para customer
2. **Média**: Cancelamentos e atualização de perfil
3. **Baixa**: Melhorias e otimizações

---

**Status Geral**: ✅ **CORE FUNCIONAL - Faltam endpoints de consulta e gestão para customers**
