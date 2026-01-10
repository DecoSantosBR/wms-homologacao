import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "./ui/button";
import { Camera, X } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrCodeRegionId = "qr-reader";

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setError(null);
      setIsScanning(true);

      const html5QrCode = new Html5Qrcode(qrCodeRegionId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" }, // Câmera traseira em mobile
        {
          fps: 10, // Frames por segundo
          qrbox: { width: 250, height: 250 }, // Área de leitura
        },
        (decodedText) => {
          // Sucesso na leitura
          onScan(decodedText);
          stopScanner();
        },
        (errorMessage) => {
          // Erro de leitura (ignorar, é normal)
          console.debug("Erro de leitura:", errorMessage);
        }
      );
    } catch (err: any) {
      console.error("Erro ao iniciar scanner:", err);
      setError(err.message || "Erro ao acessar câmera");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        // Verificar se o scanner está realmente rodando antes de parar
        const state = await scannerRef.current.getState();
        if (state === 2) { // 2 = SCANNING
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      } catch (err: any) {
        // Ignorar erro se scanner já estiver parado
        if (!err.message?.includes("not running")) {
          console.error("Erro ao parar scanner:", err);
        }
      }
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Scanner de Código de Barras</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Scanner Area */}
      <div className="w-full max-w-md bg-white rounded-lg overflow-hidden">
        <div id={qrCodeRegionId} className="w-full" />
      </div>

      {/* Instructions */}
      <div className="w-full max-w-md mt-4 text-center text-white/80 text-sm">
        {isScanning ? (
          <p>Posicione o código de barras dentro da área marcada</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <p>Iniciando câmera...</p>
        )}
      </div>

      {/* Manual Input Option */}
      <div className="w-full max-w-md mt-6">
        <Button
          variant="outline"
          onClick={handleClose}
          className="w-full bg-white/10 text-white border-white/20 hover:bg-white/20"
        >
          Cancelar e Digitar Manualmente
        </Button>
      </div>
    </div>
  );
}
