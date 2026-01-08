import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Tenants from "./pages/Tenants";
import Products from "./pages/Products";
import Locations from "./pages/Locations";
import Receiving from "./pages/Receiving";
import Picking from "./pages/Picking";
import Inventory from "./pages/Inventory";
import Cadastros from "./pages/Cadastros";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/tenants"} component={Tenants} />
      <Route path={"/products"} component={Products} />
      <Route path={"/locations"} component={Locations} />
      <Route path={"/receiving"} component={Receiving} />
      <Route path={"/picking"} component={Picking} />
      <Route path={"/inventory"} component={Inventory} />
      <Route path={"/cadastros"} component={Cadastros} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
