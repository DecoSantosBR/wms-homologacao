import { useState, useRef, useEffect } from "react";
import { CollectorLayout } from "../../components/CollectorLayout";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { Camera, MapPin, Package, CheckCircle2, Undo2 } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { toast } from "sonner";
import { ProductCombobox } from "../../components/ProductCombobox";

export function CollectorPicking() {
  const [step, setStep] = useState<"select" | "scan_location" | "scan_product">("select");
  const [showScanner, setShowScanner] = useState(false);
  const [selectedWaveId, setSelectedWaveId] = useState<number | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  
  // Step 2: Bipagem de endereço
  const [locationCode, setLocationCode] = useState("");
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  
  // Step 3: Bipagem de produto
  const [productCode, setProductCode] = useState("");
  const [showAssociationDialog, setShowAssociationDialog] = useState(false);
  const [pendingProductCode, setPendingProductCode] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [pickedQuantity, setPickedQuantity] = useState<number>(1);
  
  const locationInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Buscar tenants (clientes)
  const { data: tenants } = trpc.tenants.list.useQuery();

  // Buscar ondas disponíveis com status "pending"
  const { data: waves } = trpc.wave.list.useQuery({
    status: "pending",
    tenantId: selectedTenantId ? parseInt(selectedTenantId) : undefined,
    limit: 50,
  });

  // Buscar detalhes da onda selecionada
  const { data: waveData } = trpc.wave.getById.useQuery(
    { id: selectedWaveId! },
    { enabled: !!selectedWaveId }
  );

  // Buscar produtos disponíveis para associação
  const { data: products } = trpc.products.list.useQuery(
    selectedTenantId ? { tenantId: parseInt(selectedTenantId) } : undefined,
    { enabled: !!selectedTenantId }
  );

  const handleStartPicking = () => {
    if (!selectedWaveId) {
      toast.error("Selecione uma onda");
      return;
    }
    setStep("scan_location");
    setTimeout(() => locationInputRef.current?.focus(), 100);
  };

  // Validar endereço
  const validateLocationMutation = trpc.wave.validateLocation.useMutation({
    onSuccess: (data) => {
      setCurrentLocation(data.location);
      setStep("scan_product");
      setLocationCode("");
      setTimeout(() => productInputRef.current?.focus(), 100);
      toast.success(`Endereço validado! ${data.itemCount} itens`);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleLocationSubmit = () => {
    if (!locationCode.trim()) {
      toast.error("Digite ou escaneie um endereço");
      return;
    }

    if (!selectedWaveId) {
      toast.error("Onda não selecionada");
      return;
    }

    validateLocationMutation.mutate({
      waveId: selectedWaveId,
      locationCode: locationCode.trim(),
    });
  };

  // Escanear produto
  const scanProductMutation = trpc.wave.scanProduct.useMutation({
    onSuccess: (data) => {
      if (data.isNewLabel) {
        // Etiqueta nova, abrir dialog de associação
        setPendingProductCode(productCode);
        setShowAssociationDialog(true);
      } else {
        // Etiqueta já associada, registrar item separado
        toast.success("Produto reconhecido!", {
          description: data.waveItem ? `${data.waveItem.pickedQuantity}/${data.waveItem.totalQuantity} separados` : "Item registrado",
        });
        setProductCode("");
        // TODO: Verificar se todos os itens foram separados
        // Se sim, finalizar automaticamente
        productInputRef.current?.focus();
      }
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleProductSubmit = () => {
    if (!productCode.trim()) {
      toast.error("Digite ou escaneie um produto");
      return;
    }

    if (!selectedWaveId || !currentLocation) {
      toast.error("Onda ou endereço não selecionado");
      return;
    }

    scanProductMutation.mutate({
      waveId: selectedWaveId,
      locationId: currentLocation.id,
      productCode: productCode.trim(),
    });
  };

  // Associar etiqueta
  const associateLabelMutation = trpc.wave.associateLabel.useMutation({
    onSuccess: (data) => {
      toast.success("Item separado!", {
        description: `${data.waveItem.pickedQuantity}/${data.waveItem.totalQuantity} unidades`,
      });

      setShowAssociationDialog(false);
      setPendingProductCode("");
      setSelectedProductId(null);
      setPickedQuantity(1);
      setProductCode("");
      
      // Voltar para bipagem de produto (mesmo endereço)
      setTimeout(() => productInputRef.current?.focus(), 100);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleAssociate = () => {
    if (!selectedProductId) {
      toast.error("Selecione um produto");
      return;
    }

    if (pickedQuantity < 1) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }

    if (!selectedWaveId || !currentLocation) {
      toast.error("Onda ou endereço não selecionado");
      return;
    }

    associateLabelMutation.mutate({
      waveId: selectedWaveId,
      locationId: currentLocation.id,
      labelCode: pendingProductCode,
      productId: selectedProductId,
      quantity: pickedQuantity,
    });
  };

  // Finalizar onda
  const completeWaveMutation = trpc.wave.completeWave.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setStep("select");
      setSelectedWaveId(null);
      setSelectedTenantId("");
      setCurrentLocation(null);
      utils.wave.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleFinish = () => {
    if (!selectedWaveId) {
      toast.error("Onda não selecionada");
      return;
    }

    if (confirm("Finalizar separação da onda?")) {
      completeWaveMutation.mutate({ waveId: selectedWaveId });
    }
  };

  const handleScanSuccess = (code: string) => {
    setShowScanner(false);
    
    if (step === "scan_location") {
      setLocationCode(code);
      handleLocationSubmit();
    } else if (step === "scan_product") {
      setProductCode(code);
      handleProductSubmit();
    }
  };

  if (showScanner) {
    return (
      <BarcodeScanner
        onScan={handleScanSuccess}
        onClose={() => setShowScanner(false)}
      />
    );
  }

  // Dialog de associação de produto
  if (showAssociationDialog) {
    return (
      <CollectorLayout title="Associar Produto">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label>Etiqueta Escaneada</Label>
                <Input value={pendingProductCode} disabled className="font-mono" />
              </div>

              <div>
                <Label>Produto *</Label>
                <ProductCombobox
                  products={products || []}
                  value={selectedProductId ? String(selectedProductId) : ""}
                  onValueChange={(value) => setSelectedProductId(parseInt(value))}
                  placeholder="Selecione o produto"
                />
              </div>

              <div>
                <Label>Quantidade Separada *</Label>
                <Input
                  type="number"
                  min="1"
                  value={pickedQuantity}
                  onChange={(e) => setPickedQuantity(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowAssociationDialog(false);
                    setPendingProductCode("");
                    setSelectedProductId(null);
                    setPickedQuantity(1);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAssociate}
                >
                  Confirmar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </CollectorLayout>
    );
  }

  // Step 1: Seleção de onda
  if (step === "select") {
    return (
      <CollectorLayout title="Picking - Separação">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label>Cliente (Tenant)</Label>
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants?.map((tenant) => (
                      <SelectItem key={tenant.id} value={String(tenant.id)}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Onda de Separação</Label>
                <Select 
                  value={selectedWaveId ? String(selectedWaveId) : ""} 
                  onValueChange={(value) => setSelectedWaveId(parseInt(value))}
                  disabled={!selectedTenantId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !selectedTenantId ? "Selecione um cliente primeiro" :
                      waves?.length === 0 ? "Nenhuma onda disponível" :
                      "Escolha uma onda de separação"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {waves?.map((wave) => (
                      <SelectItem key={wave.id} value={String(wave.id)}>
                        {wave.waveNumber} - {wave.totalItems} itens
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleStartPicking}
                disabled={!selectedWaveId}
              >
                <Package className="mr-2 h-5 w-5" />
                Iniciar Separação
              </Button>
            </CardContent>
          </Card>
        </div>
      </CollectorLayout>
    );
  }

  // Step 2: Bipagem de endereço
  if (step === "scan_location") {
    return (
      <CollectorLayout title="Bipar Endereço">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="text-center">
                <MapPin className="mx-auto h-16 w-16 text-primary mb-4" />
                <p className="text-lg font-medium">Escaneie o endereço de separação</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Onda: {waveData?.waveNumber}
                </p>
              </div>

              <div>
                <Label>Código do Endereço</Label>
                <Input
                  ref={locationInputRef}
                  value={locationCode}
                  onChange={(e) => setLocationCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLocationSubmit();
                    }
                  }}
                  placeholder="Digite ou escaneie"
                  className="text-lg font-mono"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowScanner(true)}
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Escanear
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleLocationSubmit}
                  disabled={!locationCode.trim()}
                >
                  Confirmar
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("select");
                  setSelectedWaveId(null);
                }}
              >
                Voltar
              </Button>
            </CardContent>
          </Card>
        </div>
      </CollectorLayout>
    );
  }

  // Step 3: Bipagem de produto
  if (step === "scan_product") {
    return (
      <CollectorLayout title="Bipar Produto">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="text-center">
                <Package className="mx-auto h-16 w-16 text-primary mb-4" />
                <p className="text-lg font-medium">Escaneie o produto</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Endereço: {currentLocation?.code}
                </p>
              </div>

              <div>
                <Label>Código do Produto</Label>
                <Input
                  ref={productInputRef}
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleProductSubmit();
                    }
                  }}
                  placeholder="Digite ou escaneie"
                  className="text-lg font-mono"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowScanner(true)}
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Escanear
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleProductSubmit}
                  disabled={!productCode.trim()}
                >
                  Confirmar
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setStep("scan_location");
                    setCurrentLocation(null);
                  }}
                >
                  Voltar
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleFinish}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Finalizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </CollectorLayout>
    );
  }

  return null;
}
