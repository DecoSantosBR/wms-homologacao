# Correção: Estoque Disponível Negativo no Relatório

**Data:** 29/01/2026  
**Módulo:** Relatórios WMS - Estoque por Endereço

---

## 🐛 Problema Reportado

O relatório "Estoque por Endereço" exibia valores **negativos** na coluna `totalAvailable` (estoque disponível):

- H01-01-01: **-280**
- H01-01-02: **-160**
- H01-01-03: **-140**

Valores negativos não fazem sentido do ponto de vista de negócio, pois indicam que há mais reservas do que estoque físico.

---

## 🔍 Causa Raiz

**Reservas órfãs**: Registros de estoque com `reservedQuantity` maior que zero, mas sem pedidos ativos correspondentes.

Isso ocorreu porque:
1. Pedidos foram finalizados, cancelados ou expedidos
2. As reservas não foram liberadas corretamente no estoque
3. Acúmulo gradual de inconsistências ao longo do tempo

---

## ✅ Solução Aplicada

### 1. Diagnóstico
Executada query para identificar registros com reservas incorretas:

```sql
SELECT 
  i.id,
  i.productId,
  i.locationId,
  i.batch,
  i.quantity,
  i.reservedQuantity as currentReserved,
  COALESCE(SUM(poi.requestedQuantity), 0) as correctReserved
FROM inventory i
LEFT JOIN pickingOrderItems poi ON i.productId = poi.productId AND i.batch = poi.batch
LEFT JOIN pickingOrders po ON poi.pickingOrderId = po.id AND po.status IN ('pending', 'in_progress', 'separated')
GROUP BY i.id, i.productId, i.locationId, i.batch, i.quantity, i.reservedQuantity
HAVING i.reservedQuantity != COALESCE(SUM(poi.requestedQuantity), 0);
```

**Resultado:** 3 registros com reservas órfãs identificados.

### 2. Correção Automática
Executada query de UPDATE para recalcular `reservedQuantity` baseado apenas em pedidos ativos:

```sql
UPDATE inventory i
LEFT JOIN (
  SELECT 
    poi.productId,
    poi.batch,
    SUM(poi.requestedQuantity) as totalReserved
  FROM pickingOrderItems poi
  INNER JOIN pickingOrders po ON poi.pickingOrderId = po.id
  WHERE po.status IN ('pending', 'in_progress', 'separated')
  GROUP BY poi.productId, poi.batch
) active_reserves ON i.productId = active_reserves.productId AND i.batch = active_reserves.batch
SET i.reservedQuantity = COALESCE(active_reserves.totalReserved, 0)
WHERE i.reservedQuantity != COALESCE(active_reserves.totalReserved, 0);
```

### 3. Validação
Após correção, os valores no relatório foram atualizados:

| Endereço   | Total | Reservado | **Disponível (Antes)** | **Disponível (Depois)** |
|------------|-------|-----------|------------------------|-------------------------|
| H01-01-01  | 280   | 560       | **-280** ❌            | **280** ✅              |
| H01-01-02  | 160   | 320       | **-160** ❌            | **160** ✅              |
| H01-01-03  | 140   | 280       | **-140** ❌            | **140** ✅              |

---

## 📊 Resultado Final

✅ **Problema resolvido**: Todos os valores de `totalAvailable` agora são **positivos** e refletem o estoque real disponível.

✅ **Integridade restaurada**: Reservas agora correspondem apenas a pedidos ativos (pending, in_progress, separated).

✅ **Relatório funcional**: O relatório "Estoque por Endereço" exibe dados corretos e confiáveis.

---

## 🔄 Prevenção Futura

### Função de Sincronização Existente
O sistema já possui uma função `syncInventoryReservations()` em `server/syncReservations.ts` que pode ser executada periodicamente para prevenir acúmulo de reservas órfãs.

### Recomendações
1. **Executar sincronização periodicamente** (ex: diariamente via cron job)
2. **Adicionar logs de auditoria** em operações de reserva/liberação
3. **Investigar fluxos** que não liberam reservas corretamente:
   - Finalização de pedidos
   - Cancelamento de pedidos
   - Expedição de pedidos

---

## 📝 Arquivos Modificados

- **Banco de dados**: 3 registros corrigidos na tabela `inventory`
- **todo.md**: Bug documentado e marcado como resolvido

---

## 🎯 Lição Aprendida

**Reservas de estoque devem ser liberadas automaticamente** quando pedidos mudam de status para estados finais (picked, staged, shipped, cancelled). A correção manual via SQL é uma solução paliativa; o ideal é corrigir os fluxos que causam as inconsistências.
