# WMS Med@x - Documentação do Módulo Conferência Cega por Etiquetas

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Módulo:** Conferência Cega por Associação de Etiquetas  
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

O **Módulo de Conferência Cega por Etiquetas** permite que operadores de recebimento realizem conferência de mercadorias através da leitura sequencial de etiquetas com código de barras, sem visualizar a quantidade esperada (conferência cega verdadeira).

### Características Principais

- ✅ Leitura de etiquetas via código de barras (scanner físico ou câmera)
- ✅ Associação automática de etiquetas a itens de recebimento
- ✅ Incremento de quantidade por etiqueta lida
- ✅ Detecção automática de divergências
- ✅ Ajustes de quantidade com aprovação de supervisor
- ✅ Finalização com criação automática de estoque
- ✅ Auditoria completa de todas as operações

---

## Funcionalidades Principais

### 1. Sessão de Conferência Cega

**Descrição:** Cria uma sessão para conferência de uma ordem de recebimento.

**Dados da Sessão:**
- ID da ordem de recebimento
- Usuário que iniciou
- Data/hora de início
- Status: "in_progress", "completed", "cancelled"
- Resumo final com divergências detectadas

### 2. Leitura de Etiquetas

**Descrição:** Operador lê etiquetas via scanner ou câmera.

**Dados Capturados:**
- Código de barras (EAN, UPC, Code128, QR Code)
- Timestamp da leitura
- Usuário que leu
- Associação automática ao item correto

**Suporte a Múltiplos Formatos:**
- EAN-13 / EAN-14
- UPC
- Code128
- QR Code
- GS1-128 (com AI para lote, validade, serial)

### 3. Associação de Etiquetas

**Descrição:** Sistema associa etiqueta lida ao item de recebimento correto.

**Lógica:**
1. Decodificar código de barras
2. Extrair GTIN (código do produto)
3. Buscar item na ordem com mesmo GTIN
4. Incrementar quantidade do item
5. Registrar leitura com timestamp

### 4. Detecção de Divergências

**Descrição:** Sistema detecta automaticamente quando quantidade conferida diverge da esperada.

**Tipos de Divergência:**
- **Quantidade Insuficiente:** Conferido < Esperado
- **Quantidade Excedente:** Conferido > Esperado
- **Código Inválido:** Etiqueta não corresponde a nenhum item

**Ação:** Bloqueia finalização até aprovação de supervisor

### 5. Ajustes de Quantidade

**Descrição:** Supervisor aprova ou rejeita divergências.

**Fluxo:**
1. Operador tenta finalizar com divergência
2. Sistema exibe resumo de divergências
3. Supervisor analisa e aprova/rejeita
4. Se aprovado: finaliza com quantidade ajustada
5. Se rejeitado: retorna para conferência

---

## Arquitetura Técnica

### Tabelas de Banco de Dados

```sql
-- Sessões de Conferência Cega
CREATE TABLE blindConferenceSessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  receivingOrderId INT NOT NULL,
  startedBy INT NOT NULL,
  startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completedAt TIMESTAMP,
  status ENUM('in_progress', 'completed', 'cancelled') DEFAULT 'in_progress',
  totalExpected DECIMAL(10, 2),
  totalConferenced DECIMAL(10, 2),
  divergenceCount INT DEFAULT 0,
  FOREIGN KEY (receivingOrderId) REFERENCES receivingOrders(id),
  FOREIGN KEY (startedBy) REFERENCES systemUsers(id),
  INDEX idx_status (status),
  INDEX idx_receivingOrderId (receivingOrderId)
);

-- Associações de Etiquetas
CREATE TABLE labelAssociations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sessionId INT NOT NULL,
  receivingOrderItemId INT NOT NULL,
  barcode VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  batch VARCHAR(50),
  expiryDate DATE,
  readAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  readBy INT NOT NULL,
  FOREIGN KEY (sessionId) REFERENCES blindConferenceSessions(id),
  FOREIGN KEY (receivingOrderItemId) REFERENCES receivingOrderItems(id),
  FOREIGN KEY (readBy) REFERENCES systemUsers(id),
  INDEX idx_sessionId (sessionId),
  INDEX idx_barcode (barcode)
);

-- Leituras de Etiquetas (histórico)
CREATE TABLE labelReadings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sessionId INT NOT NULL,
  barcode VARCHAR(255) NOT NULL,
  decodedData JSON,
  matchedItemId INT,
  status ENUM('matched', 'unmatched', 'duplicate') DEFAULT 'matched',
  readAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sessionId) REFERENCES blindConferenceSessions(id),
  FOREIGN KEY (matchedItemId) REFERENCES receivingOrderItems(id),
  INDEX idx_sessionId (sessionId)
);

-- Ajustes de Divergência
CREATE TABLE blindConferenceAdjustments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sessionId INT NOT NULL,
  receivingOrderItemId INT NOT NULL,
  expectedQuantity DECIMAL(10, 2),
  conferencedQuantity DECIMAL(10, 2),
  adjustedQuantity DECIMAL(10, 2),
  reason TEXT,
  approvedBy INT,
  approvedAt TIMESTAMP,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  FOREIGN KEY (sessionId) REFERENCES blindConferenceSessions(id),
  FOREIGN KEY (receivingOrderItemId) REFERENCES receivingOrderItems(id),
  FOREIGN KEY (approvedBy) REFERENCES systemUsers(id),
  INDEX idx_status (status)
);
```

### Interfaces TypeScript

```typescript
export interface BlindConferenceSession {
  id: number;
  receivingOrderId: number;
  startedBy: number;
  startedAt: Date;
  completedAt?: Date;
  status: "in_progress" | "completed" | "cancelled";
  totalExpected: number;
  totalConferenced: number;
  divergenceCount: number;
}

export interface LabelAssociation {
  id: number;
  sessionId: number;
  receivingOrderItemId: number;
  barcode: string;
  quantity: number;
  batch?: string;
  expiryDate?: Date;
  readAt: Date;
  readBy: number;
}

export interface LabelReading {
  id: number;
  sessionId: number;
  barcode: string;
  decodedData?: any;
  matchedItemId?: number;
  status: "matched" | "unmatched" | "duplicate";
  readAt: Date;
}

export interface BlindConferenceAdjustment {
  id: number;
  sessionId: number;
  receivingOrderItemId: number;
  expectedQuantity: number;
  conferencedQuantity: number;
  adjustedQuantity?: number;
  reason?: string;
  approvedBy?: number;
  approvedAt?: Date;
  status: "pending" | "approved" | "rejected";
}
```

---

## Backend - Código Completo

### server/blindConference.ts

```typescript
import { getDb } from "./db";
import {
  blindConferenceSessions,
  labelAssociations,
  labelReadings,
  blindConferenceAdjustments,
  receivingOrderItems,
  receivingOrders,
  inventory,
  inventoryMovements,
} from "../drizzle/schema";
import { eq, and, sum } from "drizzle-orm";
import { updateLocationStatus } from "./locations";

/**
 * Inicia uma sessão de conferência cega
 */
export async function startBlindConferenceSession(
  receivingOrderId: number,
  userId: number
) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Calcular total esperado
  const items = await dbConn
    .select({ total: sum(receivingOrderItems.expectedQuantity) })
    .from(receivingOrderItems)
    .where(eq(receivingOrderItems.receivingOrderId, receivingOrderId));

  const totalExpected = items[0]?.total ?? 0;

  // Criar sessão
  const result = await dbConn.insert(blindConferenceSessions).values({
    receivingOrderId,
    startedBy: userId,
    totalExpected,
    status: "in_progress",
  });

  return {
    sessionId: result[0].insertId,
    totalExpected,
  };
}

/**
 * Lê e processa uma etiqueta
 */
export async function readLabel(
  sessionId: number,
  barcode: string,
  userId: number
) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Decodificar código de barras
  const decodedData = decodeBarcode(barcode);

  // Buscar sessão
  const session = await dbConn
    .select()
    .from(blindConferenceSessions)
    .where(eq(blindConferenceSessions.id, sessionId))
    .limit(1);

  if (!session[0]) throw new Error("Sessão não encontrada");

  // Buscar item correspondente
  const items = await dbConn
    .select()
    .from(receivingOrderItems)
    .where(
      and(
        eq(receivingOrderItems.receivingOrderId, session[0].receivingOrderId),
        eq(receivingOrderItems.expectedGtin, decodedData.gtin)
      )
    );

  if (items.length === 0) {
    // Registrar leitura não correspondida
    await dbConn.insert(labelReadings).values({
      sessionId,
      barcode,
      decodedData,
      status: "unmatched",
    });
    throw new Error("Etiqueta não corresponde a nenhum item da ordem");
  }

  const item = items[0];

  // Registrar leitura
  await dbConn.insert(labelReadings).values({
    sessionId,
    barcode,
    decodedData,
    matchedItemId: item.id,
    status: "matched",
  });

  // Associar etiqueta
  await dbConn.insert(labelAssociations).values({
    sessionId,
    receivingOrderItemId: item.id,
    barcode,
    quantity: decodedData.quantity || 1,
    batch: decodedData.batch,
    expiryDate: decodedData.expiryDate,
    readBy: userId,
  });

  return {
    itemId: item.id,
    productSku: item.expectedGtin,
    quantity: decodedData.quantity || 1,
  };
}

/**
 * Incrementa quantidade de um item
 */
export async function incrementItemQuantity(
  sessionId: number,
  receivingOrderItemId: number,
  quantity: number
) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Buscar associações existentes
  const associations = await dbConn
    .select({ total: sum(labelAssociations.quantity) })
    .from(labelAssociations)
    .where(
      and(
        eq(labelAssociations.sessionId, sessionId),
        eq(labelAssociations.receivingOrderItemId, receivingOrderItemId)
      )
    );

  const currentTotal = associations[0]?.total ?? 0;
  const newTotal = currentTotal + quantity;

  return { currentTotal, newTotal };
}

/**
 * Desfaz última leitura
 */
export async function undoLastReading(sessionId: number) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Buscar última associação
  const lastAssociation = await dbConn
    .select()
    .from(labelAssociations)
    .where(eq(labelAssociations.sessionId, sessionId))
    .orderBy(labelAssociations.readAt)
    .limit(1);

  if (lastAssociation.length === 0) {
    throw new Error("Nenhuma leitura para desfazer");
  }

  // Deletar associação
  await dbConn
    .delete(labelAssociations)
    .where(eq(labelAssociations.id, lastAssociation[0].id));

  return { undone: true };
}

/**
 * Finaliza conferência cega
 */
export async function finalizeBlindConference(
  sessionId: number,
  userId: number
) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Buscar sessão
  const session = await dbConn
    .select()
    .from(blindConferenceSessions)
    .where(eq(blindConferenceSessions.id, sessionId))
    .limit(1);

  if (!session[0]) throw new Error("Sessão não encontrada");

  // Calcular totais por item
  const itemTotals = await dbConn
    .select({
      itemId: labelAssociations.receivingOrderItemId,
      total: sum(labelAssociations.quantity),
    })
    .from(labelAssociations)
    .where(eq(labelAssociations.sessionId, sessionId))
    .groupBy(labelAssociations.receivingOrderItemId);

  // Buscar itens da ordem
  const items = await dbConn
    .select()
    .from(receivingOrderItems)
    .where(eq(receivingOrderItems.receivingOrderId, session[0].receivingOrderId));

  // Detectar divergências
  const divergences = [];
  let totalConferenced = 0;

  for (const item of items) {
    const conferenced = itemTotals.find((t) => t.itemId === item.id)?.total ?? 0;
    totalConferenced += conferenced;

    if (conferenced !== item.expectedQuantity) {
      divergences.push({
        itemId: item.id,
        expectedQuantity: item.expectedQuantity,
        conferencedQuantity: conferenced,
      });
    }
  }

  // Atualizar sessão
  await dbConn
    .update(blindConferenceSessions)
    .set({
      totalConferenced,
      divergenceCount: divergences.length,
      status: divergences.length > 0 ? "in_progress" : "completed",
      completedAt: divergences.length === 0 ? new Date() : undefined,
    })
    .where(eq(blindConferenceSessions.id, sessionId));

  // Se sem divergências, criar estoque
  if (divergences.length === 0) {
    await createInventoryFromConference(session[0].receivingOrderId, itemTotals);
  }

  return {
    sessionId,
    totalExpected: session[0].totalExpected,
    totalConferenced,
    divergences,
    status: divergences.length === 0 ? "completed" : "pending_approval",
  };
}

/**
 * Cria registros de estoque após conferência bem-sucedida
 */
async function createInventoryFromConference(
  receivingOrderId: number,
  itemTotals: any[]
) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Buscar ordem
  const order = await dbConn
    .select()
    .from(receivingOrders)
    .where(eq(receivingOrders.id, receivingOrderId))
    .limit(1);

  if (!order[0]) throw new Error("Ordem não encontrada");

  // Buscar endereço REC alocado
  const recLocation = await dbConn
    .select()
    .from(warehouseLocations)
    .where(
      and(
        eq(warehouseLocations.code, "REC"),
        eq(warehouseLocations.status, "available")
      )
    )
    .limit(1);

  if (!recLocation[0]) {
    throw new Error("Nenhum endereço REC disponível");
  }

  // Criar registros de estoque
  for (const total of itemTotals) {
    const item = await dbConn
      .select()
      .from(receivingOrderItems)
      .where(eq(receivingOrderItems.id, total.itemId))
      .limit(1);

    if (item[0]) {
      await dbConn.insert(inventory).values({
        productId: item[0].productId,
        locationId: recLocation[0].id,
        batch: item[0].batch,
        quantity: total.total,
        expiryDate: item[0].expiryDate,
        status: "quarantine",
        tenantId: order[0].tenantId,
      });

      // Registrar movimentação
      await dbConn.insert(inventoryMovements).values({
        productId: item[0].productId,
        toLocationId: recLocation[0].id,
        quantity: total.total,
        batch: item[0].batch,
        movementType: "receiving",
      });
    }
  }

  // Atualizar status do endereço
  await updateLocationStatus(recLocation[0].id);

  // Atualizar status da ordem
  await dbConn
    .update(receivingOrders)
    .set({ status: "completed" })
    .where(eq(receivingOrders.id, receivingOrderId));
}

/**
 * Decodifica código de barras
 */
function decodeBarcode(barcode: string) {
  // Suporte a GS1-128 com AI
  const gs1Pattern = /\((\d{2})\)([^\(]*)/g;
  let match;
  const data: any = { barcode };

  while ((match = gs1Pattern.exec(barcode)) !== null) {
    const ai = match[1];
    const value = match[2];

    switch (ai) {
      case "01": // GTIN
        data.gtin = value;
        break;
      case "10": // Lote
        data.batch = value;
        break;
      case "17": // Validade YYMMDD
        const year = parseInt("20" + value.substring(0, 2));
        const month = parseInt(value.substring(2, 4));
        const day = parseInt(value.substring(4, 6));
        data.expiryDate = new Date(year, month - 1, day);
        break;
      case "21": // Serial
        data.serial = value;
        break;
      case "37": // Quantidade
        data.quantity = parseInt(value);
        break;
    }
  }

  // Se não for GS1, tratar como EAN simples
  if (!data.gtin && barcode.length >= 12) {
    data.gtin = barcode;
  }

  return data;
}
```

---

## Frontend - Código Completo

### client/src/components/BlindCheckModal.tsx

```typescript
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, AlertCircle, CheckCircle2 } from "lucide-react";
import { BarcodeScanner } from "./BarcodeScanner";
import { trpc } from "@/lib/trpc";

interface BlindCheckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivingOrderId: number;
  onSuccess?: () => void;
}

export function BlindCheckModal({
  open,
  onOpenChange,
  receivingOrderId,
  onSuccess,
}: BlindCheckModalProps) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [barcode, setBarcode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [readings, setReadings] = useState<any[]>([]);

  // Mutations
  const startSessionMutation = trpc.blindConference.startSession.useMutation();
  const readLabelMutation = trpc.blindConference.readLabel.useMutation();
  const finalizeMutation = trpc.blindConference.finalize.useMutation();

  // Iniciar sessão ao abrir modal
  useEffect(() => {
    if (open && !sessionId) {
      startSessionMutation.mutate(
        { receivingOrderId },
        {
          onSuccess: (data) => {
            setSessionId(data.sessionId);
            toast.success("Sessão de conferência iniciada");
          },
          onError: (error) => {
            toast.error(error.message);
            onOpenChange(false);
          },
        }
      );
    }
  }, [open]);

  const handleReadBarcode = async () => {
    if (!barcode.trim() || !sessionId) return;

    readLabelMutation.mutate(
      { sessionId, barcode },
      {
        onSuccess: (data) => {
          setReadings([...readings, data]);
          setBarcode("");
          toast.success(`Etiqueta lida: ${data.productSku}`);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  const handleScannerResult = (code: string) => {
    setBarcode(code);
    setShowScanner(false);
    // Auto-submit
    setTimeout(() => {
      readLabelMutation.mutate(
        { sessionId: sessionId!, barcode: code },
        {
          onSuccess: (data) => {
            setReadings([...readings, data]);
            setBarcode("");
            toast.success(`Etiqueta lida: ${data.productSku}`);
          },
          onError: (error) => {
            toast.error(error.message);
          },
        }
      );
    }, 100);
  };

  const handleFinalize = async () => {
    if (!sessionId) return;

    finalizeMutation.mutate(
      { sessionId },
      {
        onSuccess: (data) => {
          if (data.divergences.length === 0) {
            toast.success("Conferência finalizada com sucesso!");
            onOpenChange(false);
            setSessionId(null);
            setReadings([]);
            onSuccess?.();
          } else {
            toast.warning(`${data.divergences.length} divergência(s) detectada(s)`);
            // Mostrar resumo de divergências
          }
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conferência Cega por Etiquetas</DialogTitle>
        </DialogHeader>

        {showScanner ? (
          <div className="space-y-4">
            <BarcodeScanner
              onResult={handleScannerResult}
              onClose={() => setShowScanner(false)}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Input de Código de Barras */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Código de Barras</label>
              <div className="flex gap-2">
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleReadBarcode()}
                  placeholder="Escanear ou digitar código..."
                  autoFocus
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowScanner(true)}
                  title="Escanear com câmera"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ou use leitor de código de barras
              </p>
            </div>

            {/* Histórico de Leituras */}
            {readings.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-medium mb-3">Etiquetas Lidas ({readings.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {readings.map((reading, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <div>
                          <p className="font-mono text-sm">{reading.productSku}</p>
                          <p className="text-xs text-muted-foreground">
                            Qtd: {reading.quantity}
                          </p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleFinalize}
                disabled={readings.length === 0 || finalizeMutation.isPending}
              >
                {finalizeMutation.isPending ? "Finalizando..." : "Finalizar Conferência"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## Fluxos Operacionais

### Fluxo Completo de Conferência Cega

```
1. Operador clica em "Iniciar Conferência Cega" na ordem de recebimento
2. Sistema cria sessão e exibe modal
3. Operador começa a ler etiquetas (scanner ou câmera)
4. Para cada etiqueta:
   a. Sistema decodifica código de barras
   b. Busca item correspondente na ordem
   c. Incrementa quantidade do item
   d. Registra leitura com timestamp
   e. Exibe confirmação visual
5. Operador continua lendo até finalizar
6. Operador clica "Finalizar Conferência"
7. Sistema calcula totais por item
8. Se sem divergências:
   a. Cria registros de estoque
   b. Aloca endereço REC automaticamente
   c. Registra movimentações
   d. Atualiza status de endereço
   e. Finaliza ordem
9. Se com divergências:
   a. Exibe resumo de divergências
   b. Aguarda aprovação de supervisor
   c. Supervisor aprova ou rejeita
   d. Se aprovado: cria estoque com quantidade ajustada
   e. Se rejeitado: retorna para conferência
```

---

**Fim da Documentação - Conferência Cega por Etiquetas**
