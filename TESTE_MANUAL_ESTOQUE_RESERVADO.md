# Teste Manual: Validação de Estoque Reservado

## 🎯 Objetivo
Validar que o sistema **bloqueia** movimentações de estoque reservado para picking.

## 📋 Pré-requisitos
1. Ter produtos cadastrados com estoque
2. Criar um pedido de separação (picking order) com status "validated" ou "in_wave"
3. O pedido deve criar reservas de estoque automaticamente

## 🧪 Cenário de Teste

### Passo 1: Verificar Estoque com Reserva
1. Acesse **Estoque → Posições de Estoque**
2. Identifique um produto que tenha:
   - **Quantidade Total**: Ex: 280 unidades
   - **Qtd. Reservada**: Ex: 20 unidades (em vermelho)
   - **Qtd. Disponível**: Ex: 260 unidades (em verde)

### Passo 2: Tentar Movimentar Quantidade MAIOR que Disponível
1. Acesse **Estoque → Movimentações**
2. Clique em **Nova Movimentação**
3. Preencha:
   - **Endereço Origem**: O endereço com estoque reservado (ex: H01-01-01)
   - **Produto**: O produto identificado no Passo 1
   - **Lote**: O lote correspondente
   - **Quantidade**: Digite uma quantidade **MAIOR** que a disponível
     - Exemplo: Se disponível = 260, digite **270** ou **280**
   - **Endereço Destino**: Qualquer outro endereço válido
   - **Tipo**: Transferência

4. Clique em **Registrar Movimentação**

### ✅ Resultado Esperado (CORRETO)
O sistema deve **BLOQUEAR** a movimentação e exibir mensagem de erro detalhada:

```
Saldo insuficiente. 
Total: 280, 
Reservado: 20, 
Disponível: 260, 
Solicitado: 270
```

### ❌ Resultado Incorreto (BUG)
Se o sistema **PERMITIR** a movimentação, o bug ainda existe.

### Passo 3: Tentar Movimentar Quantidade MENOR que Disponível
1. Repita o processo do Passo 2
2. Desta vez, digite uma quantidade **MENOR** que a disponível
   - Exemplo: Se disponível = 260, digite **50** ou **100**

### ✅ Resultado Esperado (CORRETO)
O sistema deve **PERMITIR** a movimentação e exibir:
```
Movimentação registrada com sucesso
```

## 🔍 Validação Adicional

### Verificar Reservas no Banco de Dados
Execute a query SQL:

```sql
SELECT 
  wl.code as endereco,
  p.sku,
  p.description,
  i.batch,
  i.quantity as total,
  COALESCE(SUM(pr.quantity), 0) as reservado,
  i.quantity - COALESCE(SUM(pr.quantity), 0) as disponivel
FROM inventory i
INNER JOIN warehouseLocations wl ON i.locationId = wl.id
INNER JOIN products p ON i.productId = p.id
LEFT JOIN pickingReservations pr ON pr.inventoryId = i.id
GROUP BY i.id, wl.code, p.sku, p.description, i.batch, i.quantity
HAVING reservado > 0
ORDER BY wl.code;
```

Resultado esperado: Lista de endereços com estoque reservado e quantidade disponível correta.

## 📝 Observações Importantes

1. **Reservas são criadas automaticamente** quando:
   - Um pedido de separação é validado (status = "validated")
   - Um pedido é incluído em uma onda (status = "in_wave")

2. **Reservas são liberadas** quando:
   - O pedido é cancelado
   - O pedido é concluído (status = "shipped")
   - O pedido é excluído

3. **A validação implementada** (arquivo `server/movements.ts`, linhas 79-99):
   - Calcula quantidade total no endereço
   - Subtrai quantidade reservada
   - Compara com quantidade solicitada
   - Bloqueia se solicitado > disponível

## 🐛 Se o Bug Persistir

Se o sistema ainda permitir movimentar estoque reservado:

1. Verifique se o código em `server/movements.ts` está correto (linhas 65-99)
2. Verifique se o import de `pickingReservations` está presente (linha 10)
3. Reinicie o servidor: `pnpm dev`
4. Limpe o cache do navegador (Ctrl+Shift+R)

## ✅ Critérios de Sucesso

- [ ] Sistema bloqueia movimentação quando quantidade solicitada > disponível
- [ ] Mensagem de erro exibe Total, Reservado, Disponível e Solicitado
- [ ] Sistema permite movimentação quando quantidade solicitada ≤ disponível
- [ ] Reservas continuam intactas após tentativa de movimentação bloqueada
