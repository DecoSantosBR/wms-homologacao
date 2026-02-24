# Bug Crítico: Status da Onda Não Atualiza

## Evidência

**Data:** 21/01/2026, 05:25 BRT

**Onda:** OS-20260121-0001

**Status Exibido na Lista:** ⊘ Pendente ❌

**Status Real (conforme tela de execução):** ✅ Onda Concluída! (100% - 5 de 5 itens completos)

## Detalhes

- **Pedidos:** 4
- **Itens:** 5  
- **Quantidade Total:** 110
- **Progresso:** 110/110 unidades (100%)
- **Criado em:** 21/01/2026, 08:06:17

## Problema

A lista de ondas exibe status "Pendente" mesmo após todos os itens terem sido separados e a tela de execução mostrar "Onda Concluída!".

Isso indica que:
1. A finalização automática NÃO está atualizando o status da onda no banco de dados
2. OU a query da lista não está buscando o status atualizado
3. OU há um problema de cache/invalidação no frontend

## Próximos Passos

1. ✅ Verificar status real no banco de dados via SQL
2. ⏳ Adicionar logs de debug em `registerPickedItem` (linhas 263-288)
3. ⏳ Verificar se a condição `allCompleted` está retornando true
4. ⏳ Verificar se o UPDATE está sendo executado
5. ⏳ Verificar se há erro silencioso não capturado
