import React, { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Package, Printer, Eye, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Waves() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: waves = [], isLoading } = trpc.picking.listWaves.useQuery();

  // Filtrar ondas
  const filteredWaves = waves.filter((wave) => {
    const matchesStatus = statusFilter === "all" || wave.status === statusFilter;
    const matchesSearch = wave.waveNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Badge de status
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Pendente", className: "bg-gray-500" },
      picking: { label: "Em Separação", className: "bg-blue-500" },
      picked: { label: "Separado", className: "bg-green-500" },
      staged: { label: "Conferido", className: "bg-purple-500" },
      completed: { label: "Concluído", className: "bg-emerald-600" },
      cancelled: { label: "Cancelado", className: "bg-red-500" },
    };

    const variant = variants[status] || variants.pending;
    return (
      <Badge className={`${variant.className} text-white`}>
        {variant.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Ondas de Separação"
        description="Gerenciamento de ondas de picking (Wave Picking)"
      />

      <div className="container mx-auto py-8 px-4">
        {/* Filtros e Busca */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Busca */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por número da onda..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro de Status */}
            <div className="w-full md:w-64">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="picking">Em Separação</SelectItem>
                  <SelectItem value="picked">Separado</SelectItem>
                  <SelectItem value="staged">Conferido</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contador de Resultados */}
          <div className="mt-4 text-sm text-gray-600">
            {filteredWaves.length} {filteredWaves.length === 1 ? "onda encontrada" : "ondas encontradas"}
          </div>
        </div>

        {/* Tabela de Ondas */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando ondas...</div>
          ) : filteredWaves.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma onda encontrada
              </h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Crie ondas de separação a partir dos pedidos de picking"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número da Onda</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Pedidos</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                  <TableHead className="text-center">Quantidade Total</TableHead>
                  <TableHead>Regra</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWaves.map((wave) => (
                  <TableRow key={wave.id}>
                    <TableCell className="font-medium">{wave.waveNumber}</TableCell>
                    <TableCell>{getStatusBadge(wave.status)}</TableCell>
                    <TableCell className="text-center">{wave.totalOrders}</TableCell>
                    <TableCell className="text-center">{wave.totalItems}</TableCell>
                    <TableCell className="text-center">{wave.totalQuantity}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {wave.pickingRule === "FIFO" ? "FIFO" : wave.pickingRule === "FEFO" ? "FEFO" : "Dirigido"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(wave.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/waves/${wave.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // TODO: Implementar impressão
                            console.log("Imprimir onda", wave.id);
                          }}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
