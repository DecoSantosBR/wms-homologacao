import { parseNFE } from './server/nfeParser';
import { readFileSync } from 'fs';

async function test() {
  try {
    const xmlContent = readFileSync('/home/ubuntu/upload/43220631673254001508550000000058541989903913-nfe.xml', 'utf-8');
    
    console.log('=== Testando parseNFE completo ===\n');
    
    const result = await parseNFE(xmlContent);
    
    console.log('✅ Parse bem-sucedido!\n');
    console.log('Chave de Acesso:', result.chaveAcesso);
    console.log('Número NF:', result.numero);
    console.log('Série:', result.serie);
    console.log('Data Emissão:', result.dataEmissao);
    console.log('\nFornecedor:');
    console.log('  CNPJ:', result.fornecedor.cnpj);
    console.log('  Razão Social:', result.fornecedor.razaoSocial);
    console.log('  Nome Fantasia:', result.fornecedor.nomeFantasia);
    console.log('\nProdutos:', result.produtos.length);
    
    if (result.produtos.length > 0) {
      console.log('\nPrimeiro produto:');
      console.log('  Código:', result.produtos[0].codigo);
      console.log('  Descrição:', result.produtos[0].descricao);
      console.log('  EAN:', result.produtos[0].ean);
      console.log('  Quantidade:', result.produtos[0].quantidade);
      console.log('  Unidade:', result.produtos[0].unidade);
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  }
}

test();
