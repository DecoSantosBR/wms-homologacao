import { useState, useRef } from "react";
import { CollectorLayout } from "../../components/CollectorLayout";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { Camera, Check, Loader2, Package, CheckCircle2 } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { toast } from "sonner";

export function CollectorPicking() {
  const [step, setStep] = useState<"select" | "picking">("select");
  const [showScanner, setShowScanner] = useState(false);
  const [selectedWaveId, setSelectedWaveId] = useState<number | null>(null);
  
  // Conferência de picking
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [scannedCode, setScannedCode] = useState("");
  const [pickedQuantity, setPickedQuantity] = useState("");
  
  const codeInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Buscar ondas disponíveis
  const { data: waves } = trpc.wave.list.useQuery({
    status: "picking",
    limit: 50,
  });

  // Buscar detalhes da onda selecionada
  const { data: waveData } = trpc.wave.getById.useQuery(
    { id: selectedWaveId! },
    { enabled: !!selectedWaveId }
  );

  // Registrar item separado
  const registerItemMutation = trpc.wave.registerPickedItem.useMutation({
    onSuccess: (data) => {
      toast.success("Item registrado!", {
        description: `${data.pickedQuantity}/${data.totalQuantity} separados`,
      });
      
      setScannedCode("");
      setPickedQuantity("");
      
      // Avançar para próximo item
      if (currentItemIndex < (waveData?.items.length || 0) - 1) {
        setCurrentItemIndex(currentItemIndex + 1);
      } else {
        // Todos os itens foram separados
        toast.success("Onda finalizada!", {
          description: "Todos os itens foram separados",
        });
        setStep("select");
        setSelectedWaveId(null);
        setCurrentItemIndex(0);
      }
      
      utils.wave.getById.invalidate({ id: selectedWaveId! });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleStartPicking = () => {
    if (!selectedWaveId) {
      toast.error("Selecione uma onda");
      return;
    }
    setStep("picking");
  };

  const handleScanSuccess = (code: string) => {
    setScannedCode(code);
    setShowScanner(false);
    codeInputRef.current?.focus();
  };

  const handleConfirmItem = () => {
    if (!scannedCode.trim()) {
      toast.error("Escaneie a etiqueta do produto");
      return;
    }

    if (!pickedQuantity || parseInt(pickedQuantity) < 1) {
      toast.error("Informe a quantidade separada");
      return;
    }

    const currentItem = waveData?.items[currentItemIndex];
    if (!currentItem) {
      toast.error("Item não encontrado");
      return;
    }

    registerItemMutation.mutate({
      waveId: selectedWaveId!,
      itemId: currentItem.id,
      scannedCode: scannedCode.trim(),
      quantity: parseInt(pickedQuantity),
    });
  };

  const currentItem = waveData?.items[currentItemIndex];
  const totalItems = waveData?.items.length || 0;
  const completedItems = currentItemIndex;

  if (showScanner) {
    return (
      <BarcodeScanner
        onScan={handleScanSuccess}
        onClose={() => setShowScanner(false)}
      />
    );
  }

  // Tela de seleção de onda
  if (step === "select") {
    return (
      <CollectorLayout title="Picking - Separação">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <Label className="text-lg font-semibold mb-3 block">Selecione a Onda</Label>
              <Select
                value={selectedWaveId?.toString() || ""}
                onValueChange={(v) => setSelectedWaveId(parseInt(v))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Escolha uma onda de separação" />
                </SelectTrigger>
                <SelectContent>
                  {waves?.map((wave: any) => (
                    <SelectItem key={wave.id} value={wave.id.toString()}>
                      Onda #{wave.id} - {wave.totalItems} itens
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Button
            onClick={handleStartPicking}
            disabled={!selectedWaveId}
            className="w-full h-14 text-lg"
          >
            <Package className="w-5 h-5 mr-2" />
            Iniciar Separação
          </Button>
        </div>
      </CollectorLayout>
    );
  }

  // Tela de separação
  return (
    <CollectorLayout title={`Onda #${selectedWaveId}`}>
      <div className="space-y-4">
        {/* Progresso */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Progresso</Label>
              <span className="text-2xl font-bold">{completedItems}/{totalItems}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${(completedItems / totalItems) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {currentItem ? (
          <>
            {/* Informações do Item Atual */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-base font-semibold mb-3 block">Item Atual</Label>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Produto:</span>
                    <span className="font-medium text-sm">{currentItem.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">SKU:</span>
                    <span className="font-medium text-sm">{currentItem.productSku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Endereço:</span>
                    <span className="font-medium text-sm">{currentItem.locationCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Quantidade:</span>
                    <span className="font-bold text-lg text-blue-600">{currentItem.totalQuantity}</span>
                  </div>
                  {currentItem.batch && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Lote:</span>
                      <span className="font-medium text-sm">{currentItem.batch}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Escaneamento */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-base font-semibold">Etiqueta do Produto</Label>
                <div className="flex gap-2">
                  <Input
                    ref={codeInputRef}
                    value={scannedCode}
                    onChange={(e) => setScannedCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleConfirmItem();
                      }
                    }}
                    placeholder="Escaneie ou digite o código..."
                    className="h-12 text-base"
                    disabled={registerItemMutation.isPending}
                    inputMode="numeric"
                  />
                  <Button
                    onClick={() => setShowScanner(true)}
                    className="h-12 px-4"
                  >
                    <Camera className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quantidade */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-base font-semibold">Quantidade Separada</Label>
                <Input
                  type="number"
                  value={pickedQuantity}
                  onChange={(e) => setPickedQuantity(e.target.value)}
                  placeholder="Quantidade..."
                  className="h-12 text-base"
                  min="1"
                  max={currentItem.totalQuantity}
                  disabled={registerItemMutation.isPending}
                  inputMode="numeric"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPickedQuantity(currentItem.totalQuantity.toString())}
                    className="flex-1 h-10 text-sm"
                  >
                    Quantidade Total
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPickedQuantity(Math.floor(currentItem.totalQuantity / 2).toString())}
                    className="flex-1 h-10 text-sm"
                  >
                    Metade
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Confirmar */}
            <Button
              onClick={handleConfirmItem}
              disabled={registerItemMutation.isPending || !scannedCode || !pickedQuantity}
              className="w-full h-14 text-lg"
            >
              {registerItemMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Check className="w-5 h-5 mr-2" />
              )}
              Confirmar Item
            </Button>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <Label className="text-xl font-bold mb-2 block">Onda Finalizada!</Label>
              <p className="text-gray-600 mb-4">Todos os itens foram separados</p>
              <Button
                onClick={() => {
                  setStep("select");
                  setSelectedWaveId(null);
                  setCurrentItemIndex(0);
                }}
                className="w-full h-12"
              >
                Nova Onda
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </CollectorLayout>
  );
}
