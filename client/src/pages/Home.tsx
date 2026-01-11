import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { 
  ClipboardCheck, 
  Package, 
  Truck, 
  FileText, 
  Upload,
  BarChart3,
  Warehouse,
  Shield
} from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  // Estado de carregamento
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Usuário não autenticado - mostrar tela de login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mb-4">
              <h1 className="text-4xl font-bold text-primary">Med@x</h1>
              <p className="text-sm text-muted-foreground mt-1">WMS</p>
            </div>
            <CardTitle className="text-2xl">Sistema de Gerenciamento de Armazém</CardTitle>
            <CardDescription>
              Gerencie todas as operações do seu armazém farmacêutico de forma eficiente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="lg">
              <a href={getLoginUrl()}>Entrar no Sistema</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Definição de módulos com suas propriedades
  const modules = [
    {
      title: "Recebimento",
      description: "Agendamento e conferência de mercadorias que chegam ao armazém",
      icon: ClipboardCheck,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      features: [
        "Agendar recebimentos",
        "Conferir mercadorias",
        "Registrar entradas"
      ],
      href: "/receiving"
    },
    {
      title: "Separação",
      description: "Picking e separação de pedidos para expedição",
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      features: [
        "Listar pedidos",
        "Separar itens",
        "Confirmar picking"
      ],
      href: "/picking/execute"
    },
    {
      title: "Expedição",
      description: "Carregamento e rastreamento de mercadorias",
      icon: Truck,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      features: [
        "Carregar veículos",
        "Rastrear entregas",
        "Confirmar expedições"
      ],
      href: "/shipping"
    },
    {
      title: "Cadastros",
      description: "Gestão de dados mestre do sistema",
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      features: [
        "Cadastrar clientes",
        "Gerenciar produtos",
        "Configurar endereços",
        "Gerenciar usuários"
      ],
      href: "/cadastros"
    },
    {
      title: "Importação NF",
      description: "Upload de XML de notas fiscais",
      icon: Upload,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      features: [
        "Importar XML",
        "Gerar OTs automaticamente",
        "Histórico de importações"
      ],
      href: "/nfe-import"
    },
    {
      title: "Estoque",
      description: "Controle e rastreabilidade de inventário",
      icon: Warehouse,
      color: "text-green-600",
      bgColor: "bg-green-50",
      features: [
        "Consultar posições",
        "Movimentações",
        "Dashboard de ocupação",
        "Histórico de etiquetas"
      ],
      href: "/stock"
    },
    {
      title: "Relatórios",
      description: "KPIs, dashboards e auditoria",
      icon: BarChart3,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      features: [
        "Rastreabilidade",
        "Performance",
        "Conformidade"
      ],
      href: "/reports"
    },
    {
      title: "Admin",
      description: "Gerenciamento e limpeza de dados do sistema",
      icon: Shield,
      color: "text-red-600",
      bgColor: "bg-red-50",
      features: [
        "Limpeza de dados",
        "Auditoria",
        "Conformidade"
      ],
      href: "/admin"
    }
  ];

  // Estatísticas rápidas
  const stats = [
    { label: "Recebimentos Hoje", value: "12" },
    { label: "Pedidos em Separação", value: "28" },
    { label: "Expedições Pendentes", value: "15" },
    { label: "Total Processado", value: "55" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold">Med@x</h1>
              <span className="text-sm text-muted-foreground">WMS</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Bem-vindo, <span className="font-medium text-foreground">{user?.name || "Usuário"}</span>
              </span>
              <Button variant="outline" size="sm" onClick={() => logout()}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-3">
            Sistema de Gerenciamento de Armazém
          </h2>
          <p className="text-lg text-muted-foreground">
            Gerencie todas as operações do seu armazém de forma eficiente
          </p>
        </div>

        {/* Grid de Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Card key={module.title} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${module.bgColor}`}>
                      <Icon className={`h-6 w-6 ${module.color}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{module.title}</CardTitle>
                      <CardDescription>{module.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {module.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="text-primary">•</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href={module.href}>
                    <Button className="w-full">Acessar Módulo</Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-primary">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
