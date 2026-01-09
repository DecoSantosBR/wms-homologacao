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
import { useEffect } from "react";

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

  // Gerar código automaticamente quando preencher rua, prédio, andar e quadrante
  useEffect(() => {
    const { aisle, rack, level, position, locationType } = formData;
    
    if (aisle && rack && level) {
      let generatedCode = "";
      
      if (locationType === "whole") {
        // Formato: T01-01-01 (andar com 2 dígitos)
        generatedCode = `${aisle}-${rack}-${level}`;
      } else if (locationType === "fraction" && position) {
        // Formato: T01-01-1A (andar com 1 dígito + letra do quadrante)
        generatedCode = `${aisle}-${rack}-${level}${position}`;
      }
      
      if (generatedCode && generatedCode !== formData.code) {
        setFormData(prev => ({ ...prev, code: generatedCode }));
      }
    }
  }, [formData.aisle, formData.rack, formData.level, formData.position, formData.locationType]);

  const validateLocationCode = () => {
    const { code, locationType, position } = formData;
    
    if (!code.trim()) {
      return "Código do endereço é obrigatório";
    }
    
    // Regex para validação
    const wholeRegex = /^[A-Z]\d{2}-\d{2}-\d{2}$/; // Ex: T01-01-01
    const fractionRegex = /^[A-Z]\d{2}-\d{2}-\d[A-Z]$/; // Ex: T01-01-1A
    
    if (locationType === "whole") {
      if (!wholeRegex.test(code)) {
        return "Código inválido para endereço Inteiro. Formato esperado: RUA-PRÉDIO-ANDAR (ex: T01-01-01)";
      }
    } else if (locationType === "fraction") {
      if (!fractionRegex.test(code)) {
        return "Código inválido para endereço Fração. Formato esperado: RUA-PRÉDIO-ANDAR+QUADRANTE (ex: T01-01-1A)";
      }
      
      // Validar quadrante (A, B, C, D)
      const quadrant = code.slice(-1);
      if (!["A", "B", "C", "D"].includes(quadrant)) {
        return "Quadrante inválido. Valores permitidos: A, B, C, D";
      }
      
      if (!position) {
        return "Quadrante é obrigatório para endereços do tipo Fração";
      }
    }
    
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.zoneId) {
      toast.error("Selecione uma zona");
      return;
    }
    
    const codeError = validateLocationCode();
    if (codeError) {
      toast.error(codeError);
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
        <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 py-2">
          <Plus className="h-4 w-4" />
          Novo Endereço
        </button>
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
                placeholder="Ex: T01-01-01 (Inteira) ou T01-01-1A (Fração)"
                required
                readOnly
              />
              <p className="text-xs text-gray-500">Código gerado automaticamente ao preencher Rua, Prédio, Andar e Quadrante</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="aisle">Rua</Label>
                <Input
                  id="aisle"
                  value={formData.aisle}
                  onChange={(e) => setFormData({ ...formData, aisle: e.target.value.toUpperCase() })}
                  placeholder="Ex: T01"
                />
                <p className="text-xs text-gray-500">Formato: Letra + 2 dígitos (ex: T01)</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rack">Prédio</Label>
                <Input
                  id="rack"
                  value={formData.rack}
                  onChange={(e) => setFormData({ ...formData, rack: e.target.value.toUpperCase() })}
                  placeholder="Ex: 01"
                />
                <p className="text-xs text-gray-500">Formato: 2 dígitos (ex: 01)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="level">Andar</Label>
                <Input
                  id="level"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value.toUpperCase() })}
                  placeholder={formData.locationType === "whole" ? "Ex: 01" : "Ex: 1"}
                />
                <p className="text-xs text-gray-500">
                  {formData.locationType === "whole" ? "Formato: 2 dígitos (ex: 01)" : "Formato: 1 dígito (ex: 1)"}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="position">Quadrante</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value.toUpperCase() })}
                  placeholder="Ex: A"
                  disabled={formData.locationType === "whole"}
                />
                <p className="text-xs text-gray-500">
                  {formData.locationType === "fraction" 
                    ? "Obrigatório para Fração. Valores: A, B, C, D" 
                    : "Não aplicável para Inteira"}
                </p>
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
