import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, AlertCircle, Scan } from "lucide-react";
import { toast } from "sonner";

interface BlindCheckModalProps {
  open: boolean;
  onClose: () => void;
  receivingOrderId: number;
  items: Array<{
    id: number;
    productId: number;
    expectedQuantity: number;
    receivedQuantity: number;
    expectedGtin?: string | null;
    productSku?: string | null;
    productDescription?: string | null;
  }>;
}

interface CheckedItem {
  itemId: number;
  productDescription: string;
  batch: string;
  quantityReceived: number;
  hasDivergence: boolean;
  timestamp: Date;
}

export function BlindCheckModal({ open, onClose, receivingOrderId, items }: BlindCheckModalProps) {
  const [barcode, setBarcode] = useState("");
  const [batch, setBatch] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [checkedItems, setCheckedItems] = useState<CheckedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const checkItemMutation = trpc.receiving.checkItem.useMutation({
    onSuccess: (data, variables) => {
      const item = items.find(i => i.id === variables.itemId);
      
      setCheckedItems(prev => [...prev, {
        itemId: variables.itemId,
        productDescription: item?.productDescription || "Produto desconhecido",
        batch: variables.batch || "S/L",
        quantityReceived: variables.quantityReceived,
        hasDivergence: data.hasDivergence,
        timestamp: new Date(),
      }]);

      if (data.hasDivergence) {
        toast.warning("Divergência detectada!", {
          description: `Item conferido com quantidade diferente do esperado.`,
        });
      } else {
        toast.success("Item conferido com sucesso!", {
          description: data.message,
        });
      }

      // Limpar campos
      setBarcode("");
      setBatch("");
      setExpiryDate("");
      setQuantity(1);
      setIsProcessing(false);

      // Retornar foco ao input do scanner
      setTimeout(() => barcodeInputRef.current?.focus(), 100);

      // Invalidar queries
      utils.receiving.getItems.invalidate({ orderId: receivingOrderId });
    },
    onError: (error) => {
      toast.error("Erro ao conferir item", {
        description: error.message,
      });
      setIsProcessing(false);
      barcodeInputRef.current?.focus();
    },
  });

  // Foco automático no input do scanner ao abrir modal
  useEffect(() => {
    if (open) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleBarcodeSubmit = () => {
    if (!barcode.trim()) {
      toast.error("Digite ou escaneie um código de barras");
      return;
    }

    setIsProcessing(true);

    // Buscar item por GTIN/EAN
    const matchingItem = items.find(item => 
      item.expectedGtin === barcode || 
      item.productSku === barcode
    );

    if (!matchingItem) {
      toast.error("Produto não encontrado", {
        description: `Código ${barcode} não pertence a esta ordem de recebimento.`,
      });
      setIsProcessing(false);
      setBarcode("");
      barcodeInputRef.current?.focus();
      return;
    }

    // Verificar se já foi conferido completamente
    if (matchingItem.receivedQuantity >= matchingItem.expectedQuantity) {
      toast.warning("Item já conferido", {
        description: "Este item já foi conferido completamente.",
      });
      setIsProcessing(false);
      setBarcode("");
      barcodeInputRef.current?.focus();
      return;
    }

    // Calcular quantidade a conferir
    const remainingQuantity = matchingItem.expectedQuantity - matchingItem.receivedQuantity;
    const quantityToCheck = Math.min(quantity, remainingQuantity + 10); // Permite 10 unidades a mais para sobras

    // Registrar conferência
    checkItemMutation.mutate({
      itemId: matchingItem.id,
      quantityReceived: matchingItem.receivedQuantity + quantityToCheck,
      batch,
      expiryDate: expiryDate || undefined,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.currentTarget === barcodeInputRef.current) {
        handleBarcodeSubmit();
      }
    }
  };

  const handleClose = () => {
    if (checkedItems.length > 0) {
      const confirmed = window.confirm(
        "Você conferiu itens nesta sessão. Tem certeza que deseja fechar?"
      );
      if (!confirmed) return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Conferência Cega - Ordem #{receivingOrderId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Scanner Input */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className="space-y-4">
              <div>
                <Label htmlFor="barcode" className="text-base font-semibold">
                  Código de Barras (GTIN/EAN/SKU)
                </Label>
                <Input
                  ref={barcodeInputRef}
                  id="barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escaneie ou digite o código de barras..."
                  className="mt-2 text-lg font-mono"
                  disabled={isProcessing}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="batch">Lote</Label>
                  <Input
                    id="batch"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Opcional"
                    disabled={isProcessing}
                  />
                </div>

                <div>
                  <Label htmlFor="expiryDate">Data de Validade</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>

                <div>
                  <Label htmlFor="quantity">Quantidade</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    disabled={isProcessing}
                  />
                </div>
              </div>

              <Button
                onClick={handleBarcodeSubmit}
                disabled={isProcessing || !barcode.trim()}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Conferir Item
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Itens Conferidos */}
          {checkedItems.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Itens Conferidos Nesta Sessão</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Hora</th>
                      <th className="text-left p-3 text-sm font-medium">Produto</th>
                      <th className="text-left p-3 text-sm font-medium">Lote</th>
                      <th className="text-right p-3 text-sm font-medium">Quantidade</th>
                      <th className="text-center p-3 text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkedItems.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-3 text-sm">
                          {item.timestamp.toLocaleTimeString("pt-BR")}
                        </td>
                        <td className="p-3 text-sm">{item.productDescription}</td>
                        <td className="p-3 text-sm font-mono">{item.batch}</td>
                        <td className="p-3 text-sm text-right">{item.quantityReceived}</td>
                        <td className="p-3 text-center">
                          {item.hasDivergence ? (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-xs">Divergência</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs">OK</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resumo dos Itens da Ordem */}
          <div>
            <h3 className="font-semibold mb-3">Itens da Ordem</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Produto</th>
                    <th className="text-center p-3">Esperado</th>
                    <th className="text-center p-3">Recebido</th>
                    <th className="text-center p-3">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const progress = item.expectedQuantity > 0 
                      ? (item.receivedQuantity / item.expectedQuantity) * 100 
                      : 0;
                    const isComplete = item.receivedQuantity >= item.expectedQuantity;

                    return (
                      <tr key={item.id} className="border-t">
                        <td className="p-3">
                          <div className="font-medium">{item.productDescription}</div>
                          <div className="text-xs text-muted-foreground">
                            SKU: {item.productSku} | GTIN: {item.expectedGtin || "N/A"}
                          </div>
                        </td>
                        <td className="p-3 text-center">{item.expectedQuantity}</td>
                        <td className="p-3 text-center font-semibold">
                          {item.receivedQuantity}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  isComplete ? "bg-green-500" : "bg-blue-500"
                                }`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-12 text-right">
                              {Math.round(progress)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
