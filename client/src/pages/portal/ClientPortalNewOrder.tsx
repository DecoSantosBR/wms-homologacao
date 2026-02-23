import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import * as XLSX from "xlsx";

interface OrderItem {
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unit: "boxes" | "units";
}

export default function ClientPortalNewOrder() {
  const [, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path);
  // Toast já importado do sonner
  const [activeTab, setActiveTab] = useState("individual");

  // Estado do formulário individual
  const [orderNumber, setOrderNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<"boxes" | "units">("boxes");

  // Estado da importação
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Queries
  const { data: stockData } = trpc.clientPortal.stockPositions.useQuery({
    page: 1,
    pageSize: 1000,
  });
  
  // Extrair produtos únicos do estoque
  const productsMap = new Map();
  stockData?.items?.forEach((item: any) => {
    if (!productsMap.has(item.productId)) {
      productsMap.set(item.productId, {
        id: item.productId,
        sku: item.sku,
        description: item.productName,
      });
    }
  });
  const products = Array.from(productsMap.values());
  type Product = typeof products[number];
  const createOrderMutation = trpc.clientPortal.createPickingOrder.useMutation();
  const importOrdersMutation = trpc.clientPortal.importOrders.useMutation();

  // Adicionar item ao pedido
  const handleAddItem = () => {
    if (!selectedProductId || !quantity) {
      toast.error("Selecione um produto e informe a quantidade");
      return;
    }

    const product = products.find((p: Product) => p.id === parseInt(selectedProductId));
    if (!product) return;

    const newItem: OrderItem = {
      productId: product.id,
      sku: product.sku,
      productName: product.description,
      quantity: parseFloat(quantity),
      unit,
    };

    setItems([...items, newItem]);
    setSelectedProductId("");
    setQuantity("");
    setUnit("boxes");
  };

  // Remover item do pedido
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Criar pedido individual
  const handleCreateOrder = async () => {
    if (!orderNumber.trim()) {
      toast.error("Informe o número do pedido");
      return;
    }

    if (items.length === 0) {
      toast.error("O pedido deve conter pelo menos um produto");
      return;
    }

    try {
      await createOrderMutation.mutateAsync({
        sessionToken: "", // Será extraído do cookie automaticamente pelo backend
        customerOrderNumber: orderNumber,
        deliveryAddress: deliveryAddress || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          requestedQuantity: item.quantity,
          requestedUM: item.unit === "boxes" ? "box" as const : "unit" as const,
        })),
      });

      toast.success(`Pedido ${orderNumber} criado com sucesso`);

      navigate("/portal/pedidos");
    } catch (error: any) {
      toast.error(error.message || "Ocorreu um erro ao criar o pedido");
    }
  };

  // Importar pedidos via Excel
  const handleImportOrders = async () => {
    if (!importFile) {
      toast.error("Selecione um arquivo Excel para importar");
      return;
    }

    setIsImporting(true);

    try {
      const fileBuffer = await importFile.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const result = await importOrdersMutation.mutateAsync({
        fileData: JSON.stringify(data),
      });

      toast.success(`${result.success} pedidos importados com sucesso. ${result.errors?.length || 0} erros.`);

      if (result.errors && result.errors.length > 0) {
        console.error("Erros de importação:", result.errors);
      }

      if (typeof result.success === 'number' && result.success > 0) {
        navigate("/portal/pedidos");
      }
    } catch (error: any) {
      toast.error(error.message || "Ocorreu um erro ao importar os pedidos");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/portal/pedidos")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Pedidos
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Novo Pedido</h1>
          <p className="text-gray-600 mt-2">
            Crie um pedido individual ou importe múltiplos pedidos via Excel
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="importacao">Importação</TabsTrigger>
          </TabsList>

          {/* Aba Individual */}
          <TabsContent value="individual">
            <Card className="p-6">
              <div className="space-y-6">
                {/* Dados do Pedido */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="orderNumber">
                      Número do Pedido <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="orderNumber"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="Ex: PED-2026-001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deliveryAddress">Endereço de Entrega</Label>
                    <Input
                      id="deliveryAddress"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                {/* Adicionar Produtos */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Adicionar Produtos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="product">Produto</Label>
                      <Select
                        value={selectedProductId}
                        onValueChange={setSelectedProductId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product: Product) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.sku} - {product.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="quantity">Quantidade</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0"
                        min="0"
                        step="1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unit">Unidade</Label>
                      <Select value={unit} onValueChange={(v) => setUnit(v as any)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="boxes">Caixas</SelectItem>
                          <SelectItem value="units">Unidades</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleAddItem} className="w-full md:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Produto
                  </Button>
                </div>

                {/* Lista de Produtos */}
                {items.length > 0 && (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">
                      Produtos do Pedido ({items.length})
                    </h3>
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                          </div>
                          <div className="text-right mr-4">
                            <p className="font-semibold">
                              {item.quantity} {item.unit === "boxes" ? "caixas" : "unidades"}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex justify-end gap-4 border-t pt-6">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/portal/pedidos")}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateOrder}
                    disabled={createOrderMutation.isPending}
                  >
                    {createOrderMutation.isPending ? "Criando..." : "Criar Pedido"}
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Aba Importação */}
          <TabsContent value="importacao">
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Importar Pedidos via Excel
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Faça upload de um arquivo Excel (.xls ou .xlsx) contendo os pedidos.
                    O arquivo deve ter as colunas: Número do Pedido, SKU, Quantidade,
                    Unidade, Endereço de Entrega (opcional).
                  </p>
                </div>

                {/* Upload de Arquivo */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <div className="mb-4">
                    <Label
                      htmlFor="file-upload"
                      className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Clique para selecionar um arquivo
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".xls,.xlsx"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setImportFile(file);
                      }}
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      ou arraste e solte aqui
                    </p>
                  </div>
                  {importFile && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">
                        Arquivo selecionado: {importFile.name}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        {(importFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  )}
                </div>

                {/* Instruções */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-2">
                    Formato do Arquivo Excel
                  </h4>
                  <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                    <li>
                      <strong>Número do Pedido:</strong> Identificador único do pedido
                    </li>
                    <li>
                      <strong>SKU:</strong> Código do produto
                    </li>
                    <li>
                      <strong>Quantidade:</strong> Quantidade solicitada (número)
                    </li>
                    <li>
                      <strong>Unidade:</strong> "caixas" ou "unidades"
                    </li>
                    <li>
                      <strong>Endereço de Entrega:</strong> Opcional
                    </li>
                  </ul>
                </div>

                {/* Botões de Ação */}
                <div className="flex justify-end gap-4 border-t pt-6">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/portal/pedidos")}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImportOrders}
                    disabled={!importFile || isImporting}
                  >
                    {isImporting ? "Importando..." : "Importar Pedidos"}
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
