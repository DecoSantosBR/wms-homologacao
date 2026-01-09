import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  AlertCircle,
  Scan,
  MapPin,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

export default function PickingExecution() {
  const [, params] = useRoute("/picking/:id");
  const [, setLocation] = useLocation();
  const orderId = params?.id ? parseInt(params.id) : 0;

  const [scannedCode, setScannedCode] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [pickedQuantity, setPickedQuantity] = useState("");
  const [locationId, setLocationId] = useState("");
  const [batch, setBatch] = useState("");

  const { data: order, isLoading, refetch } = trpc.picking.getById.useQuery({ id: orderId });
  const updateStatusMutation = trpc.picking.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Status atualizado com sucesso!");
    },
  });
  const pickItemMutation = trpc.picking.pickItem.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedItemId(null);
      setPickedQuantity("");
      setLocationId("");
      setBatch("");
      toast.success("Item separado com sucesso!");
    },
  });

  // Auto-focus no input de scanner
  useEffect(() => {
    const input = document.getElementById("scanner-input");
    if (input) {
      input.focus();
    }
  }, []);

  const handleScan = (code: string) => {
    // Lógica de scanner - por enquanto apenas exibe
    toast.info(`Código escaneado: ${code}`);
    setScannedCode("");
  };

  const handlePickItem = () => {
    if (!selectedItemId || !pickedQuantity || !locationId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    pickItemMutation.mutate({
      itemId: selectedItemId,
      pickedQuantity: parseInt(pickedQuantity),
      locationId: parseInt(locationId),
      batch: batch || undefined,
    });
  };

  const handleStartPicking = () => {
    updateStatusMutation.mutate({ id: orderId, status: "picking" });
  };

  const handleFinishPicking = () => {
    updateStatusMutation.mutate({ id: orderId, status: "picked" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <p className="text-center text-muted-foreground">Carregando pedido...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Pedido não encontrado</h3>
          <Button onClick={() => setLocation("/picking")}>Voltar</Button>
        </Card>
      </div>
    );
  }

  const allItemsPicked = order.items?.every((item) => item.status === "picked");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Mobile */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/picking")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">{order.orderNumber}</h1>
              <p className="text-sm text-muted-foreground">{order.customerName}</p>
            </div>
          </div>

          {/* Scanner Input */}
          <div className="relative">
            <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="scanner-input"
              type="text"
              placeholder="Escaneie código de barras..."
              value={scannedCode}
              onChange={(e) => setScannedCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && scannedCode) {
                  handleScan(scannedCode);
                }
              }}
              className="pl-10 text-lg"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status Card */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-semibold capitalize">{order.status}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prioridade</p>
              <p className="font-semibold capitalize">{order.priority}</p>
            </div>
          </div>

          {order.status === "pending" && (
            <Button onClick={handleStartPicking} className="w-full" size="lg">
              Iniciar Separação
            </Button>
          )}

          {order.status === "picking" && allItemsPicked && (
            <Button onClick={handleFinishPicking} className="w-full" size="lg">
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Finalizar Separação
            </Button>
          )}
        </Card>

        {/* Items List */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Itens para Separar</h2>

          {order.items?.map((item) => (
            <Card
              key={item.id}
              className={`p-4 ${
                selectedItemId === item.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedItemId(item.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold">{item.productName}</h3>
                  <p className="text-sm text-muted-foreground">SKU: {item.productSku}</p>
                </div>
                {item.status === "picked" ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <Package className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Solicitado</p>
                  <p className="font-semibold">
                    {item.requestedQuantity} {item.requestedUM}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Separado</p>
                  <p className="font-semibold">{item.pickedQuantity || 0}</p>
                </div>
              </div>

              {selectedItemId === item.id && item.status !== "picked" && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div>
                    <Label>Quantidade Separada *</Label>
                    <Input
                      type="number"
                      value={pickedQuantity}
                      onChange={(e) => setPickedQuantity(e.target.value)}
                      placeholder="Digite a quantidade"
                    />
                  </div>

                  <div>
                    <Label>ID do Endereço *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={locationId}
                        onChange={(e) => setLocationId(e.target.value)}
                        placeholder="ID do endereço"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Lote (opcional)</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={batch}
                        onChange={(e) => setBatch(e.target.value)}
                        placeholder="Número do lote"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handlePickItem}
                    disabled={pickItemMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {pickItemMutation.isPending ? "Salvando..." : "Confirmar Separação"}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
