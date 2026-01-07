import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Receiving() {
  const { data: orders, isLoading } = trpc.receiving.list.useQuery({});

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    in_progress: "bg-blue-500",
    in_quarantine: "bg-orange-500",
    completed: "bg-green-500",
    cancelled: "bg-gray-500",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    in_progress: "Em Andamento",
    in_quarantine: "Em Quarentena",
    completed: "Concluído",
    cancelled: "Cancelado",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recebimento</h1>
          <p className="text-muted-foreground">Ordens de recebimento</p>
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
                    <CardTitle>NF-e: {order.nfeNumber}</CardTitle>
                    <CardDescription>Fornecedor: {order.supplierName}</CardDescription>
                  </div>
                  <Badge className={statusColors[order.status]}>
                    {statusLabels[order.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div>CNPJ: {order.supplierCnpj}</div>
                  <div className="text-muted-foreground">
                    Criado em: {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
