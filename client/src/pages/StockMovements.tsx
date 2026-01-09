import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowRightLeft, AlertCircle, Plus, History } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { format } from "date-fns";

export default function StockMovements() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fromLocationId, setFromLocationId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [movementType, setMovementType] = useState<"transfer" | "adjustment" | "return" | "disposal" | "quality">("transfer");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();

  // Queries
  const { data: movements = [], isLoading } = trpc.stock.getMovements.useQuery({});
  const { data: locationsWithStock = [] } = trpc.stock.getLocationsWithStock.useQuery();
  
  // Query de produtos do endereço origem (só busca quando fromLocationId está definido)
  const { data: locationProducts = [] } = trpc.stock.getLocationProducts.useQuery(
    { locationId: Number(fromLocationId) },
    { enabled: !!fromLocationId }
  );

  // Query de endereços destino (filtrados por tipo de movimentação)
  // Obtém produto selecionado para filtrar
  const selectedProductForFilter = locationProducts.find(p => `${p.productId}-${p.batch || ""}` === selectedProduct);
  
  const { data: destinationLocations = [] } = trpc.stock.getDestinationLocations.useQuery(
    {
      movementType,
      productId: selectedProductForFilter?.productId,
      batch: selectedProductForFilter?.batch || undefined,
      tenantId: selectedProductForFilter?.tenantId,
    },
    { enabled: !!selectedProduct && movementType !== "adjustment" && movementType !== "disposal" }
  );

  // Mutation
  const registerMovement = trpc.stock.registerMovement.useMutation({
    onSuccess: () => {
      toast.success("Movimentação registrada com sucesso!");
      utils.stock.getMovements.invalidate();
      utils.stock.getPositions.invalidate();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar movimentação");
    },
  });

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setFromLocationId("");
    setSelectedProduct("");
    setToLocationId("");
    setQuantity("");
    setMovementType("transfer");
    setNotes("");
  };

  const handleSubmit = () => {
    if (!fromLocationId || !selectedProduct || !toLocationId || !quantity) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const product = locationProducts.find(p => `${p.productId}-${p.batch || ""}` === selectedProduct);
    if (!product) {
      toast.error("Produto não encontrado");
      return;
    }

    registerMovement.mutate({
      productId: product.productId,
      fromLocationId: Number(fromLocationId),
      toLocationId: Number(toLocationId),
      quantity: Number(quantity),
      batch: product.batch || undefined,
      movementType,
      notes: notes || undefined,
    });
  };

  // Badge de tipo de movimentação
  const getMovementTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; className: string }> = {
      transfer: { label: "Transferência", className: "bg-blue-100 text-blue-800 border-blue-300" },
      adjustment: { label: "Ajuste", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
      return: { label: "Devolução", className: "bg-green-100 text-green-800 border-green-300" },
      disposal: { label: "Descarte", className: "bg-red-100 text-red-800 border-red-300" },
      quality: { label: "Qualidade", className: "bg-indigo-100 text-indigo-800 border-indigo-300" },
      receiving: { label: "Recebimento", className: "bg-purple-100 text-purple-800 border-purple-300" },
      picking: { label: "Separação", className: "bg-orange-100 text-orange-800 border-orange-300" },
    };
    const config = typeConfig[type] || typeConfig.transfer;
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  // Obter produto selecionado para mostrar saldo disponível
  const selectedProductData = locationProducts.find(p => `${p.productId}-${p.batch || ""}` === selectedProduct);
  const maxQuantity = selectedProductData?.quantity || 0;

  // Endereços de destino: usar filtrados ou todos com estoque
  const availableDestinations = (movementType === "transfer" || movementType === "return" || movementType === "quality") && selectedProduct
    ? destinationLocations
    : locationsWithStock.filter((loc) => String(loc.id) !== fromLocationId);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        icon={<ArrowRightLeft className="h-8 w-8" />}
        title="Movimentações de Estoque"
        description="Registre e consulte movimentações entre endereços"
        actions={
          <Button onClick={handleOpenDialog}>
            <Plus className="w-4 h-4 mr-2" /> Nova Movimentação
          </Button>
        }
      />

      <div className="container py-8">
        {/* Tabela de Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" /> Histórico de Movimentações
            </CardTitle>
            <CardDescription>{movements.length} movimentação(ões) registrada(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : movements.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Nenhuma movimentação registrada</AlertDescription>
              </Alert>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Realizado Por</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell>{format(new Date(mov.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                        <TableCell>{getMovementTypeBadge(mov.movementType)}</TableCell>
                        <TableCell className="font-mono">{mov.productSku}</TableCell>
                        <TableCell>{mov.productDescription}</TableCell>
                        <TableCell className="font-mono">{mov.batch || "-"}</TableCell>
                        <TableCell className="text-right font-bold">
                          {mov.quantity.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>{mov.performedByName || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{mov.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Nova Movimentação */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Movimentação de Estoque</DialogTitle>
            <DialogDescription>
              Registre uma movimentação entre endereços
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Endereço Origem */}
            <div className="grid gap-2">
              <Label htmlFor="fromLocation">Endereço Origem *</Label>
              <Select value={fromLocationId} onValueChange={setFromLocationId}>
                <SelectTrigger id="fromLocation">
                  <SelectValue placeholder="Selecione o endereço origem" />
                </SelectTrigger>
                <SelectContent>
                  {locationsWithStock.map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.code} ({loc.zoneName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Produto/Lote */}
            {fromLocationId && (
              <div className="grid gap-2">
                <Label htmlFor="product">Produto/Lote *</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger id="product">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationProducts.length === 0 ? (
                      <SelectItem value="none" disabled>Nenhum produto disponível</SelectItem>
                    ) : (
                      locationProducts.map((prod) => (
                        <SelectItem 
                          key={`${prod.productId}-${prod.batch || ""}`} 
                          value={`${prod.productId}-${prod.batch || ""}`}
                        >
                          {prod.productSku} - {prod.productDescription} | Lote: {prod.batch || "SEM LOTE"} | Saldo: {prod.quantity}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedProductData && (
                  <p className="text-sm text-muted-foreground">
                    Saldo disponível: <strong>{maxQuantity}</strong> unidades
                  </p>
                )}
              </div>
            )}

            {/* Quantidade */}
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantidade *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={maxQuantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Digite a quantidade"
              />
            </div>

            {/* Endereço Destino */}
            <div className="grid gap-2">
              <Label htmlFor="toLocation">Endereço Destino *</Label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger id="toLocation">
                  <SelectValue placeholder="Selecione o endereço destino" />
                </SelectTrigger>
                <SelectContent>
                  {availableDestinations.length === 0 ? (
                    <SelectItem value="none" disabled>Nenhum endereço disponível</SelectItem>
                  ) : (
                    availableDestinations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.code} ({loc.zoneName})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Movimentação */}
            <div className="grid gap-2">
              <Label htmlFor="movementType">Tipo de Movimentação *</Label>
              <Select value={movementType} onValueChange={(v) => setMovementType(v as any)}>
                <SelectTrigger id="movementType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transferência</SelectItem>
                  <SelectItem value="adjustment">Ajuste</SelectItem>
                  <SelectItem value="return">Devolução</SelectItem>
                  <SelectItem value="disposal">Descarte</SelectItem>
                  <SelectItem value="quality">Qualidade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Digite observações sobre a movimentação (opcional)"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={registerMovement.isPending || !fromLocationId || !selectedProduct || !toLocationId || !quantity}
            >
              {registerMovement.isPending ? "Registrando..." : "Registrar Movimentação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
