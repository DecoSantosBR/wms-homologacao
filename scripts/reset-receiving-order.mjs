/**
 * Script para limpar uma ordem de recebimento específica
 * Permite reimportar a mesma NF-e para testar correções
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

console.log('🔍 Buscando todas as ordens de recebimento...');

// Buscar todas as ordens de recebimento
const orders = await db.select()
  .from(schema.receivingOrders);

if (orders.length === 0) {
  console.log('ℹ️  Nenhuma ordem encontrada');
  await connection.end();
  process.exit(0);
}

console.log(`📦 Encontradas ${orders.length} ordens`);

for (const order of orders) {
  console.log(`\n📦 Processando ordem ID ${order.id} (NF-e: ${order.nfeKey})...`);
  
  // Buscar sessões de conferência cega
  const sessions = await db.select()
    .from(schema.blindConferenceSessions)
    .where(eq(schema.blindConferenceSessions.receivingOrderId, order.id));

  console.log(`  🔍 Encontradas ${sessions.length} sessões de conferência`);

  // Deletar em ordem reversa de dependências
  for (const session of sessions) {
    console.log(`    🗑️  Deletando leituras da sessão ${session.id}...`);
    await db.delete(schema.labelReadings)
      .where(eq(schema.labelReadings.sessionId, session.id));
    
    console.log(`    🗑️  Deletando ajustes da sessão ${session.id}...`);
    await db.delete(schema.blindConferenceAdjustments)
      .where(eq(schema.blindConferenceAdjustments.sessionId, session.id));
    
    console.log(`    🗑️  Deletando associações da sessão ${session.id}...`);
    await db.delete(schema.labelAssociations)
      .where(eq(schema.labelAssociations.sessionId, session.id));
    
    console.log(`    🗑️  Deletando sessão ${session.id}...`);
    await db.delete(schema.blindConferenceSessions)
      .where(eq(schema.blindConferenceSessions.id, session.id));
  }

  console.log(`  🗑️  Deletando itens da ordem ${order.id}...`);
  await db.delete(schema.receivingOrderItems)
    .where(eq(schema.receivingOrderItems.receivingOrderId, order.id));

  console.log(`  🗑️  Deletando ordem ${order.id}...`);
  await db.delete(schema.receivingOrders)
    .where(eq(schema.receivingOrders.id, order.id));
}

console.log('✅ Ordem de recebimento limpa com sucesso!');
console.log('ℹ️  Agora você pode reimportar a mesma NF-e');

await connection.end();
