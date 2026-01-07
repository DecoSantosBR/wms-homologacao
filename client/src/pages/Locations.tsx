import PageHeader from "@/components/PageHeader";
import { MapPin } from "lucide-react";

export default function Locations() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        icon={<MapPin className="h-8 w-8" />}
        title="Endereços"
        description="Gestão de endereços de armazenagem"
      />
      <main className="container mx-auto px-6 py-8">
        <div className="text-center py-16 text-gray-500">Módulo em desenvolvimento</div>
      </main>
    </div>
  );
}
