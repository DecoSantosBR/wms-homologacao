import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Warehouse, Users, TruckIcon, ClipboardList } from "lucide-react";

export default function Home() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Carregando estatísticas...</div>
      </div>
    );
  }

  const cards = [
    {
      title: "Clientes",
      value: stats?.tenants || 0,
      description: "Clientes cadastrados",
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Produtos",
      value: stats?.products || 0,
      description: "Produtos cadastrados",
      icon: Package,
      color: "text-green-600",
    },
    {
      title: "Endereços",
      value: stats?.locations || 0,
      description: "Posições de armazenagem",
      icon: Warehouse,
      color: "text-purple-600",
    },
    {
      title: "Recebimentos Pendentes",
      value: stats?.receivingPending || 0,
      description: "Aguardando conferência",
      icon: TruckIcon,
      color: "text-orange-600",
    },
    {
      title: "Pickings Pendentes",
      value: stats?.pickingPending || 0,
      description: "Aguardando separação",
      icon: ClipboardList,
      color: "text-red-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema de gerenciamento de armazém
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao WMS Med@x</CardTitle>
          <CardDescription>
            Sistema de Gerenciamento de Armazém para operadores logísticos da área da saúde
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Funcionalidades Principais:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Gestão de clientes (multi-tenant)</li>
              <li>Cadastro de produtos com rastreabilidade</li>
              <li>Controle de endereços de armazenagem</li>
              <li>Recebimento com conferência cega</li>
              <li>Picking (separação de pedidos)</li>
              <li>Controle de estoque em tempo real</li>
              <li>Conformidade com ANVISA (RDC 430/2020)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
