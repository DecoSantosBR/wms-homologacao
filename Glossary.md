📖 Glossário Técnico e Funcional - WMS Med@x
Este documento serve como a Constituição Técnica do projeto. Todas as novas funcionalidades, refatorações ou correções de bugs devem obrigatoriamente seguir as definições e diretrizes aqui estabelecidas para garantir a integridade do estoque e a estabilidade do sistema.

🏗️ 1. Entidades de Governança e Estrutura
Tenant (Inquilino/Dono): Representa o cliente proprietário da mercadoria. O tenantId é a chave mestra de isolamento.

Regra de Ouro: Nenhuma query (leitura ou escrita) deve ser executada sem o filtro de tenantId.

Customer (Destinatário): O destino final da mercadoria (Ex: Loja X, Cliente Final Y). No sistema, é tratado como um campo descritivo (customerName) em pickingOrders.

Nota: Não deve ser confundido com o Tenant. O sistema não utiliza customerId para evitar sobreposição de nomes.

User (Usuário): Operadores ou administradores vinculados a um Tenant, com permissões baseadas em funções (RBAC).

📦 2. Gestão de Inventário (Inventory)
Inventory (Registro de Estoque): A menor unidade de rastro. Vincula um SKU, a um Lote, em uma Posição Logística específica.

Physical Quantity (quantity): A quantidade real e física presente na prateleira/posição.

Reserved Quantity (reservedQuantity): Quantidade logicamente "bloqueada" para pedidos ativos.

Cálculo de Disponibilidade: quantity - reservedQuantity.

Batch (Lote): Identificador de rastreabilidade (validade/produção). Essencial para estratégias FIFO/FEFO.

Unique Code: Identificador único e humanamente legível que garante 100% de rastreabilidade dos itens movimentados no armazém. Formato: `{SKU}-{Lote}` (Ex: 443060-22D14LA125). É usado para consolidação de pickingWaveItems e vinculação entre Allocations e Wave Items.

🚀 3. Ciclo de Saída (Outbound)
Order (Pedido): A intenção de saída original.

Wave (Onda de Separação): Agrupamento de pedidos para otimização de rota.

Picking Allocation (Alocação): O vínculo físico atômico. Diz exatamente de qual ID de inventário e de qual endereço a mercadoria deve sair.

Wave Item (Consolidado): A soma total de um SKU + Lote dentro de uma onda. Um Wave Item pode possuir múltiplas Allocations se o produto estiver em endereços diferentes.

🔄 4. Estados e Fluxos (Workflow)
Pending (Pendente): Aguardando processamento inicial.

In Progress (Em Andamento): O item ou onda já recebeu o primeiro "bip" no coletor. Em pickingAllocations, indica que a separação está em andamento mas não foi concluída.

Picked (Coletado): O item foi retirado da prateleira. A reserva lógica permanece, mas o status indica que o produto está com o operador.

Shipped (Expedido): O item saiu do armazém. É neste momento que a quantity física é baixada e a reservedQuantity é liberada.

📜 5. Regras de Ouro para Desenvolvedores (Anti-Bug)
1. Transacionalidade Obrigatória
Toda alteração de saldo ou status deve estar envolvida em uma transação:

TypeScript
await db.transaction(async (tx) => { /* lógica */ });
2. Prevenção de Race Conditions (Bloqueio Pessimista)
Sempre utilize .for('update') ao ler um saldo que será atualizado na sequência.

Ordenação: Sempre ordene os locks por ID para evitar Deadlocks:

```typescript
await tx.select().from(inventory).where(...).orderBy(inventory.id).for('update');
```

**Nota:** O código atual usa incremento atômico SQL em vez de bloqueio pessimista para operações de picking, o que é igualmente seguro e mais performático.
3. Incremento Atômico SQL
Nunca calcule o novo valor no código (Node.js). Deixe o banco de dados somar:

❌ Errado: set({ quantity: current + scanned })

✅ Certo: set({ quantity: sql`${inventory.quantity} + ${scanned}` })

4. Sincronização Multinível (Cascata)
Ao atualizar uma Allocation (nível físico), você deve obrigatoriamente verificar e atualizar o WaveItem (nível logístico) e o status da Wave/Order (nível de processo).

5. Constraints de Banco (Última Defesa)
Toda coluna de quantidade deve possuir uma constraint CHECK (quantity >= 0) no banco de dados para impedir que erros de código negativitem o estoque.

📍 6. Zonas Especiais
EXP (Expedição): Zona virtual ou física onde o estoque é baixado do sistema.

STAGE (Área de Conferência): Zona de consolidação/preparação de pedidos para serem coletados/expedidos.

Última Atualização: Fevereiro de 2026
Objetivo: Garantir que o WMS Med@x seja escalável, atômico e à prova de falhas de concorrência.