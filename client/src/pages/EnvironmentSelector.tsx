/**
 * EnvironmentSelector.tsx
 *
 * Página de seleção de ambiente - Raiz do sistema (/)
 * Permite escolher entre Med@x WMS (sistema interno) ou Portal do Cliente
 */

import { Link } from "wouter";
import { Package, Users, ArrowRight, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EnvironmentSelector() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-slate-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl shadow-xl mb-6">
            <Package className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Med@x WMS</h1>
          <p className="text-lg text-slate-600">
            Sistema de Gerenciamento de Armazém Farmacêutico
          </p>
        </div>

        {/* Environment Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Med@x WMS Card */}
          <Card className="group hover:shadow-2xl transition-all duration-300 border-2 hover:border-blue-500 bg-white">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl group-hover:bg-blue-600 transition-colors">
                  <Building2 className="h-7 w-7 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-full group-hover:bg-blue-100 transition-colors">
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
              <CardTitle className="text-2xl text-slate-900">Med@x WMS</CardTitle>
              <CardDescription className="text-base text-slate-600">
                Sistema interno de gerenciamento de armazém
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700 mb-3">Funcionalidades:</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    <span>Recebimento e conferência de mercadorias</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    <span>Separação e expedição de pedidos</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    <span>Controle de estoque e rastreabilidade</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    <span>Gestão de cadastros e relatórios</span>
                  </li>
                </ul>
              </div>

              <Link href="/home">
                <Button 
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all"
                >
                  Acessar Sistema WMS
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>

              <p className="text-xs text-center text-slate-500">
                Para colaboradores e operadores do armazém
              </p>
            </CardContent>
          </Card>

          {/* Portal do Cliente Card */}
          <Card className="group hover:shadow-2xl transition-all duration-300 border-2 hover:border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-center w-14 h-14 bg-slate-700 rounded-2xl group-hover:bg-slate-600 transition-colors">
                  <Users className="h-7 w-7 text-slate-300 group-hover:text-white transition-colors" />
                </div>
                <div className="flex items-center justify-center w-10 h-10 bg-slate-700 rounded-full group-hover:bg-slate-600 transition-colors">
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-slate-200 transition-colors" />
                </div>
              </div>
              <CardTitle className="text-2xl text-white">Portal do Cliente</CardTitle>
              <CardDescription className="text-base text-slate-400">
                Acompanhamento de estoques e pedidos em tempo real
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-300 mb-3">Funcionalidades:</p>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 bg-slate-500 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    <span>Visualização de posições de estoque</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 bg-slate-500 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    <span>Acompanhamento de pedidos e status</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 bg-slate-500 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    <span>Histórico de recebimentos</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 bg-slate-500 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    <span>Dashboard com KPIs em tempo real</span>
                  </li>
                </ul>
              </div>

              <Link href="/portal/login">
                <Button 
                  className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-base shadow-md hover:shadow-lg transition-all"
                >
                  Acessar Portal do Cliente
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>

              <p className="text-xs text-center text-slate-500">
                Para clientes com acesso cadastrado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-slate-600">
            © {new Date().getFullYear()} Med@x — Sistema de Gerenciamento de Armazém Farmacêutico
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Conformidade ANVISA RDC 430/2020 • Rastreabilidade Total
          </p>
        </div>
      </div>
    </div>
  );
}
