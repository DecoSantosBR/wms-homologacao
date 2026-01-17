# WMS Med@x - Documentação Módulo Recebimento

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Autor:** Manus AI  
**Sistema:** WMS Farmacêutico - Sistema de Gerenciamento de Armazém

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Funcionalidades](#funcionalidades)
3. [Estrutura de Dados](#estrutura-de-dados)
4. [Código Completo](#código-completo)
5. [Fluxos de Operação](#fluxos-de-operação)
6. [Integração com Backend](#integração-com-backend)

---

## Visão Geral

O módulo de Recebimento é responsável por gerenciar o recebimento de mercadorias no armazém farmacêutico. Permite importar NF-e, criar ordens de recebimento, conferir itens, endereçar produtos e gerenciar todo o fluxo de entrada de mercadorias com rastreabilidade completa.

**Localização:** `client/src/pages/Receiving.tsx`

**Tecnologias:** React 19, TypeScript, Tailwind CSS, shadcn/ui, tRPC

---

## Funcionalidades

O módulo Recebimento oferece as seguintes funcionalidades:

### 1. Importação de NF-e

Permite importar notas fiscais em formato XML, criando automaticamente ordens de recebimento com todos os itens.

**Campos:**
- Arquivo XML da NF-e
- Validação automática do formato
- Criação de OT (Ordem de Trabalho) automática

### 2. Criar Recebimento Manual

Permite criar manualmente uma ordem de recebimento sem importar NF-e.

**Campos:**
- Cliente (Tenant)
- Descrição
- Data de recebimento

### 3. Listar Ordens de Recebimento

Exibe todas as ordens de recebimento com filtros e ações.

**Informações Exibidas:**
- ID da ordem
- Cliente
- Data de recebimento
- Status (Pendente, Em Conferência, Conferido, Endereçado)
- Ações (Visualizar, Conferir, Deletar)

### 4. Conferir Itens

Permite conferir os itens recebidos contra a nota fiscal.

**Ações:**
- Visualizar item
- Informar quantidade recebida
- Validar contra quantidade esperada
- Marcar como conferido

### 5. Endereçar Itens

Atribui localização (endereço) aos itens recebidos no armazém.

**Campos:**
- Localização (zona + corredor + prateleira + posição)
- Quantidade a endereçar
- Validação de disponibilidade

### 6. Gerenciar Ordens

Permite deletar ordens individuais ou em lote.

---

## Estrutura de Dados

### Estado do Componente

```typescript
interface ReceivingState {
  isImportOpen: boolean;           // Modal de importação aberto
  isCreateOpen: boolean;           // Modal de criação aberto
  xmlContent: string;              // Conteúdo do XML
  selectedTenantId: number | null; // Cliente selecionado
  selectedReceivingId: number | null; // Ordem selecionada
  checkingItem: any | null;        // Item em conferência
  isCheckModalOpen: boolean;       // Modal de conferência aberto
  selectedOrders: Set<number>;     // Ordens selecionadas para deleção
  isDeleteModalOpen: boolean;      // Modal de confirmação de deleção
  orderToDelete: number | null;    // ID da ordem a deletar
  addressingItem: any | null;      // Item a endereçar
  isAddressingModalOpen: boolean;  // Modal de endereçamento aberto
  addressingForm: {
    locationId: string;            // ID da localização
    quantity: string;              // Quantidade
  };
}
```

### Dados Carregados via tRPC

| Query | Descrição | Parâmetros |
|-------|-----------|-----------|
| `tenants.list` | Lista de clientes | Nenhum |
| `receiving.list` | Lista de ordens de recebimento | Nenhum |
| `receiving.getItems` | Itens de uma ordem | `receivingOrderId` |
| `locations.list` | Lista de localizações | Nenhum |
| `receiving.getPendingAddressingBalance` | Saldo pendente de endereçamento | `receivingOrderItemId` |

### Mutações tRPC

| Mutação | Descrição | Parâmetros |
|---------|-----------|-----------|
| `receiving.importNFe` | Importa NF-e | `xmlContent`, `tenantId` |
| `receiving.addressItem` | Endereça um item | `itemId`, `locationId`, `quantity` |
| `receiving.delete` | Deleta uma ordem | `id` |
| `receiving.deleteBatch` | Deleta múltiplas ordens | `ids` |
| `receiving.create` | Cria ordem manual | `tenantId`, `description`, `receivingDate` |
| `receiving.checkItem` | Confere um item | `itemId`, `quantityReceived` |

---

## Código Completo

### Arquivo: client/src/pages/Receiving.tsx

```typescript
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Home, Plus, Upload, ClipboardCheck, Package, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BlindCheckModal } from "@/components/BlindCheckModal";
import { useState } from "react";

export default function Receiving() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Estado local
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [xmlContent, setXmlContent] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [selectedReceivingId, setSelectedReceivingId] = useState<number | null>(null);
  const [checkingItem, setCheckingItem] = useState<any | null>(null);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  const [addressingItem, setAddressingItem] = useState<any | null>(null);
  const [isAddressingModalOpen, setIsAddressingModalOpen] = useState(false);
  const [addressingForm, setAddressingForm] = useState({
    locationId: "",
    quantity: "",
  });

  // Queries tRPC
  const { data: tenants } = trpc.tenants.list.useQuery();
  const { data: receivingOrders, isLoading, refetch } = trpc.receiving.list.useQuery();
  const { data: receivingItems } = trpc.receiving.getItems.useQuery(
    { receivingOrderId: selectedReceivingId! },
    { enabled: !!selectedReceivingId }
  );
  const { data: locations } = trpc.locations.list.useQuery();
  const { data: addressingBalance } = trpc.receiving.getPendingAddressingBalance.useQuery(
    { receivingOrderItemId: addressingItem?.id! },
    { enabled: !!addressingItem?.id }
  );

  // Mutações tRPC
  const importNFeMutation = trpc.receiving.importNFe.useMutation({
    onSuccess: (data) => {
      toast.success(`NF-e ${data.nfeData.nfeNumber} importada com sucesso!`);
      setIsImportOpen(false);
      setXmlContent("");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao importar NF-e: ${error.message}`);
    },
  });

  const addressItemMutation = trpc.receiving.addressItem.useMutation({
    onSuccess: () => {
      toast.success("Item endereçado com sucesso!");
      setIsAddressingModalOpen(false);
      setAddressingForm({ locationId: "", quantity: "" });
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao endereçar item: ${error.message}`);
    },
  });

  const deleteMutation = trpc.receiving.delete.useMutation({
    onSuccess: () => {
      toast.success("Ordem de recebimento excluída com sucesso!");
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao excluir ordem: ${error.message}`);
    },
  });

  const deleteBatchMutation = trpc.receiving.deleteBatch.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} ordem(ns) excluída(s) com sucesso!`);
      setSelectedOrders(new Set());
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao excluir ordens: ${error.message}`);
    },
  });

  const createMutation = trpc.receiving.create.useMutation({
    onSuccess: () => {
      toast.success("Recebimento criado com sucesso!");
      setIsCreateOpen(false);
      setSelectedTenantId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao criar recebimento: ${error.message}`);
    },
  });

  const checkItemMutation = trpc.receiving.checkItem.useMutation({
    onSuccess: () => {
      toast.success("Item conferido com sucesso!");
      setIsCheckModalOpen(false);
      setCheckingItem(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao conferir item: ${error.message}`);
    },
  });

  // Funções auxiliares
  const handleImportNFe = () => {
    if (!xmlContent.trim()) {
      toast.error("Por favor, cole o conteúdo do XML");
      return;
    }
    importNFeMutation.mutate({ xmlContent });
  };

  const handleAddressItem = () => {
    if (!addressingForm.locationId || !addressingForm.quantity) {
      toast.error("Preencha todos os campos");
      return;
    }
    addressItemMutation.mutate({
      itemId: addressingItem.id,
      locationId: parseInt(addressingForm.locationId),
      quantity: parseInt(addressingForm.quantity),
    });
  };

  const handleDeleteOrder = () => {
    if (!orderToDelete) return;
    deleteMutation.mutate({ id: orderToDelete });
  };

  const handleDeleteBatch = () => {
    if (selectedOrders.size === 0) {
      toast.error("Selecione pelo menos uma ordem");
      return;
    }
    deleteBatchMutation.mutate({ ids: Array.from(selectedOrders) });
  };

  const handleCreateReceiving = () => {
    if (!selectedTenantId) {
      toast.error("Selecione um cliente");
      return;
    }
    createMutation.mutate({
      tenantId: selectedTenantId,
      description: "",
      receivingDate: new Date(),
    });
  };

  const toggleOrderSelection = (orderId: number) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: "bg-yellow-100 text-yellow-800",
      checking: "bg-blue-100 text-blue-800",
      checked: "bg-green-100 text-green-800",
      addressed: "bg-purple-100 text-purple-800",
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
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Início
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-4xl font-bold text-foreground mb-2">Recebimento</h2>
            <p className="text-lg text-muted-foreground">
              Agendamento e conferência de mercadorias que chegam ao armazém
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Importar NF-e
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar Nota Fiscal</DialogTitle>
                  <DialogDescription>
                    Cole o conteúdo do XML da nota fiscal
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    value={xmlContent}
                    onChange={(e) => setXmlContent(e.target.value)}
                    placeholder="Cole o conteúdo do XML aqui..."
                    rows={8}
                  />
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleImportNFe}
                    disabled={importNFeMutation.isPending}
                  >
                    {importNFeMutation.isPending ? "Importando..." : "Importar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Recebimento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Recebimento</DialogTitle>
                  <DialogDescription>
                    Crie um novo recebimento manualmente
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Cliente</Label>
                    <Select value={selectedTenantId?.toString() || ""} onValueChange={(v) => setSelectedTenantId(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants?.map((tenant: any) => (
                          <SelectItem key={tenant.id} value={tenant.id.toString()}>
                            {tenant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateReceiving}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Criando..." : "Criar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="w-full">
          <TabsList>
            <TabsTrigger value="orders">Ordens de Recebimento</TabsTrigger>
            <TabsTrigger value="items">Itens</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Ordens de Recebimento</CardTitle>
                  <CardDescription>
                    Total: {receivingOrders?.length || 0} ordem(ns)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receivingOrders?.map((order: any) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.id}</TableCell>
                            <TableCell>{order.tenant?.name}</TableCell>
                            <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge className={getStatusBadge(order.status)}>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedReceivingId(order.id)}
                                >
                                  Visualizar
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
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            {selectedReceivingId && receivingItems ? (
              <Card>
                <CardHeader>
                  <CardTitle>Itens da Ordem #{selectedReceivingId}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receivingItems.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.sku}</TableCell>
                            <TableCell>{item.product?.name}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setCheckingItem(item);
                                    setIsCheckModalOpen(true);
                                  }}
                                >
                                  Conferir
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setAddressingItem(item);
                                    setIsAddressingModalOpen(true);
                                  }}
                                >
                                  Endereçar
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
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  Selecione uma ordem para visualizar os itens
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      <BlindCheckModal
        isOpen={isCheckModalOpen}
        onClose={() => setIsCheckModalOpen(false)}
        item={checkingItem}
        onConfirm={(quantityReceived) => {
          checkItemMutation.mutate({
            itemId: checkingItem.id,
            quantityReceived,
          });
        }}
      />

      <Dialog open={isAddressingModalOpen} onOpenChange={setIsAddressingModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Endereçar Item</DialogTitle>
            <DialogDescription>
              Atribua uma localização ao item recebido
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Localização</Label>
              <Select value={addressingForm.locationId} onValueChange={(v) => setAddressingForm({ ...addressingForm, locationId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma localização" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((location: any) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                value={addressingForm.quantity}
                onChange={(e) => setAddressingForm({ ...addressingForm, quantity: e.target.value })}
                placeholder="Quantidade a endereçar"
              />
            </div>
            {addressingBalance && (
              <p className="text-sm text-muted-foreground">
                Saldo pendente: {addressingBalance.pendingQuantity}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddressItem}
              disabled={addressItemMutation.isPending}
            >
              {addressItemMutation.isPending ? "Endereçando..." : "Endereçar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta ordem de recebimento?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
              {deleteMutation.isPending ? "Deletando..." : "Deletar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## Fluxos de Operação

### Fluxo de Importação de NF-e

```
1. Usuário clica em "Importar NF-e"
2. Abre modal com campo de texto
3. Usuário cola conteúdo XML
4. Clica em "Importar"
5. Sistema valida XML
6. Extrai dados da NF-e
7. Cria ordem de recebimento
8. Cria itens da ordem
9. Exibe mensagem de sucesso
10. Atualiza lista de ordens
```

### Fluxo de Conferência de Item

```
1. Usuário seleciona uma ordem
2. Visualiza itens da ordem
3. Clica em "Conferir" para um item
4. Abre modal BlindCheckModal
5. Usuário informa quantidade recebida
6. Sistema valida contra quantidade esperada
7. Marca item como conferido
8. Registra diferenças (se houver)
9. Atualiza status da ordem
```

### Fluxo de Endereçamento

```
1. Usuário seleciona um item
2. Clica em "Endereçar"
3. Abre modal com seleção de localização
4. Usuário seleciona localização
5. Informa quantidade a endereçar
6. Sistema valida disponibilidade
7. Cria registro de endereçamento
8. Atualiza posição de estoque
9. Marca item como endereçado
```

---

## Integração com Backend

### Procedures tRPC Necessárias

```typescript
// server/routers.ts

export const appRouter = router({
  receiving: {
    list: publicProcedure.query(async ({ ctx }) => {
      // Retorna todas as ordens de recebimento
    }),
    
    getItems: publicProcedure
      .input(z.object({ receivingOrderId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Retorna itens de uma ordem
      }),
    
    importNFe: protectedProcedure
      .input(z.object({ xmlContent: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Importa NF-e e cria ordem
      }),
    
    addressItem: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        locationId: z.number(),
        quantity: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Endereça um item
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Deleta uma ordem
      }),
    
    deleteBatch: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        // Deleta múltiplas ordens
      }),
    
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        description: z.string(),
        receivingDate: z.date(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Cria ordem manual
      }),
    
    checkItem: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        quantityReceived: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Confere um item
      }),
    
    getPendingAddressingBalance: publicProcedure
      .input(z.object({ receivingOrderItemId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Retorna saldo pendente de endereçamento
      }),
  },
});
```

---

**Fim da Documentação - Módulo Recebimento**
