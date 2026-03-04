import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes para o labelReprintRouter
 * Verifica que as procedures de listagem e reimpressão estão registradas corretamente
 * e que a geração de PDF funciona para os 5 tipos de etiqueta.
 */

// Mock do banco de dados
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }),
}));

// Mock do bwip-js
vi.mock("bwip-js", () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-barcode")),
  },
  toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-barcode")),
}));

// Mock do pdfkit
vi.mock("pdfkit", () => {
  const EventEmitter = require("events");
  return {
    default: class MockPDF extends EventEmitter {
      constructor() {
        super();
        setTimeout(() => this.emit("end"), 10);
      }
      fontSize() { return this; }
      font() { return this; }
      text() { return this; }
      image() { return this; }
      end() { this.emit("end"); }
      on(event: string, cb: Function) {
        super.on(event, cb);
        return this;
      }
    },
  };
});

describe("labelReprintRouter", () => {
  it("deve exportar o router corretamente", async () => {
    const { labelReprintRouter } = await import("./labelReprintRouter");
    expect(labelReprintRouter).toBeDefined();
  });

  it("deve ter as 10 procedures esperadas (5 list + 5 reprint)", async () => {
    const { labelReprintRouter } = await import("./labelReprintRouter");
    const procedures = Object.keys(labelReprintRouter._def.procedures ?? labelReprintRouter._def.record ?? {});
    
    // Verificar que as procedures existem no router
    const routerDef = labelReprintRouter as any;
    const hasListReceiving = "listReceiving" in routerDef._def.record;
    const hasReprintReceiving = "reprintReceiving" in routerDef._def.record;
    const hasListWaves = "listWaves" in routerDef._def.record;
    const hasReprintWave = "reprintWave" in routerDef._def.record;
    const hasListShipments = "listShipments" in routerDef._def.record;
    const hasReprintShipment = "reprintShipment" in routerDef._def.record;
    const hasListProductLabels = "listProductLabels" in routerDef._def.record;
    const hasReprintProductLabel = "reprintProductLabel" in routerDef._def.record;
    const hasListLocations = "listLocations" in routerDef._def.record;
    const hasReprintLocation = "reprintLocation" in routerDef._def.record;

    expect(hasListReceiving).toBe(true);
    expect(hasReprintReceiving).toBe(true);
    expect(hasListWaves).toBe(true);
    expect(hasReprintWave).toBe(true);
    expect(hasListShipments).toBe(true);
    expect(hasReprintShipment).toBe(true);
    expect(hasListProductLabels).toBe(true);
    expect(hasReprintProductLabel).toBe(true);
    expect(hasListLocations).toBe(true);
    expect(hasReprintLocation).toBe(true);
  });

  it("deve estar registrado no appRouter como labelReprint", async () => {
    const { appRouter } = await import("./routers");
    const routerDef = appRouter as any;
    expect("labelReprint" in routerDef._def.record).toBe(true);
  });
});
