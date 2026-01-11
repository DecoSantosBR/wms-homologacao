import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, MapPin, Calendar, CheckCircle2, AlertCircle, Scan, Camera } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export default function WaveExecution() {
  const [, params] = useRoute("/picking/execute/:id");
  const [, navigate] = useLocation();
  const waveId = params?.id ? parseInt(params.id) : 0;

  const [scannedCode, setScannedCode] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = trpc.picking.getPickingProgress.useQuery(
    { waveId },
    { enabled: waveId > 0, refetchInterval: 3000 } // Atualizar a cada 3 segundos
  );

  const registerMutation = trpc.picking.registerPickedItem.useMutation({
    onSuccess: (result) => {
      setFeedback({
        type: "success",
        message: `✓ Item registrado! ${result.pickedQuantity}/${result.totalQuantity} separados`,
      });
      refetch();
      setScannedCode("");
      
      // Limpar feedback após 3 segundos
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error.message,
      });
      setScannedCode("");
      
      // Limpar feedback após 5 segundos
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  // Auto-focus no input do scanner
  useEffect(() => {
    scannerInputRef.current?.focus();
  }, [feedback]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!scannedCode.trim()) return;
    
    // Encontrar item pendente para escanear
    const pendingItem = data?.items.find(
      item => item.status !== "picked" && item.productSku === scannedCode.substring(0, 7)
    );

    if (!pendingItem) {
      setFeedback({
        type: "error",
        message: "Produto não encontrado ou já foi completamente separado",
      });
      setScannedCode("");
      return;
    }

    registerMutation.mutate({
      waveId,
      itemId: pendingItem.id,
      scannedCode: scannedCode.trim(),
      quantity: 1, // Por enquanto, sempre 1 unidade por escaneamento
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Pendente", className: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" },
      picking: { label: "Separando", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
      picked: { label: "Completo", className: "bg-green-500/10 text-green-700 border-green-500/20" },
    };

    const variant = variants[status] || variants.pending;
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Carregando onda...</p>
      </div>
    );
  }

  if (!data || !data.wave) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Onda não encontrada</h3>
          <Button onClick={() => navigate("/picking")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Card>
      </div>
    );
  }

  const { wave, items, progress } = data;
  const isCompleted = progress.percentComplete === 100;

  return (
    <>
      <PageHeader
        title={`Onda ${wave.waveNumber}`}
        description="Escaneie as etiquetas dos produtos para registrar a separação"
        actions={
          <Button onClick={() => navigate("/picking")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      <div className="container mx-auto py-8 space-y-6">
        {/* Barra de Progresso */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Progresso da Separação</h3>
                <p className="text-sm text-muted-foreground">
                  {progress.completedItems} de {progress.totalItems} itens completos
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{progress.percentComplete}%</div>
                <p className="text-sm text-muted-foreground">
                  {progress.pickedQuantity} / {progress.totalQuantity} unidades
                </p>
              </div>
            </div>
            <Progress value={progress.percentComplete} className="h-3" />
          </div>
        </Card>

        {/* Scanner de Etiquetas */}
        {!isCompleted && (
          <Card className="p-6">
            <form onSubmit={handleScan} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Scan className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Scanner de Etiquetas</h3>
              </div>

              <div className="flex gap-2">
                <Input
                  ref={scannerInputRef}
                  type="text"
                  placeholder="Escaneie ou digite o código da etiqueta..."
                  value={scannedCode}
                  onChange={(e) => setScannedCode(e.target.value)}
                  className="flex-1 text-lg"
                  autoFocus
                  disabled={registerMutation.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsCameraOpen(true)}
                  disabled={registerMutation.isPending}
                  title="Usar câmera"
                >
                  <Camera className="h-5 w-5" />
                </Button>
                <Button type="submit" disabled={!scannedCode.trim() || registerMutation.isPending}>
                  {registerMutation.isPending ? "Processando..." : "Confirmar"}
                </Button>
              </div>

              {feedback && (
                <div
                  className={`p-4 rounded-lg flex items-start gap-3 ${
                    feedback.type === "success"
                      ? "bg-green-500/10 text-green-700 border border-green-500/20"
                      : "bg-red-500/10 text-red-700 border border-red-500/20"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium">{feedback.message}</p>
                </div>
              )}
            </form>
          </Card>
        )}

        {/* Onda Completa */}
        {isCompleted && (
          <Card className="p-8 text-center bg-green-500/5 border-green-500/20">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-600" />
            <h3 className="text-2xl font-bold mb-2 text-green-700">Onda Concluída!</h3>
            <p className="text-muted-foreground mb-6">
              Todos os itens foram separados com sucesso.
            </p>
            <Button onClick={() => navigate("/picking")}>
              Voltar para Separação
            </Button>
          </Card>
        )}

        {/* Lista de Itens */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Itens da Onda</h3>
          
          {items.map((item) => {
            const progressPercent = item.totalQuantity > 0 
              ? Math.round((item.pickedQuantity / item.totalQuantity) * 100)
              : 0;

            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h4 className="font-semibold">{item.productName}</h4>
                        <p className="text-sm text-muted-foreground">SKU: {item.productSku}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>Endereço: <strong>{item.locationCode}</strong></span>
                      </div>
                      {item.batch && (
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>Lote: <strong>{item.batch}</strong></span>
                        </div>
                      )}
                      {item.expiryDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Validade: <strong>{new Date(item.expiryDate).toLocaleDateString("pt-BR")}</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Progresso: {item.pickedQuantity} / {item.totalQuantity}
                        </span>
                        <span className="font-semibold">{progressPercent}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(item.status)}
                    {item.status !== "picked" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          // Focar no input do scanner para o operador escanear este item
                          scannerInputRef.current?.focus();
                          scannerInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                      >
                        Separar
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Scanner de Câmera */}
      {isCameraOpen && (
        <BarcodeScanner
          onScan={(code) => {
            setScannedCode(code);
            setIsCameraOpen(false);
            // Submeter automaticamente após scan
            setTimeout(() => {
              const pendingItem = data?.items.find(
                item => item.status !== "picked" && item.productSku === code.substring(0, 7)
              );
              if (pendingItem) {
                registerMutation.mutate({
                  waveId,
                  itemId: pendingItem.id,
                  scannedCode: code.trim(),
                  quantity: 1,
                });
              } else {
                setFeedback({
                  type: "error",
                  message: "Produto não encontrado ou já foi completamente separado",
                });
                setTimeout(() => setFeedback(null), 5000);
              }
            }, 100);
          }}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </>
  );
}
