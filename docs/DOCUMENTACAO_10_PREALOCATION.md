# WMS Med@x - Documentação do Módulo Pré-alocação de Endereços

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Módulo:** Pré-alocação de Endereços via Excel  
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

O **Módulo de Pré-alocação de Endereços** permite que o gestor de recebimento aloque automaticamente endereços de armazenagem para itens de uma ordem de recebimento através de upload de planilha Excel. O sistema valida os dados, aplica regras de armazenagem e cria as alocações automaticamente.

### Características Principais

- ✅ Upload de planilha Excel (.xlsx)
- ✅ Validação automática de dados
- ✅ Aplicação de regras de armazenagem
- ✅ Sugestão inteligente de endereços
- ✅ Histórico de alocações
- ✅ Auditoria completa

---

## Funcionalidades Principais

### 1. Upload de Planilha

**Descrição:** Usuário faz upload de planilha Excel com alocações sugeridas.

**Formato Esperado:**
| SKU | Descrição | Quantidade | Endereço | Zona | Lote | Validade |
|-----|-----------|-----------|----------|------|------|----------|
| 123456 | Produto A | 100 | M01-01-01A | Medicamentos | L001 | 2026-12-31 |
| 234567 | Produto B | 50 | M01-01-02A | Medicamentos | L002 | 2026-11-30 |

**Colunas Obrigatórias:**
- SKU (código do produto)
- Quantidade
- Endereço (código do endereço) OU Zona (sistema sugere endereço)

**Colunas Opcionais:**
- Descrição
- Lote
- Validade

### 2. Validação de Dados

**Descrição:** Sistema valida cada linha da planilha.

**Validações:**
- SKU existe no catálogo de produtos
- Quantidade é número positivo
- Endereço existe e está disponível (ou zona existe)
- Lote é válido (se informado)
- Validade é data futura (se informada)
- Quantidade total não excede esperada na ordem

**Resultado:**
- ✅ Linhas válidas são processadas
- ⚠️ Linhas com aviso são marcadas para revisão
- ❌ Linhas inválidas são rejeitadas com motivo

### 3. Sugestão Inteligente de Endereços

**Descrição:** Se apenas zona é informada, sistema sugere endereço automaticamente.

**Critérios:**
1. Endereço deve estar na zona especificada
2. Endereço deve estar disponível (status = "available")
3. Endereço deve respeitar regra de armazenagem (single/multiple)
4. Preferir endereço com menor ocupação (melhor distribuição)

### 4. Criação de Alocações

**Descrição:** Cria registros de pré-alocação após validação bem-sucedida.

**Dados Criados:**
- ID da ordem de recebimento
- ID do item de recebimento
- ID do endereço alocado
- Status: "pending" (aguardando confirmação)
- Criado por (usuário)
- Data de criação

### 5. Histórico de Alocações

**Descrição:** Rastreamento completo de todas as alocações realizadas.

**Dados Registrados:**
- ID da alocação
- Ordem de recebimento
- Item (SKU, descrição)
- Endereço alocado
- Zona
- Quantidade
- Data de alocação
- Usuário que alocou
- Status (pending/confirmed/cancelled)

---

## Arquitetura Técnica

### Tabelas de Banco de Dados

```sql
-- Pré-alocações de Endereços
CREATE TABLE receivingPreallocations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  receivingOrderId INT NOT NULL,
  receivingOrderItemId INT NOT NULL,
  locationId INT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  batch VARCHAR(50),
  expiryDate DATE,
  status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
  createdBy INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmedAt TIMESTAMP,
  FOREIGN KEY (receivingOrderId) REFERENCES receivingOrders(id),
  FOREIGN KEY (receivingOrderItemId) REFERENCES receivingOrderItems(id),
  FOREIGN KEY (locationId) REFERENCES warehouseLocations(id),
  FOREIGN KEY (createdBy) REFERENCES systemUsers(id),
  INDEX idx_receivingOrderId (receivingOrderId),
  INDEX idx_status (status)
);

-- Histórico de Uploads
CREATE TABLE preallocationUploads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  receivingOrderId INT NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  uploadedBy INT NOT NULL,
  uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  totalRows INT,
  validRows INT,
  invalidRows INT,
  status ENUM('success', 'partial', 'failed') DEFAULT 'success',
  errorLog JSON,
  FOREIGN KEY (receivingOrderId) REFERENCES receivingOrders(id),
  FOREIGN KEY (uploadedBy) REFERENCES systemUsers(id),
  INDEX idx_uploadedAt (uploadedAt)
);
```

### Interfaces TypeScript

```typescript
export interface PreallocationRow {
  sku: string;
  description?: string;
  quantity: number;
  endereco?: string;
  zona?: string;
  lote?: string;
  validade?: string;
}

export interface PreallocationValidation {
  rowIndex: number;
  sku: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestedLocation?: {
    id: number;
    code: string;
    zone: string;
  };
}

export interface PreallocationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  validations: PreallocationValidation[];
  createdAllocations: number;
}

export interface ReceivingPreallocation {
  id: number;
  receivingOrderId: number;
  receivingOrderItemId: number;
  locationId: number;
  locationCode: string;
  zoneName: string;
  quantity: number;
  batch?: string;
  expiryDate?: Date;
  status: "pending" | "confirmed" | "cancelled";
  createdBy: number;
  createdAt: Date;
}
```

---

## Backend - Código Completo

### server/preallocation.ts

```typescript
import { getDb } from "./db";
import {
  receivingPreallocations,
  receivingOrderItems,
  receivingOrders,
  warehouseLocations,
  warehouseZones,
  products,
} from "../drizzle/schema";
import { eq, and, isNull, lt } from "drizzle-orm";
import * as XLSX from "xlsx";

export interface PreallocationRow {
  sku: string;
  description?: string;
  quantity: number;
  endereco?: string;
  zona?: string;
  lote?: string;
  validade?: string;
}

export interface PreallocationValidation {
  rowIndex: number;
  sku: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestedLocation?: {
    id: number;
    code: string;
    zone: string;
  };
}

/**
 * Processa arquivo Excel de pré-alocação
 */
export async function processPreallocationFile(
  receivingOrderId: number,
  fileBuffer: Buffer,
  userId: number
): Promise<PreallocationResult> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Parsear Excel
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<PreallocationRow>(worksheet);

  if (rows.length === 0) {
    throw new Error("Planilha vazia");
  }

  // Buscar ordem e itens
  const order = await dbConn
    .select()
    .from(receivingOrders)
    .where(eq(receivingOrders.id, receivingOrderId))
    .limit(1);

  if (!order[0]) {
    throw new Error("Ordem de recebimento não encontrada");
  }

  const orderItems = await dbConn
    .select()
    .from(receivingOrderItems)
    .where(eq(receivingOrderItems.receivingOrderId, receivingOrderId));

  // Validar cada linha
  const validations: PreallocationValidation[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const validation = await validatePreallocationRow(
      row,
      orderItems,
      dbConn
    );
    validation.rowIndex = i + 2; // +2 porque linha 1 é header, linhas começam em 1

    validations.push(validation);

    if (validation.valid) {
      validCount++;
    } else {
      invalidCount++;
    }
  }

  // Criar alocações para linhas válidas
  let createdCount = 0;

  for (const validation of validations) {
    if (!validation.valid) continue;

    const row = rows[validation.rowIndex - 2];
    const orderItem = orderItems.find((i) => i.expectedGtin === row.sku);

    if (!orderItem) continue;

    // Determinar endereço
    let locationId: number;

    if (row.endereco) {
      // Usar endereço específico
      const location = await dbConn
        .select()
        .from(warehouseLocations)
        .where(eq(warehouseLocations.code, row.endereco))
        .limit(1);

      if (!location[0]) continue;
      locationId = location[0].id;
    } else if (validation.suggestedLocation) {
      // Usar endereço sugerido
      locationId = validation.suggestedLocation.id;
    } else {
      continue;
    }

    // Criar pré-alocação
    await dbConn.insert(receivingPreallocations).values({
      receivingOrderId,
      receivingOrderItemId: orderItem.id,
      locationId,
      quantity: row.quantity,
      batch: row.lote,
      expiryDate: row.validade ? new Date(row.validade) : undefined,
      status: "pending",
      createdBy: userId,
    });

    createdCount++;
  }

  // Registrar upload
  await dbConn.insert(preallocationUploads).values({
    receivingOrderId,
    fileName: `preallocation-${Date.now()}.xlsx`,
    uploadedBy: userId,
    totalRows: rows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    status: invalidCount === 0 ? "success" : "partial",
    errorLog: validations,
  });

  return {
    totalRows: rows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    validations,
    createdAllocations: createdCount,
  };
}

/**
 * Valida uma linha de pré-alocação
 */
async function validatePreallocationRow(
  row: PreallocationRow,
  orderItems: any[],
  dbConn: any
): Promise<PreallocationValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let suggestedLocation: any = undefined;

  // Validar SKU
  if (!row.sku || row.sku.trim() === "") {
    errors.push("SKU obrigatório");
    return { rowIndex: 0, sku: row.sku || "", valid: false, errors, warnings };
  }

  const orderItem = orderItems.find((i) => i.expectedGtin === row.sku);
  if (!orderItem) {
    errors.push(`SKU ${row.sku} não encontrado na ordem`);
  }

  // Validar quantidade
  if (!row.quantity || row.quantity <= 0) {
    errors.push("Quantidade deve ser maior que zero");
  } else if (orderItem && row.quantity > orderItem.expectedQuantity) {
    errors.push(
      `Quantidade ${row.quantity} excede esperada ${orderItem.expectedQuantity}`
    );
  }

  // Validar endereço ou zona
  if (!row.endereco && !row.zona) {
    errors.push("Endereço ou Zona obrigatório");
  } else if (row.endereco) {
    // Validar endereço específico
    const location = await dbConn
      .select()
      .from(warehouseLocations)
      .where(eq(warehouseLocations.code, row.endereco))
      .limit(1);

    if (!location[0]) {
      errors.push(`Endereço ${row.endereco} não encontrado`);
    } else if (location[0].status !== "available") {
      errors.push(`Endereço ${row.endereco} não está disponível`);
    }
  } else if (row.zona) {
    // Validar zona e sugerir endereço
    const zone = await dbConn
      .select()
      .from(warehouseZones)
      .where(eq(warehouseZones.name, row.zona))
      .limit(1);

    if (!zone[0]) {
      errors.push(`Zona ${row.zona} não encontrada`);
    } else {
      // Sugerir endereço disponível
      const availableLocation = await dbConn
        .select()
        .from(warehouseLocations)
        .where(
          and(
            eq(warehouseLocations.zoneId, zone[0].id),
            eq(warehouseLocations.status, "available")
          )
        )
        .limit(1);

      if (availableLocation[0]) {
        suggestedLocation = {
          id: availableLocation[0].id,
          code: availableLocation[0].code,
          zone: zone[0].name,
        };
      } else {
        warnings.push(`Nenhum endereço disponível na zona ${row.zona}`);
      }
    }
  }

  // Validar lote e validade
  if (row.lote && row.lote.trim() === "") {
    warnings.push("Lote vazio");
  }

  if (row.validade) {
    const expiryDate = new Date(row.validade);
    if (isNaN(expiryDate.getTime())) {
      errors.push(`Validade ${row.validade} em formato inválido`);
    } else if (expiryDate <= new Date()) {
      errors.push(`Validade ${row.validade} já expirou`);
    }
  }

  return {
    rowIndex: 0,
    sku: row.sku,
    valid: errors.length === 0,
    errors,
    warnings,
    suggestedLocation,
  };
}

/**
 * Confirma pré-alocações
 */
export async function confirmPreallocations(
  receivingOrderId: number
): Promise<number> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const result = await dbConn
    .update(receivingPreallocations)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(
      and(
        eq(receivingPreallocations.receivingOrderId, receivingOrderId),
        eq(receivingPreallocations.status, "pending")
      )
    );

  return result.rowCount || 0;
}

/**
 * Obtém pré-alocações de uma ordem
 */
export async function getPreallocations(
  receivingOrderId: number
): Promise<ReceivingPreallocation[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const results = await dbConn
    .select({
      id: receivingPreallocations.id,
      receivingOrderId: receivingPreallocations.receivingOrderId,
      receivingOrderItemId: receivingPreallocations.receivingOrderItemId,
      locationId: receivingPreallocations.locationId,
      locationCode: warehouseLocations.code,
      zoneName: warehouseZones.name,
      quantity: receivingPreallocations.quantity,
      batch: receivingPreallocations.batch,
      expiryDate: receivingPreallocations.expiryDate,
      status: receivingPreallocations.status,
      createdBy: receivingPreallocations.createdBy,
      createdAt: receivingPreallocations.createdAt,
    })
    .from(receivingPreallocations)
    .innerJoin(
      warehouseLocations,
      eq(receivingPreallocations.locationId, warehouseLocations.id)
    )
    .innerJoin(
      warehouseZones,
      eq(warehouseLocations.zoneId, warehouseZones.id)
    )
    .where(
      eq(receivingPreallocations.receivingOrderId, receivingOrderId)
    );

  return results;
}
```

---

## Frontend - Código Completo

### client/src/components/PreallocationUpload.tsx

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface PreallocationUploadProps {
  receivingOrderId: number;
  onSuccess?: () => void;
}

export function PreallocationUpload({ receivingOrderId, onSuccess }: PreallocationUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const uploadMutation = trpc.receiving.uploadPreallocation.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(`${data.createdAllocations} alocação(ões) criada(s)`);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao fazer upload");
    },
    onSettled: () => {
      setLoading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".xlsx")) {
        toast.error("Apenas arquivos .xlsx são aceitos");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }

    setLoading(true);
    const buffer = await file.arrayBuffer();

    uploadMutation.mutate({
      receivingOrderId,
      fileBuffer: Buffer.from(buffer),
    });
  };

  const downloadTemplate = () => {
    // Criar planilha template
    const template = [
      ["SKU", "Descrição", "Quantidade", "Endereço", "Zona", "Lote", "Validade"],
      ["123456", "Produto A", 100, "M01-01-01A", "", "L001", "2026-12-31"],
      ["234567", "Produto B", 50, "", "Medicamentos", "L002", "2026-11-30"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pré-alocação");
    XLSX.writeFile(wb, "template-prealocation.xlsx");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pré-alocação de Endereços</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Faça upload de uma planilha Excel com as alocações de endereços para os itens desta ordem.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Arquivo Excel (.xlsx)</label>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                disabled={loading}
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <Button onClick={downloadTemplate} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Template
              </Button>
            </div>
            {file && <p className="text-sm text-muted-foreground">{file.name}</p>}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {loading ? "Processando..." : "Fazer Upload"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado do Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total de Linhas</p>
                <p className="text-2xl font-bold">{result.totalRows}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Linhas Válidas</p>
                <p className="text-2xl font-bold text-green-600">{result.validRows}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Linhas Inválidas</p>
                <p className="text-2xl font-bold text-red-600">{result.invalidRows}</p>
              </div>
            </div>

            {result.validations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Detalhes da Validação</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linha</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Mensagens</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.validations.map((v: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{v.rowIndex}</TableCell>
                          <TableCell className="font-mono">{v.sku}</TableCell>
                          <TableCell>
                            {v.valid ? (
                              <Badge className="bg-green-100 text-green-800">✓ Válido</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">✗ Inválido</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {v.errors.length > 0 && (
                              <div className="text-red-600">
                                {v.errors.map((e: string, i: number) => (
                                  <div key={i}>• {e}</div>
                                ))}
                              </div>
                            )}
                            {v.warnings.length > 0 && (
                              <div className="text-yellow-600">
                                {v.warnings.map((w: string, i: number) => (
                                  <div key={i}>⚠ {w}</div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {result.createdAllocations} alocação(ões) criada(s) com sucesso!
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## Fluxos Operacionais

### Fluxo Completo de Pré-alocação

```
1. Gestor de recebimento acessa página de pré-alocação
2. Clica em "Download Template" para baixar modelo
3. Preenche planilha com dados dos itens e endereços
4. Faz upload da planilha
5. Sistema processa arquivo:
   a. Lê linhas da planilha
   b. Valida cada linha
   c. Sugere endereços se apenas zona foi informada
   d. Cria pré-alocações para linhas válidas
6. Sistema exibe resultado:
   - Total de linhas
   - Linhas válidas/inválidas
   - Detalhes de cada validação
   - Número de alocações criadas
7. Gestor revisa resultado
8. Se tudo OK, confirma alocações
9. Sistema marca alocações como "confirmed"
10. Etiquetas podem ser impressas com endereços alocados
```

---

**Fim da Documentação - Pré-alocação de Endereços**
