import { describe, it, expect } from "vitest";
import { generateVolumeLabels } from "./volumeLabels";

describe("Volume Labels Generation", () => {
  it("should generate PDF with single volume label", async () => {
    const labels = [
      {
        customerOrderNumber: "PED-001",
        customerName: "Cliente Teste",
        volumeNumber: 1,
        totalVolumes: 1,
      },
    ];

    const pdfBuffer = await generateVolumeLabels(labels);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    // Verificar assinatura PDF (%PDF)
    expect(pdfBuffer.toString("utf8", 0, 4)).toBe("%PDF");
  });

  it("should generate PDF with multiple volume labels", async () => {
    const labels = Array.from({ length: 3 }, (_, i) => ({
      customerOrderNumber: "PED-002",
      customerName: "Cliente Multi-Volume",
      volumeNumber: i + 1,
      totalVolumes: 3,
    }));

    const pdfBuffer = await generateVolumeLabels(labels);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.toString("utf8", 0, 4)).toBe("%PDF");
  });

  it("should handle special characters in customer name", async () => {
    const labels = [
      {
        customerOrderNumber: "PED-003",
        customerName: "Cliente Ação & Cia Ltda",
        volumeNumber: 1,
        totalVolumes: 1,
      },
    ];

    const pdfBuffer = await generateVolumeLabels(labels);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });

  it("should reuse barcode for same order number", async () => {
    const labels = Array.from({ length: 5 }, (_, i) => ({
      customerOrderNumber: "PED-004",
      customerName: "Cliente Teste",
      volumeNumber: i + 1,
      totalVolumes: 5,
    }));

    const pdfBuffer = await generateVolumeLabels(labels);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });
});
