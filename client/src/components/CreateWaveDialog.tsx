import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Package, Layers, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateWaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrderIds: number[];
  onSuccess: () => void;
}

interface ConsolidatedItem {
  productId: number;
  productSku: string;
  productDescription: string;
  totalQuantity: number;
  unit: string;
  orderCount: number;
}

export function CreateWaveDialog({ open, onOpenChange, selectedOrderIds, onSuccess }: CreateWaveDialogProps) {
  // Buscar itens dos pedidos selecionados usando o novo endpoint getByIds
  const { data: ordersWithItems, isLoading: isLoadingItems, isError: hasError } = trpc.picking.getByIds.useQuery(
    { ids: selectedOrderIds },
    { enabled: open && selectedOrderIds.length > 0 }
  );

  const createWaveMutation = trpc.picking.createWave.useMutation({
    onSuccess: () => {
      toast.success("Onda criada com sucesso!");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erro ao criar onda: ${error.message}`);
    },
  });

  // Usar diretamente ordersWithItems como selectedOrders
  const selectedOrders = useMemo(() => {
    return ordersWithItems || [];
  }, [ordersWithItems]);

  // Validar se todos os pedidos são do mesmo cliente
  const clientValidation = useMemo(() => {
    if (selectedOrders.length === 0) return { valid: false, message: "Nenhum pedido selecionado" };
    
    const firstTenantId = selectedOrders[0].tenantId;
    const allSameClient = selectedOrders.every((order) => order.tenantId === firstTenantId);
    
    if (!allSameClient) {
      return { valid: false, message: "Todos os pedidos devem ser do mesmo cliente" };
    }
    
    return { valid: true, message: `Cliente: ${selectedOrders[0].customerName || "N/A"}` };
  }, [selectedOrders]);

  // Consolidar itens dos pedidos
  const consolidatedItems = useMemo(() => {
    if (!ordersWithItems) return [];

    const itemsMap = new Map<number, ConsolidatedItem>();

    ordersWithItems.forEach((orderData) => {
      orderData?.items?.forEach((item: any) => {
        const quantity = item.requestedQuantity || item.quantity || 0;
        const existing = itemsMap.get(item.productId);
        
        if (existing) {
          existing.totalQuantity += quantity;
          existing.orderCount += 1;
        } else {
          itemsMap.set(item.productId, {
            productId: item.productId,
            productSku: item.productSku || item.productName || "N/A",
            productDescription: item.productDescription || item.productName || "Produto sem descrição",
            totalQuantity: quantity,
            unit: item.requestedUM || item.unit || "UN",
            orderCount: 1,
          });
        }
      });
    });

    return Array.from(itemsMap.values());
  }, [ordersWithItems]);

  const handleCreateWave = () => {
    if (!clientValidation.valid) {
      toast.error(clientValidation.message);
      return;
    }

    createWaveMutation.mutate({ orderIds: selectedOrderIds });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" />
            Gerar Onda de Separação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Validação de Cliente */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            clientValidation.valid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
          }`}>
            {clientValidation.valid ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span className={clientValidation.valid ? "text-green-700" : "text-red-700"}>
              {clientValidation.message}
            </span>
          </div>

          {/* Erro ao carregar itens */}
          {hasError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-700">Erro ao carregar itens dos pedidos</span>
            </div>
          )}

          {/* Resumo da Onda */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Pedidos</div>
              <div className="text-2xl font-bold text-blue-700">{selectedOrders.length}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-600 font-medium">Produtos Distintos</div>
              <div className="text-2xl font-bold text-purple-700 flex items-center gap-2">
                {isLoadingItems ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  consolidatedItems.length
                )}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-medium">Itens Totais</div>
              <div className="text-2xl font-bold text-green-700 flex items-center gap-2">
                {isLoadingItems ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  consolidatedItems.reduce((sum, item) => sum + item.totalQuantity, 0)
                )}
              </div>
            </div>
          </div>

          {/* Lista de Pedidos Selecionados */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Pedidos Selecionados
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedOrders.map((order) => (
                <Badge key={order.id} variant="outline" className="text-sm">
                  #{order.orderNumber} - {order.customerName}
                </Badge>
              ))}
            </div>
          </div>

          {/* Prévia de Consolidação */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Prévia de Consolidação</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd. Total</TableHead>
                    <TableHead className="text-center">Unidade</TableHead>
                    <TableHead className="text-center">Pedidos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingItems ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Carregando itens...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : consolidatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        Nenhum item para consolidar
                      </TableCell>
                    </TableRow>
                  ) : (
                    consolidatedItems.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell className="font-mono text-sm">{item.productSku}</TableCell>
                        <TableCell>{item.productDescription}</TableCell>
                        <TableCell className="text-center font-semibold">{item.totalQuantity}</TableCell>
                        <TableCell className="text-center">{item.unit}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{item.orderCount}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={createWaveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateWave}
              disabled={
                !clientValidation.valid || 
                createWaveMutation.isPending || 
                consolidatedItems.length === 0 || 
                isLoadingItems ||
                hasError
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createWaveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando Onda...
                </>
              ) : (
                "Confirmar e Gerar Onda"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
