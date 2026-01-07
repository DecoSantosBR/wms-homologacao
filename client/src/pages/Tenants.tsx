import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Tenants() {
  const { data: tenants, isLoading } = trpc.tenants.list.useQuery();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        icon={<FileText className="h-8 w-8" />}
        title="Cadastros"
        description="Gestão de dados mestre do sistema"
        actions={
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => toast.info("Funcionalidade em desenvolvimento")}>
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        }
      />

      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Clientes Cadastrados
              </h3>
              <p className="text-sm text-gray-600">
                Total de {tenants?.length || 0} cliente(s) cadastrado(s)
              </p>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Carregando...</div>
            ) : tenants && tenants.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant: any) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>{tenant.cnpj || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tenant.type === "customer" ? "Cliente" : "Fornecedor"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                          {tenant.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => toast.info("Funcionalidade em desenvolvimento")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum cliente cadastrado</h3>
                <p className="text-sm text-gray-600 mb-6">Comece adicionando um novo cliente ao sistema</p>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => toast.info("Funcionalidade em desenvolvimento")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Cliente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
