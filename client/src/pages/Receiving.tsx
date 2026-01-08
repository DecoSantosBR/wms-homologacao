import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Eye, Trash2, Search, Filter, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS = {
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  in_quarantine: "bg-orange-100 text-orange-800",
  addressing: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS = {
  scheduled: "Agendado",
  in_progress: "Em Andamento",
  in_quarantine: "Em Quarentena",
  addressing: "Endereçamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export default function Receiving() {
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewItemsOrderId, setViewItemsOrderId] = useState<number | null>(null);
  const [scheduleOrderId, setScheduleOrderId] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");

  const { data: orders, refetch } = trpc.receiving.list.useQuery();
  const { data: orderItems } = trpc.receiving.getItems.useQuery(
    { receivingOrderId: viewItemsOrderId! },
    { enabled: !!viewItemsOrderId }
  );

  const deleteMutation = trpc.receiving.delete.useMutation({
    onSuccess: () => {
      toast.success("Ordem deletada com sucesso");
      refetch();
    },
    onError: (error) => {
      toast.error("Erro ao deletar ordem: " + error.message);
    },
  });

  const deleteBatchMutation = trpc.receiving.deleteBatch.useMutation({
    onSuccess: () => {
      toast.success("Ordens deletadas com sucesso");
      setSelectedOrders([]);
      refetch();
    },
    onError: (error) => {
      toast.error("Erro ao deletar ordens: " + error.message);
    },
  });

  const scheduleMutation = trpc.receiving.schedule.useMutation({
    onSuccess: () => {
      toast.success("Agendamento realizado com sucesso");
      setScheduleOrderId(null);
      setScheduledDate("");
      refetch();
    },
    onError: (error) => {
      toast.error("Erro ao agendar: " + error.message);
    },
  });

  const handleDelete = (orderId: number) => {
    if (confirm("Tem certeza que deseja deletar esta ordem de recebimento?")) {
      deleteMutation.mutate({ id: orderId });
    }
  };

  const handleDeleteBatch = () => {
    if (selectedOrders.length === 0) {
      toast.error("Selecione pelo menos uma ordem");
      return;
    }
    if (confirm(`Tem certeza que deseja deletar ${selectedOrders.length} ordem(ns)?`)) {
      deleteBatchMutation.mutate({ ids: selectedOrders });
    }
  };

  const handleSchedule = () => {
    if (!scheduleOrderId || !scheduledDate) {
      toast.error("Selecione uma data e hora");
      return;
    }
    scheduleMutation.mutate({ id: scheduleOrderId, scheduledDate });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map((o) => o.id));
    }
  };

  const toggleSelect = (orderId: number) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  // Filtros
  const filteredOrders = (orders || []).filter((order) => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesSearch =
      searchTerm === "" ||
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.nfeNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Recebimento</h1>
          </div>
          <p className="text-gray-600">
            Gerencie ordens de recebimento, confira mercadorias e realize endereçamento
          </p>
        </div>

        {/* Filtros e Ações */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Busca */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por número, fornecedor ou NF-e..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filtro de Status */}
              <div className="w-full md:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      <SelectValue placeholder="Status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="scheduled">Agendado</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="in_quarantine">Em Quarentena</SelectItem>
                    <SelectItem value="addressing">Endereçamento</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Deletar em Lote */}
              {selectedOrders.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteBatch}
                  disabled={deleteBatchMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Deletar ({selectedOrders.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Ordens */}
        <Card>
          <CardHeader>
            <CardTitle>Ordens de Recebimento</CardTitle>
            <CardDescription>
              {filteredOrders.length} ordem(ns) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>NF-e</TableHead>
                    <TableHead>Data Agendada</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                        Nenhuma ordem de recebimento encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleSelect(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>{order.supplierName || "-"}</TableCell>
                        <TableCell>
                          {order.nfeNumber ? (
                            <span className="font-mono text-sm">
                              {order.nfeNumber}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {order.scheduledDate
                            ? format(new Date(order.scheduledDate), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}>
                            {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setScheduleOrderId(order.id)}
                              title="Agendar previsão de chegada"
                            >
                              <Calendar className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewItemsOrderId(order.id)}
                              title="Visualizar itens"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(order.id)}
                              disabled={deleteMutation.isPending}
                              title="Deletar ordem"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Modal de Visualização de Itens */}
        <Dialog open={!!viewItemsOrderId} onOpenChange={() => setViewItemsOrderId(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Itens da Ordem</DialogTitle>
              <DialogDescription>
                Visualize os produtos desta ordem de recebimento
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qtd Esperada</TableHead>
                    <TableHead className="text-right">Qtd Recebida</TableHead>
                    <TableHead className="text-right">Qtd Endereçada</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!orderItems || orderItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                        Nenhum item encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    orderItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.productDescription || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.productSku || "-"}
                        </TableCell>
                        <TableCell className="text-right">{item.expectedQuantity}</TableCell>
                        <TableCell className="text-right">{item.receivedQuantity}</TableCell>
                        <TableCell className="text-right">{item.addressedQuantity}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Agendamento */}
        <Dialog open={!!scheduleOrderId} onOpenChange={() => setScheduleOrderId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Previsão de Chegada</DialogTitle>
              <DialogDescription>
                Informe a data e hora prevista para chegada do veículo de entrega
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Data e Hora Prevista
                </label>
                <Input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setScheduleOrderId(null)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSchedule}
                  disabled={scheduleMutation.isPending || !scheduledDate}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Confirmar Agendamento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
