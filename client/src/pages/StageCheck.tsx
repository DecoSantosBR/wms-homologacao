import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Scan, Package, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type StageItem = {
  productSku: string;
  productName: string;
  checkedQuantity: number;
  scannedAt: Date;
};

export default function StageCheck() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"search" | "checking">("search");
  const [customerOrderNumber, setCustomerOrderNumber] = useState("");
  const [stageCheckId, setStageCheckId] = useState<number | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [scannedItems, setScannedItems] = useState<StageItem[]>([]);
  const [currentSku, setCurrentSku] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState("");
  const [showDivergenceModal, setShowDivergenceModal] = useState(false);
  const [divergentItems, setDivergentItems] = useState<any[]>([]);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [volumeQuantity, setVolumeQuantity] = useState("");

  const utils = trpc.useUtils();
  const getOrderQuery = trpc.stage.getOrderForStage.useQuery(
    { customerOrderNumber: customerOrderNumber.trim() },
    { enabled: false }
  );
  const startCheckMutation = trpc.stage.startStageCheck.useMutation();
  const recordItemMutation = trpc.stage.recordStageItem.useMutation();
  const completeCheckMutation = trpc.stage.completeStageCheck.useMutation();
  const generateLabelsMutation = trpc.stage.generateVolumeLabels.useMutation();
  const cancelCheckMutation = trpc.stage.cancelStageCheck.useMutation();

  // Buscar conferência ativa ao carregar
  const { data: activeCheck } = trpc.stage.getActiveStageCheck.useQuery();

  useEffect(() => {
    if (activeCheck) {
      setStep("checking");
      setStageCheckId(activeCheck.id);
      setCustomerOrderNumber(activeCheck.customerOrderNumber);
      setScannedItems(
        activeCheck.items
          .filter((item: any) => item.checkedQuantity > 0)
          .map((item: any) => ({
            productSku: item.productSku,
            productName: item.productName,
            checkedQuantity: item.checkedQuantity,
            scannedAt: item.scannedAt,
          }))
      );
    }
  }, [activeCheck]);

  const handleSearchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerOrderNumber.trim()) {
      toast.error("Digite ou bipe o número do pedido");
      return;
    }

    try {
      const result = await utils.stage.getOrderForStage.fetch({
        customerOrderNumber: customerOrderNumber.trim(),
      });

      setOrderInfo(result);

      // Iniciar conferência
      const checkResult = await startCheckMutation.mutateAsync({
        pickingOrderId: result.order.id,
        customerOrderNumber: customerOrderNumber.trim(),
      });

      setStageCheckId(checkResult.stageCheckId);
      setStep("checking");
      
      toast.success(checkResult.message);
    } catch (error: any) {
      toast.error(error.message || "Erro ao buscar pedido");
    }
  };

  const handleRecordItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentSku.trim() || !currentQuantity.trim()) {
      toast.error("Informe a etiqueta e a quantidade");
      return;
    }

    const quantity = parseInt(currentQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("A quantidade deve ser um número positivo");
      return;
    }

    try {
      const result = await recordItemMutation.mutateAsync({
        stageCheckId: stageCheckId!,
        labelCode: currentSku.trim(),
        quantity,
      });

      // Adicionar item à lista
      const existingIndex = scannedItems.findIndex(
        (item) => item.productSku === currentSku.trim()
      );

      if (existingIndex >= 0) {
        const updated = [...scannedItems];
        updated[existingIndex].checkedQuantity = result.checkedQuantity;
        updated[existingIndex].scannedAt = new Date();
        setScannedItems(updated);
      } else {
        setScannedItems([
          ...scannedItems,
          {
            productSku: currentSku.trim(),
            productName: result.productName,
            checkedQuantity: result.checkedQuantity,
            scannedAt: new Date(),
          },
        ]);
      }

      toast.success(result.message);

      // Limpar campos
      setCurrentSku("");
      setCurrentQuantity("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar item");
    }
  };

  const handleCancelCheck = async () => {
    if (!stageCheckId) {
      toast.error("Nenhuma conferência ativa");
      return;
    }

    try {
      const result = await cancelCheckMutation.mutateAsync({
        stageCheckId: stageCheckId,
      });

      toast.success(result.message);
      
      // Resetar estado
      setStep("search");
      setCustomerOrderNumber("");
      setStageCheckId(null);
      setOrderInfo(null);
      setScannedItems([]);
      setCurrentSku("");
      setCurrentQuantity("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao cancelar conferência");
    }
  };

  const handleForceComplete = async () => {
    try {
      const result = await completeCheckMutation.mutateAsync({
        stageCheckId: stageCheckId!,
        force: true,
      });

      setShowDivergenceModal(false);
      setVolumeQuantity("");
      setShowVolumeModal(true);
      
      toast.success(result.message);
    } catch (error: any) {
      toast.error(error.message || "Erro ao forçar finalização");
    }
  };

  const handleCompleteCheck = async () => {
    if (scannedItems.length === 0) {
      toast.error("Registre pelo menos um item antes de finalizar");
      return;
    }

    try {
      const result = await completeCheckMutation.mutateAsync({
        stageCheckId: stageCheckId!,
      });

      toast.success(result.message);

      // Abrir modal para solicitar quantidade de volumes
      setShowVolumeModal(true);
    } catch (error: any) {
      // Verificar se é erro de divergência
      if (error.data?.cause?.divergentItems) {
        setDivergentItems(error.data.cause.divergentItems);
        setShowDivergenceModal(true);
      } else {
        toast.error(error.message || "Erro ao finalizar conferência");
      }
    }
  };

  const handleGenerateLabels = async () => {
    const qty = parseInt(volumeQuantity);
    if (isNaN(qty) || qty < 1) {
      toast.error("Informe uma quantidade válida de volumes");
      return;
    }

    try {
      const result = await generateLabelsMutation.mutateAsync({
        customerOrderNumber,
        customerName: orderInfo?.order?.customerName || "N/A",
        tenantName: orderInfo?.tenantName || "N/A",
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

      toast.success(`Etiquetas geradas com sucesso! (${qty} volumes)`);

      // Resetar estado
      setShowVolumeModal(false);
      setVolumeQuantity("");
      setStep("search");
      setCustomerOrderNumber("");
      setStageCheckId(null);
      setOrderInfo(null);
      setScannedItems([]);
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar etiquetas");
    }
  };

  if (step === "search") {
    return (
      <div className="container py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold">Stage - Conferência de Expedição</h1>
          <p className="text-muted-foreground mt-2">
            Confira pedidos separados antes da expedição
          </p>
        </div>

        <Card className="p-6 max-w-md mx-auto">
          <form onSubmit={handleSearchOrder} className="space-y-4">
            <div>
              <Label htmlFor="orderNumber">Número do Pedido</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="orderNumber"
                  value={customerOrderNumber}
                  onChange={(e) => setCustomerOrderNumber(e.target.value)}
                  placeholder="Digite ou bipe o número do pedido"
                  autoFocus
                />
                <Button type="submit" disabled={startCheckMutation.isPending}>
                  <Scan className="mr-2 h-4 w-4" />
                  Buscar
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => {
            setStep("search");
            setCustomerOrderNumber("");
            setStageCheckId(null);
            setOrderInfo(null);
            setScannedItems([]);
          }}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Cancelar Conferência
        </Button>
        <h1 className="text-3xl font-bold">
          Conferindo Pedido: {customerOrderNumber}
        </h1>
        <p className="text-muted-foreground mt-2">
          Bipe cada produto e informe a quantidade conferida
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulário de registro */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Package className="mr-2 h-5 w-5" />
            Registrar Item
          </h2>
          <form onSubmit={handleRecordItem} className="space-y-4">
            <div>
              <Label htmlFor="sku">Etiqueta do Produto</Label>
              <Input
                id="sku"
                value={currentSku}
                onChange={(e) => setCurrentSku(e.target.value)}
                placeholder="Bipe a etiqueta do lote"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantidade Conferida</Label>
              <Input
                id="quantity"
                type="number"
                value={currentQuantity}
                onChange={(e) => setCurrentQuantity(e.target.value)}
                placeholder="Digite a quantidade"
                min="1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={recordItemMutation.isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Registrar Item
            </Button>
          </form>
        </Card>

        {/* Lista de itens conferidos */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Itens Conferidos ({scannedItems.length})
          </h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {scannedItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum item conferido ainda
              </p>
            ) : (
              scannedItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.productSku}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.productName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{item.checkedQuantity}</p>
                    <p className="text-xs text-muted-foreground">unidades</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          size="lg"
          onClick={handleCancelCheck}
          disabled={cancelCheckMutation.isPending}
        >
          <XCircle className="mr-2 h-5 w-5" />
          Cancelar Conferência
        </Button>
        <Button
          size="lg"
          onClick={handleCompleteCheck}
          disabled={completeCheckMutation.isPending || scannedItems.length === 0}
        >
          <CheckCircle2 className="mr-2 h-5 w-5" />
          Finalizar Conferência
        </Button>
      </div>

      {/* Modal de Divergências */}
      <Dialog open={showDivergenceModal} onOpenChange={setShowDivergenceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <XCircle className="mr-2 h-5 w-5" />
              Divergências Encontradas
            </DialogTitle>
            <DialogDescription>
              Os seguintes itens apresentam diferenças entre o esperado e o conferido:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {divergentItems.map((item, index) => (
              <div key={index} className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{item.productSku}</p>
                <p className="text-sm text-muted-foreground">{item.productName}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Esperado</p>
                    <p className="font-bold">{item.expected}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Conferido</p>
                    <p className="font-bold">{item.checked}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Diferença</p>
                    <p className={`font-bold ${item.divergence > 0 ? "text-green-600" : "text-red-600"}`}>
                      {item.divergence > 0 ? "+" : ""}{item.divergence}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setShowDivergenceModal(false)}>
              Voltar e Corrigir
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleForceComplete}
              disabled={completeCheckMutation.isPending}
            >
              Forçar Finalização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Quantidade de Volumes */}
      <Dialog open={showVolumeModal} onOpenChange={setShowVolumeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Package className="mr-2 h-5 w-5" />
              Quantidade de Volumes
            </DialogTitle>
            <DialogDescription>
              Informe quantos volumes foram conferidos para gerar as etiquetas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="volumeQty">Quantidade de Volumes</Label>
              <Input
                id="volumeQty"
                type="number"
                min="1"
                value={volumeQuantity}
                onChange={(e) => setVolumeQuantity(e.target.value)}
                placeholder="Ex: 3"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowVolumeModal(false);
              setVolumeQuantity("");
            }}>
              Cancelar
            </Button>
            <Button onClick={handleGenerateLabels} disabled={generateLabelsMutation.isPending}>
              {generateLabelsMutation.isPending ? "Gerando..." : "Gerar Etiquetas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
