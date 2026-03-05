import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit2,
  ArrowRightLeft,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

// ============================================================================
// ABA 1: ALIASES DE UNIDADES
// ============================================================================
function AliasesTab() {
  const { user } = useAuth();
  const tenantId = (user as any)?.tenantId ?? 1;
  const utils = trpc.useUtils();

  const { data: aliases = [], isLoading } = trpc.unitConversion.listAliases.useQuery({ tenantId });
  const { data: levels = [] } = trpc.unitConversion.getPackagingLevels.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ alias: "", targetCode: "" });

  const createMutation = trpc.unitConversion.createAlias.useMutation({
    onSuccess: () => {
      utils.unitConversion.listAliases.invalidate();
      setDialogOpen(false);
      setForm({ alias: "", targetCode: "" });
      toast.success("Alias criado com sucesso.");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.unitConversion.updateAlias.useMutation({
    onSuccess: () => {
      utils.unitConversion.listAliases.invalidate();
      setDialogOpen(false);
      setEditId(null);
      setForm({ alias: "", targetCode: "" });
      toast.success("Alias atualizado.");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.unitConversion.deleteAlias.useMutation({
    onSuccess: () => {
      utils.unitConversion.listAliases.invalidate();
      toast.success("Alias removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setForm({ alias: "", targetCode: "" });
    setDialogOpen(true);
  }

  function openEdit(a: { id: number; alias: string; targetCode: string }) {
    setEditId(a.id);
    setForm({ alias: a.alias, targetCode: a.targetCode });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.alias || !form.targetCode) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, alias: form.alias, targetCode: form.targetCode });
    } else {
      createMutation.mutate({ tenantId, alias: form.alias, targetCode: form.targetCode });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mapeie textos do XML da NF-e para os códigos normalizados do sistema.
          Ex: <code className="bg-muted px-1 rounded text-xs">PÇ</code> →{" "}
          <code className="bg-muted px-1 rounded text-xs">UN</code>
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo Alias
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Texto do XML (alias)</TableHead>
            <TableHead>Código Normalizado</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                Carregando...
              </TableCell>
            </TableRow>
          ) : aliases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                Nenhum alias cadastrado. Os aliases padrão do sistema estão ativos.
              </TableCell>
            </TableRow>
          ) : (
            aliases.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">{a.alias}</code>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{a.targetCode}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate({ id: a.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Alias" : "Novo Alias"}</DialogTitle>
            <DialogDescription>
              Mapeie um texto do XML para o código normalizado correspondente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Texto do XML (alias)</Label>
              <Input
                placeholder="Ex: PÇ, CAIXA, FD..."
                value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <Label>Código Normalizado</Label>
              <Select value={form.targetCode} onValueChange={(v) => setForm({ ...form, targetCode: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.code} — {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// ABA 2: FATORES DE CONVERSÃO
// ============================================================================
function ConversionsTab() {
  const { user } = useAuth();
  const tenantId = (user as any)?.tenantId ?? 1;
  const utils = trpc.useUtils();

  const { data: conversions = [], isLoading } = trpc.unitConversion.listConversions.useQuery({ tenantId });
  const { data: levels = [] } = trpc.unitConversion.getPackagingLevels.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    productId: "",
    unitCode: "",
    factorToBase: "",
    roundingStrategy: "round" as "floor" | "ceil" | "round",
    notes: "",
  });

  const upsertMutation = trpc.unitConversion.upsertConversion.useMutation({
    onSuccess: () => {
      utils.unitConversion.listConversions.invalidate();
      setDialogOpen(false);
      setForm({ productId: "", unitCode: "", factorToBase: "", roundingStrategy: "round", notes: "" });
      toast.success("Fator de conversão salvo.");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.unitConversion.deleteConversion.useMutation({
    onSuccess: () => {
      utils.unitConversion.listConversions.invalidate();
      toast.success("Fator removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = conversions.filter(
    (c) =>
      !search ||
      c.productSku?.toLowerCase().includes(search.toLowerCase()) ||
      c.productDescription?.toLowerCase().includes(search.toLowerCase()) ||
      c.unitCode.toLowerCase().includes(search.toLowerCase())
  );

  function handleSave() {
    if (!form.productId || !form.unitCode || !form.factorToBase) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    upsertMutation.mutate({
      tenantId,
      productId: parseInt(form.productId),
      unitCode: form.unitCode,
      factorToBase: parseFloat(form.factorToBase),
      roundingStrategy: form.roundingStrategy,
      notes: form.notes || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por SKU ou descrição..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Fator
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto (SKU)</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Fator → UN</TableHead>
            <TableHead>Arredondamento</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Carregando...
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhum fator de conversão cadastrado.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-sm">{c.productSku ?? c.productId}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                  {c.productDescription ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{c.unitCode}</Badge>
                </TableCell>
                <TableCell className="font-semibold">
                  × {parseFloat(String(c.factorToBase)).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.roundingStrategy}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate({ id: c.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fator de Conversão</DialogTitle>
            <DialogDescription>
              Define quantas unidades base (UN) equivalem a 1 unidade da embalagem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ID do Produto *</Label>
              <Input
                type="number"
                placeholder="Ex: 42"
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Consulte o ID do produto na tela de Cadastro de Produtos.
              </p>
            </div>
            <div>
              <Label>Unidade de Embalagem *</Label>
              <Select value={form.unitCode} onValueChange={(v) => setForm({ ...form, unitCode: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {levels.filter((l) => l.code !== "UN").map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.code} — {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fator para UN *</Label>
              <Input
                type="number"
                step="0.000001"
                placeholder="Ex: 12 (1 CX = 12 UN)"
                value={form.factorToBase}
                onChange={(e) => setForm({ ...form, factorToBase: e.target.value })}
              />
            </div>
            <div>
              <Label>Estratégia de Arredondamento</Label>
              <Select
                value={form.roundingStrategy}
                onValueChange={(v) => setForm({ ...form, roundingStrategy: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round">round — arredondamento padrão (≥0.5 sobe)</SelectItem>
                  <SelectItem value="floor">floor — sempre arredonda para baixo</SelectItem>
                  <SelectItem value="ceil">ceil — sempre arredonda para cima</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                placeholder="Ex: Caixa master com 12 unidades conforme embalagem do fornecedor X"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// ABA 3: FILA DE PENDÊNCIAS
// ============================================================================
function PendingQueueTab() {
  const { user } = useAuth();
  const tenantId = (user as any)?.tenantId ?? 1;
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter] = useState<"pending" | "resolved" | "ignored" | undefined>("pending");

  const { data: queue = [], isLoading } = trpc.unitConversion.listPendingQueue.useQuery({
    tenantId,
    status: statusFilter,
  });

  const resolveMutation = trpc.unitConversion.resolvePending.useMutation({
    onSuccess: () => {
      utils.unitConversion.listPendingQueue.invalidate();
      toast.success("Item atualizado.");
    },
    onError: (e) => toast.error(e.message),
  });

  const reasonLabels: Record<string, string> = {
    no_alias: "Alias não mapeado",
    no_conversion: "Fator não cadastrado",
    new_product: "Produto novo",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          NF-es bloqueadas por falta de mapeamento de unidade ou fator de conversão.
        </p>
        <Select
          value={statusFilter ?? "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? undefined : (v as any))}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="resolved">Resolvidos</SelectItem>
            <SelectItem value="ignored">Ignorados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>NF-e</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead>Unidade XML</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-32">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Carregando...
              </TableCell>
            </TableRow>
          ) : queue.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                Nenhuma pendência encontrada.
              </TableCell>
            </TableRow>
          ) : (
            queue.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-sm">
                  <div className="font-medium">{item.nfeNumber ?? "—"}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate max-w-32">
                    {item.nfeKey ?? "—"}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-mono">{item.productCode}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-48">
                    {item.productDescription ?? "—"}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">{item.xmlUnit}</code>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {reasonLabels[item.reason] ?? item.reason}
                  </Badge>
                </TableCell>
                <TableCell>
                  {item.status === "pending" && (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                  {item.status === "resolved" && (
                    <Badge className="bg-emerald-100 text-emerald-700">Resolvido</Badge>
                  )}
                  {item.status === "ignored" && (
                    <Badge variant="outline" className="text-muted-foreground">Ignorado</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {item.status === "pending" && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-emerald-600"
                        title="Marcar como resolvido"
                        onClick={() => resolveMutation.mutate({ id: item.id, action: "resolved" })}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        title="Ignorar"
                        onClick={() => resolveMutation.mutate({ id: item.id, action: "ignored" })}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================
export default function UnitConversion() {
  const { data: levels = [] } = trpc.unitConversion.getPackagingLevels.useQuery();
  const { data: pendingQueue = [] } = trpc.unitConversion.listPendingQueue.useQuery({ status: "pending" });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-blue-600" />
          Unidades de Medida
        </h1>
        <p className="text-muted-foreground mt-1">
          Motor de Conversão Dinâmico — mapeie unidades do XML da NF-e e defina fatores de conversão por produto.
        </p>
      </div>

      {/* Níveis de embalagem */}
      <div className="grid grid-cols-5 gap-3">
        {levels.map((l) => (
          <Card key={l.code} className="text-center py-3">
            <CardContent className="p-0">
              <div className="text-2xl font-bold text-blue-600">{l.code}</div>
              <div className="text-xs text-muted-foreground">{l.name}</div>
              <div className="text-xs text-muted-foreground">Rank {l.rank}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerta de pendências */}
      {pendingQueue.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{pendingQueue.length} NF-e(s)</strong> com unidades não mapeadas aguardando resolução.
              Acesse a aba <strong>Fila de Pendências</strong> para resolver.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Abas */}
      <Tabs defaultValue="aliases">
        <TabsList>
          <TabsTrigger value="aliases">
            <Package className="h-4 w-4 mr-1" />
            Aliases de Unidades
          </TabsTrigger>
          <TabsTrigger value="conversions">
            <ArrowRightLeft className="h-4 w-4 mr-1" />
            Fatores de Conversão
          </TabsTrigger>
          <TabsTrigger value="pending">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Fila de Pendências
            {pendingQueue.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                {pendingQueue.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aliases" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Aliases de Unidades</CardTitle>
              <CardDescription>
                Mapeie textos do XML da NF-e para os códigos normalizados do sistema.
                Os aliases padrão (UN, CX, FD, PCT, PL) já estão ativos sem necessidade de cadastro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AliasesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Fatores de Conversão por Produto</CardTitle>
              <CardDescription>
                Define quantas unidades base (UN) equivalem a 1 unidade de cada embalagem para cada produto.
                Ex: 1 CX do Produto A = 12 UN.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConversionsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Fila de Pendências</CardTitle>
              <CardDescription>
                NF-es com unidades não mapeadas ou sem fator de conversão cadastrado.
                Após resolver o mapeamento, reimporte a NF-e.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingQueueTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
