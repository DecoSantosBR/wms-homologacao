import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Wrench, Trash2, RefreshCw, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
type OrphanItem = {
  id: number;
  reason: string;
  labelCode: string | null;
  uniqueCode: string | null;
  locationZone: string | null;
  tenantId: number | null;
  quantity: number;
  createdAt: Date;
};

export default function Maintenance() {
  const [orphans, setOrphans] = useState<OrphanItem[]>([]);
  const [lastScanResult, setLastScanResult] = useState<{
    orphansFound: number;
    dryRun: boolean;
    deletedCount: number;
    scannedAt: Date;
  } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const cleanupMut = trpc.maintenance.cleanupOrphanInventory.useMutation({
    onSuccess: (data) => {
      setOrphans(data.orphans as OrphanItem[]);
      setLastScanResult({
        orphansFound: data.orphansFound,
        dryRun: data.dryRun,
        deletedCount: data.deletedCount,
        scannedAt: new Date(),
      });
      if (data.dryRun) {
        if (data.orphansFound === 0) {
          toast.success("Nenhum órfão encontrado — o inventário está consistente.");
        } else {
          toast.warning(`${data.orphansFound} registro(s) órfão(s) encontrado(s). Revise a lista abaixo.`);
        }
      } else {
        toast.success(`Limpeza concluída: ${data.deletedCount} registro(s) removido(s)`);
        setOrphans([]);
      }
    },
    onError: (err) => {
      toast.error(`Erro na limpeza: ${err.message}`);
    },
  });

  const syncMut = trpc.maintenance.syncReservations.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (err) => {
      toast.error(`Erro na sincronização: ${err.message}`);
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleScan = () => {
    cleanupMut.mutate({ dryRun: true });
  };

  const handleCleanup = () => {
    setConfirmDeleteOpen(false);
    cleanupMut.mutate({ dryRun: false });
  };

  const handleSync = () => {
    syncMut.mutate();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getZoneBadge = (zone: string | null) => {
    switch (zone) {
      case "NCG": return <Badge className="bg-yellow-500 text-red-700 border border-red-200">NCG</Badge>;
      case "REC": return <Badge className="bg-blue-500 hover:bg-blue-600">REC</Badge>;
      case "EXP": return <Badge className="bg-purple-500 hover:bg-purple-600">EXP</Badge>;
      default: return <Badge variant="outline">{zone ?? "—"}</Badge>;
    }
  };

  return (
    <div className="min-h-screen">
      <PageHeader
        icon={<Wrench className="h-8 w-8" />}
        title="Manutenção"
        description="Ferramentas de diagnóstico e limpeza do sistema"
      />

      <main className="container mx-auto px-6 py-8 space-y-6">

        {/* ── Card: Limpeza de Órfãos ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Limpeza de Registros Órfãos
            </CardTitle>
            <CardDescription>
              Identifica e remove registros de inventário inconsistentes: NCG sem não-conformidade
              correspondente, REC com quantidade zero, e registros com endereço ou produto inexistente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status do último scan */}
            {lastScanResult && (
              <div className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
                lastScanResult.orphansFound === 0
                  ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
              }`}>
                {lastScanResult.orphansFound === 0
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span>
                  {lastScanResult.dryRun
                    ? `Varredura em ${lastScanResult.scannedAt.toLocaleTimeString("pt-BR")}: ${lastScanResult.orphansFound} órfão(s) encontrado(s)`
                    : `Limpeza em ${lastScanResult.scannedAt.toLocaleTimeString("pt-BR")}: ${lastScanResult.deletedCount} registro(s) removido(s)`}
                </span>
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleScan}
                disabled={cleanupMut.isPending}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                {cleanupMut.isPending && !confirmDeleteOpen ? "Verificando..." : "Verificar Órfãos"}
              </Button>

              {orphans.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={cleanupMut.isPending}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir {orphans.length} Registro(s) Órfão(s)
                </Button>
              )}
            </div>

            {/* Tabela de órfãos encontrados */}
            {orphans.length > 0 && (
              <div className="rounded-md border overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Label Code</TableHead>
                      <TableHead>Unique Code</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orphans.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.id}</TableCell>
                        <TableCell>{getZoneBadge(item.locationZone)}</TableCell>
                        <TableCell className="font-mono text-xs">{item.labelCode ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{item.uniqueCode ?? "—"}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.tenantId ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(item.createdAt).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={item.reason}>
                          {item.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {lastScanResult && orphans.length === 0 && lastScanResult.orphansFound === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum registro órfão encontrado. O inventário está consistente.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Card: Sincronização de Reservas ─────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-400" />
              Sincronização de Reservas
            </CardTitle>
            <CardDescription>
              Recalcula o campo <code>reservedQuantity</code> em todos os registros de estoque com
              base nos pedidos de separação ativos. Corrige divergências causadas por falhas de
              transação ou cancelamentos sem rollback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncMut.isPending}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} />
              {syncMut.isPending ? "Sincronizando..." : "Sincronizar Reservas"}
            </Button>
          </CardContent>
        </Card>

      </main>

      {/* ── Diálogo de confirmação ─────────────────────────────────────────── */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão de {orphans.length} registro(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. Os registros órfãos serão permanentemente
              excluídos da tabela de inventário. Certifique-se de que a lista foi revisada antes de
              prosseguir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Registros
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
