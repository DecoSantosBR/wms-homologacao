import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Package, Scan, TruckIcon, ArrowLeftRight, Home } from "lucide-react";
import { Button } from "./ui/button";

interface CollectorLayoutProps {
  children: ReactNode;
  title: string;
}

export function CollectorLayout({ children, title }: CollectorLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { path: "/collector", icon: Home, label: "Início" },
    { path: "/collector/receiving", icon: Package, label: "Recebimento" },
    { path: "/collector/picking", icon: Scan, label: "Picking" },
    { path: "/collector/stage", icon: TruckIcon, label: "Stage" },
    { path: "/collector/movement", icon: ArrowLeftRight, label: "Movimentação" },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-4">
          <div className="flex items-center gap-2">
            <Scan className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">{title}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container px-4 py-6">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 z-50 w-full border-t bg-background">
        <div className="container grid grid-cols-5 gap-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className="h-16 w-full flex-col gap-1 text-xs"
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
