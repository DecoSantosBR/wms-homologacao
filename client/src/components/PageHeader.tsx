import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ icon, title, description, actions }: PageHeaderProps) {
  const [, setLocation] = useLocation();

  return (
    <>
      {/* Top Navigation Bar */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Início
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-blue-600">Med@x</h1>
            <span className="text-xs text-gray-500">WMS</span>
          </div>
        </div>
      </header>

      {/* Page Title Section */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {icon && (
                <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                  {icon}
                </div>
              )}
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
                {description && (
                  <p className="text-gray-600">{description}</p>
                )}
              </div>
            </div>
            {actions && (
              <div className="flex items-center gap-3">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
