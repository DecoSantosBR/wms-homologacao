import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Package, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CreateProductDialog } from "@/components/CreateProductDialog";
import { useState } from "react";

export default function Products() {
  const { data: products, isLoading } = trpc.products.list.useQuery();
  const { data: tenants } = trpc.tenants.list.useQuery();
  const utils = trpc.useUtils();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    tenantId: 0,
    sku: "",
    description: "",
    gtin: "",
    anvisaRegistry: "",
    therapeuticClass: "",
    manufacturer: "",
    unitsPerBox: 0,
    storageCondition: "ambient" as "ambient" | "refrigerated_2_8" | "frozen_minus_20" | "controlled",
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso!");
      utils.products.list.invalidate();
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar produto: " + error.message);
    },
  });

  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("Produto excluído com sucesso!");
      utils.products.list.invalidate();
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao excluir produto: " + error.message);
    },
  });

  const handleEdit = (product: any) => {
    setSelectedProduct(product);
    setEditForm({
      tenantId: product.tenantId,
      sku: product.sku || "",
      description: product.description || "",
      gtin: product.gtin || "",
      anvisaRegistry: product.anvisaRegistry || "",
      therapeuticClass: product.therapeuticClass || "",
      manufacturer: product.manufacturer || "",
      unitsPerBox: product.unitsPerBox || 0,
      storageCondition: product.storageCondition || "ambient",
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (product: any) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleUpdateSubmit = () => {
    if (!selectedProduct) return;
    updateMutation.mutate({
      id: selectedProduct.id,
      ...editForm,
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedProduct) return;
    deleteMutation.mutate({ id: selectedProduct.id });
  };

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
                    <TableHead>SKU</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>GTIN</TableHead>
                    <TableHead>Registro ANVISA</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product: any) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>{product.description}</TableCell>
                      <TableCell>{product.gtin || "-"}</TableCell>
                      <TableCell>{product.anvisaRegistry || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEdit(product)}
                            title="Editar produto"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(product)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Excluir produto"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>
              Atualize as informações do produto abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tenant">Cliente</Label>
              <Select
                value={editForm.tenantId.toString()}
                onValueChange={(value) => setEditForm({ ...editForm, tenantId: parseInt(value) })}
              >
                <SelectTrigger id="edit-tenant">
                  <SelectValue placeholder="Selecione o cliente" />
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

            <div className="space-y-2">
              <Label htmlFor="edit-sku">SKU / Código Interno *</Label>
              <Input
                id="edit-sku"
                value={editForm.sku}
                onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                placeholder="Ex: MED-001"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="edit-description">Descrição do Produto *</Label>
              <Input
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Nome completo do produto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-gtin">GTIN / EAN</Label>
              <Input
                id="edit-gtin"
                value={editForm.gtin}
                onChange={(e) => setEditForm({ ...editForm, gtin: e.target.value })}
                placeholder="7891234567890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-anvisa">Registro ANVISA</Label>
              <Input
                id="edit-anvisa"
                value={editForm.anvisaRegistry}
                onChange={(e) => setEditForm({ ...editForm, anvisaRegistry: e.target.value })}
                placeholder="1.0000.0000.000-0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-class">Classe Terapêutica</Label>
              <Input
                id="edit-class"
                value={editForm.therapeuticClass}
                onChange={(e) => setEditForm({ ...editForm, therapeuticClass: e.target.value })}
                placeholder="Ex: Analgésico"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-manufacturer">Fabricante</Label>
              <Input
                id="edit-manufacturer"
                value={editForm.manufacturer}
                onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                placeholder="Nome do fabricante"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-units">Quantidade por Caixa</Label>
              <Input
                id="edit-units"
                type="number"
                value={editForm.unitsPerBox}
                onChange={(e) => setEditForm({ ...editForm, unitsPerBox: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-storage">Condição de Armazenagem</Label>
              <Select
                value={editForm.storageCondition}
                onValueChange={(value: any) => setEditForm({ ...editForm, storageCondition: value })}
              >
                <SelectTrigger id="edit-storage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambient">Ambiente (15-30°C)</SelectItem>
                  <SelectItem value="refrigerated_2_8">Refrigerado (2-8°C)</SelectItem>
                  <SelectItem value="frozen_minus_20">Congelado (-20°C)</SelectItem>
                  <SelectItem value="controlled">Controlado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateSubmit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto <strong>{selectedProduct?.description}</strong>?
              Esta ação marcará o produto como descontinuado no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
