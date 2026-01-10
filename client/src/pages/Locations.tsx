import React from "react";
import { PageHeader } from "@/components/PageHeader";
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
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { MapPin, Pencil, Trash2, Plus, Layers, Search, ArrowUpDown, X, Printer } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import JsBarcode from "jsbarcode";

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
    storageCondition: "ambient" as "ambient" | "refrigerated_2_8" | "frozen_minus_20" | "controlled" | "quarantine",
    hasTemperatureControl: false,
  });

  // Import Excel states
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<any>(null);

  // Filter and sort states
  const [searchText, setSearchText] = useState("");
  const [filterZone, setFilterZone] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Bulk delete states
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

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

  const deleteManyMutation = trpc.locations.deleteMany.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} endereço(s) excluído(s) com sucesso!`);
      utils.locations.list.invalidate();
      setBulkDeleteDialogOpen(false);
      setSelectedIds([]);
    },
    onError: (error) => {
      toast.error("Erro ao excluir endereços: " + error.message);
    },
  });

  // Zone mutations
  const createZoneMutation = trpc.zones.create.useMutation({
    onSuccess: () => {
      toast.success("Zona criada com sucesso!");
      utils.zones.list.invalidate();
      setZoneDialogOpen(false);
      setZoneForm({ name: "", code: "", storageCondition: "ambient", hasTemperatureControl: false });
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

  const importExcelMutation = trpc.locations.importExcel.useMutation({
    onSuccess: (results) => {
      setImportResults(results);
      utils.locations.list.invalidate();
      toast.success(`Importação concluída! ${results.success.length} endereços criados, ${results.errors.length} erros.`);
    },
    onError: (error) => {
      toast.error("Erro ao importar arquivo: " + error.message);
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
    setZoneForm({ name: "", code: "", storageCondition: "ambient", hasTemperatureControl: false });
    setZoneDialogOpen(true);
  };

  const handleEditZone = (zone: any) => {
    setSelectedZone(zone);
    setZoneForm({
      name: zone.name,
      code: zone.code,
      storageCondition: zone.storageCondition,
      hasTemperatureControl: zone.hasTemperatureControl || false,
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

  // Import Excel handlers
  const handleImportClick = () => {
    setImportFile(null);
    setImportResults(null);
    setImportDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResults(null);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const fileBase64 = base64.split(',')[1]; // Remove data:application/...;base64,
      importExcelMutation.mutate({ fileBase64 });
    };
    reader.readAsDataURL(importFile);
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/modelo_importacao_enderecos.xlsx';
    link.download = 'modelo_importacao_enderecos.xlsx';
    link.click();
  };

  // Bulk delete handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedLocations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedLocations.map((loc: any) => loc.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos um endereço para excluir");
      return;
    }
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    deleteManyMutation.mutate({ ids: selectedIds });
  };

  const handlePrintLabels = () => {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos um endereço para imprimir");
      return;
    }

    // Buscar dados completos dos endereços selecionados
    const selectedLocations = locations?.filter((loc: any) => selectedIds.includes(loc.id)) || [];
    
    if (selectedLocations.length === 0) {
      toast.error("Nenhum endereço encontrado");
      return;
    }

    // Gerar documento Word e fazer download
    generateWordLabels(selectedLocations);
    toast.success(`${selectedLocations.length} etiqueta(s) enviada(s) para impressão`);
  };

  // Filter and sort logic
  const filteredAndSortedLocations = React.useMemo(() => {
    if (!locations) return [];

    let filtered = [...locations];

    // Apply search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(loc => 
        loc.code?.toLowerCase().includes(search) ||
        loc.aisle?.toLowerCase().includes(search) ||
        loc.rack?.toLowerCase().includes(search) ||
        loc.level?.toLowerCase().includes(search)
      );
    }

    // Apply zone filter
    if (filterZone !== "all") {
      filtered = filtered.filter(loc => loc.zoneId === parseInt(filterZone));
    }

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(loc => loc.status === filterStatus);
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter(loc => loc.locationType === filterType);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField as keyof typeof a];
      let bVal = b[sortField as keyof typeof b];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal !== null && bVal !== null) {
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return filtered;
  }, [locations, searchText, filterZone, filterStatus, filterType, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleClearFilters = () => {
    setSearchText("");
    setFilterZone("all");
    setFilterStatus("all");
    setFilterType("all");
  };

  const getStorageConditionBadge = (condition: string) => {
    const conditions: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      ambient: { label: "Ambiente", variant: "default" },
      refrigerated_2_8: { label: "Refrigerado 2-8°C", variant: "secondary" },
      frozen_minus_20: { label: "Congelado -20°C", variant: "outline" },
      controlled: { label: "Controlado", variant: "secondary" },
      quarantine: { label: "Quarentena", variant: "destructive" },
    };
    return conditions[condition] || { label: condition, variant: "outline" };
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
                    <p className="text-sm text-gray-600">
                      {filteredAndSortedLocations.length} de {locations?.length || 0} endereço(s)
                      {(searchText || filterZone !== "all" || filterStatus !== "all" || filterType !== "all") && " (filtrado)"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selectedIds.length > 0 && (
                      <>
                        <Button variant="outline" onClick={handlePrintLabels}>
                          <Printer className="h-4 w-4 mr-2" />
                          Imprimir Etiquetas ({selectedIds.length})
                        </Button>
                        <Button variant="destructive" onClick={handleBulkDelete}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir Selecionados ({selectedIds.length})
                        </Button>
                      </>
                    )}
                    <Button variant="outline" onClick={handleImportClick}>
                      Importar Excel
                    </Button>
                    <CreateLocationDialog />
                  </div>
                </div>

                {/* Filters Section */}
                <div className="mb-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {/* Search */}
                    <div className="md:col-span-2 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar por código, rua, prédio..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    {/* Zone Filter */}
                    <Select value={filterZone} onValueChange={setFilterZone}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as zonas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as zonas</SelectItem>
                        {zones?.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id.toString()}>
                            {zone.code} - {zone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="available">Disponível</SelectItem>
                        <SelectItem value="occupied">Ocupado</SelectItem>
                        <SelectItem value="blocked">Bloqueado</SelectItem>
                        <SelectItem value="counting">Em Contagem</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Type Filter */}
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        <SelectItem value="whole">Inteira</SelectItem>
                        <SelectItem value="fraction">Fração</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters Button */}
                  {(searchText || filterZone !== "all" || filterStatus !== "all" || filterType !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Limpar Filtros
                    </Button>
                  )}
                </div>

                {isLoading ? (
                  <div className="text-center py-12 text-gray-500">Carregando...</div>
                ) : filteredAndSortedLocations && filteredAndSortedLocations.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedIds.length === filteredAndSortedLocations.length && filteredAndSortedLocations.length > 0}
                            onCheckedChange={handleToggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>
                          <button
                            onClick={() => handleSort('code')}
                            className="flex items-center gap-1 hover:text-blue-600 font-semibold"
                          >
                            Código
                            {sortField === 'code' && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            onClick={() => handleSort('aisle')}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Rua
                            {sortField === 'aisle' && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            onClick={() => handleSort('rack')}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Prédio
                            {sortField === 'rack' && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            onClick={() => handleSort('level')}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Andar
                            {sortField === 'level' && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Regra</TableHead>
                        <TableHead>
                          <button
                            onClick={() => handleSort('status')}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Status
                            {sortField === 'status' && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">Ções</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedLocations.map((location: any) => (
                        <TableRow key={location.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(location.id)}
                              onCheckedChange={() => handleToggleSelect(location.id)}
                            />
                          </TableCell>
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
                        const conditionBadge = getStorageConditionBadge(zone.storageCondition);
                        return (
                          <TableRow key={zone.id}>
                            <TableCell className="font-medium">{zone.code}</TableCell>
                            <TableCell>{zone.name}</TableCell>
                            <TableCell>
                              <Badge variant={conditionBadge.variant}>
                                {conditionBadge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {zone.hasTemperatureControl ? "Controle de Temperatura" : "Sem Controle"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={zone.status === "active" ? "default" : "secondary"}>
                                {zone.status === "active" ? "Ativo" : "Inativo"}
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
              <Label htmlFor="zone-storage-condition">Condição de Armazenagem *</Label>
              <Select
                value={zoneForm.storageCondition}
                onValueChange={(value: any) => setZoneForm({ ...zoneForm, storageCondition: value })}
              >
                <SelectTrigger id="zone-storage-condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambient">Ambiente</SelectItem>
                  <SelectItem value="refrigerated_2_8">Refrigerado 2-8°C</SelectItem>
                  <SelectItem value="frozen_minus_20">Congelado -20°C</SelectItem>
                  <SelectItem value="controlled">Controlado</SelectItem>
                  <SelectItem value="quarantine">Quarentena</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="zone-temp-control" className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="zone-temp-control"
                  checked={zoneForm.hasTemperatureControl}
                  onChange={(e) => setZoneForm({ ...zoneForm, hasTemperatureControl: e.target.checked })}
                  className="h-4 w-4"
                />
                Possui Controle de Temperatura
              </Label>
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
              <Label htmlFor="edit-zone-storage-condition">Condição de Armazenagem *</Label>
              <Select
                value={zoneForm.storageCondition}
                onValueChange={(value: any) => setZoneForm({ ...zoneForm, storageCondition: value })}
              >
                <SelectTrigger id="edit-zone-storage-condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambient">Ambiente</SelectItem>
                  <SelectItem value="refrigerated_2_8">Refrigerado 2-8°C</SelectItem>
                  <SelectItem value="frozen_minus_20">Congelado -20°C</SelectItem>
                  <SelectItem value="controlled">Controlado</SelectItem>
                  <SelectItem value="quarantine">Quarentena</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="edit-zone-temp-control" className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-zone-temp-control"
                  checked={zoneForm.hasTemperatureControl}
                  onChange={(e) => setZoneForm({ ...zoneForm, hasTemperatureControl: e.target.checked })}
                  className="h-4 w-4"
                />
                Possui Controle de Temperatura
              </Label>
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

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão em Massa</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div>
                  Você está prestes a <strong className="text-red-600">excluir permanentemente {selectedIds.length} endereço(s)</strong> do sistema.
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-sm font-semibold text-red-900 mb-1">
                    ⚠️ Atenção: Esta ação é IRREVERSÍVEL!
                  </div>
                  <div className="text-xs text-red-700">
                    Os endereços serão removidos permanentemente do banco de dados (hard delete).
                    Não será possível recuperá-los após a exclusão.
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Tem certeza que deseja continuar?
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteManyMutation.isPending}
            >
              {deleteManyMutation.isPending ? 'Excluindo...' : `Excluir ${selectedIds.length} Endereço(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Excel Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Endereços via Excel</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo Excel (.xlsx) com os endereços a serem cadastrados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Arquivo Excel *</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
              />
              {importFile && (
                <p className="text-sm text-gray-600">
                  Arquivo selecionado: <strong>{importFile.name}</strong>
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 mb-2">
                <strong>Não possui o modelo?</strong>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                Baixar Modelo Excel
              </Button>
            </div>

            {importResults && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-900 mb-1">
                    ✓ {importResults.success.length} endereços importados com sucesso
                  </p>
                  {importResults.success.length > 0 && (
                    <p className="text-xs text-green-700">
                      {importResults.success.slice(0, 5).join(', ')}
                      {importResults.success.length > 5 && ` e mais ${importResults.success.length - 5}...`}
                    </p>
                  )}
                </div>

                {importResults.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-900 mb-2">
                      ✗ {importResults.errors.length} erros encontrados
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {importResults.errors.map((err: any, idx: number) => (
                        <p key={idx} className="text-xs text-red-700">
                          Linha {err.row}: {err.error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              {importResults ? 'Fechar' : 'Cancelar'}
            </Button>
            {!importResults && (
              <Button
                onClick={handleImportSubmit}
                disabled={!importFile || importExcelMutation.isPending}
              >
                {importExcelMutation.isPending ? 'Importando...' : 'Importar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Gera etiquetas em formato Word (.doc)
 * Formato: 10cm x 5cm por etiqueta (replicando layout do PDF)
 */
function generateWordLabels(locations: any[]) {
  // Gerar HTML para documento Word
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Etiquetas de Endereços</title>
      <style>
        @page {
          size: 10cm 5cm;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
        }
        .label {
          width: 10cm;
          height: 5cm;
          padding: 0.3cm 0.5cm;
          box-sizing: border-box;
          page-break-after: always;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .label:last-child {
          page-break-after: auto;
        }
        .title {
          font-size: 14pt;
          font-weight: bold;
          color: #000;
          margin-bottom: 8px;
          letter-spacing: 2px;
        }
        .code {
          font-size: 48pt;
          font-weight: bold;
          color: #000;
          margin: 10px 0;
          line-height: 1;
        }
        .barcode {
          margin: 10px 0;
        }
        .info {
          font-size: 10pt;
          color: #000;
          margin: 3px 0;
        }
        .description {
          font-size: 9pt;
          color: #000;
          margin: 2px 0;
        }
      </style>
    </head>
    <body>
  `;

  locations.forEach((location) => {
    // Determinar zona (baseado no código ou zona do location)
    const zoneName = location.zoneName || 'Armazenagem';
    
    // Determinar tipo
    const tipoText = location.locationType === 'whole' ? 'Palete Inteiro' : 'Fração';
    
    // Montar informações adicionais
    const details = [];
    if (location.aisle) details.push(`Rua: ${location.aisle}`);
    if (location.rack) details.push(`Préd: ${location.rack}`);
    if (location.level) details.push(`Andar: ${location.level}`);
    const detailsText = details.length > 0 ? details.join(' | ') : 'Endereço de Armazenagem';

    htmlContent += `
      <div class="label">
        <div class="title">ENDEREÇO</div>
        <div class="code">${location.code}</div>
        <div class="barcode">
          ${generateBarcodeSVG(location.code)}
        </div>
        <div class="info">Zona: ${zoneName} | Tipo: ${tipoText}</div>
        <div class="description">${detailsText}</div>
      </div>
    `;
  });

  htmlContent += `
    </body>
    </html>
  `;

  // Criar blob e fazer download como .doc
  const blob = new Blob([htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `etiquetas_enderecos_${Date.now()}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Gera código de barras Code 128 usando JsBarcode
 */
function generateBarcodeSVG(text: string): string {
  try {
    // Criar elemento SVG temporário
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    
    // Gerar código de barras Code 128
    JsBarcode(svg, text, {
      format: 'CODE128',
      width: 2,
      height: 50,
      displayValue: true,
      fontSize: 14,
      margin: 5,
    });
    
    // Retornar SVG como string
    return svg.outerHTML;
  } catch (error) {
    console.error('Erro ao gerar código de barras:', error);
    // Fallback: retornar SVG simples com texto
    return `<svg width="200" height="60" xmlns="http://www.w3.org/2000/svg">
      <text x="100" y="30" text-anchor="middle" font-size="16" font-family="monospace">${text}</text>
    </svg>`;
  }
}
