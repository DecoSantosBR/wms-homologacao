import PageHeader from "@/components/PageHeader";
import { CreateLocationDialog } from "@/components/CreateLocationDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { MapPin } from "lucide-react";

export default function Locations() {
  const { data: locations, isLoading } = trpc.locations.list.useQuery();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        icon={<MapPin className="h-8 w-8" />}
        title="Endereços"
        description="Gestão de endereços de armazenagem"
        actions={<CreateLocationDialog />}
      />

      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Endereços Cadastrados</h3>
              <p className="text-sm text-gray-600">Total de {locations?.length || 0} endereço(s) cadastrado(s)</p>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Carregando...</div>
            ) : locations && locations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Rua</TableHead>
                    <TableHead>Prédio</TableHead>
                    <TableHead>Andar</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Regra</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((location: any) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">{location.code}</TableCell>
                      <TableCell>{location.aisle || "-"}</TableCell>
                      <TableCell>{location.rack || "-"}</TableCell>
                      <TableCell>{location.level || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {location.locationType === "whole" ? "Inteira" : "Fração"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {location.storageRule === "single" ? "Único" : "Multi"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={location.status === "available" ? "default" : "secondary"}>
                          {location.status === "available" ? "Disponível" : location.status === "occupied" ? "Ocupado" : "Bloqueado"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <MapPin className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum endereço cadastrado</h3>
                <p className="text-sm text-gray-600 mb-6">Comece adicionando um novo endereço ao sistema</p>
                <CreateLocationDialog />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
