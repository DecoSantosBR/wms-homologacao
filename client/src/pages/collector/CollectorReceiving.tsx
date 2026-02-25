import { useState, useEffect, useRef } from "react";
import { CollectorLayout } from "../../components/CollectorLayout";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { Camera, Check, Loader2, Undo2, Package } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { toast } from "sonner";
import { ProductCombobox } from "../../components/ProductCombobox";

export function CollectorReceiving() {
  const [step, setStep] = useState<"select" | "conference">("select");
  const [showScanner, setShowScanner] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [conferenceId, setConferenceId] = useState<number | null>(null);
  
  // Conferência cega
  const [labelCode, setLabelCode] = useState("");
  const [showAssociationDialog, setShowAssociationDialog] = useState(false);
  const [pendingLabelCode, setPendingLabelCode] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [batch, setBatch] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [unitsPerPackage, setUnitsPerPackage] = useState<number>(1);
  const [totalUnitsReceived, setTotalUnitsReceived] = useState<number>(0);
  
  // Estado efêmero para rastrear último item bipado (para undo)
  const [lastSuccessfulItem, setLastSuccessfulItem] = useState<{
    productId: number;
    batch: string;
    scannedCode: string;
  } | null>(null);
  
  const labelInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Buscar ordens de recebimento pendentes
  const { data: orders } = trpc.receiving.list.useQuery();

  // Buscar itens da ordem selecionada
  const { data: orderItems } = trpc.receiving.getItems.useQuery(
    { receivingOrderId: selectedOrderId! },
    { enabled: !!selectedOrderId }
  );

  // Buscar dados do produto selecionado
  const { data: selectedProduct } = trpc.products.getById.useQuery(
    { id: selectedProductId! },
    { enabled: !!selectedProductId }
  );

  // Preencher unitsPerPackage automaticamente
  useEffect(() => {
    if (selectedProduct?.unitsPerBox) {
      setUnitsPerPackage(selectedProduct.unitsPerBox);
      setTotalUnitsReceived(selectedProduct.unitsPerBox);
    } else {
      setUnitsPerPackage(1);
      setTotalUnitsReceived(1);
    }
  }, [selectedProduct]);

  // Iniciar sessão
  const startSessionMutation = trpc.blindConference.start.useMutation({
    onSuccess: (data) => {
      setConferenceId(data.sessionId);
      setStep("conference");
      toast.success("Conferência iniciada");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Ler etiqueta
  const readLabelMutation = trpc.blindConference.readLabel.useMutation({
    onSuccess: (data) => {
      if (data.isNewLabel) {
        setPendingLabelCode(labelCode);
        setShowAssociationDialog(true);
        
        if (orderItems && orderItems.length === 1) {
          setSelectedProductId(orderItems[0].productId);
        }
      } else {
        // Salvar último item bipado para undo
        if (data.association) {
          setLastSuccessfulItem({
            productId: data.association.productId,
            batch: data.association.batch || "",
            scannedCode: labelCode,
          });
        }
        
        toast.success("Etiqueta lida!", {
          description: `${data.association?.productName} - ${data.association?.packagesRead} volumes`,
        });
        setLabelCode("");
        labelInputRef.current?.focus();
        utils.blindConference.getSummary.invalidate({ conferenceId: conferenceId! });
      }
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Associar etiqueta
  const associateLabelMutation = trpc.blindConference.associateLabel.useMutation({
    onSuccess: (data) => {
      toast.success("Etiqueta associada!", {
        description: `${data.product.description} - ${data.totalUnits} unidades`,
      });
      
      setShowAssociationDialog(false);
      setPendingLabelCode("");
      setSelectedProductId(null);
      setBatch("");
      setExpiryDate("");
      setUnitsPerPackage(1);
      setTotalUnitsReceived(0);
      setLabelCode("");
      
      labelInputRef.current?.focus();
      utils.blindConference.getSummary.invalidate({ conferenceId: conferenceId! });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Desfazer última leitura
  const undoLastReadingMutation = trpc.blindConference.undoLastReading.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.blindConference.getSummary.invalidate({ conferenceId: conferenceId! });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Obter resumo
  const { data: summary } = trpc.blindConference.getSummary.useQuery(
    { conferenceId: conferenceId! },
    { enabled: !!conferenceId, refetchInterval: 3000 }
  );

  // Finalizar conferência
  const finishMutation = trpc.blindConference.finish.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setStep("select");
      setSelectedOrderId(null);
      setConferenceId(null);
      utils.receiving.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleStartConference = () => {
    if (!selectedOrderId) {
      toast.error("Selecione uma ordem de recebimento");
      return;
    }
    startSessionMutation.mutate({ receivingOrderId: selectedOrderId });
  };

  const handleLabelSubmit = () => {
    if (!labelCode.trim()) {
      toast.error("Digite ou escaneie um código");
      return;
    }

    if (!conferenceId) {
      toast.error("Sessão não iniciada");
      return;
    }

    readLabelMutation.mutate({
      conferenceId,
      labelCode: labelCode.trim(),
    });
  };

  const handleScanSuccess = (code: string) => {
    setLabelCode(code);
    setShowScanner(false);
    
    if (conferenceId) {
      readLabelMutation.mutate({
        conferenceId,
        labelCode: code,
      });
    }
  };

  const handleAssociate = () => {
    if (!selectedProductId) {
      toast.error("Selecione um produto");
      return;
    }

    if (unitsPerPackage < 1) {
      toast.error("Unidades por caixa deve ser maior que zero");
      return;
    }

    if (totalUnitsReceived < 1) {
      toast.error("Quantidade recebida deve ser maior que zero");
      return;
    }

    associateLabelMutation.mutate({
      conferenceId: conferenceId!,
      labelCode: pendingLabelCode,
      productId: selectedProductId,
      batch: batch || null,
      expiryDate: expiryDate || null,
      unitsPerPackage,
      totalUnitsReceived,
    });
  };

  const handleUndo = () => {
    if (!conferenceId || !lastSuccessfulItem) {
      toast.error("Nenhum item para desfazer");
      return;
    }
    
    undoLastReadingMutation.mutate({
      conferenceId,
      productId: lastSuccessfulItem.productId,
      batch: lastSuccessfulItem.batch,
    }, {
      onSuccess: () => {
        setLastSuccessfulItem(null); // Limpa para evitar múltiplos undos
        toast.info("Leitura estornada com sucesso");
      }
    });
  };

  const handleFinish = () => {
    if (!summary?.conferenceItems.length) {
      toast.error("Nenhuma etiqueta foi lida ainda");
      return;
    }
    
    if (confirm("Finalizar conferência?")) {
      finishMutation.mutate({ conferenceId: conferenceId! });
    }
  };

  const totalVolumes = summary?.conferenceItems.reduce((sum: number, item: any) => sum + item.packagesRead, 0) || 0;
  const totalUnits = summary?.conferenceItems.reduce((sum: number, item: any) => sum + (item.packagesRead * (item.unitsPerPackage || 1)), 0) || 0;

  if (showScanner) {
    return (
      <BarcodeScanner
        onScan={handleScanSuccess}
        onClose={() => setShowScanner(false)}
      />
    );
  }

  // Diálogo de associação
  if (showAssociationDialog) {
    return (
      <CollectorLayout title="Associar Etiqueta">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label className="text-lg font-semibold">Nova Etiqueta</Label>
                <p className="text-sm text-gray-600">Código: {pendingLabelCode}</p>
              </div>

              <div>
                <Label>Produto *</Label>
                <ProductCombobox
                  products={orderItems?.map((item: any) => ({
                    id: item.productId,
                    sku: item.productSku,
                    description: item.productDescription,
                  }))}
                  value={selectedProductId?.toString() || ""}
                  onValueChange={(v) => setSelectedProductId(parseInt(v))}
                  placeholder="Selecione o produto"
                  className="h-12 text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Lote</Label>
                  <Input
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    placeholder="Lote"
                    className="h-12 text-base"
                  />
                </div>
                <div>
                  <Label>Validade</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Un/Caixa *</Label>
                  <Input
                    type="number"
                    value={unitsPerPackage}
                    onChange={(e) => setUnitsPerPackage(parseInt(e.target.value) || 1)}
                    className="h-12 text-base"
                    min="1"
                  />
                </div>
                <div>
                  <Label>Qtd Recebida *</Label>
                  <Input
                    type="number"
                    value={totalUnitsReceived}
                    onChange={(e) => setTotalUnitsReceived(parseInt(e.target.value) || 0)}
                    className="h-12 text-base"
                    min="1"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAssociationDialog(false);
                    setPendingLabelCode("");
                    setSelectedProductId(null);
                  }}
                  className="flex-1 h-12"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAssociate}
                  disabled={associateLabelMutation.isPending}
                  className="flex-1 h-12"
                >
                  {associateLabelMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Associar"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </CollectorLayout>
    );
  }

  // Tela de seleção de ordem
  if (step === "select") {
    return (
      <CollectorLayout title="Recebimento">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <Label className="text-lg font-semibold mb-3 block">Selecione a Ordem</Label>
              <Select
                value={selectedOrderId?.toString() || ""}
                onValueChange={(v) => setSelectedOrderId(parseInt(v))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Escolha uma ordem de recebimento" />
                </SelectTrigger>
                  <SelectContent>
                    {orders?.map((order: any) => (
                    <SelectItem key={order.id} value={order.id.toString()}>
                      #{order.orderNumber} - {order.supplierName || "Sem fornecedor"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Button
            onClick={handleStartConference}
            disabled={!selectedOrderId || startSessionMutation.isPending}
            className="w-full h-14 text-lg"
          >
            {startSessionMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Package className="w-5 h-5 mr-2" />
            )}
            Iniciar Conferência
          </Button>
        </div>
      </CollectorLayout>
    );
  }

  // Tela de conferência
  return (
    <CollectorLayout title={`Conferência - Ordem #${selectedOrderId}`}>
      <div className="space-y-4">
        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Volumes</div>
              <div className="text-3xl font-bold">{totalVolumes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Unidades</div>
              <div className="text-3xl font-bold">{totalUnits}</div>
            </CardContent>
          </Card>
        </div>

        {/* Leitura de Etiquetas */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-base font-semibold">Leitura de Etiquetas</Label>
            <div className="flex gap-2">
              <Input
                ref={labelInputRef}
                value={labelCode}
                onChange={(e) => setLabelCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleLabelSubmit();
                  }
                }}
                placeholder="Código da etiqueta..."
                className="h-12 text-base"
                disabled={readLabelMutation.isPending}
                inputMode="numeric"
              />
              <Button
                onClick={handleLabelSubmit}
                disabled={readLabelMutation.isPending || !labelCode.trim()}
                className="h-12 px-6"
              >
                {readLabelMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Ler"
                )}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowScanner(true)}
              className="w-full h-12"
            >
              <Camera className="w-5 h-5 mr-2" />
              Escanear com Câmera
            </Button>
          </CardContent>
        </Card>

        {/* Produtos Conferidos */}
        <Card>
          <CardContent className="p-4">
            <Label className="text-base font-semibold mb-3 block">Produtos Conferidos</Label>
            
            {!summary?.conferenceItems.length ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-base mb-2">Nenhum produto conferido</p>
                <p className="text-sm">Escaneie a primeira etiqueta</p>
              </div>
            ) : (
              <div className="space-y-2">
                {summary.conferenceItems.map((item: any) => (
                  <div key={`${item.productId}-${item.batch}`} className="border rounded-lg p-3">
                    <div className="font-medium text-sm">{item.productName}</div>
                    <div className="text-xs text-gray-600 mb-2">{item.productSku}</div>
                    <div className="flex justify-between text-sm">
                      <span>Lote: {item.batch || "-"}</span>
                      <span className="font-semibold">{item.packagesRead} volumes</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleUndo}
            disabled={!summary?.conferenceItems.length || undoLastReadingMutation.isPending}
            className="h-12"
          >
            <Undo2 className="w-5 h-5 mr-2" />
            Desfazer
          </Button>
          <Button
            onClick={handleFinish}
            disabled={!summary?.conferenceItems.length || finishMutation.isPending}
            className="h-12"
          >
            {finishMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Check className="w-5 h-5 mr-2" />
            )}
            Finalizar
          </Button>
        </div>
      </div>
    </CollectorLayout>
  );
}
