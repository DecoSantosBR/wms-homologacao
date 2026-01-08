import { Link } from "wouter";
import { Users, Package, MapPin, UserCog } from "lucide-react";

export default function Cadastros() {
  const modules = [
    {
      id: "clientes",
      title: "Clientes",
      description: "Gestão de clientes e contratos",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      href: "/tenants",
      features: [
        "Cadastrar clientes",
        "Gerenciar contratos",
        "Visualizar informações",
      ],
    },
    {
      id: "produtos",
      title: "Produtos",
      description: "Catálogo de produtos e medicamentos",
      icon: Package,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      href: "/products",
      features: [
        "Cadastrar produtos",
        "Controlar SKUs",
        "Gerenciar estoque mínimo",
      ],
    },
    {
      id: "enderecos",
      title: "Endereços",
      description: "Estrutura de armazenagem do depósito",
      icon: MapPin,
      color: "text-green-600",
      bgColor: "bg-green-50",
      href: "/locations",
      features: [
        "Cadastrar endereços",
        "Definir zonas",
        "Configurar regras",
      ],
    },
    {
      id: "usuarios",
      title: "Usuários",
      description: "Controle de acesso e permissões",
      icon: UserCog,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      href: "/users",
      features: [
        "Gerenciar usuários",
        "Atribuir perfis",
        "Controlar permissões",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <a className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent hover:from-blue-700 hover:to-blue-900 transition-all">
                  Med@x
                </a>
              </Link>
              <span className="text-slate-400 font-light">WMS</span>
            </div>
            <nav className="flex items-center gap-6">
              <Link href="/">
                <a className="text-slate-600 hover:text-blue-600 transition-colors font-medium">
                  Início
                </a>
              </Link>
              <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
                <span className="text-sm text-slate-600">Bem-vindo, A Santos</span>
                <button className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
                  Sair
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-3">
            Cadastros
          </h1>
          <p className="text-lg text-slate-600">
            Gestão de dados mestre do sistema
          </p>
        </div>

        {/* Module Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.id} href={module.href}>
                <a className="block group">
                  <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-200 hover:border-blue-300 h-full">
                    {/* Icon and Title */}
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className={`${module.bgColor} ${module.color} p-3 rounded-lg group-hover:scale-110 transition-transform duration-300`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                          {module.title}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {module.description}
                        </p>
                      </div>
                    </div>

                    {/* Features List */}
                    <ul className="space-y-2 mb-4">
                      {module.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-slate-600 flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Action Button */}
                    <button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-300 shadow-md hover:shadow-lg">
                      Acessar Módulo
                    </button>
                  </div>
                </a>
              </Link>
            );
          })}
        </div>

        {/* Back Button */}
        <div className="text-center mt-8">
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Voltar ao Dashboard
            </a>
          </Link>
        </div>
      </main>
    </div>
  );
}
