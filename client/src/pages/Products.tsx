import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { CreateProductDialog } from "@/components/CreateProductDialog";

export default function Products() {
  const { data: products, isLoading } = trpc.products.list.useQuery();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        icon={<Package className="h-8 w-8" />}
        title="Produtos"
        description="Gestão de produtos cadastrados"
        actions={
          <CreateProductDialog />
        }
      />

      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Produtos Cadastrados</h3>
              <p className="text-sm text-gray-600">Total de {products?.length || 0} produto(s) cadastrado(s)</p>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Carregando...</div>
            ) : products && products.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código Interno</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>EAN</TableHead>
                    <TableHead>Registro ANVISA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product: any) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.internalCode}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.ean || "-"}</TableCell>
                      <TableCell>{product.anvisaRegistration || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <Package className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto cadastrado</h3>
                <p className="text-sm text-gray-600 mb-6">Comece adicionando um novo produto ao sistema</p>
                <CreateProductDialog />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
