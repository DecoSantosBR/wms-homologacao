import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface ManifestPrintProps {
  data: {
    manifest: {
      number: string;
      createdAt: Date;
      carrierName: string | null;
      totalOrders: number;
      totalInvoices: number;
      totalVolumes: number;
    };
    tenant: {
      name: string;
      cnpj: string;
    };
    items: Array<{
      orderNumber: string | null;
      invoiceNumber: string;
      customerName: string;
      customerCity: string;
      customerState: string;
      volumes: number;
      weight: number;
    }>;
  };
}

export const ManifestPrint = forwardRef<{ print: () => void }, ManifestPrintProps>(
  ({ data }, ref) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

    useEffect(() => {
      // Gerar QR Code com número do romaneio
      QRCode.toDataURL(`ROM-${data.manifest.number}`, {
        width: 100,
        margin: 1,
      }).then(setQrCodeUrl).catch(console.error);
    }, [data.manifest.number]);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Romaneio ${data.manifest.number}</title>
          <style>
            @page {
              size: A4;
              margin: 20mm;
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: Arial, sans-serif;
              font-size: 12pt;
              line-height: 1.4;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
            }
            
            .qrcode {
              width: 100px;
              height: 100px;
              border: 2px solid #000;
            }
            
            .logo {
              font-size: 48px;
              font-weight: bold;
              color: #1e40af;
              margin-right: 10px;
            }
            
            .logo-subtitle {
              font-size: 10px;
              color: #666;
            }
            
            .title {
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              color: #1e40af;
              margin: 30px 0;
              letter-spacing: 2px;
            }
            
            .info-row {
              display: flex;
              gap: 30px;
              margin-bottom: 15px;
            }
            
            .info-field {
              flex: 1;
            }
            
            .info-label {
              font-weight: bold;
              display: inline-block;
              margin-right: 10px;
            }
            
            .info-value {
              border-bottom: 1px solid #000;
              display: inline-block;
              min-width: 200px;
              padding-bottom: 2px;
            }
            
            .section-title {
              font-size: 16px;
              font-weight: bold;
              color: #1e40af;
              margin: 25px 0 15px 0;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            
            th {
              background-color: #1e40af;
              color: white;
              padding: 10px;
              text-align: left;
              font-weight: bold;
            }
            
            td {
              border: 1px solid #000;
              padding: 8px;
            }
            
            .totals {
              margin: 20px 0;
              display: flex;
              gap: 30px;
            }
            
            .total-item {
              font-weight: bold;
            }
            
            .signatures {
              margin-top: 50px;
            }
            
            .signature-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
            }
            
            .signature-field {
              flex: 1;
              margin: 0 20px;
            }
            
            .signature-label {
              font-weight: bold;
              margin-bottom: 30px;
            }
            
            .signature-line {
              border-top: 1px solid #000;
              padding-top: 5px;
              text-align: center;
            }
            
            @media print {
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
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

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR");
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const totalWeight = data.items.reduce((sum, item) => sum + item.weight, 0);

  // Expor função de impressão via ref
  useImperativeHandle(ref, () => ({
    print: handlePrint
  }));

  return (
    <div>
      <Button onClick={handlePrint} size="sm" variant="outline">
        <Printer className="h-4 w-4 mr-2" />
        Imprimir Romaneio
      </Button>

      <div ref={printRef} style={{ display: "none" }}>
        <div className="header">
          <div>
            <div className="logo">Med@x</div>
            <div className="logo-subtitle">Soluções Logísticas Para Saúde</div>
          </div>
          {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="qrcode" />}
        </div>

        <div className="title">ROMANEIO DE CARGA</div>

        <div className="info-row">
          <div className="info-field">
            <span className="info-label">Romaneio nº:</span>
            <span className="info-value">{data.manifest.number}</span>
          </div>
          <div className="info-field">
            <span className="info-label">Data:</span>
            <span className="info-value">{formatDate(data.manifest.createdAt)}</span>
          </div>
          <div className="info-field">
            <span className="info-label">Hora:</span>
            <span className="info-value">{formatTime(data.manifest.createdAt)}</span>
          </div>
        </div>

        <div className="info-row">
          <div className="info-field">
            <span className="info-label">Temperatura do Baú (°C):</span>
            <span className="info-value">______</span>
          </div>
        </div>

        <div className="section-title">Remetente</div>

        <div className="info-row">
          <div className="info-field">
            <span className="info-label">Empresa:</span>
            <span className="info-value">{data.tenant.name}</span>
          </div>
        </div>

        <div className="info-row">
          <div className="info-field">
            <span className="info-label">CNPJ:</span>
            <span className="info-value">{data.tenant.cnpj}</span>
          </div>
        </div>

        <div className="section-title">Transporte</div>

        <div className="info-row">
          <div className="info-field">
            <span className="info-label">Transportadora:</span>
            <span className="info-value">_________________________</span>
          </div>
          <div className="info-field">
            <span className="info-label">Placa:</span>
            <span className="info-value">_____________</span>
          </div>
        </div>

        <div className="info-row">
          <div className="info-field">
            <span className="info-label">Motorista:</span>
            <span className="info-value">______________________________</span>
          </div>
          <div className="info-field">
            <span className="info-label">CNH:</span>
            <span className="info-value">_______________</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>NF-e</th>
              <th>Destinatário</th>
              <th>Município</th>
              <th>UF</th>
              <th>Volumes</th>
              <th>Peso (kg)</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{item.orderNumber || "N/A"}</td>
                <td>{item.invoiceNumber}</td>
                <td>{item.customerName}</td>
                <td>{item.customerCity}</td>
                <td>{item.customerState}</td>
                <td>{item.volumes}</td>
                <td>{item.weight.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div className="total-item">
            Total de Pedidos: {data.manifest.totalOrders}
          </div>
          <div className="total-item">
            Total de NFs: {data.manifest.totalInvoices}
          </div>
          <div className="total-item">
            Volumes: {data.manifest.totalVolumes}
          </div>
          <div className="total-item">
            Peso Total (kg): {totalWeight.toFixed(2)}
          </div>
        </div>

        <div className="signatures">
          <div className="signature-row">
            <div className="signature-field">
              <div className="signature-label">Responsável:</div>
              <div className="signature-line">Assinatura</div>
            </div>
          </div>

          <div className="signature-row">
            <div className="signature-field">
              <div className="signature-label">Motorista:</div>
              <div className="signature-line">Assinatura</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ManifestPrint.displayName = "ManifestPrint";
