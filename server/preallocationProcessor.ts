import * as XLSX from "xlsx";
import { getDb } from "./db";
import { products, warehouseLocations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface PreallocationRow {
  row: number;
  endereco: string;
  codInterno: string;
  descricao: string;
  lote: string;
  quantidade: number;
}

export interface PreallocationValidation extends PreallocationRow {
  isValid: boolean;
  errors: string[];
  locationId?: number;
  productId?: number;
}

/**
 * Processa arquivo Excel de pré-alocação
 * Aceita variações de cabeçalhos e retorna linhas validadas
 */
export async function processPreallocationExcel(
  fileBuffer: Buffer
): Promise<{ success: boolean; rows: PreallocationRow[]; errors: string[] }> {
  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    
    if (!sheetName) {
      return { success: false, rows: [], errors: ["Planilha vazia ou inválida"] };
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (data.length < 2) {
      return { success: false, rows: [], errors: ["Planilha não contém dados"] };
    }

    // Normalizar cabeçalhos (aceitar variações)
    const headers = data[0].map((h: string) =>
      String(h || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9]/g, "") // Remove caracteres especiais
    );

    // Mapear índices de colunas
    const colMap = {
      endereco: headers.findIndex((h) =>
        ["endereco", "end", "localizacao", "local"].includes(h)
      ),
      codInterno: headers.findIndex((h) =>
        ["codinterno", "codigointerno", "codigo", "sku", "cod"].includes(h)
      ),
      descricao: headers.findIndex((h) =>
        ["descricao", "desc", "produto", "nome"].includes(h)
      ),
      lote: headers.findIndex((h) => ["lote", "batch"].includes(h)),
      quantidade: headers.findIndex((h) =>
        ["quantidade", "qtd", "qtde", "qty"].includes(h)
      ),
    };

    // Validar se encontrou colunas obrigatórias
    const missingCols: string[] = [];
    if (colMap.endereco === -1) missingCols.push("Endereço");
    if (colMap.codInterno === -1) missingCols.push("Código Interno");
    if (colMap.lote === -1) missingCols.push("Lote");
    if (colMap.quantidade === -1) missingCols.push("Quantidade");

    if (missingCols.length > 0) {
      return {
        success: false,
        rows: [],
        errors: [`Colunas obrigatórias não encontradas: ${missingCols.join(", ")}`],
      };
    }

    // Processar linhas de dados
    const rows: PreallocationRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Pular linhas vazias
      if (!row || row.every((cell) => !cell)) continue;

      const endereco = String(row[colMap.endereco] || "").trim();
      const codInterno = String(row[colMap.codInterno] || "").trim();
      const descricao = String(row[colMap.descricao] || "").trim();
      const lote = String(row[colMap.lote] || "").trim();
      const quantidade = Number(row[colMap.quantidade] || 0);

      // Validações básicas
      if (!endereco) {
        errors.push(`Linha ${i + 1}: Endereço vazio`);
        continue;
      }
      if (!codInterno) {
        errors.push(`Linha ${i + 1}: Código Interno vazio`);
        continue;
      }
      if (!lote) {
        errors.push(`Linha ${i + 1}: Lote vazio`);
        continue;
      }
      if (!quantidade || quantidade <= 0) {
        errors.push(`Linha ${i + 1}: Quantidade inválida`);
        continue;
      }

      rows.push({
        row: i + 1,
        endereco,
        codInterno,
        descricao,
        lote,
        quantidade,
      });
    }

    return { success: true, rows, errors };
  } catch (error: any) {
    return {
      success: false,
      rows: [],
      errors: [`Erro ao processar arquivo: ${error.message}`],
    };
  }
}

/**
 * Valida pré-alocações contra banco de dados
 * Verifica se endereços e produtos existem e pertencem ao tenant correto
 */
export async function validatePreallocations(
  rows: PreallocationRow[],
  tenantId: number
): Promise<PreallocationValidation[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const validations: PreallocationValidation[] = [];

  for (const row of rows) {
    const errors: string[] = [];
    let locationId: number | undefined;
    let productId: number | undefined;

    // Validar endereço
    const [location] = await db
      .select()
      .from(warehouseLocations)
      .where(
        and(
          eq(warehouseLocations.code, row.endereco),
          eq(warehouseLocations.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!location) {
      errors.push(`Endereço "${row.endereco}" não encontrado`);
    } else {
      locationId = location.id;
    }

    // Validar produto
    const [product] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.sku, row.codInterno),
          eq(products.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!product) {
      errors.push(`Produto "${row.codInterno}" não encontrado`);
    } else {
      productId = product.id;
    }

    validations.push({
      ...row,
      isValid: errors.length === 0,
      errors,
      locationId,
      productId,
    });
  }

  return validations;
}

/**
 * Gera arquivo Excel modelo para pré-alocação
 */
export function generatePreallocationTemplate(): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Endereço", "Cód. Interno", "Descrição", "Lote", "Quantidade"],
    ["M01-01-02A", "441702P", "INTRAFIX COMPACT AIR IL", "25H04LB356", "120"],
    ["M01-01-03B", "123456", "Exemplo de Produto", "L001", "50"],
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pré-alocação");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
