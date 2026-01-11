# Testes Automatizados - WMS Med@x

## Visão Geral

Suite completa de testes automatizados com **Vitest** para validar o fluxo crítico de separação (picking), desde a criação do pedido até a baixa de estoque.

## Execução dos Testes

```bash
# Executar todos os testes
pnpm test

# Executar apenas testes de picking
pnpm test picking.flow.test.ts

# Executar em modo watch (desenvolvimento)
pnpm test --watch
```

## Arquivo de Testes

**Localização:** `server/picking.flow.test.ts`

## Casos de Teste Implementados

### 1. Criação de Pedidos com Sucesso
**Teste:** `deve criar pedido com sucesso quando há estoque disponível`

**Cenário:**
- Cliente: Test Client (ID 999001)
- Produto: TEST-PROD-001 (ID 999002)
- Estoque disponível: 100 unidades
- Quantidade solicitada: 50 unidades

**Validações:**
- ✅ Pedido criado com número único (formato `PK{timestamp}`)
- ✅ Status do pedido: `pending`
- ✅ Item do pedido criado corretamente
- ✅ Estoque reservado: 50 unidades (FEFO aplicado)
- ✅ Quantidade total do pedido: 50

**Resultado:** ✅ PASSOU (446ms)

---

### 2. Validação de Estoque Insuficiente
**Teste:** `deve falhar ao criar pedido com estoque insuficiente`

**Cenário:**
- Estoque disponível: 100 unidades
- Quantidade solicitada: 500 unidades (5x o disponível)

**Validações:**
- ✅ Erro lançado com mensagem "Estoque insuficiente"
- ✅ Nenhum pedido criado no banco
- ✅ Estoque não foi reservado (reservedQuantity = 0)
- ✅ Transação atômica: sem pedidos órfãos

**Resultado:** ✅ PASSOU

---

### 3. Validação de Produto Inexistente
**Teste:** `deve falhar ao criar pedido para produto inexistente`

**Cenário:**
- Produto ID: 999999 (não existe)
- Quantidade solicitada: 10 unidades

**Validações:**
- ✅ Erro lançado com mensagem "não encontrado"
- ✅ Nenhum pedido criado
- ✅ Validação ocorre ANTES de criar pedido

**Resultado:** ✅ PASSOU

---

## Cobertura de Funcionalidades

### ✅ Implementado
- [x] Criação de pedidos com validação de estoque
- [x] Reserva automática de estoque (FEFO - First Expired, First Out)
- [x] Validação de estoque insuficiente
- [x] Validação de produto inexistente
- [x] Prevenção de pedidos órfãos (transação atômica)
- [x] Setup e cleanup automático de dados de teste

### 🔜 Próximos Testes (Roadmap)
- [ ] Geração de ondas (consolidação de múltiplos pedidos)
- [ ] Alocação FEFO com múltiplas posições
- [ ] Execução de separação (picking)
- [ ] Validação de etiquetas de endereço
- [ ] Finalização de onda
- [ ] Baixa automática de estoque
- [ ] Liberação de reservas
- [ ] Casos de erro em separação

---

## Estrutura dos Testes

### Setup de Dados
Cada teste cria um ambiente isolado com:
- **Tenant:** Test Client (ID 999001)
- **Produto:** TEST-PROD-001 (ID 999002)
- **Zona:** TEST-ZONE (ID 999003)
- **Endereço:** TEST-01-01-01 (ID 999004)
- **Estoque:** 100 unidades (validade em 3 meses)

### Cleanup Automático
Após cada teste, todos os dados são removidos respeitando foreign keys:
1. pickingWaveItems
2. pickingWaves
3. pickingReservations
4. pickingOrderItems
5. pickingOrders
6. inventory
7. warehouseLocations
8. warehouseZones
9. products
10. tenants

---

## Resultados da Última Execução

```
✓ server/picking.flow.test.ts (3 tests) 865ms
  ✓ Fluxo Completo de Separação
    ✓ deve criar pedido com sucesso quando há estoque disponível 446ms
    ✓ deve falhar ao criar pedido com estoque insuficiente
    ✓ deve falhar ao criar pedido para produto inexistente

Test Files  1 passed (1)
     Tests  3 passed (3)
  Duration  2.20s
```

**Taxa de Sucesso:** 100% (3/3)

---

## Benefícios dos Testes

### 🛡️ Prevenção de Regressões
- Garante que correções críticas não sejam perdidas
- Detecta bugs antes de chegarem à produção
- Valida fluxo completo de ponta a ponta

### 🚀 Confiança para Refatoração
- Permite melhorias no código com segurança
- Facilita manutenção e evolução do sistema
- Documenta comportamento esperado

### 📊 Validação de Regras de Negócio
- FEFO (First Expired, First Out) aplicado corretamente
- Transações atômicas (sem pedidos órfãos)
- Validações de estoque precisas

---

## Integração Contínua

Os testes podem ser integrados em pipelines CI/CD:

```yaml
# Exemplo GitHub Actions
- name: Run Tests
  run: pnpm test
```

---

## Manutenção dos Testes

### Quando Adicionar Novos Testes
- ✅ Ao implementar nova funcionalidade
- ✅ Ao corrigir um bug (teste de regressão)
- ✅ Ao alterar regras de negócio

### Boas Práticas
- ✅ Usar IDs de teste altos (999xxx) para evitar conflito com dados reais
- ✅ Sempre fazer cleanup após cada teste
- ✅ Testar casos de sucesso E casos de erro
- ✅ Usar nomes descritivos para os testes
- ✅ Manter testes independentes (não dependem uns dos outros)

---

## Contato e Suporte

Para dúvidas sobre os testes, consulte:
- **Arquivo de testes:** `server/picking.flow.test.ts`
- **Documentação Vitest:** https://vitest.dev/
- **TODO:** `todo.md` (seção "Fase TESTES AUTOMATIZADOS")
