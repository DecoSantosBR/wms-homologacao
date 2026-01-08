import { PageHeader } from "@/components/PageHeader";
import { ClipboardList } from "lucide-react";

export default function Receiving() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        icon={<ClipboardList className="h-8 w-8" />}
        title="Recebimento"
        description="Gestão de recebimento de mercadorias"
      />
      <main className="container mx-auto px-6 py-8">
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium mb-2">Módulo em desenvolvimento</p>
          <p className="text-sm text-muted-foreground">
            Backend completo implementado com 7 endpoints funcionais.
            <br />
            Interface frontend será implementada na próxima sessão.
          </p>
        </div>
      </main>
    </div>
  );
}
