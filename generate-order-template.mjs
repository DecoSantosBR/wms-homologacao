import xlsx from 'xlsx';
import { writeFileSync } from 'fs';

// Criar workbook
const wb = xlsx.utils.book_new();

// Dados de exemplo
const data = [
  ['Nº do Pedido', 'Cliente', 'Destinatário', 'Cód. do Produto', 'Quantidade', 'Unidade de Medida'],
  ['PED-001', 'Hapvida', 'Hospital São Lucas', '834207', 10, 'caixa'],
  ['PED-001', 'Hapvida', 'Hospital São Lucas', '401460P', 5, 'caixa'],
  ['PED-002', 'Hapvida', 'Clínica Santa Maria', '834207', 20, 'unidade'],
];

// Criar worksheet
const ws = xlsx.utils.aoa_to_sheet(data);

// Definir larguras das colunas
ws['!cols'] = [
  { wch: 15 }, // Nº do Pedido
  { wch: 20 }, // Cliente
  { wch: 25 }, // Destinatário
  { wch: 18 }, // Cód. do Produto
  { wch: 12 }, // Quantidade
  { wch: 20 }, // Unidade de Medida
];

// Adicionar worksheet ao workbook
xlsx.utils.book_append_sheet(wb, ws, 'Pedidos');

// Salvar arquivo
xlsx.writeFile(wb, '/home/ubuntu/wms-medax/client/public/templates/template-importacao-pedidos.xlsx');

console.log('✅ Template criado: client/public/templates/template-importacao-pedidos.xlsx');
