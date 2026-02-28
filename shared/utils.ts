/**
 * Converte Date para formato MySQL DATE (YYYY-MM-DD)
 * @param date - Date object ou null
 * @returns String no formato YYYY-MM-DD ou null
 */
export function toMySQLDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  
  // Se já é string, retorna direto
  if (typeof date === 'string') return date;
  
  // Converte Date para YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Gera uniqueCode a partir de SKU e lote
 * @param sku - SKU do produto
 * @param batch - Lote do produto
 * @returns uniqueCode no formato SKU-LOTE
 */
export function getUniqueCode(sku: string, batch: string | null): string {
  if (!batch) return sku;
  return `${sku}-${batch}`;
}
