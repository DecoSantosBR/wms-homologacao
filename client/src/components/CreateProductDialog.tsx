import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CreateProductDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    tenantId: "",
    sku: "",
    description: "",
    gtin: "",
    anvisaRegistry: "",
    therapeuticClass: "",
    manufacturer: "",
    unitsPerBox: "",
    storageCondition: "ambient" as "ambient" | "refrigerated_2_8" | "frozen_minus_20" | "controlled",
  });

  const { data: tenants } = trpc.tenants.list.useQuery();
  const utils = trpc.useUtils();
  
  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Produto cadastrado com sucesso!");
      utils.products.list.invalidate();
      setOpen(false);
      setFormData({
        tenantId: "",
        sku: "",
        description: "",
        gtin: "",
        anvisaRegistry: "",
        therapeuticClass: "",
        manufacturer: "",
        unitsPerBox: "",
        storageCondition: "ambient",
      });
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar produto: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tenantId) {
      toast.error("Selecione um cliente");
      return;
    }
    
    if (!formData.sku.trim()) {
      toast.error("SKU/Código Interno é obrigatório");
      return;
    }
    
    if (!formData.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }

    createMutation.mutate({
      tenantId: parseInt(formData.tenantId),
      sku: formData.sku,
      description: formData.description,
      gtin: formData.gtin || undefined,
      anvisaRegistry: formData.anvisaRegistry || undefined,
      therapeuticClass: formData.therapeuticClass || undefined,
      manufacturer: formData.manufacturer || undefined,
      unitsPerBox: formData.unitsPerBox ? parseInt(formData.unitsPerBox) : undefined,
      storageCondition: formData.storageCondition,
      requiresBatchControl: true,
      requiresExpiryControl: true,
      unitOfMeasure: "UN",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="h-4 w-4" />
          Novo Produto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Produto</DialogTitle>
            <DialogDescription>
              Preencha os dados do produto para cadastrá-lo no sistema
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tenantId">
                Cliente <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.tenantId} onValueChange={(value) => setFormData({ ...formData, tenantId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {tenants?.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id.toString()}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sku">
                  SKU / Código Interno <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Ex: 441000"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gtin">EAN / GTIN</Label>
                <Input
                  id="gtin"
                  value={formData.gtin}
                  onChange={(e) => setFormData({ ...formData, gtin: e.target.value })}
                  placeholder="Ex: 7891234567890"
                  maxLength={14}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">
                Descrição / Nome do Produto <span className="text-red-500">*</span>
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: DIPIRONA SÓDICA 500MG COM 10 COMPRIMIDOS"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="anvisaRegistry">Registro ANVISA</Label>
                <Input
                  id="anvisaRegistry"
                  value={formData.anvisaRegistry}
                  onChange={(e) => setFormData({ ...formData, anvisaRegistry: e.target.value })}
                  placeholder="Ex: 1.0000.0000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unitsPerBox">Quantidade por Caixa</Label>
                <Input
                  id="unitsPerBox"
                  type="number"
                  value={formData.unitsPerBox}
                  onChange={(e) => setFormData({ ...formData, unitsPerBox: e.target.value })}
                  placeholder="Ex: 50"
                  min="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="therapeuticClass">Classe Terapêutica</Label>
                <Input
                  id="therapeuticClass"
                  value={formData.therapeuticClass}
                  onChange={(e) => setFormData({ ...formData, therapeuticClass: e.target.value })}
                  placeholder="Ex: Analgésico"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="manufacturer">Fabricante</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="Ex: EMS Pharma"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="storageCondition">Condição de Armazenagem</Label>
              <Select
                value={formData.storageCondition}
                onValueChange={(value: any) => setFormData({ ...formData, storageCondition: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambient">Ambiente (15-30°C)</SelectItem>
                  <SelectItem value="refrigerated_2_8">Refrigerado (2-8°C)</SelectItem>
                  <SelectItem value="frozen_minus_20">Congelado (-20°C)</SelectItem>
                  <SelectItem value="controlled">Controlado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
