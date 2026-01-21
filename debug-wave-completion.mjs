/**
 * Script de debug para testar finalização automática de onda
 * 
 * Uso: node debug-wave-completion.mjs <waveId>
 * Exemplo: node debug-wave-completion.mjs 90002
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';

// Simular schema (apenas o necessário)
const pickingWaves = {
  id: 'id',
  status: 'status',
  pickedBy: 'pickedBy',
  pickedAt: 'pickedAt',
};

const pickingWaveItems = {
  id: 'id',
  waveId: 'waveId',
  status: 'status',
  pickedQuantity: 'pickedQuantity',
  totalQuantity: 'totalQuantity',
};

const pickingOrders = {
  id: 'id',
  waveId: 'waveId',
  status: 'status',
  pickedBy: 'pickedBy',
  pickedAt: 'pickedAt',
};

async function main() {
  const waveId = parseInt(process.argv[2]);
  
  if (!waveId) {
    console.error('❌ Uso: node debug-wave-completion.mjs <waveId>');
    process.exit(1);
  }

  console.log(`🔍 Verificando onda ID: ${waveId}\n`);

  // Conectar ao banco
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  try {
    // 1. Buscar informações da onda
    const [wave] = await connection.query(
      'SELECT id, waveNumber, status, pickedBy, pickedAt FROM pickingWaves WHERE id = ?',
      [waveId]
    );

    if (!wave || wave.length === 0) {
      console.error(`❌ Onda ${waveId} não encontrada`);
      process.exit(1);
    }

    console.log('📦 Onda:', wave[0]);
    console.log('');

    // 2. Buscar todos os itens da onda
    const [items] = await connection.query(
      'SELECT id, productSku, status, pickedQuantity, totalQuantity FROM pickingWaveItems WHERE waveId = ?',
      [waveId]
    );

    console.log(`📋 Itens da onda (${items.length} total):`);
    items.forEach((item, idx) => {
      const complete = item.pickedQuantity === item.totalQuantity;
      const icon = item.status === 'picked' ? '✅' : (item.status === 'picking' ? '🔄' : '⏸️');
      console.log(`  ${icon} Item ${idx + 1}: ${item.productSku} | Status: ${item.status} | ${item.pickedQuantity}/${item.totalQuantity} ${complete ? '(COMPLETO)' : '(PENDENTE)'}`);
    });
    console.log('');

    // 3. Verificar se todos estão picked
    const allPicked = items.every(item => item.status === 'picked');
    console.log(`🔍 Todos os itens picked? ${allPicked ? '✅ SIM' : '❌ NÃO'}`);
    
    if (!allPicked) {
      console.log('⚠️  Itens pendentes:');
      items.filter(i => i.status !== 'picked').forEach(item => {
        console.log(`     - ${item.productSku}: ${item.status} (${item.pickedQuantity}/${item.totalQuantity})`);
      });
    }
    console.log('');

    // 4. Buscar pedidos associados
    const [orders] = await connection.query(
      'SELECT id, customerOrderNumber, status, pickedBy, pickedAt FROM pickingOrders WHERE waveId = ?',
      [waveId]
    );

    console.log(`📑 Pedidos associados (${orders.length} total):`);
    orders.forEach((order, idx) => {
      const icon = order.status === 'picked' ? '✅' : '⏸️';
      console.log(`  ${icon} Pedido ${idx + 1}: ${order.customerOrderNumber} | Status: ${order.status}`);
    });
    console.log('');

    // 5. Diagnóstico
    console.log('🔬 DIAGNÓSTICO:');
    
    if (wave[0].status === 'completed') {
      console.log('  ✅ Onda está com status "completed" - OK!');
    } else {
      console.log(`  ❌ Onda está com status "${wave[0].status}" - PROBLEMA!`);
      
      if (allPicked) {
        console.log('  ⚠️  Todos os itens estão "picked" mas a onda não foi finalizada!');
        console.log('  💡 A finalização automática NÃO foi executada.');
        console.log('  🐛 Possíveis causas:');
        console.log('     1. O código de finalização não está sendo chamado');
        console.log('     2. Há um erro silencioso não capturado');
        console.log('     3. A condição allCompleted está retornando false incorretamente');
      } else {
        console.log('  ℹ️  Ainda há itens pendentes - onda não deve ser finalizada ainda.');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
