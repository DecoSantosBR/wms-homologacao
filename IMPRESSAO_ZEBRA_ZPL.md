# Impressão Direta para Impressoras Zebra (ZPL)

## Visão Geral

O sistema WMS Med@x agora suporta impressão direta de etiquetas para impressoras térmicas Zebra usando a linguagem ZPL (Zebra Programming Language). Esta funcionalidade permite gerar etiquetas profissionais com logo, código de barras e informações do produto sem necessidade de drivers ou software adicional.

## Características

- **Formato da etiqueta**: 10cm x 5cm (283 x 142 pontos a 203 DPI)
- **Código de barras**: Code-128
- **Conteúdo**:
  * Logo Med@x (formato GRF compactado)
  * Nome do produto (máximo 30 caracteres)
  * SKU do produto
  * Número do lote
  * Data de validade (formato DD/MM/YYYY)
  * Código de barras legível

## Como Usar

### 1. Gerar Etiqueta ZPL

1. Acesse o módulo **Recebimento**
2. Clique em **Visualizar itens** de uma ordem
3. Clique no botão **Imprimir Etiqueta** do item desejado
4. No modal, escolha a quantidade de etiquetas
5. Clique no botão **Zebra (ZPL)** (azul claro)
6. O sistema gerará um arquivo `.zpl` para download

### 2. Enviar para Impressora

Existem três métodos para enviar o arquivo ZPL para a impressora:

#### Método 1: USB (Windows)
```batch
copy etiqueta-401460P22D08LB109.zpl \\.\USB001
```

#### Método 2: Rede (Windows)
```batch
copy etiqueta-401460P22D08LB109.zpl \\IMPRESSORA-IP\ZPL
```

#### Método 3: Software Zebra Setup Utilities
1. Abra o Zebra Setup Utilities
2. Selecione a impressora
3. Clique em "Open Communication with Printer"
4. Clique em "Send File" e selecione o arquivo .zpl

## Estrutura do Código ZPL

```zpl
^XA                                          # Início do documento
^FO50,20^GFA,800,800,8,:Z64:...             # Logo Med@x (imagem GRF)
^FO50,80^A0N,25,25^FDProduto Nome^FS        # Nome do produto
^FO50,110^A0N,20,20^FDSKU: 401460P^FS      # SKU
^FO50,135^A0N,20,20^FDLote: 22D08LB109^FS  # Lote
^FO50,160^A0N,20,20^FDVal: 31/12/2026^FS   # Validade
^FO50,200^BCN,80,Y,N,N^FD401460P...^FS     # Código de barras
^XZ                                          # Fim do documento
```

## Comandos ZPL Utilizados

| Comando | Descrição |
|---------|-----------|
| `^XA` | Início do formato de etiqueta |
| `^XZ` | Fim do formato de etiqueta |
| `^FO` | Field Origin - posição X,Y do campo |
| `^A0N` | Fonte padrão Zebra 0, orientação normal |
| `^FD...^FS` | Field Data - dados do campo |
| `^BCN` | Código de barras Code-128, orientação normal |
| `^GFA` | Graphic Field - imagem gráfica comprimida |

## Configurações da Impressora

### Resolução
- **Padrão**: 203 DPI (8 dots/mm)
- **Alternativa**: 300 DPI (12 dots/mm) - ajustar coordenadas proporcionalmente

### Velocidade de Impressão
- **Recomendado**: 4 ips (polegadas por segundo)
- **Máximo**: 6 ips

### Escuridão (Darkness)
- **Recomendado**: 15-20
- Ajustar conforme qualidade do papel

### Tipo de Mídia
- Etiquetas térmicas diretas ou transferência térmica
- Rolo contínuo de 10cm de largura

## Solução de Problemas

### Etiqueta não imprime
- Verificar conexão USB/Rede
- Confirmar que a impressora está online
- Testar com comando de status: `~HS` (Host Status)

### Código de barras ilegível
- Aumentar escuridão (darkness)
- Reduzir velocidade de impressão
- Verificar qualidade do papel

### Logo não aparece
- O logo está em formato GRF compactado (Z64)
- Verificar se a impressora suporta compressão Z64
- Alternativa: usar formato ASCII hexadecimal

## API Backend

### Procedure: `receiving.generateLabelZPL`

**Input:**
```typescript
{
  productSku: string;
  batch: string;
  productId?: number;
  productName?: string;
  expiryDate?: string;
  quantity?: number;
}
```

**Output:**
```typescript
{
  success: boolean;
  labelCode: string;
  zplCode: string;
  quantity: number;
}
```

## Testes Unitários

Localização: `server/label.zpl.test.ts`

```bash
pnpm test label.zpl.test.ts
```

**Cobertura:**
- ✅ Geração de código ZPL com sucesso
- ✅ Registro em tabela productLabels
- ✅ Tratamento de produto não encontrado

## Referências

- [Zebra Programming Guide](https://www.zebra.com/us/en/support-downloads/knowledge-articles/zpl-programming-guide.html)
- [ZPL Command Reference](https://www.zebra.com/content/dam/zebra/manuals/printers/common/programming/zpl-zbi2-pm-en.pdf)
- [Labelary ZPL Viewer](http://labelary.com/viewer.html) - Testar código ZPL online

## Suporte

Para dúvidas ou problemas com impressoras Zebra, consulte:
- Documentação oficial Zebra
- Suporte técnico Med@x
- Manual da impressora específica
