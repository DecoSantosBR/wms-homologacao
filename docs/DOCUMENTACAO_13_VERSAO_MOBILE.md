# WMS Med@x - Documentação da Versão Mobile

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Módulo:** Versão Mobile do WMS  
**Status:** ✅ Implementado e Funcional

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Funcionalidades Principais](#funcionalidades-principais)
3. [Arquitetura Técnica](#arquitetura-técnica)
4. [Componentes Mobile](#componentes-mobile)
5. [Integrações Nativas](#integrações-nativas)
6. [Fluxos Operacionais](#fluxos-operacionais)

---

## Visão Geral

A **Versão Mobile do WMS Med@x** é uma interface otimizada para dispositivos móveis (smartphones e tablets) que permite que operadores de armazém realizem operações críticas em campo. A aplicação é responsiva, funciona offline e integra-se com câmera e scanner de código de barras.

### Características Principais

- ✅ Interface mobile-first responsiva
- ✅ Suporte a câmera para leitura de código de barras
- ✅ Suporte a scanner físico de código de barras
- ✅ Funcionalidade offline com sincronização
- ✅ Otimização para toque (touch-friendly)
- ✅ Bateria otimizada (menos requisições)
- ✅ Suporte a múltiplas orientações (portrait/landscape)

---

## Funcionalidades Principais

### 1. Recebimento Mobile

**Descrição:** Operador realiza conferência de recebimento em campo.

**Funcionalidades:**
- Listar ordens de recebimento
- Ler etiquetas via câmera ou scanner
- Incrementar quantidade por etiqueta
- Visualizar divergências em tempo real
- Finalizar conferência
- Sincronizar com servidor

**Interface:**
- Botão grande de câmera (toque fácil)
- Display grande de quantidade
- Feedback visual com cores
- Botão de desfazer (última leitura)

### 2. Separação Mobile (Picking)

**Descrição:** Operador realiza picking de pedidos em campo.

**Funcionalidades:**
- Listar ordens de separação
- Ler código de endereço
- Ler código de produto
- Confirmar quantidade
- Gerenciar devoluções
- Finalizar picking

**Interface:**
- Mapa visual do armazém (se disponível)
- Rota otimizada de picking
- Confirmação de item por item
- Contador visual de itens

### 3. Movimentações Mobile

**Descrição:** Operador registra movimentações de estoque.

**Funcionalidades:**
- Ler endereço origem
- Ler endereço destino
- Informar quantidade
- Confirmar movimentação
- Histórico de movimentações

### 4. Consulta de Estoque Mobile

**Descrição:** Operador consulta posições de estoque em tempo real.

**Funcionalidades:**
- Buscar por SKU
- Buscar por endereço
- Visualizar quantidade disponível
- Visualizar localização no armazém
- Histórico de movimentações do produto

---

## Arquitetura Técnica

### Tecnologias

```
Frontend:
- React 19 com Tailwind CSS 4
- PWA (Progressive Web App)
- Service Workers para offline
- Capacitor para integrações nativas

Backend:
- Express 4 com tRPC
- Sincronização de dados
- API otimizada para mobile
```

### Estrutura de Pastas

```
client/
├── src/
│   ├── pages/
│   │   ├── mobile/
│   │   │   ├── ReceivingMobile.tsx
│   │   │   ├── PickingMobile.tsx
│   │   │   ├── MovementsMobile.tsx
│   │   │   └── StockQueryMobile.tsx
│   │   └── ...
│   ├── components/
│   │   ├── mobile/
│   │   │   ├── BarcodeScanner.tsx
│   │   │   ├── CameraCapture.tsx
│   │   │   ├── MobileLayout.tsx
│   │   │   ├── QuantityInput.tsx
│   │   │   └── ConfirmationDialog.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useBarcode.ts
│   │   ├── useCamera.ts
│   │   ├── useOfflineSync.ts
│   │   └── useMobileOrientation.ts
│   └── ...
├── public/
│   ├── manifest.json
│   ├── service-worker.js
│   └── ...
└── ...
```

---

## Componentes Mobile

### 1. BarcodeScanner.tsx

```typescript
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Keyboard } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
  placeholder?: string;
}

export function BarcodeScanner({ onScan, onError, placeholder }: BarcodeScannerProps) {
  const [input, setInput] = useState("");
  const [useCameraMode, setUseCameraMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Iniciar câmera
  useEffect(() => {
    if (!useCameraMode) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        onError?.("Erro ao acessar câmera");
        setUseCameraMode(false);
      }
    };

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [useCameraMode]);

  const handleScan = (barcode: string) => {
    if (barcode.trim()) {
      onScan(barcode);
      setInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleScan(input);
    }
  };

  return (
    <div className="space-y-3">
      {useCameraMode ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg bg-black"
          />
          <canvas ref={canvasRef} className="hidden" />
          <Button
            onClick={() => setUseCameraMode(false)}
            variant="outline"
            className="w-full"
          >
            <Keyboard className="w-4 h-4 mr-2" />
            Digitar Código
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder || "Escanear ou digitar..."}
            autoFocus
            className="text-lg"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => handleScan(input)}
              className="flex-1"
            >
              Confirmar
            </Button>
            <Button
              onClick={() => setUseCameraMode(true)}
              variant="outline"
              size="icon"
            >
              <Camera className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 2. MobileLayout.tsx

```typescript
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Menu } from "lucide-react";
import { useRouter } from "wouter";

interface MobileLayoutProps {
  title: string;
  children: ReactNode;
  onBack?: () => void;
  showMenu?: boolean;
  actions?: ReactNode;
}

export function MobileLayout({
  title,
  children,
  onBack,
  showMenu,
  actions,
}: MobileLayoutProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-primary-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
        <div className="flex gap-2">
          {actions}
          {showMenu && (
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {children}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t flex gap-2 p-3 justify-around">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router("/")}
          className="flex-1"
        >
          <Home className="w-4 h-4" />
        </Button>
        {/* Adicionar mais botões conforme necessário */}
      </div>
    </div>
  );
}
```

### 3. QuantityInput.tsx

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus } from "lucide-react";

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function QuantityInput({
  value,
  onChange,
  min = 1,
  max = 9999,
  step = 1,
}: QuantityInputProps) {
  const [input, setInput] = useState(String(value));

  const handleChange = (newValue: number) => {
    if (newValue >= min && newValue <= max) {
      onChange(newValue);
      setInput(String(newValue));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || 0;
    setInput(e.target.value);
    if (newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-muted p-3 rounded-lg">
      <Button
        variant="outline"
        size="icon"
        onClick={() => handleChange(value - step)}
        disabled={value <= min}
        className="h-12 w-12"
      >
        <Minus className="w-5 h-5" />
      </Button>

      <Input
        type="number"
        value={input}
        onChange={handleInputChange}
        className="text-center text-2xl font-bold h-12 flex-1"
        min={min}
        max={max}
      />

      <Button
        variant="outline"
        size="icon"
        onClick={() => handleChange(value + step)}
        disabled={value >= max}
        className="h-12 w-12"
      >
        <Plus className="w-5 h-5" />
      </Button>
    </div>
  );
}
```

---

## Integrações Nativas

### 1. Câmera

```typescript
// Usar Capacitor para acesso nativo à câmera
import { Camera } from "@capacitor/camera";

export async function takePicture() {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: "base64",
    source: "Camera",
    direction: "rear",
  });

  return image.base64String;
}
```

### 2. Scanner de Código de Barras

```typescript
// Usar Capacitor para integração com scanner físico
import { BarcodeScanner } from "@capacitor-community/barcode-scanner";

export async function startBarcodeScanning() {
  const result = await BarcodeScanner.scan();
  return result.ScanResult;
}
```

### 3. Sincronização Offline

```typescript
// Service Worker para sincronização offline
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-data") {
    event.waitUntil(syncDataWithServer());
  }
});

async function syncDataWithServer() {
  const db = await openDatabase();
  const pendingData = await db.getAll("pending");

  for (const item of pendingData) {
    try {
      await fetch("/api/trpc/sync", {
        method: "POST",
        body: JSON.stringify(item),
      });
      await db.delete("pending", item.id);
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
    }
  }
}
```

---

## Fluxos Operacionais

### Fluxo 1: Recebimento Mobile

```
1. Operador abre app no smartphone
2. Seleciona "Recebimento"
3. Seleciona ordem de recebimento
4. Clica em "Iniciar Conferência"
5. Aponta câmera para etiqueta
6. Sistema lê código de barras
7. Quantidade é incrementada
8. Feedback visual (som/vibração)
9. Operador continua lendo etiquetas
10. Clica em "Finalizar"
11. Sistema sincroniza com servidor
12. Ordem é marcada como conferida
```

### Fluxo 2: Picking Mobile

```
1. Operador abre app
2. Seleciona "Separação"
3. Seleciona ordem de picking
4. Sistema exibe rota otimizada
5. Operador vai para primeiro endereço
6. Lê código do endereço
7. Sistema confirma localização
8. Lê código do produto
9. Confirma quantidade
10. Marca como separado
11. Sistema guia para próximo endereço
12. Repete até finalizar todos itens
13. Clica em "Finalizar Picking"
14. Sistema sincroniza
```

---

## Otimizações Mobile

### Performance

- Lazy loading de componentes
- Compressão de imagens
- Cache de dados frequentes
- Requisições agrupadas (batching)
- Redução de re-renders

### Bateria

- Reduzir frequência de sincronização
- Desabilitar GPS quando não necessário
- Usar background sync
- Reduzir brilho de tela (modo escuro)

### Dados

- Sincronização apenas de dados modificados
- Compressão de payloads
- Cache local com IndexedDB
- Modo offline-first

---

**Fim da Documentação - Versão Mobile**
