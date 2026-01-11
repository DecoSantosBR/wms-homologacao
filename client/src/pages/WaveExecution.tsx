import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { WaveLabel } from "../components/WaveLabel";
import { PickingList } from "../components/PickingList";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import { 
  Package, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Printer, 
  QrCode,
  AlertCircle,
  PlayCircle,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function WaveExecution() {
  const [, params] = useRoute("/waves/:id");
  const [, navigate] = useLocation();
  const waveId = params?.id ? parseInt(params.id) : 0;
  
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [showPickingListDialog, setShowPickingListDialog] = useState(false);

  const { data: wave, isLoading } = trpc.picking.getWaveById.useQuery(
    { id: waveId },
    { enabled: waveId > 0 }
  );

  const updateStatusMutation = trpc.picking.updateWaveStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado com sucesso!");
      // Invalidar cache para atualizar dados
      trpc.useUtils().picking.getWaveById.invalidate({ id: waveId });
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });

  const handleStartPicking = () => {
    updateStatusMutation.mutate({
      id: waveId,
      status: "picking",
    });
  };

  const handleCompletePicking = () => {
    updateStatusMutation.mutate({
      id: waveId,
      status: "picked",
    });
  };

  const handleStage = () => {
    updateStatusMutation.mutate({
      id: waveId,
      status: "staged",
    });
  };

  const handleComplete = () => {
    updateStatusMutation.mutate({
      id: waveId,
      status: "completed",
    });
  };

  const handlePrintLabel = () => {
    setShowLabelDialog(true);
  };

  const handlePrintPickingList = () => {
    setShowPickingListDialog(true);
  };

  // Badge de status
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      pending: { 
        label: "Pendente", 
        className: "bg-gray-500 text-white",
        icon: <Clock className="h-3 w-3 mr-1" />
      },
      picking: { 
        label: "Em Separação", 
        className: "bg-blue-500 text-white",
        icon: <PlayCircle className="h-3 w-3 mr-1" />
      },
      picked: { 
        label: "Separado", 
        className: "bg-green-500 text-white",
        icon: <CheckCircle className="h-3 w-3 mr-1" />
      },
      staged: { 
        label: "Conferido", 
        className: "bg-purple-500 text-white",
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />
      },
      completed: { 
        label: "Concluído", 
        className: "bg-emerald-600 text-white",
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />
      },
      cancelled: { 
        label: "Cancelado", 
        className: "bg-red-500 text-white",
        icon: <AlertCircle className="h-3 w-3 mr-1" />
      },
    };

    const variant = variants[status] || variants.pending;
    return (
      <Badge className={variant.className}>
        {variant.icon}
        {variant.label}
      </Badge>
    );
  };

  // Calcular progresso
  const getProgress = (status: string) => {
    const statusProgress: Record<string, number> = {
      pending: 0,
      picking: 25,
      picked: 50,
      staged: 75,
      completed: 100,
      cancelled: 0,
    };
    return statusProgress[status] || 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Carregando..." description="Aguarde..." />
        <div className="container mx-auto py-8 px-4">
          <div className="text-center text-gray-500">Carregando detalhes da onda...</div>
        </div>
      </div>
    );
  }

  if (!wave) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Onda não encontrada" description="A onda solicitada não existe" />
        <div className="container mx-auto py-8 px-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <p className="text-gray-600 mb-4">Onda não encontrada</p>
                <Button onClick={() => navigate("/waves")}>Voltar para Ondas</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={`Onda ${wave.waveNumber}`}
        description="Detalhes e execução da onda de separação"
      />

      <div className="container mx-auto py-8 px-4 space-y-6">
        {/* Card de Informações Gerais */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{wave.waveNumber}</CardTitle>
                <CardDescription>
                  Criado em {format(new Date(wave.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrintLabel}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Etiqueta
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrintPickingList}>
                  <Printer className="h-4 w-4 mr-2" />
                  Lista de Picking
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status e Progresso */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Status</span>
                {getStatusBadge(wave.status)}
              </div>
              <Progress value={getProgress(wave.status)} className="h-2" />
            </div>

            <Separator />

            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{wave.totalOrders}</div>
                <div className="text-sm text-gray-600">Pedidos</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{wave.totalItems}</div>
                <div className="text-sm text-gray-600">Itens Distintos</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{wave.totalQuantity}</div>
                <div className="text-sm text-gray-600">Unidades Totais</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-3xl font-bold text-orange-600">
                  {wave.pickingRule === "FIFO" ? "FIFO" : wave.pickingRule === "FEFO" ? "FEFO" : "Dirigido"}
                </div>
                <div className="text-sm text-gray-600">Regra de Picking</div>
              </div>
            </div>

            <Separator />

            {/* Ações de Execução */}
            <div className="flex flex-wrap gap-3">
              {wave.status === "pending" && (
                <Button onClick={handleStartPicking} disabled={updateStatusMutation.isPending}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Iniciar Separação
                </Button>
              )}
              {wave.status === "picking" && (
                <Button onClick={handleCompletePicking} disabled={updateStatusMutation.isPending}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Concluir Separação
                </Button>
              )}
              {wave.status === "picked" && (
                <Button onClick={handleStage} disabled={updateStatusMutation.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Conferir e Stagear
                </Button>
              )}
              {wave.status === "staged" && (
                <Button onClick={handleComplete} disabled={updateStatusMutation.isPending}>
                  <Package className="h-4 w-4 mr-2" />
                  Finalizar Onda
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card de Itens da Onda */}
        <Card>
          <CardHeader>
            <CardTitle>Itens da Onda</CardTitle>
            <CardDescription>
              Lista consolidada de produtos com endereços de origem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Quantidade</TableHead>
                  <TableHead>Endereços de Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wave.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.productSku}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-center font-semibold">{item.totalQuantity}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {item.locationCode}
                        {item.batch && ` | Lote: ${item.batch}`}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Card de Pedidos Originais */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Incluídos na Onda</CardTitle>
            <CardDescription>
              {wave.totalOrders} {wave.totalOrders === 1 ? "pedido" : "pedidos"} consolidados nesta onda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wave.orders.map((order: any) => (
                <Card key={order.id} className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-mono text-sm font-semibold">{order.orderNumber}</div>
                      <Badge variant="secondary" className="text-xs">
                        {order.itemCount} {order.itemCount === 1 ? "item" : "itens"}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      Cliente: {order.customerName}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs de Impressão */}
      {wave && (
        <>
          <WaveLabel
            wave={{
              id: wave.id,
              waveNumber: wave.waveNumber,
              totalOrders: wave.totalOrders,
              totalItems: wave.totalItems,
              totalQuantity: wave.totalQuantity,
              createdAt: wave.createdAt,
            }}
            open={showLabelDialog}
            onOpenChange={setShowLabelDialog}
          />
          <PickingList
            wave={{
              id: wave.id,
              waveNumber: wave.waveNumber,
              totalOrders: wave.totalOrders,
              totalItems: wave.totalItems,
              totalQuantity: wave.totalQuantity,
              pickingRule: wave.pickingRule,
              createdAt: wave.createdAt,
              items: wave.items,
            }}
            open={showPickingListDialog}
            onOpenChange={setShowPickingListDialog}
          />
        </>
      )}
    </div>
  );
}
