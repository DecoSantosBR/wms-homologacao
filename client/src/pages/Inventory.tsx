import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Inventory() {
  const { data: inventory, isLoading } = trpc.inventory.list.useQuery({});

  const statusColors: Record<string, string> = {
    available: "bg-green-500",
    quarantine: "bg-orange-500",
    blocked: "bg-red-500",
    reserved: "bg-blue-500",
  };

  const statusLabels: Record<string, string> = {
    available: "Disponível",
    quarantine: "Quarentena",
    blocked: "Bloqueado",
    reserved: "Reservado",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Estoque</h1>
        <p className="text-muted-foreground">Saldo de estoque por produto/lote/endereço</p>
      </div>

      {isLoading ? (
        <div>Carregando...</div>
      ) : (
        <div className="grid gap-4">
          {inventory?.map((item: any) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Produto ID: {item.productId}
                  </CardTitle>
                  <Badge className={statusColors[item.status]}>
                    {statusLabels[item.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Quantidade</div>
                    <div className="font-semibold text-lg">{item.quantity}</div>
                  </div>
                  {item.batch && (
                    <div>
                      <div className="text-muted-foreground">Lote</div>
                      <div>{item.batch}</div>
                    </div>
                  )}
                  {item.expiryDate && (
                    <div>
                      <div className="text-muted-foreground">Validade</div>
                      <div>{new Date(item.expiryDate).toLocaleDateString()}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-muted-foreground">Endereço</div>
                    <div>ID: {item.locationId}</div>
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
