import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Package, Layers, CheckCircle2 } from "lucide-react";
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
  orderCount: number; // Quantos pedidos contêm este produto
}

interface OrderWithItems {
  id: number;
  tenantId: number;
  clientName?: string | null;
  orderNumber: string;
  items?: Array<{
    productId: number;
    productSku?: string | null;
    productDescription?: string | null;
    productName?: string | null;
    requestedQuantity?: number;
    quantity?: number;
    requestedUM?: string;
    unit?: string;
  }>;
}

export function CreateWaveDialog({ open, onOpenChange, selectedOrderIds, onSuccess }: CreateWaveDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [ordersWithItems, setOrdersWithItems] = useState<OrderWithItems[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Buscar detalhes dos pedidos selecionados
  const { data: orders } = trpc.picking.list.useQuery({ limit: 1000 });

  const createWaveMutation = trpc.picking.createWave.useMutation({
    onSuccess: () => {
      toast.success("Onda criada com sucesso!");
      onSuccess();
      onOpenChange(false);
      setOrdersWithItems([]);
    },
    onError: (error) => {
      toast.error(`Erro ao criar onda: ${error.message}`);
      setIsGenerating(false);
    },
  });

  // Buscar itens dos pedidos selecionados quando o modal abrir
  useEffect(() => {
    if (!open || selectedOrderIds.length === 0) {
      setOrdersWithItems([]);
      return;
    }

    const fetchOrderItems = async () => {
      setIsLoadingItems(true);
      console.log("[CreateWaveDialog] Iniciando busca de itens para pedidos:", selectedOrderIds);
      
      try {
        // Buscar cada pedido individualmente
        const promises = selectedOrderIds.map(async (orderId) => {
          const url = `/api/trpc/picking.getById?input=${encodeURIComponent(JSON.stringify({ id: orderId }))}`;
          console.log("[CreateWaveDialog] Buscando pedido:", orderId, "URL:", url);
          
          const response = await fetch(url);
          console.log("[CreateWaveDialog] Response status:", response.status, "para pedido:", orderId);
          
          if (!response.ok) {
            console.error("[CreateWaveDialog] Erro ao buscar pedido", orderId, "status:", response.status);
            throw new Error(`Failed to fetch order ${orderId}`);
          }
          
          const data = await response.json();
          console.log("[CreateWaveDialog] Dados recebidos para pedido", orderId, ":", data);
          return data.result.data;
        });
        
        const results = await Promise.all(promises);
        console.log("[CreateWaveDialog] Todos os resultados:", results);
        
        // Mapear resultados para formato esperado
        const mappedResults = results.filter(Boolean).map((order: any) => ({
          ...order,
          items: order.items?.map((item: any) => ({
            ...item,
            productSku: item.productSku || item.productName,
            productDescription: item.productDescription || item.productName,
            quantity: item.requestedQuantity || item.quantity,
            unit: item.requestedUM || item.unit,
          })),
        }));
        
        console.log("[CreateWaveDialog] Resultados mapeados:", mappedResults);
        setOrdersWithItems(mappedResults as OrderWithItems[]);
      } catch (error) {
        console.error("[CreateWaveDialog] Erro ao buscar itens dos pedidos:", error);
        toast.error("Erro ao carregar itens dos pedidos");
      } finally {
        setIsLoadingItems(false);
      }
    };

    fetchOrderItems();
  }, [open, selectedOrderIds]);

  // Filtrar pedidos selecionados
  const selectedOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => selectedOrderIds.includes(order.id));
  }, [orders, selectedOrderIds]);

  // Validar se todos os pedidos são do mesmo cliente
  const clientValidation = useMemo(() => {
    if (selectedOrders.length === 0) return { valid: false, message: "Nenhum pedido selecionado" };
    
    const firstTenantId = selectedOrders[0].tenantId;
    const allSameClient = selectedOrders.every((order) => order.tenantId === firstTenantId);
    
    if (!allSameClient) {
      return { valid: false, message: "Todos os pedidos devem ser do mesmo cliente" };
    }
    
    return { valid: true, message: `Cliente: ${selectedOrders[0].clientName || "N/A"}` };
  }, [selectedOrders]);

  // Consolidar itens dos pedidos
  const consolidatedItems = useMemo(() => {
    const itemsMap = new Map<number, ConsolidatedItem>();

    ordersWithItems.forEach((orderData) => {
      orderData?.items?.forEach((item: any) => {
        const quantity = item.quantity || item.requestedQuantity || 0;
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
            unit: item.unit || item.requestedUM || "UN",
            orderCount: 1,
          });
        }
      });
    });

    return Array.from(itemsMap.values());
  }, [ordersWithItems]);

  const handleCreateWave = async () => {
    if (!clientValidation.valid) {
      toast.error(clientValidation.message);
      return;
    }

    setIsGenerating(true);
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

          {/* Resumo da Onda */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Pedidos</div>
              <div className="text-2xl font-bold text-blue-700">{selectedOrders.length}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-600 font-medium">Produtos Distintos</div>
              <div className="text-2xl font-bold text-purple-700">
                {isLoadingItems ? "..." : consolidatedItems.length}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-medium">Itens Totais</div>
              <div className="text-2xl font-bold text-green-700">
                {isLoadingItems ? "..." : consolidatedItems.reduce((sum, item) => sum + item.totalQuantity, 0)}
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
                  #{order.orderNumber} - {order.clientName}
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
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        Carregando itens...
                      </TableCell>
                    </TableRow>
                  ) : consolidatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
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
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateWave}
              disabled={!clientValidation.valid || isGenerating || consolidatedItems.length === 0 || isLoadingItems}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? "Gerando Onda..." : "Confirmar e Gerar Onda"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
