import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, AlertCircle, Scan, Camera, Package, Undo } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "./BarcodeScanner";

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

interface LabelAssociation {
  id: number;
  labelCode: string;
  productId: number;
  productName: string;
  productSku: string;
  batch: string | null;
  unitsPerPackage: number;
  packagesRead: number;
  totalUnits: number;
}

export function BlindCheckModal({ open, onClose, receivingOrderId, items }: BlindCheckModalProps) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [labelCode, setLabelCode] = useState("");
  const [showAssociationDialog, setShowAssociationDialog] = useState(false);
  const [pendingLabelCode, setPendingLabelCode] = useState("");
  
  // Campos de associação
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [batch, setBatch] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [unitsPerPackage, setUnitsPerPackage] = useState<number>(1);
  
  const labelInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Iniciar sessão ao abrir modal
  const startSessionMutation = trpc.blindConference.start.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error("Erro ao iniciar conferência", {
        description: error.message,
      });
    },
  });

  // Ler etiqueta
  const readLabelMutation = trpc.blindConference.readLabel.useMutation({
    onSuccess: (data) => {
      if (data.isNewLabel) {
        // Etiqueta nova - abrir diálogo de associação
        setPendingLabelCode(labelCode);
        setShowAssociationDialog(true);
        
        // Pré-preencher unitsPerPackage se houver produto com unitsPerBox
        const firstProduct = items[0];
        if (firstProduct) {
          setSelectedProductId(firstProduct.productId);
        }
      } else {
        // Etiqueta já associada - incrementou automaticamente
        toast.success("Etiqueta lida com sucesso!", {
          description: `${data.association?.productName} - ${data.association?.packagesRead} embalagens (${data.association?.totalUnits} unidades)`,
        });
        setLabelCode("");
        labelInputRef.current?.focus();
        
        // Atualizar resumo
        utils.blindConference.getSummary.invalidate({ sessionId: sessionId! });
      }
    },
    onError: (error) => {
      toast.error("Erro ao ler etiqueta", {
        description: error.message,
      });
    },
  });

  // Associar etiqueta
  const associateLabelMutation = trpc.blindConference.associateLabel.useMutation({
    onSuccess: (data) => {
      toast.success("Etiqueta associada com sucesso!", {
        description: `${data.product.description} - ${data.totalUnits} unidades`,
      });
      
      // Limpar campos
      setShowAssociationDialog(false);
      setPendingLabelCode("");
      setSelectedProductId(null);
      setBatch("");
      setExpiryDate("");
      setUnitsPerPackage(1);
      setLabelCode("");
      
      // Retornar foco
      labelInputRef.current?.focus();
      
      // Atualizar resumo
      utils.blindConference.getSummary.invalidate({ sessionId: sessionId! });
    },
    onError: (error) => {
      toast.error("Erro ao associar etiqueta", {
        description: error.message,
      });
    },
  });

  // Desfazer última leitura
  const undoLastReadingMutation = trpc.blindConference.undoLastReading.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.blindConference.getSummary.invalidate({ sessionId: sessionId! });
    },
    onError: (error) => {
      toast.error("Erro ao desfazer leitura", {
        description: error.message,
      });
    },
  });

  // Obter resumo
  const { data: summary, isLoading: isLoadingSummary } = trpc.blindConference.getSummary.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId, refetchInterval: 3000 }
  );

  // Finalizar conferência
  const finishMutation = trpc.blindConference.finish.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.receiving.list.invalidate();
      utils.receiving.getItems.invalidate({ receivingOrderId: receivingOrderId });
      onClose();
    },
    onError: (error) => {
      toast.error("Erro ao finalizar conferência", {
        description: error.message,
      });
    },
  });

  // Iniciar sessão ao abrir modal
  useEffect(() => {
    if (open && !sessionId) {
      startSessionMutation.mutate({ receivingOrderId });
    }
  }, [open, receivingOrderId]);

  // Foco automático
  useEffect(() => {
    if (open && !showAssociationDialog) {
      setTimeout(() => labelInputRef.current?.focus(), 100);
    }
  }, [open, showAssociationDialog]);

  const handleLabelSubmit = () => {
    if (!labelCode.trim()) {
      toast.error("Digite ou escaneie um código de etiqueta");
      return;
    }

    if (!sessionId) {
      toast.error("Sessão não iniciada");
      return;
    }

    readLabelMutation.mutate({
      sessionId,
      labelCode: labelCode.trim(),
    });
  };

  const handleScanSuccess = (code: string) => {
    setLabelCode(code);
    setShowScanner(false);
    
    // Processar automaticamente
    if (sessionId) {
      readLabelMutation.mutate({
        sessionId,
        labelCode: code,
      });
    }
  };

  const handleAssociate = () => {
    if (!selectedProductId) {
      toast.error("Selecione um produto");
      return;
    }

    if (!batch.trim()) {
      toast.error("Lote é obrigatório para rastreabilidade");
      return;
    }

    if (unitsPerPackage < 1) {
      toast.error("Unidades por embalagem deve ser maior que zero");
      return;
    }

    associateLabelMutation.mutate({
      sessionId: sessionId!,
      labelCode: pendingLabelCode,
      productId: selectedProductId,
      batch: batch || null,
      expiryDate: expiryDate || null,
      unitsPerPackage,
    });
  };

  const handleUndo = () => {
    if (!sessionId) return;
    undoLastReadingMutation.mutate({ sessionId });
  };

  const handleFinish = () => {
    if (!sessionId) return;
    
    if (summary && summary.hasDivergences) {
      const confirmed = window.confirm(
        "Foram detectadas divergências. Deseja finalizar mesmo assim?"
      );
      if (!confirmed) return;
    }
    
    finishMutation.mutate({ sessionId });
  };

  const totalConferenced = summary?.associations.reduce((sum, a) => sum + a.totalUnits, 0) || 0;
  const totalExpected = items.reduce((sum, i) => sum + i.expectedQuantity, 0);
  const progress = totalExpected > 0 ? Math.round((totalConferenced / totalExpected) * 100) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferência Cega - Ordem #{receivingOrderId}</DialogTitle>
          </DialogHeader>

          {!sessionId ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2">Iniciando sessão...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Scanner de Etiquetas */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <Label className="text-sm font-medium mb-2 block">Código da Etiqueta</Label>
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
                    placeholder="Digite ou escaneie o código da etiqueta"
                    className="flex-1"
                    disabled={readLabelMutation.isPending}
                  />
                  <Button
                    onClick={() => setShowScanner(true)}
                    variant="outline"
                    size="icon"
                    title="Usar câmera"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleLabelSubmit}
                    disabled={readLabelMutation.isPending || !labelCode.trim()}
                  >
                    {readLabelMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Scan className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Progresso */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progresso</span>
                  <span className="text-sm text-gray-600">
                    {totalConferenced} / {totalExpected} unidades ({progress}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>

              {/* Associações */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Etiquetas Lidas</h3>
                  <Button
                    onClick={handleUndo}
                    variant="outline"
                    size="sm"
                    disabled={!summary?.associations.length || undoLastReadingMutation.isPending}
                  >
                    <Undo className="w-4 h-4 mr-2" />
                    Desfazer Última
                  </Button>
                </div>

                {isLoadingSummary ? (
                  <div className="text-center py-4 text-gray-500">Carregando...</div>
                ) : !summary?.associations.length ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>Nenhuma etiqueta lida ainda</p>
                    <p className="text-sm">Escaneie ou digite o código da primeira etiqueta</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {summary.associations.map((assoc) => (
                      <div
                        key={assoc.id}
                        className="flex items-center justify-between p-3 bg-white border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{assoc.productName}</div>
                          <div className="text-sm text-gray-600">
                            SKU: {assoc.productSku} | Etiqueta: {assoc.labelCode}
                            {assoc.batch && ` | Lote: ${assoc.batch}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-blue-600">
                            {assoc.packagesRead}x {assoc.unitsPerPackage}un
                          </div>
                          <div className="text-sm text-gray-600">
                            = {assoc.totalUnits} unidades
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumo com Divergências */}
              {summary && summary.summary.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-4">Resumo por Produto</h3>
                  <div className="space-y-2">
                    {summary.summary.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          item.divergence !== 0 ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{item.productName}</div>
                          {item.batch && (
                            <div className="text-sm text-gray-600">Lote: {item.batch}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            {item.divergence === 0 ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-yellow-600" />
                            )}
                            <div>
                              <div className="font-semibold">
                                {item.quantityConferenced} / {item.quantityExpected}
                              </div>
                              {item.divergence !== 0 && (
                                <div className="text-sm text-yellow-700">
                                  {item.divergence > 0 ? "+" : ""}{item.divergence} unidades
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={!summary?.associations.length || finishMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {finishMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Finalizar Conferência
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Associação */}
      <Dialog open={showAssociationDialog} onOpenChange={setShowAssociationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Associar Etiqueta a Produto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Etiqueta</Label>
              <Input value={pendingLabelCode} disabled className="bg-gray-100" />
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Produto *</Label>
              <Select
                value={selectedProductId?.toString()}
                onValueChange={(value) => setSelectedProductId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.productId} value={item.productId.toString()}>
                      {item.productDescription} ({item.productSku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Lote *</Label>
                <Input
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="Ex: 25H04LB356"
                  required
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Validade</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Unidades por Embalagem *</Label>
              <Input
                type="number"
                min="1"
                value={unitsPerPackage}
                onChange={(e) => setUnitsPerPackage(Number(e.target.value))}
                placeholder="Ex: 12"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAssociationDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleAssociate}
                disabled={!selectedProductId || !batch.trim() || associateLabelMutation.isPending}
              >
                {associateLabelMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Associar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scanner via Câmera */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
