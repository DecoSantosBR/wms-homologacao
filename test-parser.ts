import { readFileSync } from 'fs';
import { parseStringPromise, processors } from 'xml2js';

async function testParser() {
  const xmlContent = readFileSync('/home/ubuntu/upload/43220631673254001508550000000058541989903913-nfe.xml', 'utf-8');

  console.log('=== Testando parser de NF-e ===\n');

  try {
    const parsed = await parseStringPromise(xmlContent, {
      explicitArray: true,
      mergeAttrs: true,
      trim: true,
      tagNameProcessors: [processors.stripPrefix],
      ignoreAttrs: false,
    });

    console.log('✅ Parse bem-sucedido!');
    console.log('\n=== Chaves do objeto raiz ===');
    console.log(JSON.stringify(Object.keys(parsed), null, 2));

    console.log('\n=== Estrutura completa (primeiros 2 níveis) ===');
    for (const key of Object.keys(parsed)) {
      console.log(`\n${key}:`);
      if (parsed[key] && typeof parsed[key] === 'object') {
        if (Array.isArray(parsed[key])) {
          console.log(`  (array com ${parsed[key].length} elementos)`);
          if (parsed[key][0] && typeof parsed[key][0] === 'object') {
            console.log(`  Chaves do primeiro elemento:`, Object.keys(parsed[key][0]));
          }
        } else {
          console.log(`  Chaves:`, Object.keys(parsed[key]));
        }
      }
    }

    // Tentar encontrar NFe
    console.log('\n=== Tentando encontrar tag NFe ===');
    const nfe = parsed.nfeProc?.NFe?.[0] || parsed.NFe?.[0];
    if (nfe) {
      console.log('✅ Tag NFe encontrada!');
      console.log('Chaves da NFe:', Object.keys(nfe));
    } else {
      console.log('❌ Tag NFe não encontrada pelos métodos padrão');
    }

  } catch (error: any) {
    console.error('❌ Erro no parse:', error.message);
  }
}

testParser();
