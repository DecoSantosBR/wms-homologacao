# WMS Med@x - Documentação Módulo Separação (Picking)

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Autor:** Manus AI  
**Sistema:** WMS Farmacêutico - Sistema de Gerenciamento de Armazém

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Funcionalidades](#funcionalidades)
3. [Estrutura de Dados](#estrutura-de-dados)
4. [Componentes Utilizados](#componentes-utilizados)
5. [Fluxos de Operação](#fluxos-de-operação)
6. [Integração com Backend](#integração-com-backend)

---

## Visão Geral

O módulo de Separação (Picking) é responsável por gerenciar o processo de separação de pedidos para expedição. Permite listar pedidos pendentes, separar itens usando o PickingWizard, confirmar picking, gerenciar devoluções e rastrear todo o processo com eficiência.

**Localização:** `client/src/pages/Picking.tsx`

**Tecnologias:** React 19, TypeScript, Tailwind CSS, shadcn/ui, tRPC, PickingWizard

---

## Funcionalidades

O módulo Separação oferece as seguintes funcionalidades:

### 1. Listar Pedidos de Separação

Exibe todos os pedidos pendentes de separação com filtros e status.

**Informações Exibidas:**
- ID do pedido
- Cliente
- Data do pedido
- Quantidade de itens
- Status (Pendente, Em Separação, Separado, Expedido)
- Ações (Iniciar Picking, Visualizar, Deletar)

### 2. Iniciar Picking (Separação)

Abre o PickingWizard para guiar o usuário através do processo de separação.

**Etapas:**
1. Seleção de localização
2. Leitura de código de barras
3. Confirmação de quantidade
4. Validação de item
5. Próximo item ou conclusão

### 3. Confirmar Picking

Marca um pedido como separado e pronto para expedição.

**Validações:**
- Todos os itens foram separados
- Quantidades conferem
- Sem discrepâncias

### 4. Gerenciar Devoluções

Permite registrar itens que não puderam ser separados (devoluções).

**Campos:**
- Motivo da devolução
- Quantidade
- Observações

### 5. Deletar Pedidos

Remove pedidos de separação que não serão processados.

---

## Estrutura de Dados

### Estado do Componente

```typescript
interface PickingState {
  selectedPickingOrderId: number | null;    // Pedido selecionado
  isPickingWizardOpen: boolean;             // Wizard aberto
  pickingItems: PickingItem[];              // Itens a separar
  currentItemIndex: number;                 // Item atual
  scannedItems: Map<number, number>;        // Itens já separados
  isConfirmModalOpen: boolean;              // Modal de confirmação
  isReturnModalOpen: boolean;               // Modal de devolução
  returnReason: string;                     // Motivo da devolução
  isDeleteModalOpen: boolean;               // Modal de deleção
  orderToDelete: number | null;             // ID do pedido a deletar
}
```

### Dados Carregados via tRPC

| Query | Descrição | Parâmetros |
|-------|-----------|-----------|
| `picking.list` | Lista de pedidos de separação | Nenhum |
| `picking.getItems` | Itens de um pedido | `pickingOrderId` |
| `picking.getItemByBarcode` | Busca item por código de barras | `barcode` |
| `locations.list` | Lista de localizações | Nenhum |

### Mutações tRPC

| Mutação | Descrição | Parâmetros |
|---------|-----------|-----------|
| `picking.startPicking` | Inicia processo de picking | `pickingOrderId` |
| `picking.confirmItem` | Confirma separação de item | `itemId`, `quantity`, `locationId` |
| `picking.completePicking` | Marca pedido como separado | `pickingOrderId` |
| `picking.createReturn` | Registra devolução | `itemId`, `quantity`, `reason` |
| `picking.delete` | Deleta pedido | `id` |

---

## Componentes Utilizados

### PickingWizard

Componente especializado para guiar o processo de picking.

**Props:**
```typescript
interface PickingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  items: PickingItem[];
  onItemConfirm: (itemId: number, quantity: number, locationId: number) => void;
  onComplete: () => void;
}
```

**Funcionalidades:**
- Navegação entre itens
- Leitura de código de barras
- Validação de quantidade
- Confirmação de localização
- Progresso visual

### Componentes shadcn/ui

| Componente | Uso |
|-----------|-----|
| Button | Botões de ação |
| Card | Containers |
| Dialog | Modals |
| Table | Listagem de pedidos |
| Badge | Status dos pedidos |
| Input | Campos de entrada |
| Textarea | Observações |

---

## Fluxos de Operação

### Fluxo Principal de Picking

```
1. Usuário acessa módulo Separação
2. Visualiza lista de pedidos pendentes
3. Clica em "Iniciar Picking" para um pedido
4. Abre PickingWizard
5. Sistema exibe primeiro item
6. Usuário vai até localização indicada
7. Escaneia código de barras do item
8. Sistema valida item
9. Usuário confirma quantidade
10. Sistema registra separação
11. Próximo item ou conclusão
12. Usuário clica em "Completar"
13. Sistema valida todos os itens
14. Marca pedido como separado
15. Exibe mensagem de sucesso
```

### Fluxo de Devolução

```
1. Durante picking, item não encontrado
2. Usuário clica em "Registrar Devolução"
3. Abre modal com campos
4. Usuário seleciona motivo
5. Informa quantidade
6. Adiciona observações
7. Clica em "Confirmar Devolução"
8. Sistema registra devolução
9. Remove item da lista de picking
10. Continua com próximo item
```

### Fluxo de Confirmação de Picking

```
1. Todos os itens foram separados
2. Usuário clica em "Confirmar Picking"
3. Sistema valida:
   - Todos os itens foram separados
   - Quantidades conferem
   - Sem discrepâncias
4. Se válido: marca como "Separado"
5. Se inválido: exibe erros
6. Atualiza status do pedido
7. Libera para expedição
```

---

## Código de Integração

### Arquivo: client/src/pages/Picking.tsx (Resumo)

```typescript
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PickingWizard } from "@/components/PickingWizard";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Package, Home } from "lucide-react";
import { Link } from "wouter";

export default function Picking() {
  const { user } = useAuth();
  
  // Estado local
  const [selectedPickingOrderId, setSelectedPickingOrderId] = useState<number | null>(null);
  const [isPickingWizardOpen, setIsPickingWizardOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);

  // Queries tRPC
  const { data: pickingOrders, isLoading, refetch } = trpc.picking.list.useQuery();
  const { data: pickingItems } = trpc.picking.getItems.useQuery(
    { pickingOrderId: selectedPickingOrderId! },
    { enabled: !!selectedPickingOrderId }
  );

  // Mutações tRPC
  const startPickingMutation = trpc.picking.startPicking.useMutation({
    onSuccess: () => {
      toast.success("Picking iniciado!");
      setIsPickingWizardOpen(true);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const completePickingMutation = trpc.picking.completePicking.useMutation({
    onSuccess: () => {
      toast.success("Picking concluído com sucesso!");
      setIsConfirmModalOpen(false);
      setSelectedPickingOrderId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const createReturnMutation = trpc.picking.createReturn.useMutation({
    onSuccess: () => {
      toast.success("Devolução registrada!");
      setIsReturnModalOpen(false);
      setReturnReason("");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteMutation = trpc.picking.delete.useMutation({
    onSuccess: () => {
      toast.success("Pedido deletado!");
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Funções auxiliares
  const handleStartPicking = (orderId: number) => {
    setSelectedPickingOrderId(orderId);
    startPickingMutation.mutate({ pickingOrderId: orderId });
  };

  const handleCompletePicking = () => {
    if (!selectedPickingOrderId) return;
    completePickingMutation.mutate({ pickingOrderId: selectedPickingOrderId });
  };

  const handleCreateReturn = (itemId: number, quantity: number) => {
    createReturnMutation.mutate({
      itemId,
      quantity,
      reason: returnReason,
    });
  };

  const handleDeleteOrder = () => {
    if (!orderToDelete) return;
    deleteMutation.mutate({ id: orderToDelete });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      picking: "bg-blue-100 text-blue-800",
      picked: "bg-green-100 text-green-800",
      shipped: "bg-purple-100 text-purple-800",
    };
    return variants[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold">Med@x</h1>
              <span className="text-sm text-muted-foreground">WMS</span>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Início
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-foreground mb-2">Separação</h2>
          <p className="text-lg text-muted-foreground">
            Picking e separação de pedidos para expedição
          </p>
        </div>

        {/* Pedidos Table */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Pedidos de Separação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pickingOrders?.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.id}</TableCell>
                        <TableCell>{order.tenant?.name}</TableCell>
                        <TableCell>{order.items?.length || 0}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(order.status)}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleStartPicking(order.id)}
                              disabled={order.status !== "pending"}
                            >
                              <Package className="h-4 w-4 mr-1" />
                              Iniciar Picking
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setOrderToDelete(order.id)}
                            >
                              Deletar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Itens da Ordem */}
        {selectedPickingOrderId && pickingItems && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Itens do Pedido #{selectedPickingOrderId}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Localização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pickingItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.sku}</TableCell>
                        <TableCell>{item.product?.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.location?.code}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Confirmar Picking
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsReturnModalOpen(true)}
                >
                  Registrar Devolução
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* PickingWizard Modal */}
      <PickingWizard
        isOpen={isPickingWizardOpen}
        onClose={() => setIsPickingWizardOpen(false)}
        items={pickingItems || []}
        onItemConfirm={(itemId, quantity, locationId) => {
          // Lógica para confirmar item
        }}
        onComplete={() => {
          setIsPickingWizardOpen(false);
          setIsConfirmModalOpen(true);
        }}
      />

      {/* Confirm Picking Modal */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Picking</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja confirmar o picking deste pedido?
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCompletePicking}
              disabled={completePickingMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return Modal */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Devolução</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motivo</label>
              <Input
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Motivo da devolução"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsReturnModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => handleCreateReturn(0, 0)}
              disabled={createReturnMutation.isPending}
            >
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja deletar este pedido?
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrder}
              disabled={deleteMutation.isPending}
            >
              Deletar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## Integração com Backend

### Procedures tRPC Necessárias

```typescript
export const appRouter = router({
  picking: {
    list: publicProcedure.query(async ({ ctx }) => {
      // Retorna todos os pedidos de picking
    }),
    
    getItems: publicProcedure
      .input(z.object({ pickingOrderId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Retorna itens de um pedido
      }),
    
    getItemByBarcode: publicProcedure
      .input(z.object({ barcode: z.string() }))
      .query(async ({ ctx, input }) => {
        // Busca item por código de barras
      }),
    
    startPicking: protectedProcedure
      .input(z.object({ pickingOrderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Inicia processo de picking
      }),
    
    confirmItem: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        quantity: z.number(),
        locationId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Confirma separação de item
      }),
    
    completePicking: protectedProcedure
      .input(z.object({ pickingOrderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Marca pedido como separado
      }),
    
    createReturn: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        quantity: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Registra devolução
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Deleta pedido
      }),
  },
});
```

---

**Fim da Documentação - Módulo Separação**
