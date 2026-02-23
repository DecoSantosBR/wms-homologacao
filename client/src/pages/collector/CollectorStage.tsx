import { useState } from "react";
import { CollectorLayout } from "../../components/CollectorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { Camera, Check, X, AlertCircle } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";

export function CollectorStage() {
  const [showScanner, setShowScanner] = useState(false);
  const [currentField, setCurrentField] = useState<"order" | "product" | null>(null);
  
  const [orderNumber, setOrderNumber] = useState("");
  const [checkId, setCheckId] = useState<number | null>(null);
  const [scannedItems, setScannedItems] = useState<any[]>([]);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [volumeQuantity, setVolumeQuantity] = useState("");
  
  // Modal de item fracionado
  const [showFractionalModal, setShowFractionalModal] = useState(false);
  const [fractionalData, setFractionalData] = useState<any>(null);
  const [fractionalQuantity, setFractionalQuantity] = useState("");
  const [manualLabelCode, setManualLabelCode] = useState("");

  // Query para buscar pedido
  const orderQuery = trpc.stage.getOrderForStage.useQuery(
    { customerOrderNumber: orderNumber },
    { enabled: !!orderNumber && !checkId }
  );

  // Mutation para iniciar conferência
  const startCheckMutation = trpc.stage.startStageCheck.useMutation({
    onSuccess: (data: any) => {
      setCheckId(data.stageCheckId);
      toast.success("Conferência iniciada!");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Mutation para registrar item (com auto-incremento)
  const recordItemMutation = trpc.stage.recordStageItem.useMutation({
    onSuccess: (data: any) => {
      if (data.isFractional) {
        // Item fracionado: abrir modal para entrada manual
        setFractionalData(data);
        setShowFractionalModal(true);
        toast.info(data.message);
      } else {
        // Item inteiro: incrementado automaticamente
        toast.success(data.message);
        setScannedItems((prev) => [...prev, {
          productCode: data.labelCode,
          productName: data.productName,
          quantity: data.quantityAdded,
          checkedQuantity: data.checkedQuantity,
          remainingQuantity: data.remainingQuantity,
        }]);
      }
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Mutation para finalizar conferência
  const completeCheckMutation = trpc.stage.completeStageCheck.useMutation({
    onSuccess: (data: any) => {
      if (data.divergences && data.divergences.length > 0) {
        toast.warning(`Conferência finalizada com ${data.divergences.length} divergência(s)`);
      } else {
        toast.success("Conferência finalizada com sucesso!");
      }
      // Abrir modal de geração de etiquetas
      setShowVolumeModal(true);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Mutation para gerar etiquetas de volume
  const generateLabelsMutation = trpc.stage.generateVolumeLabels.useMutation();

  const handleScan = (code: string) => {
    if (currentField === "order") {
      setOrderNumber(code);
      toast.success(`Pedido escaneado: ${code}`);
    } else if (currentField === "product") {
      // Auto-incremento: chamar backend com autoIncrement = true
      if (!checkId) {
        toast.error("Inicie a conferência primeiro");
        return;
      }
      
      recordItemMutation.mutate({
        stageCheckId: checkId,
        labelCode: code,
        autoIncrement: true,
      });
    }
    setShowScanner(false);
    setCurrentField(null);
  };

  const handleStartCheck = () => {
    if (!orderNumber || !orderQuery.data) {
      toast.error("Informe o número do pedido");
      return;
    }
    startCheckMutation.mutate({ 
      pickingOrderId: orderQuery.data.order.id,
      customerOrderNumber: orderNumber 
    });
  };

  const handleRecordFractionalItem = () => {
    const qty = parseInt(fractionalQuantity);
    if (!qty || qty <= 0) {
      toast.error("Informe uma quantidade válida");
      return;
    }

    if (!checkId || !fractionalData) {
      toast.error("Dados inválidos");
      return;
    }

    recordItemMutation.mutate({
      stageCheckId: checkId,
      labelCode: fractionalData.labelCode,
      quantity: qty,
      autoIncrement: false,
    });

    // Fechar modal e limpar dados
    setShowFractionalModal(false);
    setFractionalData(null);
    setFractionalQuantity("");
  };

  const handleCompleteCheck = () => {
    if (!checkId) return;
    
    if (scannedItems.length === 0) {
      toast.error("Escaneie pelo menos um item antes de finalizar");
      return;
    }

    completeCheckMutation.mutate({ stageCheckId: checkId });
  };

  const handleGenerateLabels = async () => {
    const qty = parseInt(volumeQuantity);
    if (!qty || qty <= 0) {
      toast.error("Informe uma quantidade válida de volumes");
      return;
    }

    try {
      const result = await generateLabelsMutation.mutateAsync({
        customerOrderNumber: orderNumber,
        customerName: orderQuery.data?.order?.customerName || "N/A",
        tenantName: orderQuery.data?.tenantName || "N/A",
        totalVolumes: qty,
      });

      // Converter base64 para blob e baixar
      const byteCharacters = atob(result.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Criar link de download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Etiquetas geradas com sucesso!");
      
      // Reset completo
      setShowVolumeModal(false);
      setVolumeQuantity("");
      setOrderNumber("");
      setCheckId(null);
      setScannedItems([]);
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar etiquetas");
    }
  };

  const handleNewOrder = () => {
    setOrderNumber("");
    setCheckId(null);
    setScannedItems([]);
  };

  if (showScanner) {
    return (
      <BarcodeScanner
        onScan={handleScan}
        onClose={() => {
          setShowScanner(false);
          setCurrentField(null);
        }}
      />
    );
  }

  return (
    <CollectorLayout title="Stage - Conferência">
      <div className="space-y-4">
        {/* Seleção de Pedido */}
        {!checkId ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Número do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 0001"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="h-12 text-lg"
                />
                <Button
                  type="button"
                  size="lg"
                  onClick={() => {
                    setCurrentField("order");
                    setShowScanner(true);
                  }}
                  className="h-12 px-4"
                >
                  <Camera className="h-5 w-5" />
                </Button>
              </div>
              
              {orderQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Carregando pedido...</p>
              )}
              
              {orderQuery.data && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-900">
                    Pedido {orderQuery.data.order.customerOrderNumber || orderQuery.data.order.orderNumber}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Cliente: {orderQuery.data.tenantName}
                  </p>
                  <p className="text-xs text-green-700">
                    {orderQuery.data.items.length} itens
                  </p>
                </div>
              )}
              
              {orderQuery.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-900">{orderQuery.error.message}</p>
                </div>
              )}

              <Button
                onClick={handleStartCheck}
                disabled={!orderQuery.data || startCheckMutation.isPending}
                size="lg"
                className="w-full h-12"
              >
                {startCheckMutation.isPending ? "Iniciando..." : "Iniciar Conferência"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Resumo do Pedido */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Pedido {orderNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {scannedItems.length} itens conferidos
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNewOrder}
                  >
                    Novo Pedido
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Card de Bipagem */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bipar Etiqueta</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Bipe ou digite o código da etiqueta do produto
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Entrada Manual */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite o código da etiqueta"
                    value={manualLabelCode}
                    onChange={(e) => setManualLabelCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && manualLabelCode.trim()) {
                        if (!checkId) {
                          toast.error("Inicie a conferência primeiro");
                          return;
                        }
                        recordItemMutation.mutate({
                          stageCheckId: checkId,
                          labelCode: manualLabelCode.trim(),
                          autoIncrement: true,
                        });
                        setManualLabelCode("");
                      }
                    }}
                    className="h-12 text-lg"
                    disabled={recordItemMutation.isPending}
                  />
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => {
                      if (!manualLabelCode.trim()) {
                        toast.error("Digite o código da etiqueta");
                        return;
                      }
                      if (!checkId) {
                        toast.error("Inicie a conferência primeiro");
                        return;
                      }
                      recordItemMutation.mutate({
                        stageCheckId: checkId,
                        labelCode: manualLabelCode.trim(),
                        autoIncrement: true,
                      });
                      setManualLabelCode("");
                    }}
                    className="h-12 px-6"
                    disabled={recordItemMutation.isPending || !manualLabelCode.trim()}
                  >
                    {recordItemMutation.isPending ? "..." : "OK"}
                  </Button>
                </div>

                {/* Botão Scanner */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    setCurrentField("product");
                    setShowScanner(true);
                  }}
                  className="w-full h-12"
                  disabled={recordItemMutation.isPending}
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Escanear com Câmera
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Itens Conferidos */}
            {scannedItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Itens Conferidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {scannedItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.productCode}</p>
                          <p className="text-xs text-gray-600">{item.productName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">+{item.quantity}</p>
                          <p className="text-xs text-gray-500">
                            Total: {item.checkedQuantity}
                            {item.remainingQuantity > 0 && ` (falta: ${item.remainingQuantity})`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Botão Finalizar */}
            <Button
              onClick={handleCompleteCheck}
              disabled={completeCheckMutation.isPending || scannedItems.length === 0}
              size="lg"
              variant="default"
              className="w-full h-14 bg-green-600 hover:bg-green-700"
            >
              {completeCheckMutation.isPending ? "Finalizando..." : "Finalizar Conferência"}
            </Button>
          </>
        )}
      </div>

      {/* Modal de Item Fracionado */}
      <Dialog open={showFractionalModal} onOpenChange={setShowFractionalModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Item Fracionado Detectado</DialogTitle>
            <DialogDescription>
              A quantidade restante é menor que 1 caixa. Informe a quantidade exata conferida.
            </DialogDescription>
          </DialogHeader>
          {fractionalData && (
            <div className="space-y-4 py-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm font-medium text-yellow-900">
                  {fractionalData.productName}
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  SKU: {fractionalData.productSku} | Lote: {fractionalData.batch}
                </p>
                <p className="text-xs text-yellow-700">
                  Quantidade restante: <span className="font-bold">{fractionalData.remainingQuantity}</span> unidades
                </p>
                <p className="text-xs text-yellow-700">
                  (1 caixa = {fractionalData.unitsPerBox} unidades)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fractionalQuantity">Quantidade Conferida (unidades)</Label>
                <Input
                  id="fractionalQuantity"
                  type="number"
                  placeholder="Ex: 15"
                  value={fractionalQuantity}
                  onChange={(e) => setFractionalQuantity(e.target.value)}
                  min="1"
                  max={fractionalData.remainingQuantity}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowFractionalModal(false);
              setFractionalData(null);
              setFractionalQuantity("");
            }}>
              Cancelar
            </Button>
            <Button onClick={handleRecordFractionalItem} disabled={recordItemMutation.isPending}>
              {recordItemMutation.isPending ? "Registrando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Geração de Etiquetas de Volume */}
      <Dialog open={showVolumeModal} onOpenChange={setShowVolumeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Etiquetas de Volume</DialogTitle>
            <DialogDescription>
              Informe a quantidade de volumes para gerar as etiquetas de identificação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="volumeQuantity">Quantidade de Volumes</Label>
              <Input
                id="volumeQuantity"
                type="number"
                placeholder="Ex: 3"
                value={volumeQuantity}
                onChange={(e) => setVolumeQuantity(e.target.value)}
                min="1"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowVolumeModal(false);
              setVolumeQuantity("");
              // Reset completo
              setOrderNumber("");
              setCheckId(null);
              setScannedItems([]);
            }}>
              Pular
            </Button>
            <Button onClick={handleGenerateLabels} disabled={generateLabelsMutation.isPending}>
              {generateLabelsMutation.isPending ? "Gerando..." : "Gerar Etiquetas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CollectorLayout>
  );
}
