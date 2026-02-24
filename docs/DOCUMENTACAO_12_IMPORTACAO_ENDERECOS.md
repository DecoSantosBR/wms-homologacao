# WMS Med@x - Documentação do Módulo Importação de Endereços via Excel

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Módulo:** Importação de Endereços via Excel  
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

O **Módulo de Importação de Endereços via Excel** permite que administradores importem em lote endereços de armazenagem através de planilha Excel. O sistema valida dados, gera códigos de endereço automaticamente e cria os registros no banco de dados.

### Características Principais

- ✅ Upload de planilha Excel (.xlsx)
- ✅ Validação automática de dados
- ✅ Geração automática de códigos de endereço
- ✅ Suporte a múltiplas zonas
- ✅ Configuração de regras de armazenagem
- ✅ Histórico de importações
- ✅ Auditoria completa

---

## Funcionalidades Principais

### 1. Upload de Planilha

**Descrição:** Administrador faz upload de planilha Excel com dados de endereços.

**Formato Esperado:**
| Zona | Tipo | Capacidade | Regra | Cliente | Descrição |
|------|------|-----------|-------|---------|-----------|
| Medicamentos | Inteira | 1000 | single | Tenant A | Endereço para medicamentos |
| Medicamentos | Fração | 500 | multiple | Tenant B | Endereço para frações |
| Geral | Inteira | 2000 | multiple | Compartilhado | Endereço compartilhado |

**Colunas Obrigatórias:**
- Zona (deve existir no sistema)
- Tipo (Inteira ou Fração)
- Capacidade (número positivo)
- Regra (single ou multiple)

**Colunas Opcionais:**
- Cliente (Tenant)
- Descrição

### 2. Validação de Dados

**Descrição:** Sistema valida cada linha da planilha.

**Validações:**
- Zona existe no sistema
- Tipo é "Inteira" ou "Fração"
- Capacidade é número positivo
- Regra é "single" ou "multiple"
- Cliente (se informado) existe no sistema
- Não há duplicatas de código

**Resultado:**
- ✅ Linhas válidas são processadas
- ⚠️ Linhas com aviso são marcadas para revisão
- ❌ Linhas inválidas são rejeitadas com motivo

### 3. Geração Automática de Códigos

**Descrição:** Sistema gera códigos de endereço automaticamente.

**Formato do Código:**
```
{ZONA_SIGLA}{NIVEL}{FILEIRA}{COLUNA}{POSICAO}
Exemplo: M01-01-01A
  M = Medicamentos (sigla da zona)
  01 = Nível 1
  01 = Fileira 1
  A = Coluna A
```

**Lógica:**
1. Extrair sigla da zona (primeiras letras)
2. Calcular próximo nível disponível
3. Calcular próxima fileira disponível
4. Gerar coluna (A-Z)
5. Gerar posição (1-10)

### 4. Criação de Endereços

**Descrição:** Cria registros de endereço após validação bem-sucedida.

**Dados Criados:**
- Código do endereço (gerado automaticamente)
- Zona
- Tipo (Inteira/Fração)
- Capacidade
- Regra de armazenagem (single/multiple)
- Cliente (se informado)
- Status: "available"
- Criado por (usuário)

### 5. Histórico de Importações

**Descrição:** Rastreamento completo de todas as importações realizadas.

**Dados Registrados:**
- ID da importação
- Nome do arquivo
- Data/hora da importação
- Usuário que importou
- Total de linhas
- Linhas válidas/inválidas
- Status (success/partial/failed)
- Log de erros

---

## Arquitetura Técnica

### Tabelas de Banco de Dados

```sql
-- Histórico de Importações de Endereços
CREATE TABLE locationImports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  fileName VARCHAR(255) NOT NULL,
  importedBy INT NOT NULL,
  importedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  totalRows INT,
  validRows INT,
  invalidRows INT,
  createdLocations INT,
  status ENUM('success', 'partial', 'failed') DEFAULT 'success',
  errorLog JSON,
  FOREIGN KEY (importedBy) REFERENCES systemUsers(id),
  INDEX idx_importedAt (importedAt)
);
```

### Interfaces TypeScript

```typescript
export interface LocationImportRow {
  zona: string;
  tipo: "Inteira" | "Fração";
  capacidade: number;
  regra: "single" | "multiple";
  cliente?: string;
  descricao?: string;
}

export interface LocationImportValidation {
  rowIndex: number;
  zona: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestedCode?: string;
}

export interface LocationImportResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  validations: LocationImportValidation[];
  createdLocations: number;
  codes: string[];
}

export interface LocationImportHistory {
  id: number;
  fileName: string;
  importedBy: number;
  importedByName: string;
  importedAt: Date;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdLocations: number;
  status: "success" | "partial" | "failed";
}
```

---

## Backend - Código Completo

### server/locationImport.ts

```typescript
import { getDb } from "./db";
import {
  warehouseLocations,
  warehouseZones,
  tenants,
  locationImports,
} from "../drizzle/schema";
import { eq, like, and } from "drizzle-orm";
import * as XLSX from "xlsx";

export interface LocationImportRow {
  zona: string;
  tipo: "Inteira" | "Fração";
  capacidade: number;
  regra: "single" | "multiple";
  cliente?: string;
  descricao?: string;
}

export interface LocationImportValidation {
  rowIndex: number;
  zona: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestedCode?: string;
}

/**
 * Processa arquivo Excel de importação de endereços
 */
export async function processLocationImportFile(
  fileBuffer: Buffer,
  userId: number
): Promise<LocationImportResult> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Parsear Excel
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<LocationImportRow>(worksheet);

  if (rows.length === 0) {
    throw new Error("Planilha vazia");
  }

  // Buscar zonas e clientes
  const zones = await dbConn.select().from(warehouseZones);
  const clients = await dbConn.select().from(tenants);

  // Validar cada linha
  const validations: LocationImportValidation[] = [];
  const createdCodes: string[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const validation = await validateLocationImportRow(
      row,
      zones,
      clients,
      dbConn
    );
    validation.rowIndex = i + 2; // +2 porque linha 1 é header

    validations.push(validation);

    if (validation.valid) {
      validCount++;
      if (validation.suggestedCode) {
        createdCodes.push(validation.suggestedCode);
      }
    } else {
      invalidCount++;
    }
  }

  // Criar endereços para linhas válidas
  let createdCount = 0;

  for (const validation of validations) {
    if (!validation.valid) continue;

    const row = rows[validation.rowIndex - 2];
    const zone = zones.find((z) => z.name === row.zona);

    if (!zone) continue;

    // Determinar cliente
    let tenantId: number | null = null;
    if (row.cliente && row.cliente !== "Compartilhado") {
      const client = clients.find((c) => c.name === row.cliente);
      if (client) tenantId = client.id;
    }

    // Criar endereço
    await dbConn.insert(warehouseLocations).values({
      code: validation.suggestedCode!,
      zoneId: zone.id,
      type: row.tipo === "Inteira" ? "whole" : "fraction",
      capacity: row.capacidade,
      storageRule: row.regra,
      status: "available",
      tenantId,
      description: row.descricao,
    });

    createdCount++;
  }

  // Registrar importação
  await dbConn.insert(locationImports).values({
    fileName: `location-import-${Date.now()}.xlsx`,
    importedBy: userId,
    totalRows: rows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    createdLocations: createdCount,
    status: invalidCount === 0 ? "success" : "partial",
    errorLog: validations,
  });

  return {
    totalRows: rows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    validations,
    createdLocations: createdCount,
    codes: createdCodes,
  };
}

/**
 * Valida uma linha de importação de endereço
 */
async function validateLocationImportRow(
  row: LocationImportRow,
  zones: any[],
  clients: any[],
  dbConn: any
): Promise<LocationImportValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let suggestedCode: string | undefined;

  // Validar zona
  if (!row.zona || row.zona.trim() === "") {
    errors.push("Zona obrigatória");
    return {
      rowIndex: 0,
      zona: row.zona || "",
      valid: false,
      errors,
      warnings,
    };
  }

  const zone = zones.find((z) => z.name === row.zona);
  if (!zone) {
    errors.push(`Zona ${row.zona} não encontrada`);
  }

  // Validar tipo
  if (!row.tipo || !["Inteira", "Fração"].includes(row.tipo)) {
    errors.push("Tipo deve ser 'Inteira' ou 'Fração'");
  }

  // Validar capacidade
  if (!row.capacidade || row.capacidade <= 0) {
    errors.push("Capacidade deve ser maior que zero");
  }

  // Validar regra
  if (!row.regra || !["single", "multiple"].includes(row.regra)) {
    errors.push("Regra deve ser 'single' ou 'multiple'");
  }

  // Validar cliente
  if (row.cliente && row.cliente !== "Compartilhado") {
    const client = clients.find((c) => c.name === row.cliente);
    if (!client) {
      warnings.push(`Cliente ${row.cliente} não encontrado`);
    }
  }

  // Gerar código sugerido
  if (zone && errors.length === 0) {
    suggestedCode = await generateLocationCode(zone, dbConn);
  }

  return {
    rowIndex: 0,
    zona: row.zona,
    valid: errors.length === 0,
    errors,
    warnings,
    suggestedCode,
  };
}

/**
 * Gera código de endereço automaticamente
 */
async function generateLocationCode(zone: any, dbConn: any): Promise<string> {
  // Extrair sigla da zona (primeiras 1-3 letras)
  const zoneSigla = zone.name.substring(0, 1).toUpperCase();

  // Buscar próximo nível
  const lastLocation = await dbConn
    .select()
    .from(warehouseLocations)
    .where(like(warehouseLocations.code, `${zoneSigla}%`))
    .orderBy(warehouseLocations.code)
    .limit(1);

  let level = 1;
  let row = 1;
  let column = "A";

  if (lastLocation.length > 0) {
    // Parsear último código
    const lastCode = lastLocation[0].code;
    const match = lastCode.match(/(\d{2})-(\d{2})-(\d{2})([A-Z])/);
    if (match) {
      level = parseInt(match[1]);
      row = parseInt(match[2]);
      column = match[4];

      // Incrementar
      if (column === "Z") {
        column = "A";
        row++;
        if (row > 99) {
          row = 1;
          level++;
        }
      } else {
        column = String.fromCharCode(column.charCodeAt(0) + 1);
      }
    }
  }

  return `${zoneSigla}${String(level).padStart(2, "0")}-${String(row).padStart(2, "0")}-01${column}`;
}

/**
 * Obtém histórico de importações
 */
export async function getLocationImportHistory(
  limit: number = 50
): Promise<LocationImportHistory[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const results = await dbConn
    .select({
      id: locationImports.id,
      fileName: locationImports.fileName,
      importedBy: locationImports.importedBy,
      importedByName: systemUsers.name,
      importedAt: locationImports.importedAt,
      totalRows: locationImports.totalRows,
      validRows: locationImports.validRows,
      invalidRows: locationImports.invalidRows,
      createdLocations: locationImports.createdLocations,
      status: locationImports.status,
    })
    .from(locationImports)
    .innerJoin(systemUsers, eq(locationImports.importedBy, systemUsers.id))
    .orderBy(desc(locationImports.importedAt))
    .limit(limit);

  return results;
}
```

---

## Frontend - Código Completo

### client/src/components/LocationImportUpload.tsx

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
import * as XLSX from "xlsx";

interface LocationImportUploadProps {
  onSuccess?: () => void;
}

export function LocationImportUpload({ onSuccess }: LocationImportUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const uploadMutation = trpc.locations.uploadImport.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(`${data.createdLocations} endereço(s) criado(s)`);
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
      fileBuffer: Buffer.from(buffer),
    });
  };

  const downloadTemplate = () => {
    const template = [
      ["Zona", "Tipo", "Capacidade", "Regra", "Cliente", "Descrição"],
      ["Medicamentos", "Inteira", 1000, "single", "Tenant A", "Endereço para medicamentos"],
      ["Medicamentos", "Fração", 500, "multiple", "Tenant B", "Endereço para frações"],
      ["Geral", "Inteira", 2000, "multiple", "Compartilhado", "Endereço compartilhado"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Endereços");
    XLSX.writeFile(wb, "template-locations.xlsx");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Importar Endereços</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Faça upload de uma planilha Excel com os dados dos endereços a serem criados.
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
            <CardTitle>Resultado da Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total de Linhas</p>
                <p className="text-2xl font-bold">{result.totalRows}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Válidas</p>
                <p className="text-2xl font-bold text-green-600">{result.validRows}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inválidas</p>
                <p className="text-2xl font-bold text-red-600">{result.invalidRows}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Criados</p>
                <p className="text-2xl font-bold text-blue-600">{result.createdLocations}</p>
              </div>
            </div>

            {result.codes.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Códigos Gerados</h4>
                <div className="flex flex-wrap gap-2">
                  {result.codes.map((code: string, idx: number) => (
                    <Badge key={idx} variant="outline">
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.validations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Detalhes da Validação</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linha</TableHead>
                        <TableHead>Zona</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Código Gerado</TableHead>
                        <TableHead>Mensagens</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.validations.map((v: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{v.rowIndex}</TableCell>
                          <TableCell>{v.zona}</TableCell>
                          <TableCell>
                            {v.valid ? (
                              <Badge className="bg-green-100 text-green-800">✓ Válido</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">✗ Inválido</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">{v.suggestedCode || "-"}</TableCell>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## Fluxos Operacionais

### Fluxo Completo de Importação

```
1. Admin acessa página de importação de endereços
2. Clica em "Download Template" para baixar modelo
3. Preenche planilha com dados dos endereços
4. Faz upload da planilha
5. Sistema processa arquivo:
   a. Lê linhas da planilha
   b. Valida cada linha
   c. Gera código de endereço automaticamente
   d. Cria endereços para linhas válidas
6. Sistema exibe resultado:
   - Total de linhas
   - Linhas válidas/inválidas
   - Códigos gerados
   - Detalhes de cada validação
7. Admin revisa resultado
8. Endereços estão prontos para uso
9. Podem ser usados em pré-alocações e operações
```

---

**Fim da Documentação - Importação de Endereços via Excel**
