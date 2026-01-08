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
import { MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CreateLocationDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    zoneId: "",
    tenantId: "",
    code: "",
    aisle: "",
    rack: "",
    level: "",
    position: "",
    locationType: "whole" as "whole" | "fraction",
    storageRule: "single" as "single" | "multi",
  });

  const { data: zones } = trpc.zones.list.useQuery();
  const { data: tenants } = trpc.tenants.list.useQuery();
  const utils = trpc.useUtils();
  
  const createMutation = trpc.locations.create.useMutation({
    onSuccess: () => {
      toast.success("Endereço cadastrado com sucesso!");
      utils.locations.list.invalidate();
      setOpen(false);
      setFormData({
        zoneId: "",
        tenantId: "",
        code: "",
        aisle: "",
        rack: "",
        level: "",
        position: "",
        locationType: "whole",
        storageRule: "single",
      });
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar endereço: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.zoneId) {
      toast.error("Selecione uma zona");
      return;
    }
    
    if (!formData.code.trim()) {
      toast.error("Código do endereço é obrigatório");
      return;
    }

    createMutation.mutate({
      zoneId: parseInt(formData.zoneId),
      tenantId: formData.tenantId ? parseInt(formData.tenantId) : undefined,
      code: formData.code,
      aisle: formData.aisle || undefined,
      rack: formData.rack || undefined,
      level: formData.level || undefined,
      position: formData.position || undefined,
      locationType: formData.locationType,
      storageRule: formData.storageRule,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="h-4 w-4" />
          Novo Endereço
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Cadastrar Novo Endereço
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do endereço de armazenagem
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="zoneId">
                Zona <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.zoneId} onValueChange={(value) => setFormData({ ...formData, zoneId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a zona" />
                </SelectTrigger>
                <SelectContent>
                  {zones?.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id.toString()}>
                      {zone.code} - {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tenantId">Cliente (Reserva)</Label>
              <Select value={formData.tenantId} onValueChange={(value) => setFormData({ ...formData, tenantId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Compartilhado (todos os clientes)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Compartilhado</SelectItem>
                  {tenants?.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id.toString()}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Deixe em branco para endereço compartilhado</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="code">
                Código do Endereço <span className="text-red-500">*</span>
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ex: A01-P01-N01"
                required
              />
              <p className="text-xs text-gray-500">Formato sugerido: RUA-PRÉDIO-ANDAR-QUADRANTE</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="aisle">Rua</Label>
                <Input
                  id="aisle"
                  value={formData.aisle}
                  onChange={(e) => setFormData({ ...formData, aisle: e.target.value.toUpperCase() })}
                  placeholder="Ex: A01"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rack">Prédio</Label>
                <Input
                  id="rack"
                  value={formData.rack}
                  onChange={(e) => setFormData({ ...formData, rack: e.target.value.toUpperCase() })}
                  placeholder="Ex: P01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="level">Andar</Label>
                <Input
                  id="level"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value.toUpperCase() })}
                  placeholder="Ex: N01"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="position">Quadrante</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value.toUpperCase() })}
                  placeholder="Ex: Q01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="locationType">Tipo de Endereço</Label>
                <Select
                  value={formData.locationType}
                  onValueChange={(value: any) => setFormData({ ...formData, locationType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole">Inteira (Whole)</SelectItem>
                    <SelectItem value="fraction">Fração (Fraction)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="storageRule">Regra de Armazenagem</Label>
                <Select
                  value={formData.storageRule}
                  onValueChange={(value: any) => setFormData({ ...formData, storageRule: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Único Item/Lote</SelectItem>
                    <SelectItem value="multi">Multi-Item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
