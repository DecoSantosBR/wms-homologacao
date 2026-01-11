import React, { useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Printer } from "lucide-react";

interface PickingListProps {
  wave: {
    id: number;
    waveNumber: string;
    totalOrders: number;
    totalItems: number;
    totalQuantity: number;
    pickingRule: string;
    createdAt: Date;
    items: Array<{
      id: number;
      productSku: string;
      productName: string;
      totalQuantity: number;
      locationCode: string;
      batch: string | null;
      expiryDate: Date | null;
    }>;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PickingList({ wave, open, onOpenChange }: PickingListProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lista de Picking - ${wave.waveNumber}</title>
          <style>
            @media print {
              @page {
                size: A4;
                margin: 1cm;
              }
              body {
                margin: 0;
                padding: 0;
              }
              .no-print {
                display: none;
              }
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 12px;
              line-height: 1.4;
              color: #000;
            }
            .picking-list {
              max-width: 210mm;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              border-bottom: 3px solid #000;
              padding-bottom: 16px;
              margin-bottom: 16px;
            }
            .header h1 {
              font-size: 24px;
              margin: 0 0 8px 0;
            }
            .header-info {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
              font-size: 11px;
            }
            .info-row {
              display: flex;
              gap: 4px;
            }
            .info-label {
              font-weight: bold;
            }
            .summary {
              background: #f5f5f5;
              padding: 12px;
              margin-bottom: 16px;
              border: 1px solid #ddd;
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              text-align: center;
            }
            .summary-item {
              display: flex;
              flex-direction: column;
            }
            .summary-value {
              font-size: 20px;
              font-weight: bold;
            }
            .summary-label {
              font-size: 10px;
              color: #666;
              text-transform: uppercase;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background: #000;
              color: #fff;
              padding: 8px;
              text-align: left;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
            }
            td {
              padding: 8px;
              border-bottom: 1px solid #ddd;
              font-size: 11px;
            }
            tr:nth-child(even) {
              background: #f9f9f9;
            }
            .sku {
              font-family: 'Courier New', monospace;
              font-weight: bold;
            }
            .location {
              font-weight: bold;
              color: #0066cc;
            }
            .checkbox {
              width: 16px;
              height: 16px;
              border: 2px solid #000;
              display: inline-block;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #000;
            }
            .signature-line {
              margin-top: 60px;
              border-top: 1px solid #000;
              padding-top: 8px;
              text-align: center;
            }
            .notes {
              margin-top: 20px;
              padding: 12px;
              border: 1px solid #ddd;
              background: #f9f9f9;
            }
            .notes-title {
              font-weight: bold;
              margin-bottom: 8px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lista de Picking</DialogTitle>
          <DialogDescription>
            Visualize e imprima a lista de separação da onda
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview da Lista */}
          <div ref={printRef} className="picking-list bg-white p-5 border border-gray-200">
            {/* Cabeçalho */}
            <div className="header border-b-2 border-black pb-4 mb-4">
              <h1 className="text-2xl font-bold mb-2">LISTA DE PICKING</h1>
              <div className="header-info grid grid-cols-2 gap-2 text-xs">
                <div className="info-row flex gap-1">
                  <span className="info-label font-bold">Onda:</span>
                  <span>{wave.waveNumber}</span>
                </div>
                <div className="info-row flex gap-1">
                  <span className="info-label font-bold">Data:</span>
                  <span>{format(new Date(wave.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
                <div className="info-row flex gap-1">
                  <span className="info-label font-bold">Regra:</span>
                  <span>{wave.pickingRule === "FIFO" ? "FIFO (Primeiro a Entrar, Primeiro a Sair)" : wave.pickingRule === "FEFO" ? "FEFO (Primeiro a Vencer, Primeiro a Sair)" : "Direcionado"}</span>
                </div>
                <div className="info-row flex gap-1">
                  <span className="info-label font-bold">Total de Pedidos:</span>
                  <span>{wave.totalOrders}</span>
                </div>
              </div>
            </div>

            {/* Resumo */}
            <div className="summary bg-gray-100 p-3 mb-4 border border-gray-300 grid grid-cols-4 gap-3 text-center">
              <div className="summary-item">
                <div className="summary-value text-xl font-bold">{wave.totalItems}</div>
                <div className="summary-label text-[10px] text-gray-600 uppercase">Itens Distintos</div>
              </div>
              <div className="summary-item">
                <div className="summary-value text-xl font-bold">{wave.totalQuantity}</div>
                <div className="summary-label text-[10px] text-gray-600 uppercase">Unidades Totais</div>
              </div>
              <div className="summary-item">
                <div className="summary-value text-xl font-bold">{wave.items.length}</div>
                <div className="summary-label text-[10px] text-gray-600 uppercase">Linhas de Picking</div>
              </div>
              <div className="summary-item">
                <div className="summary-value text-xl font-bold">
                  {new Set(wave.items.map(i => i.locationCode)).size}
                </div>
                <div className="summary-label text-[10px] text-gray-600 uppercase">Endereços</div>
              </div>
            </div>

            {/* Tabela de Itens */}
            <table className="w-full border-collapse mb-5">
              <thead>
                <tr>
                  <th className="bg-black text-white p-2 text-left text-xs uppercase">✓</th>
                  <th className="bg-black text-white p-2 text-left text-xs uppercase">Endereço</th>
                  <th className="bg-black text-white p-2 text-left text-xs uppercase">SKU</th>
                  <th className="bg-black text-white p-2 text-left text-xs uppercase">Produto</th>
                  <th className="bg-black text-white p-2 text-center text-xs uppercase">Qtd</th>
                  <th className="bg-black text-white p-2 text-left text-xs uppercase">Lote</th>
                  <th className="bg-black text-white p-2 text-left text-xs uppercase">Validade</th>
                </tr>
              </thead>
              <tbody>
                {wave.items.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-2 border-b border-gray-300">
                      <span className="checkbox inline-block w-4 h-4 border-2 border-black"></span>
                    </td>
                    <td className="p-2 border-b border-gray-300">
                      <span className="location font-bold text-blue-600">{item.locationCode}</span>
                    </td>
                    <td className="p-2 border-b border-gray-300">
                      <span className="sku font-mono font-bold">{item.productSku}</span>
                    </td>
                    <td className="p-2 border-b border-gray-300 text-xs">{item.productName}</td>
                    <td className="p-2 border-b border-gray-300 text-center font-bold">{item.totalQuantity}</td>
                    <td className="p-2 border-b border-gray-300 text-xs">
                      {item.batch || "-"}
                    </td>
                    <td className="p-2 border-b border-gray-300 text-xs">
                      {item.expiryDate ? format(new Date(item.expiryDate), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Observações */}
            <div className="notes mt-5 p-3 border border-gray-300 bg-gray-50">
              <div className="notes-title font-bold mb-2">OBSERVAÇÕES:</div>
              <div className="text-xs leading-relaxed">
                • Conferir lote e validade antes de separar<br />
                • Marcar checkbox após separar cada item<br />
                • Anotar divergências encontradas<br />
                • Assinar ao final da separação
              </div>
            </div>

            {/* Rodapé com Assinatura */}
            <div className="footer mt-10 pt-5 border-t-2 border-black">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="signature-line mt-16 border-t border-black pt-2 text-center text-xs">
                    Separado por
                  </div>
                </div>
                <div>
                  <div className="signature-line mt-16 border-t border-black pt-2 text-center text-xs">
                    Conferido por
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botão de Impressão */}
          <Button onClick={handlePrint} className="w-full">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Lista de Picking
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
