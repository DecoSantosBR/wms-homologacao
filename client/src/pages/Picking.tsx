import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Picking() {
  const { data: orders, isLoading } = trpc.picking.list.useQuery({});

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    in_progress: "bg-blue-500",
    completed: "bg-green-500",
    cancelled: "bg-gray-500",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    in_progress: "Em Andamento",
    completed: "Concluído",
    cancelled: "Cancelado",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Picking</h1>
          <p className="text-muted-foreground">Ordens de separação</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Ordem
        </Button>
      </div>

      {isLoading ? (
        <div>Carregando...</div>
      ) : (
        <div className="grid gap-4">
          {orders?.map((order: any) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pedido: {order.orderNumber}</CardTitle>
                    <CardDescription>
                      Criado em: {new Date(order.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge className={statusColors[order.status]}>
                    {statusLabels[order.status]}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
