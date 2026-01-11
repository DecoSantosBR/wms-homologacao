import React, { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Printer } from "lucide-react";

interface WaveLabelProps {
  wave: {
    id: number;
    waveNumber: string;
    totalOrders: number;
    totalItems: number;
    totalQuantity: number;
    createdAt: Date;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaveLabel({ wave, open, onOpenChange }: WaveLabelProps) {
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
          <title>Etiqueta de Onda - ${wave.waveNumber}</title>
          <style>
            @media print {
              @page {
                size: 10cm 10cm;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .label {
              width: 10cm;
              height: 10cm;
              border: 2px solid #000;
              padding: 16px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              width: 100%;
            }
            .wave-number {
              font-size: 24px;
              font-weight: bold;
              margin: 0 0 8px 0;
            }
            .date {
              font-size: 12px;
              color: #666;
              margin: 0;
            }
            .qr-container {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .info {
              width: 100%;
              border-top: 2px solid #000;
              padding-top: 12px;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              text-align: center;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-value {
              font-size: 20px;
              font-weight: bold;
              margin: 0;
            }
            .info-label {
              font-size: 10px;
              color: #666;
              margin: 0;
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Etiqueta de Onda</DialogTitle>
          <DialogDescription>
            Visualize e imprima a etiqueta com QR code da onda
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview da Etiqueta */}
          <div 
            ref={printRef}
            className="label border-2 border-black p-4 flex flex-col items-center justify-between"
            style={{ width: "10cm", height: "10cm" }}
          >
            {/* Cabeçalho */}
            <div className="header text-center w-full">
              <h2 className="wave-number text-2xl font-bold mb-2">{wave.waveNumber}</h2>
              <p className="date text-xs text-gray-600">
                {format(new Date(wave.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </div>

            {/* QR Code */}
            <div className="qr-container flex-1 flex items-center justify-center">
              <QRCodeSVG
                value={`WAVE-${wave.id}`}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Informações */}
            <div className="info w-full border-t-2 border-black pt-3 grid grid-cols-3 gap-2 text-center">
              <div className="info-item">
                <p className="info-value text-xl font-bold">{wave.totalOrders}</p>
                <p className="info-label text-[10px] text-gray-600">Pedidos</p>
              </div>
              <div className="info-item">
                <p className="info-value text-xl font-bold">{wave.totalItems}</p>
                <p className="info-label text-[10px] text-gray-600">Itens</p>
              </div>
              <div className="info-item">
                <p className="info-value text-xl font-bold">{wave.totalQuantity}</p>
                <p className="info-label text-[10px] text-gray-600">Unidades</p>
              </div>
            </div>
          </div>

          {/* Botão de Impressão */}
          <Button onClick={handlePrint} className="w-full">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Etiqueta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
