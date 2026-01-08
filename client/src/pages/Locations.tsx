import PageHeader from "@/components/PageHeader";
import { CreateLocationDialog } from "@/components/CreateLocationDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { MapPin, Pencil, Trash2, Plus, Layers } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Locations() {
  const { data: locations, isLoading } = trpc.locations.list.useQuery();
  const { data: zones, isLoading: zonesLoading } = trpc.zones.list.useQuery();
  const { data: tenants } = trpc.tenants.list.useQuery();
  const utils = trpc.useUtils();

  // Location states
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

  // Zone states
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editZoneDialogOpen, setEditZoneDialogOpen] = useState(false);
  const [deleteZoneDialogOpen, setDeleteZoneDialogOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [zoneForm, setZoneForm] = useState({
    name: "",
    code: "",
    description: "",
    zoneType: "storage" as "receiving" | "storage" | "shipping" | "quarantine",
  });

  // Location mutations
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

  // Zone mutations
  const createZoneMutation = trpc.zones.create.useMutation({
    onSuccess: () => {
      toast.success("Zona criada com sucesso!");
      utils.zones.list.invalidate();
      setZoneDialogOpen(false);
      setZoneForm({ name: "", code: "", description: "", zoneType: "storage" });
    },
    onError: (error) => {
      toast.error("Erro ao criar zona: " + error.message);
    },
  });

  const updateZoneMutation = trpc.zones.update.useMutation({
    onSuccess: () => {
      toast.success("Zona atualizada com sucesso!");
      utils.zones.list.invalidate();
      setEditZoneDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar zona: " + error.message);
    },
  });

  const deleteZoneMutation = trpc.zones.delete.useMutation({
    onSuccess: () => {
      toast.success("Zona excluída com sucesso!");
      utils.zones.list.invalidate();
      setDeleteZoneDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao excluir zona: " + error.message);
    },
  });

  // Location handlers
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

  // Zone handlers
  const handleCreateZone = () => {
    setZoneForm({ name: "", code: "", description: "", zoneType: "storage" });
    setZoneDialogOpen(true);
  };

  const handleEditZone = (zone: any) => {
    setSelectedZone(zone);
    setZoneForm({
      name: zone.name,
      code: zone.code,
      description: zone.description || "",
      zoneType: zone.zoneType,
    });
    setEditZoneDialogOpen(true);
  };

  const handleDeleteZone = (zone: any) => {
    setSelectedZone(zone);
    setDeleteZoneDialogOpen(true);
  };

  const handleCreateZoneSubmit = () => {
    createZoneMutation.mutate(zoneForm);
  };

  const handleUpdateZoneSubmit = () => {
    if (!selectedZone) return;
    updateZoneMutation.mutate({
      id: selectedZone.id,
      ...zoneForm,
    });
  };

  const handleDeleteZoneConfirm = () => {
    if (!selectedZone) return;
    deleteZoneMutation.mutate({ id: selectedZone.id });
  };

  const getZoneTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      receiving: { label: "Recebimento", variant: "default" },
      storage: { label: "Armazenagem", variant: "secondary" },
      shipping: { label: "Expedição", variant: "outline" },
      quarantine: { label: "Quarentena", variant: "destructive" },
    };
    return types[type] || { label: type, variant: "outline" };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        icon={<MapPin className="h-8 w-8" />}
        title="Endereços e Zonas"
        description="Gestão de endereços de armazenagem e zonas do armazém"
      />

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="locations" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="locations">
              <MapPin className="h-4 w-4 mr-2" />
              Endereços
            </TabsTrigger>
            <TabsTrigger value="zones">
              <Layers className="h-4 w-4 mr-2" />
              Zonas
            </TabsTrigger>
          </TabsList>

          {/* Locations Tab */}
          <TabsContent value="locations">
            <Card>
              <CardContent className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Endereços Cadastrados</h3>
                    <p className="text-sm text-gray-600">Total de {locations?.length || 0} endereço(s) cadastrado(s)</p>
                  </div>
                  <CreateLocationDialog />
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
          </TabsContent>

          {/* Zones Tab */}
          <TabsContent value="zones">
            <Card>
              <CardContent className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Zonas Cadastradas</h3>
                    <p className="text-sm text-gray-600">Total de {zones?.length || 0} zona(s) cadastrada(s)</p>
                  </div>
                  <Button onClick={handleCreateZone}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Zona
                  </Button>
                </div>

                {zonesLoading ? (
                  <div className="text-center py-12 text-gray-500">Carregando...</div>
                ) : zones && zones.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {zones.map((zone: any) => {
                        const typeBadge = getZoneTypeBadge(zone.zoneType);
                        return (
                          <TableRow key={zone.id}>
                            <TableCell className="font-medium">{zone.code}</TableCell>
                            <TableCell>{zone.name}</TableCell>
                            <TableCell>
                              <Badge variant={typeBadge.variant}>
                                {typeBadge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{zone.description || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={zone.active ? "default" : "secondary"}>
                                {zone.active ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleEditZone(zone)}
                                  title="Editar zona"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDeleteZone(zone)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Excluir zona"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                      <Layers className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma zona cadastrada</h3>
                    <p className="text-sm text-gray-600 mb-6">Comece adicionando uma nova zona ao armazém</p>
                    <Button onClick={handleCreateZone}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Zona
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Location Dialog */}
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
              <Label htmlFor="edit-code">Código *</Label>
              <Input
                id="edit-code"
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                placeholder="Ex: A-01-01-01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-aisle">Rua</Label>
              <Input
                id="edit-aisle"
                value={editForm.aisle}
                onChange={(e) => setEditForm({ ...editForm, aisle: e.target.value })}
                placeholder="Ex: A"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-rack">Prédio</Label>
              <Input
                id="edit-rack"
                value={editForm.rack}
                onChange={(e) => setEditForm({ ...editForm, rack: e.target.value })}
                placeholder="Ex: 01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-level">Andar</Label>
              <Input
                id="edit-level"
                value={editForm.level}
                onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                placeholder="Ex: 01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-position">Posição</Label>
              <Input
                id="edit-position"
                value={editForm.position}
                onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                placeholder="Ex: 01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-locationType">Tipo de Localização *</Label>
              <Select
                value={editForm.locationType}
                onValueChange={(value: "whole" | "fraction") =>
                  setEditForm({ ...editForm, locationType: value })
                }
              >
                <SelectTrigger id="edit-locationType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whole">Inteira</SelectItem>
                  <SelectItem value="fraction">Fração</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-storageRule">Regra de Armazenagem *</Label>
              <Select
                value={editForm.storageRule}
                onValueChange={(value: "single" | "multi") =>
                  setEditForm({ ...editForm, storageRule: value })
                }
              >
                <SelectTrigger id="edit-storageRule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Único Item</SelectItem>
                  <SelectItem value="multi">Multi Item</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Location Dialog */}
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
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Zone Dialog */}
      <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Zona</DialogTitle>
            <DialogDescription>
              Crie uma nova zona de armazenagem no armazém.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="zone-code">Código *</Label>
              <Input
                id="zone-code"
                value={zoneForm.code}
                onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })}
                placeholder="Ex: ZONA-A"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zone-name">Nome *</Label>
              <Input
                id="zone-name"
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                placeholder="Ex: Zona de Armazenagem A"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="zone-type">Tipo *</Label>
              <Select
                value={zoneForm.zoneType}
                onValueChange={(value: any) => setZoneForm({ ...zoneForm, zoneType: value })}
              >
                <SelectTrigger id="zone-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receiving">Recebimento</SelectItem>
                  <SelectItem value="storage">Armazenagem</SelectItem>
                  <SelectItem value="shipping">Expedição</SelectItem>
                  <SelectItem value="quarantine">Quarentena</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="zone-description">Descrição</Label>
              <Textarea
                id="zone-description"
                value={zoneForm.description}
                onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                placeholder="Descrição detalhada da zona"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateZoneSubmit} disabled={createZoneMutation.isPending}>
              {createZoneMutation.isPending ? "Criando..." : "Criar Zona"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Zone Dialog */}
      <Dialog open={editZoneDialogOpen} onOpenChange={setEditZoneDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Zona</DialogTitle>
            <DialogDescription>
              Atualize as informações da zona de armazenagem.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-zone-code">Código *</Label>
              <Input
                id="edit-zone-code"
                value={zoneForm.code}
                onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-zone-name">Nome *</Label>
              <Input
                id="edit-zone-name"
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="edit-zone-type">Tipo *</Label>
              <Select
                value={zoneForm.zoneType}
                onValueChange={(value: any) => setZoneForm({ ...zoneForm, zoneType: value })}
              >
                <SelectTrigger id="edit-zone-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receiving">Recebimento</SelectItem>
                  <SelectItem value="storage">Armazenagem</SelectItem>
                  <SelectItem value="shipping">Expedição</SelectItem>
                  <SelectItem value="quarantine">Quarentena</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="edit-zone-description">Descrição</Label>
              <Textarea
                id="edit-zone-description"
                value={zoneForm.description}
                onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditZoneDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateZoneSubmit} disabled={updateZoneMutation.isPending}>
              {updateZoneMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Zone Dialog */}
      <AlertDialog open={deleteZoneDialogOpen} onOpenChange={setDeleteZoneDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a zona <strong>{selectedZone?.name}</strong>? 
              Esta ação marcará a zona como inativa no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteZoneConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
