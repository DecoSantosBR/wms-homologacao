import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Clock, CheckCircle2, AlertCircle, Truck, Trash2, X, Waves } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProductItem {
  productId: number;
  productName: string;
  quantity: number;
  unit: "box" | "unit";
}

export default function PickingOrders() {
  const [activeTab, setActiveTab] = useState<"orders" | "waves">("orders");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateWaveDialogOpen, setIsCreateWaveDialogOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "urgent" | "emergency">("normal");
  const [selectedProducts, setSelectedProducts] = useState<ProductItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<"box" | "unit">("box");

  const { data: orders, isLoading, refetch } = trpc.picking.list.useQuery({ limit: 100 });
  const { data: waves, isLoading: wavesLoading, refetch: refetchWaves } = trpc.wave.list.useQuery({ limit: 100 });
  const { data: products } = trpc.products.list.useQuery();
  const { data: inventory } = trpc.stock.getPositions.useQuery({});
  const { data: tenants } = trpc.tenants.list.useQuery(); // Buscar lista de clientes

  const createWaveMutation = trpc.wave.create.useMutation({
    onSuccess: () => {
      refetchWaves();
      setIsCreateWaveDialogOpen(false);
      setSelectedOrderIds([]);
      alert("Onda criada com sucesso!");
    },
    onError: (error) => {
      alert(`Erro ao criar onda: ${error.message}`);
    },
  });

  const createMutation = trpc.picking.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreateDialogOpen(false);
      setSelectedTenantId("");
      setCustomerName("");
      setPriority("normal");
      setSelectedProducts([]);
      alert("Pedido criado com sucesso!");
    },
    onError: (error) => {
      alert(`Erro ao criar pedido: ${error.message}`);
    },
  });

  const handleAddProduct = () => {
    if (!selectedProductId || quantity <= 0) {
      alert("Selecione um produto e informe a quantidade.");
      return;
    }

    const product = products?.find((p) => p.id === parseInt(selectedProductId));
    if (!product) {
      alert("Produto não encontrado.");
      return;
    }

    // Verificar estoque disponível
    const availableStock = inventory?.filter(
      (inv: any) => inv.productId === product.id && inv.status === "available"
    );
    const totalAvailable = availableStock?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;

    console.log("Product:", product);
    console.log("Available stock:", totalAvailable);
    console.log("Requested:", quantity, unit);

    // NOTA: Por enquanto, não validar estoque pois não temos conversão de UM implementada
    // TODO: Implementar conversão de unidades (caixa -> unidade) usando product.unitsPerBox
    // if (totalAvailable < quantity) {
    //   alert(`Estoque insuficiente. Disponível: ${totalAvailable} ${unit === "box" ? "caixas" : "unidades"}. Solicitado: ${quantity}.`);
    //   return;
    // }

    // Verificar se produto já foi adicionado
    if (selectedProducts.some((p) => p.productId === product.id)) {
      alert("Produto já adicionado. Remova-o para adicionar novamente.");
      return;
    }

    setSelectedProducts([
      ...selectedProducts,
      {
        productId: product.id,
        productName: product.description,
        quantity,
        unit,
      },
    ]);

    // Limpar campos
    setSelectedProductId("");
    setQuantity(1);
    setUnit("box");
  };

  const handleRemoveProduct = (productId: number) => {
    setSelectedProducts(selectedProducts.filter((p) => p.productId !== productId));
  };

  const handleCreate = () => {
    if (!selectedTenantId) {
      alert("Selecione o cliente para quem o pedido será criado.");
      return;
    }

    if (!customerName) {
      alert("Informe o nome do cliente.");
      return;
    }

    if (selectedProducts.length === 0) {
      alert("Adicione pelo menos um produto ao pedido.");
      return;
    }

    createMutation.mutate({
      tenantId: parseInt(selectedTenantId),
      customerName,
      priority,
      items: selectedProducts.map((p) => ({
        productId: p.productId,
        requestedQuantity: p.quantity,
        requestedUnit: p.unit,
      })),
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { label: "Pendente", variant: "secondary", icon: Clock },
      picking: { label: "Separando", variant: "default", icon: Package },
      picked: { label: "Separado", variant: "outline", icon: CheckCircle2 },
      checking: { label: "Conferindo", variant: "default", icon: AlertCircle },
      packed: { label: "Embalado", variant: "outline", icon: Package },
      shipped: { label: "Expedido", variant: "default", icon: Truck },
      cancelled: { label: "Cancelado", variant: "destructive", icon: AlertCircle },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      emergency: { label: "Emergência", className: "bg-red-500 text-white" },
      urgent: { label: "Urgente", className: "bg-orange-500 text-white" },
      normal: { label: "Normal", className: "bg-blue-500 text-white" },
      low: { label: "Baixa", className: "bg-gray-500 text-white" },
    };

    const config = variants[priority] || variants.normal;

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Carregando pedidos...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Pedidos de Separação"
        description="Gerencie e acompanhe pedidos de picking"
        actions={
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Pedido
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Pedido de Separação</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Dados do Pedido */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Dados do Pedido</h3>
                
                <div>
                  <Label>Cliente (Tenant) *</Label>
                  <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants?.map((tenant) => (
                        <SelectItem key={tenant.id} value={String(tenant.id)}>
                          {tenant.name} - {tenant.cnpj}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Nome do Destinatário *</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nome do destinatário (farmácia, hospital, etc.)"
                  />
                </div>

                <div>
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                      <SelectItem value="emergency">Emergência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Adicionar Produtos */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Produtos</h3>
                
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Label>Produto</Label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.sku} - {product.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-3">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Unidade</Label>
                    <Select value={unit} onValueChange={(v: any) => setUnit(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="box">Caixa</SelectItem>
                        <SelectItem value="unit">Unidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 flex items-end">
                    <Button type="button" onClick={handleAddProduct} className="w-full">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Lista de Produtos Adicionados */}
                {selectedProducts.length > 0 && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedProducts.map((product) => (
                          <TableRow key={product.productId}>
                            <TableCell className="font-medium">{product.productName}</TableCell>
                            <TableCell>{product.quantity}</TableCell>
                            <TableCell>{product.unit === "box" ? "Caixa" : "Unidade"}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveProduct(product.productId)}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {selectedProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum produto adicionado</p>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={!customerName || selectedProducts.length === 0 || createMutation.isPending}
                >
                  {createMutation.isPending ? "Criando..." : "Criar Pedido"}
                </Button>
              </div>
            </div>
          </DialogContent>
          </Dialog>
        }
      />

      <div className="container mx-auto py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "orders" | "waves")}>
          <TabsList className="mb-6">
            <TabsTrigger value="orders" className="gap-2">
              <Package className="h-4 w-4" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="waves" className="gap-2">
              <Waves className="h-4 w-4" />
              Ondas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            {/* Botão Gerar Onda (aparece quando há pedidos selecionados) */}
            {selectedOrderIds.length > 0 && (
              <div className="mb-4 flex items-center justify-between bg-primary/10 p-4 rounded-lg border border-primary/20">
                <p className="font-semibold">
                  {selectedOrderIds.length} pedido(s) selecionado(s)
                </p>
                <Button onClick={() => setIsCreateWaveDialogOpen(true)}>
                  <Waves className="h-4 w-4 mr-2" />
                  Gerar Onda ({selectedOrderIds.length})
                </Button>
              </div>
            )}

            <div className="grid gap-4">
        {orders && orders.length === 0 && (
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground mb-4">Crie seu primeiro pedido de separação</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido
            </Button>
          </Card>
        )}

        {orders?.map((order) => {
          const isSelected = selectedOrderIds.includes(order.id);
          const isPending = order.status === "pending";
          const firstSelectedOrder = orders.find(o => selectedOrderIds.includes(o.id));
          const isDifferentTenant = firstSelectedOrder && firstSelectedOrder.tenantId !== order.tenantId;

          return (
            <Card 
              key={order.id} 
              className={`p-6 transition-shadow ${
                isSelected ? "border-primary bg-primary/5" : ""
              } ${
                isDifferentTenant && isPending ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Checkbox para seleção (apenas pedidos pendentes) */}
                {isPending && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDifferentTenant}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (isDifferentTenant) return;
                      
                      setSelectedOrderIds(prev => 
                        isSelected 
                          ? prev.filter(id => id !== order.id)
                          : [...prev, order.id]
                      );
                    }}
                    className="h-5 w-5 cursor-pointer"
                  />
                )}

                {/* Conteúdo do Card (clicável para ver detalhes) */}
                <Link href={`/picking/${order.id}`} className="flex-1">
                  <div className="hover:opacity-80 transition-opacity">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{order.orderNumber}</h3>
                    {getStatusBadge(order.status)}
                    {getPriorityBadge(order.priority)}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Cliente: {order.clientName || "N/A"}</p>
                    <p>
                      Itens: {order.totalItems} | Quantidade Total: {order.totalQuantity}
                    </p>
                    <p>Criado em: {new Date(order.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>

                      <Button variant="outline" size="sm" onClick={(e) => e.preventDefault()}>
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </Link>

                {isDifferentTenant && isPending && (
                  <p className="text-xs text-destructive mt-2">
                    ⚠️ Cliente diferente dos pedidos já selecionados
                  </p>
                )}
              </div>
            </Card>
          );
        })}
            </div>
          </TabsContent>

          <TabsContent value="waves">
            <div className="grid gap-4">
              {wavesLoading && (
                <p className="text-muted-foreground">Carregando ondas...</p>
              )}

              {waves && waves.length === 0 && (
                <Card className="p-8 text-center">
                  <Waves className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma onda encontrada</h3>
                  <p className="text-muted-foreground mb-4">Agrupe múltiplos pedidos do mesmo cliente em uma onda</p>
                  <Dialog open={isCreateWaveDialogOpen} onOpenChange={setIsCreateWaveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Gerar Onda
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Gerar Onda de Separação</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Selecione múltiplos pedidos do mesmo cliente para consolidar em uma onda.
                        </p>

                        {/* Filtrar apenas pedidos pendentes */}
                        {orders?.filter(o => o.status === "pending").length === 0 ? (
                          <p className="text-center py-8 text-muted-foreground">
                            Nenhum pedido pendente disponível para criar onda.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {orders?.filter(o => o.status === "pending").map((order) => {
                              const isSelected = selectedOrderIds.includes(order.id);
                              const firstSelectedOrder = orders.find(o => selectedOrderIds.includes(o.id));
                              const isDifferentTenant = firstSelectedOrder && firstSelectedOrder.tenantId !== order.tenantId;

                              return (
                                <Card 
                                  key={order.id} 
                                  className={`p-4 cursor-pointer transition-colors ${
                                    isSelected ? "border-primary bg-primary/5" : ""
                                  } ${isDifferentTenant ? "opacity-50" : ""}`}
                                  onClick={() => {
                                    if (isDifferentTenant) return;
                                    
                                    setSelectedOrderIds(prev => 
                                      isSelected 
                                        ? prev.filter(id => id !== order.id)
                                        : [...prev, order.id]
                                    );
                                  }}
                                >
                                  <div className="flex items-center gap-4">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      disabled={isDifferentTenant}
                                      onChange={() => {}} // Controlled by card click
                                      className="h-4 w-4"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold">{order.orderNumber}</span>
                                        {getPriorityBadge(order.priority)}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <p>Cliente: {order.clientName || "N/A"}</p>
                                        <p>Itens: {order.totalItems} | Quantidade: {order.totalQuantity}</p>
                                      </div>
                                    </div>
                                  </div>
                                  {isDifferentTenant && (
                                    <p className="text-xs text-destructive mt-2">
                                      ⚠️ Cliente diferente dos pedidos já selecionados
                                    </p>
                                  )}
                                </Card>
                              );
                            })}
                          </div>
                        )}

                        {selectedOrderIds.length > 0 && (
                          <div className="bg-muted p-4 rounded-lg">
                            <p className="font-semibold mb-2">
                              {selectedOrderIds.length} pedido(s) selecionado(s)
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Os itens serão consolidados e os endereços alocados automaticamente.
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 justify-end pt-4 border-t">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setIsCreateWaveDialogOpen(false);
                              setSelectedOrderIds([]);
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            onClick={() => {
                              if (selectedOrderIds.length === 0) {
                                alert("Selecione pelo menos um pedido.");
                                return;
                              }
                              createWaveMutation.mutate({ orderIds: selectedOrderIds });
                            }}
                            disabled={selectedOrderIds.length === 0 || createWaveMutation.isPending}
                          >
                            {createWaveMutation.isPending ? "Gerando..." : "Gerar Onda"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </Card>
              )}

              {waves?.map((wave: any) => (
                <Link key={wave.id} href={`/picking/execute/${wave.id}`}>
                  <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{wave.waveNumber}</h3>
                          {getStatusBadge(wave.status)}
                        </div>

                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Pedidos: {wave.totalOrders} | Itens: {wave.totalItems}</p>
                          <p>Quantidade Total: {wave.totalQuantity}</p>
                          <p>Criado em: {new Date(wave.createdAt).toLocaleString("pt-BR")}</p>
                        </div>
                      </div>

                      <Button variant="outline" size="sm">
                        Executar
                      </Button>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
