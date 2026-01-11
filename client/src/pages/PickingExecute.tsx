import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Home, Package, PlayCircle } from "lucide-react";
import { toast } from "sonner";

export default function PickingExecute() {
  const [, navigate] = useLocation();
  const [selectedWave, setSelectedWave] = useState<number | null>(null);

  const { data: waves, isLoading } = trpc.picking.getAvailableWaves.useQuery();

  const startPickingMutation = trpc.picking.startWavePicking.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Separação iniciada!");
      navigate(`/picking/execute/${variables.waveId}`);
    },
    onError: (error) => {
      toast.error(`Erro ao iniciar separação: ${error.message}`);
    },
  });

  const handleStartPicking = (waveId: number) => {
    startPickingMutation.mutate({ waveId });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      pending: { label: "Pendente", variant: "outline" },
      picking: { label: "Em Separação", variant: "default" },
    };
    const config = variants[status] || { label: status, variant: "secondary" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <Home className="h-4 w-4 mr-2" />
            Início
          </Button>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando ondas disponíveis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <Home className="h-4 w-4 mr-2" />
          Início
        </Button>
      </div>

      {/* Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Executar Separação</h1>
        <p className="text-muted-foreground">
          Selecione uma onda para iniciar a separação
        </p>
      </div>

      {/* Waves List */}
      {!waves || waves.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma onda disponível para separação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {waves.map((wave) => (
            <Card 
              key={wave.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedWave === wave.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedWave(wave.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{wave.waveNumber}</CardTitle>
                    <CardDescription>
                      Criado em {new Date(wave.createdAt).toLocaleString("pt-BR")}
                    </CardDescription>
                  </div>
                  {getStatusBadge(wave.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pedidos</p>
                    <p className="text-2xl font-bold">{wave.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Itens</p>
                    <p className="text-2xl font-bold">{wave.totalItems}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Quantidade Total</p>
                    <p className="text-2xl font-bold">{wave.totalQuantity} unidades</p>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartPicking(wave.id);
                  }}
                  disabled={startPickingMutation.isPending}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  {wave.status === "picking" ? "Continuar Separação" : "Iniciar Separação"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
