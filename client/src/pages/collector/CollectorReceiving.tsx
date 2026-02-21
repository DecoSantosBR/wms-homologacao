import { useState } from "react";
import { CollectorLayout } from "../../components/CollectorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { Camera, Check, X } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { toast } from "sonner";

export function CollectorReceiving() {
  const [showScanner, setShowScanner] = useState(false);
  const [currentField, setCurrentField] = useState<"product" | "location" | null>(null);
  
  const [productCode, setProductCode] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [batch, setBatch] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const createReceivingMutation = trpc.blindConference.start.useMutation({
    onSuccess: () => {
      toast.success("Item recebido com sucesso");
      // Limpar campos
      setProductCode("");
      setLocationCode("");
      setQuantity("");
      setBatch("");
      setExpiryDate("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleScan = (code: string) => {
    if (currentField === "product") {
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
    
    if (!productCode || !locationCode || !quantity) {
      toast.error("Preencha produto, endereço e quantidade");
      return;
    }

    // TODO: Implementar lógica de recebimento via coletor
    toast.info("Funcionalidade em desenvolvimento");
  };

  const handleClear = () => {
    setProductCode("");
    setLocationCode("");
    setQuantity("");
    setBatch("");
    setExpiryDate("");
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
    <CollectorLayout title="Recebimento">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Produto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Código do produto"
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
            <CardTitle className="text-lg">Endereço</CardTitle>
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

        {/* Quantidade e Lote */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="quantity">Quantidade *</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="Quantidade"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-12 text-lg"
                min="1"
              />
            </div>
            <div>
              <Label htmlFor="batch">Lote</Label>
              <Input
                id="batch"
                placeholder="Número do lote"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="h-12 text-lg"
              />
            </div>
            <div>
              <Label htmlFor="expiryDate">Validade</Label>
              <Input
                id="expiryDate"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-12 text-lg"
              />
            </div>
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
            disabled={createReceivingMutation.isPending}
          >
            <Check className="mr-2 h-5 w-5" />
            {createReceivingMutation.isPending ? "Salvando..." : "Confirmar"}
          </Button>
        </div>
      </form>
    </CollectorLayout>
  );
}
