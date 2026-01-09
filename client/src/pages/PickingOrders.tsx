import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Clock, CheckCircle2, AlertCircle, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PickingOrders() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "urgent" | "emergency">("normal");
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: number; quantity: number; unit: "box" | "unit" }>>([]);

  const { data: orders, isLoading, refetch } = trpc.picking.list.useQuery({ limit: 100 });
  const { data: products } = trpc.products.list.useQuery();
  const createMutation = trpc.picking.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreateDialogOpen(false);
      setCustomerName("");
      setPriority("normal");
      setSelectedProducts([]);
    },
  });

  const handleCreate = () => {
    if (!customerName || selectedProducts.length === 0) return;

    createMutation.mutate({
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
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Pedidos de Separação</h1>
          <p className="text-muted-foreground">Gerencie e acompanhe pedidos de picking</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Pedido de Separação</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Cliente</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
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

              <div>
                <Label>Produtos (simplificado - MVP)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Funcionalidade completa de seleção de produtos será implementada na próxima iteração
                </p>
              </div>

              <Button onClick={handleCreate} disabled={!customerName || createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar Pedido"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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

        {orders?.map((order) => (
          <Link key={order.id} href={`/picking/${order.id}`}>
            <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{order.orderNumber}</h3>
                    {getStatusBadge(order.status)}
                    {getPriorityBadge(order.priority)}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Cliente: {order.customerName || "N/A"}</p>
                    <p>
                      Itens: {order.totalItems} | Quantidade Total: {order.totalQuantity}
                    </p>
                    <p>Criado em: {new Date(order.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>

                <Button variant="outline" size="sm">
                  Ver Detalhes
                </Button>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
