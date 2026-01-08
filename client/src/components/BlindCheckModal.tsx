import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, AlertCircle, Camera, Undo, Edit, Home } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "./BarcodeScanner";
import { useLocation } from "wouter";

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

export function BlindCheckModal({ open, onClose, receivingOrderId, items }: BlindCheckModalProps) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [labelCode, setLabelCode] = useState("");
  const [showAssociationDialog, setShowAssociationDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [pendingLabelCode, setPendingLabelCode] = useState("");
  
  // Campos de associação
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [batch, setBatch] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [unitsPerPackage, setUnitsPerPackage] = useState<number>(1);
  
  const labelInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  // Iniciar sessão ao abrir modal
  const startSessionMutation = trpc.blindConference.start.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      toast.success(data.message);
    },
    onError: (error: any) => {
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
        
        // Pré-selecionar primeiro produto se houver apenas um
        if (items.length === 1) {
          setSelectedProductId(items[0].productId);
        }
      } else {
        // Etiqueta já associada - incrementou automaticamente
        toast.success("Etiqueta lida com sucesso!", {
          description: `${data.association?.productName} - ${data.association?.packagesRead} volumes (${data.association?.totalUnits} unidades)`,
        });
        setLabelCode("");
        labelInputRef.current?.focus();
        
        // Atualizar resumo
        utils.blindConference.getSummary.invalidate({ sessionId: sessionId! });
      }
    },
    onError: (error: any) => {
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
    onError: (error: any) => {
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
    onError: (error: any) => {
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
      setLocation("/recebimento");
    },
    onError: (error: any) => {
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

  const handleFinishClick = () => {
    if (!summary?.associations.length) {
      toast.error("Nenhuma etiqueta foi lida ainda");
      return;
    }
    setShowFinishDialog(true);
  };

  const handleConfirmFinish = () => {
    if (!sessionId) return;
    finishMutation.mutate({ sessionId });
  };

  // Calcular métricas
  const totalVolumes = summary?.associations.reduce((sum: number, a: any) => sum + a.packagesRead, 0) || 0;
  const totalUnits = summary?.associations.reduce((sum: number, a: any) => sum + a.totalUnits, 0) || 0;
  const distinctProducts = new Set(summary?.associations.map((a: any) => a.productId)).size || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-blue-600 rounded"></div>
                <div>
                  <DialogTitle className="text-2xl">Conferência Cega - Ordem #{receivingOrderId}</DialogTitle>
                  <p className="text-sm text-gray-600">Leia as etiquetas para conferir os volumes recebidos</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Voltar
              </Button>
            </div>
          </DialogHeader>

          {!sessionId ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2">Iniciando sessão...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Métricas */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-sm text-gray-600 mb-1">Volumes Lidos</div>
                    <div className="text-3xl font-bold">{totalVolumes}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="text-sm text-gray-600 mb-1">Unidades Totais</div>
                    <div className="text-3xl font-bold">{totalUnits}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="text-sm text-gray-600 mb-1">Produtos Distintos</div>
                    <div className="text-3xl font-bold">{distinctProducts}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Leitura de Etiquetas */}
              <Card>
                <CardContent className="p-6">
                  <div className="mb-2">
                    <Label className="text-base font-semibold">Leitura de Etiquetas</Label>
                    <p className="text-sm text-gray-600">Escaneie ou digite o código da etiqueta</p>
                  </div>
                  <div className="flex gap-2 mb-2">
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
                      className="flex-1 text-lg"
                      disabled={readLabelMutation.isPending}
                    />
                    <Button
                      onClick={handleLabelSubmit}
                      disabled={readLabelMutation.isPending || !labelCode.trim()}
                      size="lg"
                    >
                      {readLabelMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Ler"
                      )}
                    </Button>
                  </div>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Camera className="w-4 h-4" />
                    Escanear com Câmera
                  </button>
                </CardContent>
              </Card>

              {/* Produtos Conferidos */}
              <Card>
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold">Produtos Conferidos</h3>
                    <p className="text-sm text-gray-600">Resumo das associações e quantidades lidas</p>
                  </div>

                  {isLoadingSummary ? (
                    <div className="text-center py-8 text-gray-500">Carregando...</div>
                  ) : !summary?.associations.length ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg mb-2">Nenhum produto conferido ainda</p>
                      <p className="text-sm">Escaneie ou digite o código da primeira etiqueta para começar</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead className="text-right">Un/Volume</TableHead>
                          <TableHead className="text-right">Volumes</TableHead>
                          <TableHead className="text-right">Unidades</TableHead>
                          <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.associations.map((assoc: any) => (
                          <TableRow key={assoc.id}>
                            <TableCell>
                              <div className="font-medium">{assoc.productName}</div>
                              <div className="text-sm text-gray-600">{assoc.productSku}</div>
                            </TableCell>
                            <TableCell>{assoc.batch || "-"}</TableCell>
                            <TableCell className="text-right">{assoc.unitsPerPackage}</TableCell>
                            <TableCell className="text-right font-semibold">{assoc.packagesRead}</TableCell>
                            <TableCell className="text-right font-semibold">{assoc.totalUnits}</TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Ações */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={handleUndo}
                  disabled={!summary?.associations.length || undoLastReadingMutation.isPending}
                >
                  <Undo className="w-4 h-4 mr-2" />
                  Desfazer Última
                </Button>
                <Button
                  onClick={handleFinishClick}
                  disabled={!summary?.associations.length}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
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
                <Label className="text-sm font-medium mb-2 block">Lote (opcional)</Label>
                <Input
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="Ex: 25H04LB356"
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Validade (opcional)</Label>
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
                disabled={!selectedProductId || associateLabelMutation.isPending}
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

      {/* Dialog de Finalização */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Finalizar Conferência</DialogTitle>
            <p className="text-sm text-gray-600">Revise o resumo antes de finalizar</p>
          </DialogHeader>

          <div className="space-y-6">
            {/* Métricas do resumo */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold">{totalVolumes}</div>
                <div className="text-sm text-gray-600">Volumes</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{totalUnits}</div>
                <div className="text-sm text-gray-600">Unidades</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{distinctProducts}</div>
                <div className="text-sm text-gray-600">Produtos</div>
              </div>
            </div>

            {/* Tabela de resumo com divergências */}
            {summary && summary.summary.length > 0 && (
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Conferido</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                      <TableHead className="text-right">Divergência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.summary.map((item: any, idx: any) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          {item.batch && (
                            <div className="text-sm text-gray-600">Lote: {item.batch}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{item.quantityConferenced}</TableCell>
                        <TableCell className="text-right">{item.quantityExpected}</TableCell>
                        <TableCell className="text-right">
                          {item.divergence === 0 ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-yellow-600">
                              <AlertCircle className="w-4 h-4" />
                              {item.divergence > 0 ? "+" : ""}{item.divergence}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowFinishDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmFinish}
                disabled={finishMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {finishMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Confirmar Finalização
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
