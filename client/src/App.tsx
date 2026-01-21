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
import PickingOrders from "./pages/PickingOrders";
import PickingExecution from "./pages/PickingExecution";
import WaveExecution from "./pages/WaveExecution";
import Inventory from "./pages/Inventory";
import Cadastros from "./pages/Cadastros";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import NFEImport from "./pages/NFEImport";
import StockPositions from "./pages/StockPositions";
import StockMovements from "./pages/StockMovements";
import OccupancyDashboard from "./pages/OccupancyDashboard";
import StageCheck from "./pages/StageCheck";
import ScannerTest from "./pages/ScannerTest";
import PrintSettings from "./pages/PrintSettings";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/tenants"} component={Tenants} />
      <Route path={"/products"} component={Products} />
      <Route path={"/locations"} component={Locations} />
      <Route path={"/receiving"} component={Receiving} />
      <Route path={"/recebimento"} component={Receiving} />
      <Route path={"/picking"} component={PickingOrders} />
      <Route path={"/picking/:id"} component={PickingExecution} />
      <Route path={"/picking/execute/:id"} component={WaveExecution} />
      <Route path={"/separacao"} component={Picking} />
      <Route path={"/inventory"} component={Inventory} />
      <Route path={"/cadastros"} component={Cadastros} />
      <Route path={"/cadastros/produtos"} component={Products} />
      <Route path={"/users"} component={Users} />
      <Route path={"/roles"} component={Roles} />
      <Route path={"/nfe-import"} component={NFEImport} />
      <Route path={"/stock"} component={StockPositions} />
      <Route path={"/stock/movements"} component={StockMovements} />
      <Route path={"/stock/occupancy"} component={OccupancyDashboard} />
      <Route path={"/stage/check"} component={StageCheck} />
      <Route path={"/scanner-test"} component={ScannerTest} />
      <Route path={"/settings/printing"} component={PrintSettings} />
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
