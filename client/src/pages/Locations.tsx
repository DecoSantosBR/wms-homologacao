import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Locations() {
  const { data: locations, isLoading } = trpc.locations.list.useQuery({});

  const statusColors: Record<string, string> = {
    available: "bg-green-500",
    occupied: "bg-blue-500",
    blocked: "bg-red-500",
    counting: "bg-yellow-500",
  };

  const statusLabels: Record<string, string> = {
    available: "Disponível",
    occupied: "Ocupado",
    blocked: "Bloqueado",
    counting: "Em Contagem",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Endereços</h1>
          <p className="text-muted-foreground">Gestão de endereços de armazenagem</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Endereço
        </Button>
      </div>

      {isLoading ? (
        <div>Carregando...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {locations?.map((location: any) => (
            <Card key={location.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{location.code}</CardTitle>
                  <Badge className={statusColors[location.status]}>
                    {statusLabels[location.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {location.aisle && <div>Rua: {location.aisle}</div>}
                {location.rack && <div>Prédio: {location.rack}</div>}
                {location.level && <div>Andar: {location.level}</div>}
                <div className="text-muted-foreground">
                  Tipo: {location.locationType === "whole" ? "Inteira" : "Fração"}
                </div>
                <div className="text-muted-foreground">
                  Regra: {location.storageRule === "single" ? "Único" : "Multi"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
