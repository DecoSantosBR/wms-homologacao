import { createWave } from './server/waveLogic.js';

// Criar onda de teste com os IDs dos pedidos que criamos
const orderIds = [1, 2];

console.log('Criando onda de teste com pedidos:', orderIds);

try {
  const wave = await createWave(orderIds);
  console.log('✅ Onda criada com sucesso!');
  console.log('ID da onda:', wave.id);
  console.log('Itens na onda:', wave.items?.length || 0);
  process.exit(0);
} catch (error) {
  console.error('❌ Erro ao criar onda:', error.message);
  process.exit(1);
}
