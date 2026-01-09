import { getDb } from "./db";
import {
  receivingPreallocations,
  receivingOrderItems,
  receivingOrders,
  warehouseLocations,
  products,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as XLSX from "xlsx";

export interface PreallocationRow {
  endereco: string;
  codInterno: string;
  descricao?: string;
  lote: string;
  quantidade: number;
}

export interface PreallocationValidation {
  isValid: boolean;
  row: number;
  endereco: string;
  codInterno: string;
  lote: string;
  quantidade: number;
  errors: string[];
  locationId?: number;
  productId?: number;
}

export interface PreallocationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  validations: PreallocationValidation[];
}

/**
 * Processa arquivo Excel de pré-alocação
 * Aceita variações de cabeçalhos (com/sem acentos, maiúsculas/minúsculas)
 */
export async function processPreallocationExcel(
  fileBuffer: Buffer
): Promise<PreallocationRow[]> {
  // Parsear Excel
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (rawRows.length < 2) {
    throw new Error("Planilha vazia ou sem dados");
  }

  // Primeira linha é o cabeçalho
  const headers = (rawRows[0] as string[]).map((h) =>
    String(h || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9]/g, "") // Remove caracteres especiais
  );

  // Mapear índices de colunas (aceita variações)
  const enderecoIdx = headers.findIndex((h) =>
    ["endereco", "endereço", "end"].includes(h)
  );
  const codInternoIdx = headers.findIndex((h) =>
    ["codinterno", "codigointerno", "codigo", "sku"].includes(h)
  );
  const descricaoIdx = headers.findIndex((h) =>
    ["descricao", "descrição", "desc", "produto"].includes(h)
  );
  const loteIdx = headers.findIndex((h) => ["lote", "batch"].includes(h));
  const quantidadeIdx = headers.findIndex((h) =>
    ["quantidade", "qtd", "qty", "quant"].includes(h)
  );

  if (enderecoIdx === -1) {
    throw new Error(
      'Coluna "Endereço" não encontrada. Verifique o cabeçalho da planilha.'
    );
  }
  if (codInternoIdx === -1) {
    throw new Error(
      'Coluna "Cód. Interno" não encontrada. Verifique o cabeçalho da planilha.'
    );
  }
  if (loteIdx === -1) {
    throw new Error(
      'Coluna "Lote" não encontrada. Verifique o cabeçalho da planilha.'
    );
  }
  if (quantidadeIdx === -1) {
    throw new Error(
      'Coluna "Quantidade" não encontrada. Verifique o cabeçalho da planilha.'
    );
  }

  // Processar linhas de dados (pular header)
  const rows: PreallocationRow[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] as any[];

    // Pular linhas vazias
    if (!row || row.length === 0 || !row[enderecoIdx]) {
      continue;
    }

    const endereco = String(row[enderecoIdx] || "").trim();
    const codInterno = String(row[codInternoIdx] || "").trim();
    const descricao =
      descricaoIdx >= 0 ? String(row[descricaoIdx] || "").trim() : undefined;
    const lote = String(row[loteIdx] || "").trim();
    const quantidade = Number(row[quantidadeIdx]) || 0;

    // Validações básicas
    if (!endereco || !codInterno || !lote || quantidade <= 0) {
      continue; // Pular linha inválida
    }

    rows.push({
      endereco,
      codInterno,
      descricao,
      lote,
      quantidade,
    });
  }

  return rows;
}

/**
 * Valida pré-alocações contra banco de dados
 */
export async function validatePreallocations(
  rows: PreallocationRow[],
  receivingOrderId: number,
  tenantId: number | null
): Promise<PreallocationValidation[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const validations: PreallocationValidation[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors: string[] = [];
    let locationId: number | undefined;
    let productId: number | undefined;

    // 1. Validar endereço
    const locations = await dbConn
      .select()
      .from(warehouseLocations)
      .where(eq(warehouseLocations.code, row.endereco))
      .limit(1);

    if (locations.length === 0) {
      errors.push(`Endereço "${row.endereco}" não encontrado`);
    } else {
      locationId = locations[0].id;
    }

    // 2. Validar produto
    const productsResult = await dbConn
      .select()
      .from(products)
      .where(eq(products.sku, row.codInterno))
      .limit(1);

    if (productsResult.length === 0) {
      errors.push(`Produto "${row.codInterno}" não encontrado`);
    } else {
      productId = productsResult[0].id;
    }

    validations.push({
      isValid: errors.length === 0,
      row: i + 2, // +2 porque linha 1 é header, linhas começam em 1
      endereco: row.endereco,
      codInterno: row.codInterno,
      lote: row.lote,
      quantidade: row.quantidade,
      errors,
      locationId,
      productId,
    });
  }

  return validations;
}

/**
 * Salva pré-alocações válidas no banco de dados
 */
export async function savePreallocations(
  receivingOrderId: number,
  validations: PreallocationValidation[],
  userId: number
): Promise<number> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  let savedCount = 0;

  for (const validation of validations) {
    if (!validation.isValid || !validation.locationId || !validation.productId) {
      continue;
    }

    await dbConn.insert(receivingPreallocations).values({
      receivingOrderId,
      productId: validation.productId,
      locationId: validation.locationId,
      batch: validation.lote,
      quantity: validation.quantidade,
      status: "pending",
      createdBy: userId,
    });

    savedCount++;
  }

  return savedCount;
}

/**
 * Lista pré-alocações de uma ordem de recebimento
 */
export async function getPreallocations(receivingOrderId: number) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const preallocations = await dbConn
    .select({
      id: receivingPreallocations.id,
      receivingOrderId: receivingPreallocations.receivingOrderId,
      productId: receivingPreallocations.productId,
      productSku: products.sku,
      productDescription: products.description,
      locationId: receivingPreallocations.locationId,
      locationCode: warehouseLocations.code,
      batch: receivingPreallocations.batch,
      quantity: receivingPreallocations.quantity,
      status: receivingPreallocations.status,
      createdBy: receivingPreallocations.createdBy,
      createdAt: receivingPreallocations.createdAt,
    })
    .from(receivingPreallocations)
    .leftJoin(products, eq(receivingPreallocations.productId, products.id))
    .leftJoin(
      warehouseLocations,
      eq(receivingPreallocations.locationId, warehouseLocations.id)
    )
    .where(eq(receivingPreallocations.receivingOrderId, receivingOrderId));

  return preallocations;
}

/**
 * Deleta pré-alocações de uma ordem de recebimento
 */
export async function deletePreallocations(receivingOrderId: number) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  await dbConn
    .delete(receivingPreallocations)
    .where(eq(receivingPreallocations.receivingOrderId, receivingOrderId));
}
