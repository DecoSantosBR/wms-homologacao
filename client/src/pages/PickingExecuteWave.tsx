import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Home, Package, MapPin, CheckCircle2, Barcode, Camera } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/BarcodeScanner";

type ScanStep = "location" | "item";

export default function PickingExecuteWave() {
  const [, params] = useRoute("/picking/execute/:id");
  const [, navigate] = useLocation();
  const waveId = params?.id ? parseInt(params.id) : 0;

  const [scanStep, setScanStep] = useState<ScanStep>("location");
  const [currentLocation, setCurrentLocation] = useState<string>("");
  const [scannedLabel, setScannedLabel] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"location" | "label" | null>(null);

  const locationInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const { data: wave } = trpc.picking.getWaveById.useQuery(
    { id: waveId },
    { enabled: waveId > 0 }
  );

  const { data: progress } = trpc.picking.getPickingProgress.useQuery(
    { waveId },
    { enabled: waveId > 0, refetchInterval: 5000 }
  );

  const { data: nextLocation } = trpc.picking.getNextLocation.useQuery(
    { waveId },
    { enabled: waveId > 0 && scanStep === "location" }
  );

  const { data: locationItems } = trpc.picking.getLocationItems.useQuery(
    { waveId, locationCode: currentLocation },
    { enabled: waveId > 0 && currentLocation !== "" }
  );

  const utils = trpc.useUtils();

  const registerItemMutation = trpc.picking.registerPickedItem.useMutation({
    onSuccess: (result) => {
      toast.success(`Item registrado! ${result.itemCompleted ? "Item completo ✓" : ""}`);
      
      // Limpar campos
      setScannedLabel("");
      setQuantity("1");
      
      // Invalidar queries
      utils.picking.getLocationItems.invalidate({ waveId, locationCode: currentLocation });
      utils.picking.getPickingProgress.invalidate({ waveId });
      utils.picking.getNextLocation.invalidate({ waveId });

      // Se todos os itens do endereço foram separados, voltar para scan de endereço
      if (result.itemCompleted && locationItems && locationItems.length === 1) {
        setCurrentLocation("");
        setScanStep("location");
        toast.success("Endereço completo! Próximo endereço...");
      }

      // Se a onda foi completada
      if (result.waveCompleted) {
        toast.success("🎉 Onda completada! Levando para Stage...");
        setTimeout(() => navigate("/waves"), 2000);
      }

      // Focar no input de etiqueta
      setTimeout(() => labelInputRef.current?.focus(), 100);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
      setScannedLabel("");
      setTimeout(() => labelInputRef.current?.focus(), 100);
    },
  });

  // Auto-focus no input correto
  useEffect(() => {
    if (scanStep === "location") {
      locationInputRef.current?.focus();
    } else {
      labelInputRef.current?.focus();
    }
  }, [scanStep]);

  // Handlers do scanner
  const openScanner = (target: "location" | "label") => {
    setScannerTarget(target);
    setShowScanner(true);
  };

  const handleScanResult = (code: string) => {
    if (scannerTarget === "location") {
      if (locationInputRef.current) {
        locationInputRef.current.value = code;
      }
      // Processar automaticamente
      if (nextLocation && code !== nextLocation.locationCode) {
        toast.error(`Endereço incorreto! Vá para: ${nextLocation.locationCode}`);
      } else {
        setCurrentLocation(code);
        setScanStep("item");
        toast.success(`Endereço: ${code}`);
      }
    } else if (scannerTarget === "label") {
      setScannedLabel(code);
      // Focar no campo de quantidade
      setTimeout(() => quantityInputRef.current?.focus(), 100);
    }
    setShowScanner(false);
    setScannerTarget(null);
  };

  const handleLocationScan = (e: React.FormEvent) => {
    e.preventDefault();
    const scannedCode = locationInputRef.current?.value.trim() || "";
    
    if (!scannedCode) {
      toast.error("Escaneie um endereço");
      return;
    }

    // Verificar se é o endereço correto
    if (nextLocation && scannedCode !== nextLocation.locationCode) {
      toast.error(`Endereço incorreto! Vá para: ${nextLocation.locationCode}`);
      locationInputRef.current!.value = "";
      return;
    }

    setCurrentLocation(scannedCode);
    setScanStep("item");
    toast.success(`Endereço: ${scannedCode}`);
  };

  const handleItemScan = (e: React.FormEvent) => {
    e.preventDefault();
    const label = scannedLabel.trim();
    const qty = parseInt(quantity);

    if (!label) {
      toast.error("Escaneie uma etiqueta");
      return;
    }

    if (!qty || qty <= 0) {
      toast.error("Quantidade inválida");
      return;
    }

    if (!locationItems || locationItems.length === 0) {
      toast.error("Nenhum item para separar neste endereço");
      return;
    }

    // Registrar item
    registerItemMutation.mutate({
      waveId,
      waveItemId: locationItems[0].id, // Simplificado: pega o primeiro item pendente
      locationCode: currentLocation,
      labelCode: label,
      quantity: qty,
    });
  };

  const progressPercent = progress 
    ? Math.round((progress.pickedQuantity / progress.totalQuantity) * 100)
    : 0;

  if (!wave) {
    return (
      <div className="container py-6">
        <p className="text-center text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/picking/execute")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <Home className="h-4 w-4 mr-2" />
          Início
        </Button>
      </div>

      {/* Wave Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{wave.waveNumber}</CardTitle>
              <CardDescription>Separação em andamento</CardDescription>
            </div>
            <Badge>Em Separação</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progresso</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Separado</p>
                <p className="text-2xl font-bold">{progress?.pickedQuantity || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{progress?.totalQuantity || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Itens</p>
                <p className="text-2xl font-bold">
                  {progress?.pickedItems || 0}/{progress?.totalItems || 0}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scan Location */}
      {scanStep === "location" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Escanear Endereço
            </CardTitle>
            <CardDescription>
              {nextLocation 
                ? `Próximo endereço: ${nextLocation.locationCode}`
                : "Todos os endereços foram separados!"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nextLocation ? (
              <form onSubmit={handleLocationScan} className="space-y-4">
                <div>
                  <Label htmlFor="location">Código do Endereço</Label>
                  <div className="flex gap-2">
                    <Input
                      id="location"
                      ref={locationInputRef}
                      placeholder="Bipe o código de barras do endereço"
                      autoFocus
                      className="text-lg flex-1"
                    />
                    <Button 
                      type="button" 
                      size="icon" 
                      variant="outline"
                      onClick={() => openScanner("location")}
                      className="h-auto"
                    >
                      <Camera className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg">
                  <Barcode className="h-5 w-5 mr-2" />
                  Confirmar Endereço
                </Button>
              </form>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium mb-2">Separação Concluída!</p>
                <Button onClick={() => navigate("/waves")}>
                  Voltar para Ondas
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scan Items */}
      {scanStep === "item" && (
        <div className="space-y-6">
          {/* Current Location Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Endereço: {currentLocation}
              </CardTitle>
              <CardDescription>
                {locationItems && locationItems.length > 0
                  ? `${locationItems.length} item(ns) para separar`
                  : "Carregando itens..."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {locationItems && locationItems.length > 0 && (
                <div className="space-y-3">
                  {locationItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{item.productSku}</p>
                        <p className="text-sm text-muted-foreground">{item.productName}</p>
                        {item.batch && (
                          <p className="text-xs text-muted-foreground">Lote: {item.batch}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{item.totalQuantity - item.pickedQuantity}</p>
                        <p className="text-xs text-muted-foreground">unidades</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scan Item Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Escanear Produto
              </CardTitle>
              <CardDescription>
                Bipe a etiqueta do produto e informe a quantidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleItemScan} className="space-y-4">
                <div>
                  <Label htmlFor="label">Código da Etiqueta</Label>
                  <div className="flex gap-2">
                    <Input
                      id="label"
                      ref={labelInputRef}
                      value={scannedLabel}
                      onChange={(e) => setScannedLabel(e.target.value)}
                      placeholder="Bipe o código de barras da etiqueta"
                      autoFocus
                      className="text-lg flex-1"
                    />
                    <Button 
                      type="button" 
                      size="icon" 
                      variant="outline"
                      onClick={() => openScanner("label")}
                      className="h-auto"
                    >
                      <Camera className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantidade</Label>
                  <Input
                    id="quantity"
                    ref={quantityInputRef}
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="text-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setCurrentLocation("");
                      setScanStep("location");
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1" 
                    size="lg"
                    disabled={registerItemMutation.isPending}
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Registrar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleScanResult}
          onClose={() => {
            setShowScanner(false);
            setScannerTarget(null);
          }}
        />
      )}
    </div>
  );
}
