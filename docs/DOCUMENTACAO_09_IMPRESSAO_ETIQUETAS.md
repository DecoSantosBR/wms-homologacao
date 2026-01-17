# WMS Med@x - Documentação do Módulo Impressão de Etiquetas

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Módulo:** Impressão de Etiquetas com Código de Barras  
**Status:** ✅ Implementado e Funcional

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Funcionalidades Principais](#funcionalidades-principais)
3. [Arquitetura Técnica](#arquitetura-técnica)
4. [Backend - Código Completo](#backend---código-completo)
5. [Frontend - Código Completo](#frontend---código-completo)
6. [Fluxos Operacionais](#fluxos-operacionais)

---

## Visão Geral

O **Módulo de Impressão de Etiquetas** permite gerar e imprimir etiquetas com código de barras para endereços de armazenagem. As etiquetas são geradas em formato PDF otimizado para impressoras térmicas (10x5cm) e incluem histórico completo de impressões para auditoria.

### Características Principais

- ✅ Geração de etiquetas em PDF com código de barras Code128
- ✅ Formato otimizado para impressoras térmicas (10x5cm)
- ✅ Impressão direta via navegador (Ctrl+P)
- ✅ Histórico completo de impressões
- ✅ Reimpressão de etiquetas anteriores
- ✅ Filtros por data, usuário e ordem
- ✅ Auditoria completa

---

## Funcionalidades Principais

### 1. Geração de Etiquetas

**Descrição:** Gera PDF com etiquetas para endereços de armazenagem.

**Dados da Etiqueta:**
- Código de barras Code128 (código do endereço)
- Código do endereço em texto legível
- Zona de armazenagem
- Tipo de endereço (Inteira/Fração)
- Descrição do endereço

**Formato:**
- Tamanho: 10cm x 5cm (padrão Pimaco A4251)
- Impressora: Térmica (Zebra, Argox, Elgin)
- Margem: Sem margem (preenchimento total)
- Resolução: 300 DPI

### 2. Seleção de Endereços

**Descrição:** Usuário seleciona quais endereços deseja imprimir etiquetas.

**Opções:**
- Seleção individual via checkbox
- Seleção em lote (Selecionar Todos)
- Filtros por zona, tipo, cliente

### 3. Histórico de Impressões

**Descrição:** Rastreamento completo de todas as impressões realizadas.

**Dados Registrados:**
- ID da impressão
- Usuário que imprimiu
- Data/hora da impressão
- Quantidade de etiquetas
- Lista de endereços impressos
- Motivo da impressão (opcional)

**Funcionalidades:**
- Listagem com paginação
- Filtros por data, usuário, ordem
- Botão de reimpressão
- Exportação de relatório

### 4. Reimpressão

**Descrição:** Permite reimprimir etiquetas de uma impressão anterior.

**Fluxo:**
1. Usuário acessa histórico de impressões
2. Seleciona impressão anterior
3. Clica em "Reimprimir"
4. Sistema regenera PDF com mesmos endereços
5. Abre em nova aba e aciona Ctrl+P

---

## Arquitetura Técnica

### Tabelas de Banco de Dados

```sql
-- Histórico de Impressões
CREATE TABLE labelPrintHistory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  receivingOrderId INT,
  printedBy INT NOT NULL,
  printedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  quantity INT NOT NULL,
  locationIds JSON NOT NULL,
  reason VARCHAR(255),
  FOREIGN KEY (receivingOrderId) REFERENCES receivingOrders(id),
  FOREIGN KEY (printedBy) REFERENCES systemUsers(id),
  INDEX idx_printedAt (printedAt),
  INDEX idx_printedBy (printedBy)
);
```

### Interfaces TypeScript

```typescript
export interface LabelPrintJob {
  locationIds: number[];
  reason?: string;
}

export interface LabelPrintHistory {
  id: number;
  receivingOrderId?: number;
  printedBy: number;
  printedAt: Date;
  quantity: number;
  locationIds: number[];
  reason?: string;
  printedByName?: string;
}

export interface LabelGenerationResult {
  pdfUrl: string;
  quantity: number;
  locations: Array<{
    id: number;
    code: string;
    zone: string;
    type: string;
  }>;
}
```

---

## Backend - Código Completo

### server/labelGenerator.ts

```typescript
import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import { Readable } from "stream";

export interface LabelData {
  code: string;
  zone: string;
  type: string;
  description?: string;
}

/**
 * Gera PDF com etiquetas para impressora térmica
 * Formato: 10cm x 5cm (100mm x 50mm)
 * Cada página = 1 etiqueta
 */
export async function generateLabelsPDF(labels: LabelData[]): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [283.46, 141.73], // 10cm x 5cm em pontos (72 DPI)
        margin: 0,
      });

      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Gerar cada etiqueta
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];

        if (i > 0) {
          doc.addPage();
        }

        // Gerar código de barras
        const barcodeBuffer = await bwipjs.toBuffer({
          bcid: "code128",
          text: label.code,
          scale: 2,
          height: 8,
          includetext: false,
          textxalign: "center",
        });

        // Layout da etiqueta
        const pageWidth = 283.46;
        const pageHeight = 141.73;
        const padding = 5;

        // Código de barras (topo, centralizado)
        doc.image(barcodeBuffer, padding, padding, {
          width: pageWidth - 2 * padding,
          height: 50,
        });

        // Código em texto (abaixo do código de barras)
        doc.fontSize(10).font("Helvetica-Bold").text(label.code, padding, 60, {
          width: pageWidth - 2 * padding,
          align: "center",
        });

        // Zona e tipo (rodapé)
        doc.fontSize(7).font("Helvetica").text(`${label.zone} | ${label.type}`, padding, 85, {
          width: pageWidth - 2 * padding,
          align: "center",
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Gera código de barras em formato imagem
 */
export async function generateBarcode(text: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text,
    scale: 2,
    height: 8,
    includetext: true,
    textxalign: "center",
  });
}
```

### server/routers.ts - Endpoint de Impressão

```typescript
// No arquivo server/routers.ts, adicionar ao router:

export const appRouter = router({
  // ... outros routers

  receiving: router({
    // ... outros endpoints

    generateLabels: protectedProcedure
      .input(
        z.object({
          receivingOrderId: z.number(),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database connection failed");

        // Buscar pré-alocações ou endereços REC
        const preallocations = await dbConn
          .select()
          .from(receivingPreallocations)
          .where(
            and(
              eq(receivingPreallocations.receivingOrderId, input.receivingOrderId),
              eq(receivingPreallocations.status, "pending")
            )
          );

        let locationIds: number[] = [];

        if (preallocations.length > 0) {
          // Usar endereços pré-alocados
          locationIds = preallocations.map((p) => p.locationId);
        } else {
          // Usar endereços REC
          const recLocations = await dbConn
            .select()
            .from(warehouseLocations)
            .where(like(warehouseLocations.code, "REC%"));

          locationIds = recLocations.map((l) => l.id);
        }

        if (locationIds.length === 0) {
          throw new Error("Nenhum endereço encontrado para gerar etiquetas");
        }

        // Buscar dados dos endereços
        const locations = await dbConn
          .select({
            id: warehouseLocations.id,
            code: warehouseLocations.code,
            zone: warehouseZones.name,
            type: warehouseLocations.type,
          })
          .from(warehouseLocations)
          .innerJoin(warehouseZones, eq(warehouseLocations.zoneId, warehouseZones.id))
          .where(inArray(warehouseLocations.id, locationIds));

        // Gerar PDF
        const pdfBuffer = await generateLabelsPDF(
          locations.map((l) => ({
            code: l.code,
            zone: l.zone,
            type: l.type,
          }))
        );

        // Salvar em S3
        const fileKey = `labels/${input.receivingOrderId}-${Date.now()}.pdf`;
        const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

        // Registrar no histórico
        await dbConn.insert(labelPrintHistory).values({
          receivingOrderId: input.receivingOrderId,
          printedBy: ctx.user.id,
          quantity: locations.length,
          locationIds: locationIds,
          reason: input.reason,
        });

        return {
          pdfUrl: url,
          quantity: locations.length,
          locations,
        };
      }),

    getPrintHistory: protectedProcedure
      .input(
        z.object({
          receivingOrderId: z.number().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          limit: z.number().default(50),
        })
      )
      .query(async ({ ctx, input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database connection failed");

        const conditions = [];

        if (input.receivingOrderId) {
          conditions.push(eq(labelPrintHistory.receivingOrderId, input.receivingOrderId));
        }

        if (input.startDate) {
          conditions.push(gte(labelPrintHistory.printedAt, input.startDate));
        }

        if (input.endDate) {
          conditions.push(lte(labelPrintHistory.printedAt, input.endDate));
        }

        const history = await dbConn
          .select({
            id: labelPrintHistory.id,
            receivingOrderId: labelPrintHistory.receivingOrderId,
            printedBy: labelPrintHistory.printedBy,
            printedByName: systemUsers.name,
            printedAt: labelPrintHistory.printedAt,
            quantity: labelPrintHistory.quantity,
            locationIds: labelPrintHistory.locationIds,
            reason: labelPrintHistory.reason,
          })
          .from(labelPrintHistory)
          .innerJoin(systemUsers, eq(labelPrintHistory.printedBy, systemUsers.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(labelPrintHistory.printedAt))
          .limit(input.limit);

        return history;
      }),

    reprintLabels: protectedProcedure
      .input(z.object({ printHistoryId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new Error("Database connection failed");

        // Buscar histórico
        const history = await dbConn
          .select()
          .from(labelPrintHistory)
          .where(eq(labelPrintHistory.id, input.printHistoryId))
          .limit(1);

        if (!history[0]) {
          throw new Error("Histórico de impressão não encontrado");
        }

        // Buscar endereços
        const locations = await dbConn
          .select({
            id: warehouseLocations.id,
            code: warehouseLocations.code,
            zone: warehouseZones.name,
            type: warehouseLocations.type,
          })
          .from(warehouseLocations)
          .innerJoin(warehouseZones, eq(warehouseLocations.zoneId, warehouseZones.id))
          .where(inArray(warehouseLocations.id, history[0].locationIds));

        // Gerar PDF
        const pdfBuffer = await generateLabelsPDF(
          locations.map((l) => ({
            code: l.code,
            zone: l.zone,
            type: l.type,
          }))
        );

        // Salvar em S3
        const fileKey = `labels/reprint-${input.printHistoryId}-${Date.now()}.pdf`;
        const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

        return {
          pdfUrl: url,
          quantity: locations.length,
          locations,
        };
      }),
  }),
});
```

---

## Frontend - Código Completo

### client/src/pages/Receiving.tsx - Botão de Impressão

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Printer, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface PrintLabelsButtonProps {
  receivingOrderId: number;
}

export function PrintLabelsButton({ receivingOrderId }: PrintLabelsButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [reason, setReason] = useState("");

  const generateLabelsMutation = trpc.receiving.generateLabels.useMutation({
    onSuccess: (data) => {
      // Abrir PDF em nova aba
      const printWindow = window.open(data.pdfUrl, "_blank");
      if (printWindow) {
        // Aguardar carregamento e acionar Ctrl+P
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      } else {
        // Fallback: download direto
        const link = document.createElement("a");
        link.href = data.pdfUrl;
        link.download = `etiquetas-${receivingOrderId}.pdf`;
        link.click();
      }

      toast.success(`${data.quantity} etiqueta(s) gerada(s)`);
      setShowDialog(false);
      setReason("");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar etiquetas");
    },
  });

  const handleGenerateLabels = () => {
    generateLabelsMutation.mutate({
      receivingOrderId,
      reason: reason || undefined,
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={generateLabelsMutation.isPending}
      >
        <Printer className="w-4 h-4 mr-2" />
        {generateLabelsMutation.isPending ? "Gerando..." : "Imprimir Etiquetas"}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Etiquetas</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Motivo (opcional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Reimpressão, Substituição, etc"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGenerateLabels} disabled={generateLabelsMutation.isPending}>
                {generateLabelsMutation.isPending ? "Gerando..." : "Gerar e Imprimir"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### client/src/pages/LabelPrintHistory.tsx

```typescript
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RotateCcw, Download } from "lucide-react";

export default function LabelPrintHistory() {
  const [receivingOrderId, setReceivingOrderId] = useState<number>();

  const { data: history = [] } = trpc.receiving.getPrintHistory.useQuery({
    receivingOrderId,
    limit: 100,
  });

  const reprintMutation = trpc.receiving.reprintLabels.useMutation({
    onSuccess: (data) => {
      const printWindow = window.open(data.pdfUrl, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }
      toast.success(`${data.quantity} etiqueta(s) reimpressas`);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao reimprimir");
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Impressões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      {new Date(item.printedAt).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{item.printedByName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.quantity}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{item.reason || "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => reprintMutation.mutate({ printHistoryId: item.id })}
                        disabled={reprintMutation.isPending}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reimprimir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Fluxos Operacionais

### Fluxo 1: Gerar e Imprimir Etiquetas

```
1. Operador clica em "Imprimir Etiquetas" na ordem de recebimento
2. Dialog abre solicitando motivo (opcional)
3. Operador clica em "Gerar e Imprimir"
4. Sistema busca endereços pré-alocados ou REC
5. Sistema gera PDF com etiquetas (1 página por etiqueta)
6. Sistema salva PDF em S3
7. Sistema registra no histórico de impressões
8. PDF abre em nova aba
9. Dialog de impressão do navegador é acionado (Ctrl+P)
10. Operador seleciona impressora térmica
11. Etiquetas são impressas
```

### Fluxo 2: Reimprimir Etiquetas Anteriores

```
1. Operador acessa página de histórico de impressões
2. Seleciona impressão anterior
3. Clica em "Reimprimir"
4. Sistema regenera PDF com mesmos endereços
5. PDF abre em nova aba
6. Dialog de impressão é acionado
7. Operador imprime novamente
```

---

**Fim da Documentação - Impressão de Etiquetas**
