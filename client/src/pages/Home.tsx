import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ClipboardList, 
  Package, 
  Truck, 
  FileText, 
  Upload, 
  Warehouse, 
  BarChart3 
} from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.dashboard.stats.useQuery();

  const modules = [
    {
      icon: ClipboardList,
      title: "Recebimento",
      description: "Agendamento e conferência de mercadorias que chegam ao armazém",
      features: [
        "Agendar recebimentos",
        "Conferir mercadorias",
        "Registrar entradas"
      ],
      path: "/receiving",
      color: "text-blue-600"
    },
    {
      icon: Package,
      title: "Separação",
      description: "Picking e separação de pedidos para expedição",
      features: [
        "Listar pedidos",
        "Separar itens",
        "Confirmar picking"
      ],
      path: "/picking",
      color: "text-blue-600"
    },
    {
      icon: Truck,
      title: "Expedição",
      description: "Carregamento e rastreamento de mercadorias",
      features: [
        "Carregar veículos",
        "Rastrear entregas",
        "Confirmar expedições"
      ],
      path: "/shipping",
      color: "text-blue-600"
    },
    {
      icon: FileText,
      title: "Cadastros",
      description: "Gestão de dados mestre do sistema",
      features: [
        "Cadastrar clientes",
        "Gerenciar produtos",
        "Configurar endereços",
        "Gerenciar usuários"
      ],
      path: "/cadastros",
      color: "text-purple-600"
    },
    {
      icon: Upload,
      title: "Importação NF",
      description: "Upload de XMLs de notas fiscais",
      features: [
        "Importar XML",
        "Gerar OTs automaticamente",
        "Histórico de importações"
      ],
      path: "/import-nfe",
      color: "text-orange-600"
    },
    {
      icon: Warehouse,
      title: "Estoque",
      description: "Controle e rastreabilidade de inventário",
      features: [
        "Consultar posições",
        "Movimentações",
        "Dashboard de ocupação",
        "Histórico de etiquetas"
      ],
      path: "/inventory",
      color: "text-green-600"
    },
    {
      icon: BarChart3,
      title: "Relatórios",
      description: "KPIs, dashboards e auditoria",
      features: [
        "Rastreabilidade",
        "Performance",
        "Conformidade"
      ],
      path: "/reports",
      color: "text-blue-600"
    }
  ];

  const statsCards = [
    { label: "Recebimentos Hoje", value: stats?.receivingToday || 0 },
    { label: "Pedidos em Separação", value: stats?.pickingInProgress || 0 },
    { label: "Expedições Pendentes", value: stats?.shippingPending || 0 },
    { label: "Total Processado", value: stats?.totalProcessed || 0 }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-blue-600">Med@x</h1>
            <span className="text-sm text-gray-500">WMS</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Bem-vindo, A Santos</span>
            <Button variant="ghost" size="sm">Sair</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {/* Title Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-3">
            Sistema de Gerenciamento de Armazém
          </h2>
          <p className="text-lg text-gray-600">
            Gerencie todas as operações do seu armazém de forma eficiente
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Card key={module.title} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-3 mb-2">
                    <div className={`p-2 rounded-lg bg-blue-50 ${module.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">{module.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {module.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {module.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="w-1 h-1 bg-gray-400 rounded-full" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => setLocation(module.path)}
                  >
                    Acessar Módulo
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, idx) => (
            <Card key={idx} className="text-center">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600 mb-2">{stat.label}</div>
                <div className="text-4xl font-bold text-blue-600">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
