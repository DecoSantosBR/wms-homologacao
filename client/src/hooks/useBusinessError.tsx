import { useState } from "react";
import { BusinessErrorModal, ErrorType } from "@/components/BusinessErrorModal";

interface ErrorDetail {
  label: string;
  value: string;
  variant?: "default" | "error" | "success" | "warning";
}

interface ErrorState {
  type: ErrorType;
  title: string;
  message: string;
  details?: ErrorDetail[];
  actionLabel?: string;
  onAction?: () => void;
}

export function useBusinessError() {
  const [isOpen, setIsOpen] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  const showError = (state: ErrorState) => {
    setErrorState(state);
    setIsOpen(true);
  };

  const closeError = () => {
    setIsOpen(false);
    setTimeout(() => setErrorState(null), 300); // Delay para animação de saída
  };

  // Helpers para erros comuns
  const showInsufficientStock = (data: {
    productSku: string;
    productName: string;
    requestedQuantity: number;
    requestedUnit: string;
    availableQuantity: number;
  }) => {
    showError({
      type: "insufficient_stock",
      title: "Quantidade insuficiente:",
      message: "",
      details: [
        {
          label: "SKU",
          value: `${data.productSku} - ${data.productName}`,
          variant: "default",
        },
        {
          label: "Qtnd. Solicitada",
          value: `${data.requestedQuantity.toLocaleString('pt-BR')} ${data.requestedUnit}`,
          variant: "error",
        },
        {
          label: "Qtnd. Disponível",
          value: `${data.availableQuantity.toLocaleString('pt-BR')} unidades`,
          variant: "success",
        },
      ],
    });
  };

  const showProductNotFound = (productId?: string | number) => {
    showError({
      type: "product_not_found",
      title: "Produto não encontrado",
      message: productId 
        ? `O produto com ID "${productId}" não foi encontrado no sistema.`
        : "O produto solicitado não foi encontrado no sistema.",
      details: productId ? [
        {
          label: "ID do Produto",
          value: String(productId),
          variant: "error",
        },
      ] : undefined,
    });
  };

  const showPermissionDenied = (action?: string) => {
    showError({
      type: "permission_denied",
      title: "Permissão negada",
      message: action
        ? `Você não tem permissão para ${action}.`
        : "Você não tem permissão para realizar esta operação.",
      details: [
        {
          label: "Dica",
          value: "Entre em contato com o administrador do sistema para solicitar acesso.",
          variant: "default",
        },
      ],
    });
  };

  const showDivergence = (data: {
    expected: string;
    found: string;
    context?: string;
  }) => {
    showError({
      type: "divergence",
      title: "Divergência detectada",
      message: data.context || "Foi detectada uma divergência entre o esperado e o encontrado.",
      details: [
        {
          label: "Esperado",
          value: data.expected,
          variant: "default",
        },
        {
          label: "Encontrado",
          value: data.found,
          variant: "warning",
        },
      ],
    });
  };

  const showInvalidData = (field: string, reason?: string) => {
    showError({
      type: "invalid_data",
      title: "Dados inválidos",
      message: reason || `O campo "${field}" contém dados inválidos.`,
      details: [
        {
          label: "Campo",
          value: field,
          variant: "error",
        },
      ],
    });
  };

  const showDuplicateEntry = (field: string, value: string) => {
    showError({
      type: "duplicate_entry",
      title: "Entrada duplicada",
      message: `Já existe um registro com este ${field}.`,
      details: [
        {
          label: field,
          value: value,
          variant: "warning",
        },
      ],
    });
  };

  const showGenericError = (message: string) => {
    showError({
      type: "generic",
      title: "Erro",
      message,
    });
  };

  const ErrorModal = errorState ? (
    <BusinessErrorModal
      open={isOpen}
      onClose={closeError}
      type={errorState.type}
      title={errorState.title}
      message={errorState.message}
      details={errorState.details}
      actionLabel={errorState.actionLabel}
      onAction={errorState.onAction}
    />
  ) : null;

  return {
    ErrorModal,
    showError,
    showInsufficientStock,
    showProductNotFound,
    showPermissionDenied,
    showDivergence,
    showInvalidData,
    showDuplicateEntry,
    showGenericError,
    closeError,
  };
}
