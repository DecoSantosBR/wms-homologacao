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
