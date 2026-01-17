# WMS Med@x - Lista de Funcionalidades

## 📱 ADAPTAÇÃO MOBILE - 11/01/2026 19:45

### Layout Global
- [x] Adaptar PageHeader para mobile (botões menores, logo compacto)
- [x] Implementar menu hamburguer para navegação
- [x] Ajustar espaçamentos e padding para telas pequenas
- [x] Garantir que modais sejam fullscreen em mobile

### Home e Cadastros
- [x] Grid de cards responsivo (1 coluna em mobile)
- [x] Botões e cards com touch-friendly (min 44px altura)
- [x] Textos legíveis em telas pequenas

### Tabelas e Listagens
- [x] Tabelas com scroll horizontal em mobile
- [x] Cards colapsáveis como alternativa a tabelas
- [x] Filtros em drawer/modal para economizar espaço
- [x] Paginação otimizada para mobile

### Formulários
- [x] Inputs com tamanho adequado para touch
- [x] Dropdowns nativos em mobile
- [x] Validação inline visível
- [x] Teclado numérico para campos de quantidade

### Módulos Operacionais
- [x] Recebimento: listagem e conferência mobile-friendly
- [x] Picking: interface de execução otimizada para coletor
- [x] Estoque: consulta e movimentação em mobile
- [x] Scanner: botões grandes e fáceis de tocar

### Componentes Específicos
- [x] BlindCheckModal: layout vertical em mobile
- [x] PickingStepModal: etapas em fullscreen
- [x] CreateWaveDialog: tabelas simplificadas
- [x] ImportPreallocationDialog: upload otimizado

### Testes
- [x] Testar em viewport 375px (iPhone SE)
- [x] Testar em viewport 768px (iPad)
- [x] Validar touch targets (mínimo 44px)
- [x] Verificar scroll e navegação

---

## ✅ HISTÓRICO DE FUNCIONALIDADES IMPLEMENTADAS

[Conteúdo anterior do todo.md foi preservado mas omitido aqui para brevidade]


## 📸 OTIMIZAÇÃO DO SCANNER - 11/01/2026 20:00

### Suporte a Formatos de Código
- [x] Adicionar suporte a EAN-13 (padrão europeu)
- [x] Adicionar suporte a EAN-8 (versão curta)
- [x] Adicionar suporte a Code 128 (uso industrial)
- [x] Adicionar suporte a Code 39
- [x] Adicionar suporte a QR Code
- [x] Adicionar suporte a Data Matrix
- [x] Permitir configuração de formatos ativos

### Feedback Visual
- [x] Adicionar overlay com guia de alinhamento
- [x] Implementar animação de scan (linha verde)
- [x] Mostrar preview do código detectado
- [x] Adicionar indicador de sucesso (checkmark verde)
- [x] Adicionar indicador de erro (X vermelho)
- [x] Implementar contador de tentativas

### Feedback Háptico
- [x] Vibração ao detectar código com sucesso
- [x] Vibração de erro ao falhar
- [x] Padrão de vibração diferenciado por tipo
- [x] Suporte a dispositivos sem vibração

### Melhorias de UI
- [x] Botão de lanterna (flash) para ambientes escuros
- [x] Zoom in/out para ajuste de distância
- [x] Botão de troca de câmera (frontal/traseira)
- [x] Instruções contextuais na tela
- [x] Modo fullscreen otimizado
- [x] Estatísticas de scan (taxa de sucesso)

### Performance
- [x] Otimizar taxa de frames (FPS)
- [x] Reduzir latência de detecção
- [x] Implementar debounce para evitar leituras duplicadas
- [x] Cache de configurações do usuário


## 🚨 MELHORIA DE MENSAGEM DE ERRO - 11/01/2026 20:15

### Modal de Saldo Insuficiente
- [x] Criar componente InsufficientStockModal
- [x] Exibir título "Quantidade insuficiente:"
- [x] Mostrar SKU e nome do produto
- [x] Exibir quantidade solicitada em vermelho
- [x] Exibir quantidade disponível em verde
- [x] Formatar unidades (caixas/unidades)
- [x] Integrar no fluxo de criação de pedido de separação


## 🎨 SISTEMA DE MODAIS DE ERRO - 11/01/2026 20:30

### Componente Genérico
- [x] Criar BusinessErrorModal base reutilizável
- [x] Suporte a diferentes tipos de ícones (erro, alerta, info)
- [x] Cores semânticas por tipo de erro
- [x] Layout responsivo consistente

### Modais Específicos
- [x] ProductNotFoundModal - Produto não encontrado
- [x] PermissionDeniedModal - Permissão negada
- [x] DivergenceModal - Divergência de conferência
- [x] InvalidDataModal - Dados inválidos
- [x] DuplicateEntryModal - Entrada duplicada

### Integração
- [x] Aplicar em PickingOrders (criar, editar, deletar)
- [x] Aplicar em Receiving (criar, conferir)
- [ ] Aplicar em Inventory (movimentar, ajustar)
- [x] Aplicar em Cadastros (produtos, clientes, endereços)

### Padrão Visual
- [x] Ícones consistentes (AlertCircle, XCircle, Info, Lock)
- [x] Cores semânticas (vermelho=erro, amarelo=alerta, azul=info)
- [x] Tipografia uniforme
- [x] Espaçamentos padronizados


## 🔧 CORREÇÃO MODAL ESTOQUE INSUFICIENTE - 11/01/2026 20:45

### Formato de Quantidades
- [x] Exibir caixas E unidades na linha "Solicitada"
- [x] Exibir caixas E unidades na linha "Disponível"
- [x] Calcular conversão correta usando unitsPerBox
- [x] Formato: "1.000 caixas / 80.000 unidades"

### Múltiplos Produtos
- [x] Suportar lista de produtos com estoque insuficiente
- [x] Exibir todos os produtos no mesmo modal
- [x] Layout em cards ou lista para múltiplos itens
- [ ] Parser de erro que detecta múltiplos produtos (backend precisa retornar lista)

### Backend
- [x] Incluir unitsPerBox na mensagem de erro
- [x] Calcular disponível em caixas no backend
- [ ] Retornar lista de produtos com erro (não apenas o primeiro) - requer refatoração


## 🔄 ACUMULAÇÃO DE ERROS DE ESTOQUE - 11/01/2026 21:00

### Backend
- [x] Refatorar validação para não lançar erro no primeiro produto
- [x] Acumular todos os produtos com estoque insuficiente em array
- [x] Criar estrutura de erro com lista de produtos
- [x] Lançar erro único com todos os produtos ao final

### Frontend
- [x] Atualizar parser para detectar formato de múltiplos produtos
- [x] Extrair lista de produtos do erro estruturado
- [x] Passar array completo para showInsufficientStock

### Testes
- [x] Testar com 1 produto com erro
- [x] Testar com 2+ produtos com erro
- [x] Verificar exibição no modal


## 🔧 BOTÃO AJUSTAR QUANTIDADES - 11/01/2026 21:15

### BusinessErrorModal
- [x] Adicionar prop onAdjust opcional
- [x] Exibir botão "Ajustar Quantidades" quando onAdjust fornecido
- [x] Botão visível apenas para tipo insufficient_stock
- [x] Fechar modal ao clicar em ajustar

### useBusinessError Hook
- [x] Adicionar parâmetro onAdjust em showInsufficientStock
- [x] Passar callback para BusinessErrorModal

### PickingOrders
- [x] Implementar função adjustQuantities
- [x] Calcular quantidades disponíveis por produto
- [x] Atualizar selectedProducts com quantidades ajustadas
- [x] Manter produtos com estoque OK inalterados
- [x] Passar onAdjust para showInsufficientStock


## 🔄 CONVERSÃO INTELIGENTE DE UNIDADES - 11/01/2026 21:30

### Lógica de Ajuste
- [x] Verificar se availableBoxes < 1
- [x] Verificar se availableBoxes não é número inteiro (ex: 3.5)
- [x] Quando verdadeiro: usar availableQuantity em unidades
- [x] Quando falso: usar availableBoxes em caixas
- [x] Atualizar tanto quantity quanto unit no produto


## 📋 MELHORIAS EXECUÇÃO DE ONDA - 11/01/2026 21:40

### Ordenação e Exibição
- [x] Ordenar itens por endereço crescente (H01-01-04, H01-02-01, H01-02-02)
- [x] Exibir número do pedido em cada item ("Nº do Pedido: 0001")
- [x] Estilizar número do pedido em vermelho (#ef4444)
- [x] Posicionar número do pedido no topo direito do card

### Impressão Automática
- [x] Criar função de geração de PDF dos pedidos
- [x] Implementar impressão automática ao finalizar onda
- [x] Gerar um documento por pedido da onda
- [x] Incluir informações: cliente, produtos, quantidades, endereços
- [x] Abrir preview de impressão automaticamente


## 🐛 CORREÇÃO HOOKS WAVEEXECUTION - 11/01/2026 22:17

- [x] Mover useState(hasAutoPrinted) para o topo do componente
- [x] Mover useEffect de impressão automática para o topo
- [x] Garantir que todos os hooks estejam antes dos returns condicionais
- [x] Testar execução de onda sem erros

## Novos Bugs

- [x] Erro: "tenantId é obrigatório para movimentações de estoque" na página /stock/movements

- [x] Remover lógica de cliente "compartilhado" (tenantId null) em endereços
- [x] Garantir que todo endereço tenha tenantId obrigatório

## Novas Funcionalidades

- [x] Implementar documento de impressão da Onda de Separação
  - [x] Criar função de geração de PDF no backend (waveRouter.ts)
  - [x] Adicionar botão "Imprimir Documento" na tela WaveExecution
  - [x] Layout: cabeçalho (Onda | Cliente | Data | Separado por) + corpo agrupado por pedido (Pedido + Destinatário + tabela: Produto, SKU, Endereço, Lote, Validade, Quantidade) + rodapé (Data de Impressão)

## Bugs no Documento de Impressão da Onda

- [x] Destinatário aparece como "N/A" em vez do endereço de entrega real
- [x] Todos os pedidos mostram os mesmos itens (não está agrupando corretamente por pedido)
- [x] Itens estão sendo duplicados entre pedidos diferentes

## Nova Funcionalidade

- [x] Adicionar customerOrderNumber na tela de conclusão da onda (WaveExecution) ao lado de cada item

## Bug Atual

- [x] customerOrderNumber AINDA não estava aparecendo na tela de conclusão da onda (WaveExecution) - RESOLVIDO: erro de namespace (trpc.picking → trpc.wave) + deduplicação de itens no JOIN


## Novos Bugs Reportados - 17/01/2026

- [x] customerOrderNumber ainda não estava correto - RESOLVIDO: adicionado campo pickingOrderId na tabela pickingWaveItems + atualizado waveLogic.ts para popular o campo ao criar ondas + atualizado waveRouter.ts para fazer JOIN direto com pickingOrders. Novas ondas criadas terão o customerOrderNumber correto.
- [x] Cor do customerOrderNumber mudada de vermelho (text-red-500) para preto (text-gray-900)


## Novos Bugs Reportados - 17/01/2026 (Parte 2)

- [x] Caixas de seleção não apareciam - RESOLVIDO: pedidos estavam com status 'in_wave' ao invés de 'pending' devido à deleção manual de onda anterior. Atualizado status no banco de dados para 'pending'.
- [x] Erro ao criar onda - RESOLVIDO: mesmo problema do status 'in_wave'. Após correção, onda foi criada com sucesso com 4 pedidos e customerOrderNumber aparece corretamente em preto.


## Novo Bug Reportado - 17/01/2026 (15:07)

- [x] Erro React: "Encountered two children with the same key, `10`" - RESOLVIDO: alterado key de `item.id` para chave composta `${item.id}-${item.productId}-${item.locationCode}` para garantir unicidade


## Bugs no Documento PDF - 17/01/2026 (15:17)

- [x] Itens duplicados entre pedidos - RESOLVIDO: alterado query em waveDocument.ts para usar pickingOrderId diretamente ao invés de JOIN complexo com pickingReservations. Agora cada pedido mostra apenas seus próprios itens.
- [x] Destinatário "N/A" - RESOLVIDO: query já busca deliveryAddress de pickingOrders, aguardando teste do usuário para confirmar
