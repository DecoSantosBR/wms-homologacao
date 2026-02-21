import { useState } from "react";
import { CollectorLayout } from "../../components/CollectorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { Camera, Check, X, Package } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { toast } from "sonner";

export function CollectorPicking() {
  const [showScanner, setShowScanner] = useState(false);
  const [currentField, setCurrentField] = useState<"wave" | "product" | "location" | null>(null);
  
  const [waveId, setWaveId] = useState("");
  const [waveInfo, setWaveInfo] = useState<any>(null);
  const [productCode, setProductCode] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [quantity, setQuantity] = useState("");

  // Query para buscar informações da onda
  const waveQuery = trpc.wave.getById.useQuery(
    { id: parseInt(waveId) },
    { enabled: !!waveId && !isNaN(parseInt(waveId)) }
  );

  // Mutation para registrar item separado
  const registerItemMutation = trpc.wave.registerPickedItem.useMutation({
    onSuccess: (data) => {
      const remaining = data.totalQuantity - data.pickedQuantity;
      toast.success(`Item registrado! ${remaining} restantes`);
      // Limpar campos para próximo item
      setProductCode("");
      setLocationCode("");
      setQuantity("");
      
      // Se todos os itens foram separados
      if (data.waveCompleted) {
        toast.success("Todos os itens da onda foram separados!");
        setWaveId("");
        setWaveInfo(null);
      }
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleScan = (code: string) => {
    if (currentField === "wave") {
      setWaveId(code);
      toast.success(`Onda escaneada: ${code}`);
    } else if (currentField === "product") {
      setProductCode(code);
      toast.success(`Produto escaneado: ${code}`);
    } else if (currentField === "location") {
      setLocationCode(code);
      toast.success(`Endereço escaneado: ${code}`);
    }
    setShowScanner(false);
    setCurrentField(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!waveId || !productCode || !locationCode || !quantity) {
      toast.error("Preencha todos os campos");
      return;
    }

    // Buscar itemId da onda (primeiro item disponível)
    if (!waveQuery.data || !waveQuery.data.items || waveQuery.data.items.length === 0) {
      toast.error("Nenhum item disponível na onda");
      return;
    }
    
    const firstItem = waveQuery.data.items[0];
    
    registerItemMutation.mutate({
      waveId: parseInt(waveId),
      itemId: firstItem.id,
      scannedCode: productCode,
      quantity: parseInt(quantity),
    });
  };

  const handleClear = () => {
    setProductCode("");
    setLocationCode("");
    setQuantity("");
  };

  const handleNewWave = () => {
    setWaveId("");
    setWaveInfo(null);
    setProductCode("");
    setLocationCode("");
    setQuantity("");
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
    <CollectorLayout title="Picking - Separação">
      <div className="space-y-4">
        {/* Informações da Onda */}
        {!waveId ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selecionar Onda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="ID da onda"
                  value={waveId}
                  onChange={(e) => setWaveId(e.target.value)}
                  className="h-12 text-lg"
                  type="number"
                />
                <Button
                  type="button"
                  size="lg"
                  onClick={() => {
                    setCurrentField("wave");
                    setShowScanner(true);
                  }}
                  className="h-12 px-4"
                >
                  <Camera className="h-5 w-5" />
                </Button>
              </div>
              {waveQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Carregando onda...</p>
              )}
              {waveQuery.error && (
                <p className="text-sm text-destructive">{waveQuery.error.message}</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Resumo da Onda */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Onda #{waveId}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {waveQuery.data?.items.length || 0} itens
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNewWave}
                  >
                    Trocar Onda
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Formulário de Separação */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Produto */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Etiqueta do Produto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Escaneie a etiqueta"
                      value={productCode}
                      onChange={(e) => setProductCode(e.target.value)}
                      className="h-12 text-lg"
                    />
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => {
                        setCurrentField("product");
                        setShowScanner(true);
                      }}
                      className="h-12 px-4"
                    >
                      <Camera className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Endereço */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Endereço de Origem</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Código do endereço"
                      value={locationCode}
                      onChange={(e) => setLocationCode(e.target.value)}
                      className="h-12 text-lg"
                    />
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => {
                        setCurrentField("location");
                        setShowScanner(true);
                      }}
                      className="h-12 px-4"
                    >
                      <Camera className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quantidade */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quantidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    type="number"
                    placeholder="Quantidade separada"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-12 text-lg"
                    min="1"
                  />
                </CardContent>
              </Card>

              {/* Botões de Ação */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleClear}
                  className="h-14"
                >
                  <X className="mr-2 h-5 w-5" />
                  Limpar
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="h-14"
                  disabled={registerItemMutation.isPending}
                >
                  <Check className="mr-2 h-5 w-5" />
                  {registerItemMutation.isPending ? "Registrando..." : "Confirmar"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </CollectorLayout>
  );
}
