import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Printer } from "lucide-react";
import { toast } from "sonner";

interface ImportPreallocationDialogProps {
  receivingOrderId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportPreallocationDialog({
  receivingOrderId,
  open,
  onOpenChange,
  onSuccess,
}: ImportPreallocationDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validations, setValidations] = useState<any[] | null>(null);
  const [stats, setStats] = useState<{ totalRows: number; validRows: number; invalidRows: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFileMutation = trpc.preallocation.processFile.useMutation({
    onSuccess: (data) => {
      setValidations(data.validations);
      setStats({
        totalRows: data.totalRows,
        validRows: data.validRows,
        invalidRows: data.invalidRows,
      });
      setIsProcessing(false);
      
      if (data.invalidRows > 0) {
        toast.warning(`${data.invalidRows} linha(s) com erro. Revise antes de salvar.`);
      } else {
        toast.success("Arquivo processado com sucesso!");
      }
    },
    onError: (error: any) => {
      toast.error("Erro ao processar arquivo: " + error.message);
      setIsProcessing(false);
    },
  });

  const saveMutation = trpc.preallocation.save.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.savedCount} pré-alocação(ões) salva(s) com sucesso!`);
      handleClose();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar pré-alocações: " + error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidations(null);
      setStats(null);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error("Selecione um arquivo Excel");
      return;
    }

    setIsProcessing(true);

    // Converter arquivo para base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const fileBase64 = base64.split(",")[1]; // Remover prefixo data:...;base64,

      processFileMutation.mutate({
        receivingOrderId,
        fileBase64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!validations) {
      toast.error("Processe o arquivo primeiro");
      return;
    }

    saveMutation.mutate({
      receivingOrderId,
      validations,
    });
  };

  const handleClose = () => {
    setFile(null);
    setValidations(null);
    setStats(null);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const handlePrintLabels = () => {
    if (!validations || !stats || stats.validRows === 0) {
      toast.error("Nenhuma pré-alocação válida para imprimir");
      return;
    }

    // Filtrar apenas validações válidas
    const validPreallocations = validations.filter((v: any) => v.isValid);
    
    if (validPreallocations.length === 0) {
      toast.error("Nenhuma pré-alocação válida encontrada");
      return;
    }

    // Gerar etiquetas ZPL
    generatePreallocationZPLLabels(validPreallocations);
    toast.success(`${validPreallocations.length} etiqueta(s) enviada(s) para impressão`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Pré-Alocação</DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha Excel com as colunas: Endereço, Cód. Interno, Descrição (opcional), Lote, Quantidade.
            <a href="/templates/preallocacao-template.xlsx" download className="text-blue-600 hover:underline ml-2">
              Baixar modelo de planilha
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload de arquivo */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="flex flex-col items-center gap-4">
              <FileSpreadsheet className="h-12 w-12 text-gray-400" />
              <div className="text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" asChild>
                    <span className="cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" />
                      Selecionar Arquivo Excel
                    </span>
                  </Button>
                </label>
                {file && (
                  <p className="mt-2 text-sm text-gray-600">
                    Arquivo selecionado: <strong>{file.name}</strong>
                  </p>
                )}
              </div>
              <Button
                onClick={handleProcess}
                disabled={!file || isProcessing}
                className="mt-2"
              >
                {isProcessing ? "Processando..." : "Processar Arquivo"}
              </Button>
            </div>
          </div>

          {/* Estatísticas */}
          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Total:</strong> {stats.totalRows} linhas
                </AlertDescription>
              </Alert>
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Válidas:</strong> {stats.validRows}
                </AlertDescription>
              </Alert>
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Inválidas:</strong> {stats.invalidRows}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Tabela de validações */}
          {validations && validations.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Status</TableHead>
                      <TableHead>Linha</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Cód. Interno</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validations.map((validation, idx) => (
                      <TableRow key={idx} className={validation.isValid ? "" : "bg-red-50"}>
                        <TableCell>
                          {validation.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell>{validation.row}</TableCell>
                        <TableCell className="font-mono text-sm">{validation.endereco}</TableCell>
                        <TableCell>{validation.codInterno}</TableCell>
                        <TableCell>{validation.lote}</TableCell>
                        <TableCell className="text-right">{validation.quantidade}</TableCell>
                        <TableCell>
                          {validation.errors.length > 0 && (
                            <ul className="text-sm text-red-600 list-disc list-inside">
                              {validation.errors.map((error: string, i: number) => (
                                <li key={i}>{error}</li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div>
              {validations && stats && stats.validRows > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrintLabels}
                  disabled={!validations}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Etiquetas ({stats.validRows})
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={!validations || stats?.validRows === 0 || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvando..." : `Salvar ${stats?.validRows || 0} Pré-Alocação(ões)`}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Gera etiquetas ZPL para pré-alocações (endereços)
 * Formato: 10cm x 5cm para impressoras Zebra
 */
function generatePreallocationZPLLabels(preallocations: any[]) {
  let zplCode = '';

  preallocations.forEach((prealloc) => {
    // Início da etiqueta
    zplCode += '^XA\n';
    
    // Configurações da etiqueta (10cm x 5cm = 400 x 200 dots @ 203dpi)
    zplCode += '^PW400\n';  // Largura: 400 dots (10cm)
    zplCode += '^LL200\n';  // Altura: 200 dots (5cm)
    
    // Título "ENDEREÇO"
    zplCode += '^FO50,20^A0N,25,25^FDEndereco^FS\n';
    
    // Código do endereço (grande e destacado)
    zplCode += '^FO50,50^A0N,45,45^FD' + prealloc.endereco + '^FS\n';
    
    // Linha separadora
    zplCode += '^FO50,105^GB300,2,2^FS\n';
    
    // Informações do produto
    zplCode += '^FO50,115^A0N,18,18^FDProduto: ' + prealloc.codInterno + '^FS\n';
    
    // Lote e quantidade
    const loteText = prealloc.lote ? `Lote: ${prealloc.lote}` : 'Sem lote';
    zplCode += '^FO50,138^A0N,16,16^FD' + loteText + ' | Qtd: ' + prealloc.quantidade + '^FS\n';
    
    // Código de barras Code 128 (código do endereço)
    zplCode += '^FO50,165^BCN,30,N,N,N^FD' + prealloc.endereco + '^FS\n';
    
    // Fim da etiqueta
    zplCode += '^XZ\n\n';
  });

  // Criar blob e abrir janela de impressão
  const blob = new Blob([zplCode], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  // Abrir em nova janela para impressão
  const printWindow = window.open(url, '_blank');
  
  if (printWindow) {
    printWindow.onload = () => {
      // Aguardar carregamento e abrir diálogo de impressão
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } else {
    // Fallback: download do arquivo ZPL
    const link = document.createElement('a');
    link.href = url;
    link.download = `etiquetas_preallocacao_${Date.now()}.zpl`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
