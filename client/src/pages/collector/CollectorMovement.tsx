import { useState } from "react";
import { CollectorLayout } from "../../components/CollectorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { Camera, Check, X, ArrowRight } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { toast } from "sonner";

export function CollectorMovement() {
  const [showScanner, setShowScanner] = useState(false);
  const [currentField, setCurrentField] = useState<"product" | "origin" | "destination" | null>(null);
  
  const [productCode, setProductCode] = useState("");
  const [originCode, setOriginCode] = useState("");
  const [destinationCode, setDestinationCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [productInfo, setProductInfo] = useState<any>(null);

  // TODO: Integrar com API quando endpoints estiverem disponíveis
  // const productQuery = trpc.inventory.getLocationProducts.useQuery(...)
  // const movementMutation = trpc.inventory.moveInventory.useMutation(...)

  const handleScan = (code: string) => {
    if (currentField === "product") {
      setProductCode(code);
      toast.success(`Produto escaneado: ${code}`);
    } else if (currentField === "origin") {
      setOriginCode(code);
      toast.success(`Origem escaneada: ${code}`);
    } else if (currentField === "destination") {
      setDestinationCode(code);
      toast.success(`Destino escaneado: ${code}`);
    }
    setShowScanner(false);
    setCurrentField(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productCode || !originCode || !destinationCode || !quantity) {
      toast.error("Preencha todos os campos");
      return;
    }

    // TODO: Chamar API de movimentação quando estiver disponível
    toast.success("Movimentação registrada! (modo demo)");
    
    // Limpar campos
    setProductCode("");
    setOriginCode("");
    setDestinationCode("");
    setQuantity("");
    setProductInfo(null);
  };

  const handleClear = () => {
    setProductCode("");
    setOriginCode("");
    setDestinationCode("");
    setQuantity("");
    setProductInfo(null);
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
    <CollectorLayout title="Movimentação">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Endereço de Origem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Endereço de Origem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Código do endereço"
                value={originCode}
                onChange={(e) => setOriginCode(e.target.value)}
                className="h-12 text-lg"
              />
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  setCurrentField("origin");
                  setShowScanner(true);
                }}
                className="h-12 px-4"
              >
                <Camera className="h-5 w-5" />
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* Produto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Produto/Etiqueta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="SKU, GTIN ou etiqueta"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                className="h-12 text-lg"
                disabled={!originCode}
              />
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  setCurrentField("product");
                  setShowScanner(true);
                }}
                className="h-12 px-4"
                disabled={!originCode}
              >
                <Camera className="h-5 w-5" />
              </Button>
            </div>
            
            {productInfo && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-900">
                  {productInfo.productName}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  SKU: {productInfo.sku}
                </p>
                {productInfo.batch && (
                  <p className="text-xs text-green-700">
                    Lote: {productInfo.batch}
                  </p>
                )}
                <p className="text-xs text-green-700">
                  Disponível: {productInfo.availableQuantity} unidades
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Endereço de Destino */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Endereço de Destino</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Código do endereço"
                value={destinationCode}
                onChange={(e) => setDestinationCode(e.target.value)}
                className="h-12 text-lg"
              />
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  setCurrentField("destination");
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
              placeholder="Quantidade a movimentar"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-12 text-lg"
              min="1"
              max={productInfo?.availableQuantity}
            />
          </CardContent>
        </Card>

        {/* Resumo Visual */}
        {originCode && destinationCode && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">De</p>
                  <p className="font-bold text-lg">{originCode}</p>
                </div>
                <ArrowRight className="h-6 w-6 text-blue-600" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Para</p>
                  <p className="font-bold text-lg">{destinationCode}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
            disabled={false}
          >
            <Check className="mr-2 h-5 w-5" />
            Confirmar
          </Button>
        </div>
      </form>
    </CollectorLayout>
  );
}
