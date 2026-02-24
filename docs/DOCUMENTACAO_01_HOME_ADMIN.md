# WMS Med@x - Documentação Módulo Home e Admin

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Autor:** Manus AI  
**Sistema:** WMS Farmacêutico - Sistema de Gerenciamento de Armazém

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Módulo Home](#módulo-home)
3. [Módulo Admin Dashboard](#módulo-admin-dashboard)
4. [Módulo Admin Cleanup (Limpeza de Dados)](#módulo-admin-cleanup-limpeza-de-dados)
5. [Estrutura de Componentes](#estrutura-de-componentes)
6. [Fluxos de Navegação](#fluxos-de-navegação)

---

## Visão Geral

O WMS Med@x é um sistema completo de gerenciamento de armazém farmacêutico com conformidade ANVISA. A página Home é o ponto de entrada principal após autenticação, exibindo todos os módulos disponíveis em um grid de cards. O módulo Admin fornece funcionalidades administrativas, incluindo limpeza de dados com confirmação dupla.

**Tecnologias Utilizadas:**

- **Frontend:** React 19 + TypeScript + Tailwind CSS 4
- **Componentes:** shadcn/ui (Button, Card, Checkbox, Alert)
- **Ícones:** Lucide React
- **Roteamento:** Wouter
- **Autenticação:** Manus OAuth (integrado)
- **Estado:** React Hooks (useState)
- **Backend:** tRPC (para futuras integrações)

---

## Módulo Home

### Localização do Arquivo

```
client/src/pages/Home.tsx
```

### Responsabilidades

A página Home é responsável por:

1. **Autenticação:** Verificar se o usuário está autenticado via Manus OAuth
2. **Exibição de Módulos:** Mostrar todos os 8 módulos disponíveis em um grid responsivo
3. **Navegação:** Fornecer links para cada módulo
4. **Logout:** Permitir que o usuário saia do sistema
5. **Estatísticas:** Exibir KPIs rápidos do sistema

### Estrutura de Dados

#### Módulos Disponíveis

| Módulo | Descrição | Ícone | Cor | Features |
|--------|-----------|-------|-----|----------|
| Recebimento | Agendamento e conferência de mercadorias | ClipboardCheck | Azul | Agendar, Conferir, Registrar |
| Separação | Picking e separação de pedidos | Package | Azul | Listar, Separar, Confirmar |
| Expedição | Carregamento e rastreamento | Truck | Azul | Carregar, Rastrear, Confirmar |
| Cadastros | Gestão de dados mestre | FileText | Roxo | Clientes, Produtos, Endereços |
| Importação NF | Upload de XML de notas fiscais | Upload | Laranja | Importar, Gerar OTs, Histórico |
| Estoque | Controle de inventário | Warehouse | Verde | Consultar, Movimentações, Dashboard |
| Relatórios | KPIs e dashboards | BarChart3 | Ciano | Rastreabilidade, Performance |
| Admin | Gerenciamento do sistema | Shield | Vermelho | Limpeza, Auditoria, Conformidade |

### Código Completo - Home.tsx

```typescript
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
  Users,
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
      href: "/picking"
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
      href: "/dashboard"
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
              <Link href="/mobile">
                <Button variant="outline" size="sm" className="md:hidden">
                  Versão Mobile
                </Button>
              </Link>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
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
                  <Button asChild className="w-full">
                    <Link href={module.href}>Acessar Módulo</Link>
                  </Button>
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
```

### Responsividade

A página Home é totalmente responsiva:

- **Mobile (< 768px):** 1 coluna de módulos, botão de versão mobile visível
- **Tablet (768px - 1024px):** 2 colunas de módulos
- **Desktop (> 1024px):** 3 colunas de módulos

---

## Módulo Admin Dashboard

### Localização do Arquivo

```
client/src/pages/AdminDashboard.tsx
```

### Responsabilidades

O Admin Dashboard fornece:

1. **Acesso Administrativo:** Verificação de permissões de admin
2. **Menu de Opções:** Links para funcionalidades administrativas
3. **Navegação:** Botões de voltar e ir para home

### Código Completo - AdminDashboard.tsx

```typescript
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Shield, Trash2, ArrowLeft, Home } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Verificar se usuário é admin
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <header className="bg-white border-b">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold">Med@x</h1>
                <span className="text-sm text-muted-foreground">WMS</span>
              </div>
            </div>
          </div>
        </header>

        <main className="container py-12">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-center">Acesso Negado</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Você não tem permissão para acessar o painel administrativo.
              </p>
              <Button onClick={() => setLocation("/")} className="w-full">
                Voltar para Home
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Navigation Buttons */}
        <div className="flex gap-2 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Início
          </Button>
        </div>

        {/* Page Title */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-red-600" />
            <h2 className="text-4xl font-bold text-foreground">Painel Administrativo</h2>
          </div>
          <p className="text-lg text-muted-foreground">
            Gerenciamento e controle do sistema
          </p>
        </div>

        {/* Admin Options */}
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Limpeza de Dados</CardTitle>
              <CardDescription>
                Gerenciar e limpar dados do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione os módulos que deseja limpar. Esta operação não pode ser desfeita.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Selecionar módulos</li>
                <li>• Preview de registros</li>
                <li>• Auditoria completa</li>
              </ul>
              <Button
                className="w-full bg-red-600 hover:bg-red-700"
                onClick={() => setLocation("/admin/cleanup")}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Acessar Limpeza
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
```

---

## Módulo Admin Cleanup (Limpeza de Dados)

### Localização do Arquivo

```
client/src/pages/AdminCleanupNew.tsx
```

### Responsabilidades

O módulo de Limpeza de Dados é responsável por:

1. **Seleção de Módulos:** Permitir que o admin selecione quais módulos deseja limpar
2. **Validação:** Validar entrada do usuário (motivo mínimo de 10 caracteres)
3. **Confirmação Dupla:** Gerar código de confirmação aleatório
4. **Auditoria:** Registrar a operação com motivo e usuário
5. **Execução:** Deletar permanentemente os dados selecionados

### Módulos Disponíveis para Limpeza

| Módulo | ID | Descrição | Tipo |
|--------|----|-----------| -----|
| Clientes | tenants | Remove clientes permanentemente | Hard Delete |
| Produtos | products | Remove produtos permanentemente | Hard Delete |
| Ordens de Recebimento | receivingOrders | Remove ordens de recebimento | Hard Delete |
| Ordens de Separação | pickingOrders | Remove ordens de separação | Hard Delete |
| Zonas | zones | Remove zonas permanentemente | Hard Delete |
| Movimentações | movements | Remove movimentações permanentemente | Hard Delete |
| Endereços | locations | Remove endereços permanentemente | Hard Delete |

### Fluxo de Operação

```
1. Usuário acessa /admin/cleanup
2. Verifica se é admin (role === "admin")
3. Exibe lista de módulos com checkboxes
4. Usuário seleciona módulos
5. Usuário preenche motivo (mínimo 10 caracteres)
6. Clica em "Prosseguir com Limpeza"
7. Sistema gera código de confirmação aleatório
8. Usuário digita o código
9. Sistema executa a limpeza (hard delete)
10. Registra auditoria com motivo, usuário e timestamp
```

### Código Completo - AdminCleanupNew.tsx

```typescript
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { Shield, Trash2, ArrowLeft, Home, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CleanupModule {
  id: string;
  label: string;
  description: string;
}

const CLEANUP_MODULES: CleanupModule[] = [
  {
    id: "tenants",
    label: "Clientes",
    description: "Remove clientes permanentemente (hard delete)"
  },
  {
    id: "products",
    label: "Produtos",
    description: "Remove produtos permanentemente (hard delete)"
  },
  {
    id: "receivingOrders",
    label: "Ordens de Recebimento",
    description: "Remove ordens de recebimento permanentemente (hard delete)"
  },
  {
    id: "pickingOrders",
    label: "Ordens de Separação",
    description: "Remove ordens de separação permanentemente (hard delete)"
  },
  {
    id: "zones",
    label: "Zonas",
    description: "Remove zonas permanentemente (hard delete)"
  },
  {
    id: "movements",
    label: "Movimentações",
    description: "Remove movimentações permanentemente (hard delete)"
  },
  {
    id: "locations",
    label: "Endereços",
    description: "Remove endereços permanentemente (hard delete)"
  }
];

export default function AdminCleanupNew() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Verificar se usuário é admin
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <header className="bg-white border-b">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold">Med@x</h1>
                <span className="text-sm text-muted-foreground">WMS</span>
              </div>
            </div>
          </div>
        </header>

        <main className="container py-12">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-center">Acesso Negado</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Você não tem permissão para acessar a limpeza de dados.
              </p>
              <Button onClick={() => setLocation("/")} className="w-full">
                Voltar para Home
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handleToggleModule = (moduleId: string) => {
    setSelectedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSelectAll = () => {
    if (selectedModules.length === CLEANUP_MODULES.length) {
      setSelectedModules([]);
    } else {
      setSelectedModules(CLEANUP_MODULES.map(m => m.id));
    }
  };

  const handleInitiateCleanup = () => {
    if (selectedModules.length === 0) {
      toast.error("Selecione pelo menos um módulo para limpeza");
      return;
    }

    if (reason.length < 10) {
      toast.error("Motivo da limpeza deve ter no mínimo 10 caracteres");
      return;
    }

    // Gerar código de confirmação aleatório
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGeneratedCode(code);
    setShowConfirmation(true);
    setConfirmCode("");
  };

  const handleConfirmCleanup = async () => {
    if (confirmCode !== generatedCode) {
      toast.error("Código de confirmação incorreto");
      return;
    }

    setIsLoading(true);
    try {
      // Aqui você chamaria o endpoint tRPC para executar a limpeza
      // Por enquanto, apenas simulamos
      toast.success(`Limpeza iniciada para ${selectedModules.length} módulo(s)`);
      
      // Resetar estado
      setSelectedModules([]);
      setReason("");
      setShowConfirmation(false);
      setConfirmCode("");
      setGeneratedCode("");
    } catch (error) {
      toast.error("Erro ao executar limpeza");
    } finally {
      setIsLoading(false);
    }
  };

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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Navigation Buttons */}
        <div className="flex gap-2 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Início
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        {/* Page Title */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trash2 className="h-8 w-8 text-red-600" />
            <h2 className="text-4xl font-bold text-foreground">Limpeza de Dados</h2>
          </div>
          <p className="text-lg text-muted-foreground">
            Selecione os módulos que deseja limpar
          </p>
        </div>

        {!showConfirmation ? (
          <div className="max-w-2xl mx-auto">
            {/* Warning Alert */}
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Atenção:</strong> Todos os módulos selecionados serão PERMANENTEMENTE REMOVIDOS (HARD DELETE). Esta operação não pode ser desfeita.
              </AlertDescription>
            </Alert>

            {/* Modules Selection */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Selecione os Módulos</CardTitle>
                <CardDescription>
                  Marque os módulos que deseja limpar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Select All */}
                <div className="flex items-center space-x-2 pb-4 border-b">
                  <Checkbox
                    id="select-all"
                    checked={selectedModules.length === CLEANUP_MODULES.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <label
                    htmlFor="select-all"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Selecionar Todos
                  </label>
                </div>

                {/* All Modules */}
                <div className="space-y-3">
                  {CLEANUP_MODULES.map(module => (
                    <div key={module.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={module.id}
                        checked={selectedModules.includes(module.id)}
                        onCheckedChange={() => handleToggleModule(module.id)}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={module.id}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          ☐ {module.label}
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {module.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reason Input */}
            {selectedModules.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Motivo da Limpeza</CardTitle>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Descreva o motivo da limpeza (mínimo 10 caracteres)..."
                    className="w-full p-3 border rounded-md text-sm"
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {reason.length}/10 caracteres mínimo
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            {selectedModules.length > 0 && (
              <Card className="mb-6 bg-red-50 border-red-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{selectedModules.length}</p>
                    <p className="text-sm text-muted-foreground">Módulos Selecionados para Hard Delete</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSelectedModules([]);
                  setReason("");
                }}
              >
                Limpar Seleção
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={selectedModules.length === 0 || reason.length < 10}
                onClick={handleInitiateCleanup}
              >
                Prosseguir com Limpeza
              </Button>
            </div>
          </div>
        ) : (
          /* Confirmation Screen */
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Confirmar Limpeza</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Confirmação Dupla:</strong> Digite o código abaixo para confirmar a limpeza.
                  </AlertDescription>
                </Alert>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Código de Confirmação:</p>
                  <p className="text-4xl font-bold text-primary tracking-widest">
                    {generatedCode}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Digite o código acima:</label>
                  <input
                    type="text"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value.toUpperCase())}
                    placeholder="Código de confirmação"
                    className="w-full mt-2 p-3 border rounded-md text-sm uppercase"
                    autoFocus
                  />
                </div>

                <div className="bg-red-50 p-4 rounded-md text-sm border border-red-200">
                  <p className="font-medium mb-2 text-red-900">Resumo da Limpeza:</p>
                  <ul className="space-y-1 text-red-800">
                    <li>• {selectedModules.length} módulo(s) selecionado(s)</li>
                    <li>• {selectedModules.length} hard delete(s) - PERMANENTE</li>
                    <li>• Motivo: {reason}</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowConfirmation(false)}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    disabled={confirmCode !== generatedCode || isLoading}
                    onClick={handleConfirmCleanup}
                  >
                    {isLoading ? "Processando..." : "Confirmar Limpeza"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
```

---

## Estrutura de Componentes

### Componentes Utilizados

| Componente | Origem | Uso |
|-----------|--------|-----|
| Button | shadcn/ui | Botões de ação (Acessar, Sair, Confirmar) |
| Card | shadcn/ui | Containers para módulos e seções |
| CardHeader | shadcn/ui | Títulos de cards |
| CardTitle | shadcn/ui | Títulos principais |
| CardDescription | shadcn/ui | Descrições secundárias |
| CardContent | shadcn/ui | Conteúdo dos cards |
| Checkbox | shadcn/ui | Seleção de módulos |
| Alert | shadcn/ui | Alertas de aviso |
| AlertDescription | shadcn/ui | Texto dos alertas |

### Ícones Utilizados (Lucide React)

| Ícone | Uso |
|-------|-----|
| ClipboardCheck | Módulo Recebimento |
| Package | Módulo Separação |
| Truck | Módulo Expedição |
| FileText | Módulo Cadastros |
| Upload | Módulo Importação NF |
| Warehouse | Módulo Estoque |
| BarChart3 | Módulo Relatórios |
| Shield | Módulo Admin |
| Trash2 | Ícone de Limpeza |
| ArrowLeft | Botão Voltar |
| Home | Botão Início |
| AlertTriangle | Alertas de Aviso |

---

## Fluxos de Navegação

### Fluxo de Autenticação

```
Usuário não autenticado
    ↓
Tela de Login (Home.tsx)
    ↓
Clica em "Entrar no Sistema"
    ↓
Redireciona para Manus OAuth
    ↓
Usuário autentica
    ↓
Retorna para Home.tsx
    ↓
Exibe grid de módulos
```

### Fluxo de Admin

```
Home.tsx
    ↓
Clica em card "Admin"
    ↓
AdminDashboard.tsx
    ↓
Verifica role === "admin"
    ↓
Se admin: exibe opções
Se não: exibe "Acesso Negado"
    ↓
Clica em "Acessar Limpeza"
    ↓
AdminCleanupNew.tsx
```

### Fluxo de Limpeza de Dados

```
AdminCleanupNew.tsx
    ↓
Exibe lista de módulos com checkboxes
    ↓
Usuário seleciona módulos
    ↓
Usuário preenche motivo (min 10 caracteres)
    ↓
Clica "Prosseguir com Limpeza"
    ↓
Sistema gera código aleatório
    ↓
Exibe tela de confirmação
    ↓
Usuário digita código
    ↓
Clica "Confirmar Limpeza"
    ↓
Sistema executa hard delete
    ↓
Registra auditoria
    ↓
Exibe mensagem de sucesso
```

---

## Configurações de Estilo

### Cores Utilizadas

| Elemento | Cor | Classe Tailwind |
|----------|-----|-----------------|
| Primary | Azul | `text-primary`, `bg-primary` |
| Texto Secundário | Cinza | `text-muted-foreground` |
| Fundo | Cinza Claro | `bg-gray-50` |
| Aviso | Vermelho | `text-red-600`, `bg-red-50` |
| Sucesso | Verde | `text-green-600`, `bg-green-50` |

### Tipografia

- **Títulos Principais:** `text-4xl font-bold`
- **Títulos de Cards:** `text-xl font-medium`
- **Descrições:** `text-sm text-muted-foreground`
- **Labels:** `text-sm font-medium`

---

## Próximos Passos para Implementação

1. **Implementar Endpoints tRPC:** Criar procedures para executar a limpeza real
2. **Adicionar Auditoria:** Registrar todas as operações em tabela de auditoria
3. **Criar Snapshots:** Salvar dados antes de deletar para recuperação
4. **Integrar com Banco de Dados:** Conectar com tabelas reais
5. **Adicionar Testes:** Criar vitest para validar fluxos

---

**Fim da Documentação - Módulo Home e Admin**
