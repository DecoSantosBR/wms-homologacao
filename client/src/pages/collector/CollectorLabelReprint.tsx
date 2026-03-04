/**
 * CollectorLabelReprint — Reimpressão de Etiquetas no Coletor
 *
 * Menu principal com 5 tipos de etiqueta:
 *  1. Recebimento   – ordens de recebimento
 *  2. Separação     – ondas de picking
 *  3. Volumes       – expedições/romaneios
 *  4. Produtos      – etiquetas de itens (labelAssociations)
 *  5. Endereços     – posições de estoque
 *
 * Cada tipo abre uma sub-tela com campo de busca + lista + botão de reimpressão.
 */

import { useState, useCallback } from "react";
import { CollectorLayout } from "../../components/CollectorLayout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { trpc } from "../../lib/trpc";
import { toast } from "sonner";
import {
  ClipboardCheck,
  ScanLine,
  Truck,
  BarcodeIcon,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Search,
  Printer,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LabelType = "receiving" | "waves" | "shipments" | "products" | "locations";

interface LabelTypeConfig {
  key: LabelType;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

const LABEL_TYPES: LabelTypeConfig[] = [
  {
    key: "receiving",
    title: "Etiquetas de Recebimento",
    description: "Reimprima etiquetas para ordens de recebimento",
    icon: ClipboardCheck,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    key: "waves",
    title: "Etiquetas de Pedidos de Separação",
    description: "Reimprima etiquetas para ondas de picking",
    icon: ScanLine,
    iconColor: "text-green-600",
    iconBg: "bg-green-50",
  },
  {
    key: "shipments",
    title: "Etiquetas de Volumes",
    description: "Reimprima etiquetas de volumes específicos",
    icon: Truck,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50",
  },
  {
    key: "products",
    title: "Etiquetas de Produtos",
    description: "Reimprima etiquetas para itens individuais",
    icon: BarcodeIcon,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
  },
  {
    key: "locations",
    title: "Etiquetas de Endereços",
    description: "Reimprima etiquetas para posições de estoque",
    icon: MapPin,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-50",
  },
];

// ---------------------------------------------------------------------------
// Sub-screen helpers
// ---------------------------------------------------------------------------

function openPdfInNewTab(dataUrl: string) {
  const win = window.open();
  if (win) {
    win.document.write(
      `<iframe src="${dataUrl}" style="width:100%;height:100%;border:none;"></iframe>`
    );
  } else {
    // fallback: download
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "etiqueta.pdf";
    a.click();
  }
}

// ---------------------------------------------------------------------------
// Sub-screens
// ---------------------------------------------------------------------------

function ReceivingSubScreen({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading } = trpc.labelReprint.listReceiving.useQuery(
    { search: query || undefined, limit: 30 },
    { enabled: true }
  );

  const reprint = trpc.labelReprint.reprintReceiving.useMutation({
    onSuccess: (result) => {
      toast.success("Etiqueta gerada!");
      openPdfInNewTab(result.pdf);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <SubScreenWrapper title="Etiquetas de Recebimento" onBack={onBack}>
      <SearchBar
        value={search}
        onChange={setSearch}
        onSearch={() => setQuery(search)}
        placeholder="OT, NF ou fornecedor..."
      />
      {isLoading && <LoadingRow />}
      {!isLoading && data?.length === 0 && <EmptyRow />}
      {data?.map((row) => (
        <ItemRow
          key={row.id}
          primary={row.orderNumber}
          secondary={row.supplierName ?? ""}
          badge={row.status}
          loading={reprint.isPending}
          onPrint={() => reprint.mutate({ receivingOrderId: row.id })}
        />
      ))}
    </SubScreenWrapper>
  );
}

function WavesSubScreen({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading } = trpc.labelReprint.listWaves.useQuery(
    { search: query || undefined, limit: 30 },
    { enabled: true }
  );

  const reprint = trpc.labelReprint.reprintWave.useMutation({
    onSuccess: (result) => {
      toast.success("Etiqueta gerada!");
      openPdfInNewTab(result.pdf);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <SubScreenWrapper title="Etiquetas de Separação" onBack={onBack}>
      <SearchBar
        value={search}
        onChange={setSearch}
        onSearch={() => setQuery(search)}
        placeholder="Número da onda..."
      />
      {isLoading && <LoadingRow />}
      {!isLoading && data?.length === 0 && <EmptyRow />}
      {data?.map((row) => (
        <ItemRow
          key={row.id}
          primary={row.waveNumber}
          secondary={`${row.totalOrders ?? 0} pedidos · ${row.totalItems ?? 0} itens`}
          badge={row.status}
          loading={reprint.isPending}
          onPrint={() => reprint.mutate({ waveId: row.id })}
        />
      ))}
    </SubScreenWrapper>
  );
}

function ShipmentsSubScreen({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading } = trpc.labelReprint.listShipments.useQuery(
    { search: query || undefined, limit: 30 },
    { enabled: true }
  );

  const reprint = trpc.labelReprint.reprintShipment.useMutation({
    onSuccess: (result) => {
      toast.success("Etiqueta gerada!");
      openPdfInNewTab(result.pdf);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <SubScreenWrapper title="Etiquetas de Volumes" onBack={onBack}>
      <SearchBar
        value={search}
        onChange={setSearch}
        onSearch={() => setQuery(search)}
        placeholder="Romaneio, transportadora ou placa..."
      />
      {isLoading && <LoadingRow />}
      {!isLoading && data?.length === 0 && <EmptyRow />}
      {data?.map((row) => (
        <ItemRow
          key={row.id}
          primary={row.shipmentNumber}
          secondary={[row.carrierName, row.vehiclePlate].filter(Boolean).join(" · ")}
          badge={row.status}
          loading={reprint.isPending}
          onPrint={() => reprint.mutate({ shipmentId: row.id })}
        />
      ))}
    </SubScreenWrapper>
  );
}

function ProductsSubScreen({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading } = trpc.labelReprint.listProductLabels.useQuery(
    { search: query || undefined, limit: 30 },
    { enabled: true }
  );

  const reprint = trpc.labelReprint.reprintProductLabel.useMutation({
    onSuccess: (result) => {
      toast.success("Etiqueta gerada!");
      openPdfInNewTab(result.pdf);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <SubScreenWrapper title="Etiquetas de Produtos" onBack={onBack}>
      <SearchBar
        value={search}
        onChange={setSearch}
        onSearch={() => setQuery(search)}
        placeholder="Código, SKU ou lote..."
      />
      {isLoading && <LoadingRow />}
      {!isLoading && data?.length === 0 && <EmptyRow />}
      {data?.map((row) => (
        <ItemRow
          key={row.id}
          primary={row.labelCode}
          secondary={[row.productName, row.batch ? `Lote: ${row.batch}` : null]
            .filter(Boolean)
            .join(" · ")}
          badge={row.status}
          loading={reprint.isPending}
          onPrint={() => reprint.mutate({ labelCode: row.labelCode })}
        />
      ))}
    </SubScreenWrapper>
  );
}

function LocationsSubScreen({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading } = trpc.labelReprint.listLocations.useQuery(
    { search: query || undefined, limit: 50 },
    { enabled: true }
  );

  const reprint = trpc.labelReprint.reprintLocation.useMutation({
    onSuccess: (result) => {
      toast.success("Etiqueta gerada!");
      openPdfInNewTab(result.pdf);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <SubScreenWrapper title="Etiquetas de Endereços" onBack={onBack}>
      <SearchBar
        value={search}
        onChange={setSearch}
        onSearch={() => setQuery(search)}
        placeholder="Código do endereço..."
      />
      {isLoading && <LoadingRow />}
      {!isLoading && data?.length === 0 && <EmptyRow />}
      {data?.map((row) => (
        <ItemRow
          key={row.id}
          primary={row.code}
          secondary={[row.zoneCode, row.aisle, row.rack, row.level]
            .filter(Boolean)
            .join(" / ")}
          badge={row.status}
          loading={reprint.isPending}
          onPrint={() => reprint.mutate({ locationId: row.id })}
        />
      ))}
    </SubScreenWrapper>
  );
}

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------

function SubScreenWrapper({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500">Selecione um item para reimprimir</p>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
        placeholder={placeholder}
        className="flex-1 bg-white border-slate-300"
      />
      <Button onClick={onSearch} size="icon" className="bg-blue-600 hover:bg-blue-700 text-white">
        <Search className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ItemRow({
  primary,
  secondary,
  badge,
  loading,
  onPrint,
}: {
  primary: string;
  secondary: string;
  badge?: string | null;
  loading: boolean;
  onPrint: () => void;
}) {
  return (
    <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <div className="flex-1 min-w-0 mr-3">
        <p className="font-semibold text-slate-800 truncate">{primary}</p>
        {secondary && (
          <p className="text-sm text-slate-500 truncate mt-0.5">{secondary}</p>
        )}
        {badge && (
          <Badge variant="outline" className="mt-1 text-xs capitalize">
            {badge}
          </Badge>
        )}
      </div>
      <Button
        size="sm"
        onClick={onPrint}
        disabled={loading}
        className="bg-slate-700 hover:bg-slate-800 text-white shrink-0"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-8 text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />
      <span>Carregando...</span>
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="text-center py-8 text-slate-500">
      <p className="text-sm">Nenhum item encontrado.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CollectorLabelReprint() {
  const [activeType, setActiveType] = useState<LabelType | null>(null);

  const handleBack = useCallback(() => setActiveType(null), []);

  const renderSubScreen = () => {
    switch (activeType) {
      case "receiving":
        return <ReceivingSubScreen onBack={handleBack} />;
      case "waves":
        return <WavesSubScreen onBack={handleBack} />;
      case "shipments":
        return <ShipmentsSubScreen onBack={handleBack} />;
      case "products":
        return <ProductsSubScreen onBack={handleBack} />;
      case "locations":
        return <LocationsSubScreen onBack={handleBack} />;
      default:
        return null;
    }
  };

  return (
    <CollectorLayout title="Coletor de Dados">
      {activeType ? (
        renderSubScreen()
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">
              Reimpressão de Etiquetas
            </h2>
            <p className="text-slate-200 drop-shadow text-sm">
              Escolha o tipo de etiqueta que deseja reimprimir
            </p>
          </div>

          {/* Menu de tipos */}
          <div className="space-y-3">
            {LABEL_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.key}
                  onClick={() => setActiveType(type.key)}
                  className="w-full flex items-center gap-4 bg-white/95 rounded-xl border border-slate-200 px-4 py-4 shadow-sm hover:shadow-md hover:bg-white transition-all text-left"
                >
                  <div className={`p-3 rounded-xl ${type.iconBg} shrink-0`}>
                    <Icon className={`h-7 w-7 ${type.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-base leading-tight">
                      {type.title}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5 leading-tight">
                      {type.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Atalhos Rápidos */}
          <div className="bg-white/90 rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-600 mb-3">Atalhos Rápidos</p>
            <div className="grid grid-cols-2 gap-3">
              <a href="/stock">
                <Button
                  variant="outline"
                  className="w-full h-12 border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700 hover:text-white"
                >
                  Ver Estoque
                </Button>
              </a>
              <a href="/collector">
                <Button
                  variant="outline"
                  className="w-full h-12 border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700 hover:text-white"
                >
                  Menu Principal
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </CollectorLayout>
  );
}
