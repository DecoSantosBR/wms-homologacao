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
        <div className="container mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="gap-1 sm:gap-2 h-9 px-2 sm:px-3"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="gap-1 sm:gap-2 h-9 px-2 sm:px-3"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Início</span>
            </Button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-blue-600">Med@x</h1>
            <span className="text-xs text-gray-500">WMS</span>
          </div>
        </div>
      </header>

      {/* Page Title Section */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4 w-full sm:w-auto">
              {icon && (
                <div className="p-2 sm:p-3 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
                  {icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">{title}</h2>
                {description && (
                  <p className="text-sm sm:text-base text-gray-600">{description}</p>
                )}
              </div>
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
