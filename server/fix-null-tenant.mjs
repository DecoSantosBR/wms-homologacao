/**
 * SCRIPT DE CORREÇÃO AUTOMÁTICA
 * 
 * Problema: Inventory criado com tenantId NULL causa falha na criação de pedidos
 * Solução: Atualizar tenantId baseado no produto ou endereço
 * 
 * Data: 11/01/2026 - Terceira ocorrência do bug
 * 
 * Este script deve ser executado:
 * 1. Manualmente quando o problema for detectado
 * 2. Automaticamente no startup do servidor (opcional)
 * 3. Como job agendado (opcional)
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

async function fixNullTenantInventory() {
  console.log('[FIX NULL TENANT] Iniciando correção...');
  
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // Buscar inventory com tenantId NULL
    const [nullTenantRows] = await connection.execute(`
      SELECT 
        i.id,
        i.productId,
        i.locationId,
        p.tenantId as productTenantId,
        l.tenantId as locationTenantId,
        p.sku,
        i.quantity
      FROM inventory i
      LEFT JOIN products p ON i.productId = p.id
      LEFT JOIN warehouseLocations l ON i.locationId = l.id
      WHERE i.tenantId IS NULL
    `);
    
    if (nullTenantRows.length === 0) {
      console.log('[FIX NULL TENANT] ✅ Nenhum inventory com tenantId NULL encontrado');
      return { fixed: 0, errors: 0 };
    }
    
    console.log(`[FIX NULL TENANT] ⚠️  Encontrados ${nullTenantRows.length} registros com tenantId NULL`);
    
    let fixed = 0;
    let errors = 0;
    
    for (const row of nullTenantRows) {
      try {
        // Prioridade: tenantId do produto > tenantId do endereço
        const tenantId = row.productTenantId || row.locationTenantId;
        
        if (!tenantId) {
          console.error(`[FIX NULL TENANT] ❌ Inventory ${row.id} não tem tenantId no produto nem no endereço`);
          errors++;
          continue;
        }
        
        // Atualizar tenantId
        await connection.execute(
          'UPDATE inventory SET tenantId = ? WHERE id = ?',
          [tenantId, row.id]
        );
        
        console.log(`[FIX NULL TENANT] ✅ Inventory ${row.id} (SKU: ${row.sku}, Qtd: ${row.quantity}) atualizado para tenant ${tenantId}`);
        fixed++;
        
      } catch (error) {
        console.error(`[FIX NULL TENANT] ❌ Erro ao corrigir inventory ${row.id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`[FIX NULL TENANT] Finalizado: ${fixed} corrigidos, ${errors} erros`);
    return { fixed, errors };
    
  } finally {
    await connection.end();
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  fixNullTenantInventory()
    .then(result => {
      console.log('Resultado:', result);
      process.exit(result.errors > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Erro fatal:', error);
      process.exit(1);
    });
}

export { fixNullTenantInventory };
