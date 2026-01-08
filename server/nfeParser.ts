/**
 * Parser de XML de NF-e (Nota Fiscal Eletrônica)
 * Extrai dados de produtos e informações da nota fiscal
 */

import { parseStringPromise } from "xml2js";

export interface NFEProduct {
  codigo: string; // cProd - Código do produto do fornecedor
  descricao: string; // xProd - Descrição do produto
  ean: string | null; // cEAN - Código de barras
  eanTributavel: string | null; // cEANTrib - Código de barras tributável
  unidade: string; // uCom - Unidade comercial
  quantidade: number; // qCom - Quantidade comercial
  valorUnitario: number; // vUnCom - Valor unitário comercial
  valorTotal: number; // vProd - Valor total bruto
  ncm: string | null; // NCM - Nomenclatura Comum do Mercosul
}

export interface NFEData {
  chaveAcesso: string; // Chave de acesso da NF-e
  numero: string; // Número da nota fiscal
  serie: string; // Série da nota fiscal
  dataEmissao: string; // Data de emissão
  fornecedor: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
  };
  produtos: NFEProduct[];
}

/**
 * Extrai valor de um campo do XML, tratando arrays e valores undefined
 */
function extractValue(obj: any, defaultValue: any = null): any {
  if (!obj) return defaultValue;
  if (Array.isArray(obj)) return obj[0] || defaultValue;
  return obj;
}

/**
 * Parse de XML de NF-e e extração de dados estruturados
 */
export async function parseNFE(xmlContent: string): Promise<NFEData> {
  try {
    const parsed = await parseStringPromise(xmlContent, {
      explicitArray: true,
      mergeAttrs: true,
      trim: true,
    });

    // Navegar na estrutura do XML da NF-e
    const nfe = parsed.nfeProc?.NFe?.[0] || parsed.NFe?.[0];
    if (!nfe) {
      throw new Error("Estrutura de NF-e inválida: tag NFe não encontrada");
    }

    const infNFe = nfe.infNFe?.[0];
    if (!infNFe) {
      throw new Error("Estrutura de NF-e inválida: tag infNFe não encontrada");
    }

    // Extrair chave de acesso
    const chaveAcesso = infNFe.Id?.[0]?.replace("NFe", "") || "";

    // Extrair dados da identificação da nota
    const ide = infNFe.ide?.[0];
    const numero = extractValue(ide?.nNF, "");
    const serie = extractValue(ide?.serie, "");
    const dataEmissao = extractValue(ide?.dhEmi, "");

    // Extrair dados do fornecedor (emitente)
    const emit = infNFe.emit?.[0];
    const fornecedor = {
      cnpj: extractValue(emit?.CNPJ, ""),
      razaoSocial: extractValue(emit?.xNome, ""),
      nomeFantasia: extractValue(emit?.xFant, null),
    };

    // Extrair produtos (detalhes da nota)
    const detalhes = infNFe.det || [];
    const produtos: NFEProduct[] = detalhes.map((det: any) => {
      const prod = det.prod?.[0];
      
      return {
        codigo: extractValue(prod?.cProd, ""),
        descricao: extractValue(prod?.xProd, ""),
        ean: extractValue(prod?.cEAN, null) || null,
        eanTributavel: extractValue(prod?.cEANTrib, null) || null,
        unidade: extractValue(prod?.uCom, "UN"),
        quantidade: parseFloat(extractValue(prod?.qCom, "0")),
        valorUnitario: parseFloat(extractValue(prod?.vUnCom, "0")),
        valorTotal: parseFloat(extractValue(prod?.vProd, "0")),
        ncm: extractValue(prod?.NCM, null),
      };
    });

    return {
      chaveAcesso,
      numero,
      serie,
      dataEmissao,
      fornecedor,
      produtos,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Erro ao fazer parse do XML da NF-e: ${error.message}`);
    }
    throw new Error("Erro desconhecido ao fazer parse do XML da NF-e");
  }
}

/**
 * Valida se o XML é uma NF-e válida
 */
export function isValidNFE(xmlContent: string): boolean {
  return (
    xmlContent.includes("<NFe") ||
    xmlContent.includes("<nfeProc") ||
    xmlContent.includes("nfe.xsd")
  );
}
