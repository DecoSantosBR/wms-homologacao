import PageHeader from "@/components/PageHeader";
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
        <div className="text-center py-16 text-gray-500">Módulo em desenvolvimento</div>
      </main>
    </div>
  );
}
