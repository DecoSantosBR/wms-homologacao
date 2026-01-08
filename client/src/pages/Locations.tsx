import PageHeader from "@/components/PageHeader";
import { CreateLocationDialog } from "@/components/CreateLocationDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Locations() {
  const { data: locations, isLoading } = trpc.locations.list.useQuery();
  const { data: zones } = trpc.zones.list.useQuery();
  const { data: tenants } = trpc.tenants.list.useQuery();
  const utils = trpc.useUtils();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    zoneId: 0,
    tenantId: 0,
    code: "",
    aisle: "",
    rack: "",
    level: "",
    position: "",
    locationType: "whole" as "whole" | "fraction",
    storageRule: "single" as "single" | "multi",
  });

  const updateMutation = trpc.locations.update.useMutation({
    onSuccess: () => {
      toast.success("Endereço atualizado com sucesso!");
      utils.locations.list.invalidate();
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar endereço: " + error.message);
    },
  });

  const deleteMutation = trpc.locations.delete.useMutation({
    onSuccess: () => {
      toast.success("Endereço excluído com sucesso!");
      utils.locations.list.invalidate();
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao excluir endereço: " + error.message);
    },
  });

  const handleEdit = (location: any) => {
    setSelectedLocation(location);
    setEditForm({
      zoneId: location.zoneId,
      tenantId: location.tenantId || 0,
      code: location.code || "",
      aisle: location.aisle || "",
      rack: location.rack || "",
      level: location.level || "",
      position: location.position || "",
      locationType: location.locationType || "whole",
      storageRule: location.storageRule || "single",
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (location: any) => {
    setSelectedLocation(location);
    setDeleteDialogOpen(true);
  };

  const handleUpdateSubmit = () => {
    if (!selectedLocation) return;
    updateMutation.mutate({
      id: selectedLocation.id,
      ...editForm,
      tenantId: editForm.tenantId || undefined,
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedLocation) return;
    deleteMutation.mutate({ id: selectedLocation.id });
  };

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
                    <TableHead className="text-right">Ações</TableHead>
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEdit(location)}
                            title="Editar endereço"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(location)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Excluir endereço"
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Endereço</DialogTitle>
            <DialogDescription>
              Atualize as informações do endereço de armazenagem abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-zone">Zona *</Label>
              <Select
                value={editForm.zoneId.toString()}
                onValueChange={(value) => setEditForm({ ...editForm, zoneId: parseInt(value) })}
              >
                <SelectTrigger id="edit-zone">
                  <SelectValue placeholder="Selecione a zona" />
                </SelectTrigger>
                <SelectContent>
                  {zones?.map((zone: any) => (
                    <SelectItem key={zone.id} value={zone.id.toString()}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tenant">Cliente (opcional)</Label>
              <Select
                value={editForm.tenantId.toString()}
                onValueChange={(value) => setEditForm({ ...editForm, tenantId: parseInt(value) })}
              >
                <SelectTrigger id="edit-tenant">
                  <SelectValue placeholder="Compartilhado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Compartilhado</SelectItem>
                  {tenants?.map((tenant: any) => (
                    <SelectItem key={tenant.id} value={tenant.id.toString()}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="edit-code">Código do Endereço *</Label>
              <Input
                id="edit-code"
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                placeholder="Ex: RUA-01-01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-aisle">Rua</Label>
              <Input
                id="edit-aisle"
                value={editForm.aisle}
                onChange={(e) => setEditForm({ ...editForm, aisle: e.target.value })}
                placeholder="Ex: A, B, C"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-rack">Prédio</Label>
              <Input
                id="edit-rack"
                value={editForm.rack}
                onChange={(e) => setEditForm({ ...editForm, rack: e.target.value })}
                placeholder="Ex: 01, 02, 03"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-level">Andar</Label>
              <Input
                id="edit-level"
                value={editForm.level}
                onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                placeholder="Ex: 01, 02, 03"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-position">Quadrante</Label>
              <Input
                id="edit-position"
                value={editForm.position}
                onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                placeholder="Ex: A, B, C, D"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-type">Tipo de Endereço</Label>
              <Select
                value={editForm.locationType}
                onValueChange={(value: any) => setEditForm({ ...editForm, locationType: value })}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whole">Inteira</SelectItem>
                  <SelectItem value="fraction">Fração</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-rule">Regra de Armazenagem</Label>
              <Select
                value={editForm.storageRule}
                onValueChange={(value: any) => setEditForm({ ...editForm, storageRule: value })}
              >
                <SelectTrigger id="edit-rule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Único item/lote</SelectItem>
                  <SelectItem value="multi">Multi-item</SelectItem>
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
              Tem certeza que deseja excluir o endereço <strong>{selectedLocation?.code}</strong>?
              Esta ação marcará o endereço como bloqueado no sistema.
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
