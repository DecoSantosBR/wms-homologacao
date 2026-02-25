# 📦 WMS Med@x - Sistema de Gerenciamento de Armazém Farmacêutico

Sistema completo de gerenciamento de armazém (WMS) especializado para o setor farmacêutico, com controle de lotes, validades, rastreabilidade completa e interface otimizada para coletores de dados.

## 🎯 Principais Funcionalidades

### 📥 Recebimento
- Importação automática de NF-e (XML)
- Conferência cega de mercadorias
- Registro de lotes e validades
- Endereçamento automático inteligente
- Interface mobile para coletor de dados

### 📦 Separação (Picking)
- Criação de pedidos de separação
- Geração de ondas de separação
- Reserva automática de estoque
- Picking guiado por endereço
- Impressão de etiquetas de volume

### ✅ Conferência (Stage)
- Conferência de expedição
- Validação de quantidades por lote
- Agrupamento inteligente por SKU+lote
- Interface mobile para coletor

### 🚚 Expedição
- Geração de romaneios
- Baixa automática de estoque
- Sistema de dupla reserva (modelo bancário)
- Rastreabilidade completa

### 📊 Controle de Estoque
- Posições de estoque em tempo real
- Filtros avançados (SKU, lote, endereço, zona)
- Movimentações entre endereços
- Validação de múltiplos lotes por endereço
- Controle de validade

### 📱 Interface para Coletor de Dados
- Layout mobile-first otimizado
- Scanner de código de barras integrado
- Feedback háptico e visual
- Operação com uma mão
- Suporte a câmera e flash

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 19** - Framework UI
- **TypeScript** - Tipagem estática
- **Tailwind CSS 4** - Estilização
- **shadcn/ui** - Componentes UI
- **tRPC** - Type-safe API
- **Wouter** - Roteamento
- **html5-qrcode** - Scanner de código de barras
- **Sonner** - Notificações toast

### Backend
- **Node.js** - Runtime
- **Express 4** - Framework web
- **tRPC 11** - API type-safe
- **Drizzle ORM** - ORM SQL
- **MySQL/TiDB** - Banco de dados
- **Superjson** - Serialização de dados

### Infraestrutura
- **Vite** - Build tool
- **Vitest** - Testing framework
- **Manus OAuth** - Autenticação
- **S3** - Armazenamento de arquivos

## 📋 Pré-requisitos

- Node.js 22.x ou superior
- pnpm 9.x ou superior
- MySQL 8.0 ou TiDB
- Conta Manus (para OAuth e storage)

## 🚀 Instalação

Consulte o arquivo [INSTALL.md](./INSTALL.md) para instruções detalhadas de instalação.

### Instalação Rápida

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/wms-medax.git
cd wms-medax

# Instale as dependências
pnpm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Execute as migrações do banco
pnpm db:push

# Inicie o servidor de desenvolvimento
pnpm dev
```

## 📖 Documentação

- [Guia de Instalação](./INSTALL.md)
- [Guia de Deploy](./DEPLOY.md)
- [Guia de Contribuição](./CONTRIBUTING.md)
- [Documentação da API](./docs/API.md)

## 🏗️ Estrutura do Projeto

```
wms-medax/
├── client/                 # Frontend React
│   ├── public/            # Arquivos estáticos
│   └── src/
│       ├── components/    # Componentes reutilizáveis
│       ├── pages/         # Páginas da aplicação
│       │   └── collector/ # Páginas do coletor mobile
│       ├── contexts/      # Contextos React
│       ├── hooks/         # Custom hooks
│       └── lib/           # Utilitários
├── server/                # Backend Express + tRPC
│   ├── _core/            # Infraestrutura (auth, llm, storage)
│   ├── routers.ts        # Definição de rotas tRPC
│   ├── db.ts             # Helpers de banco de dados
│   └── *.ts              # Lógica de negócio
├── drizzle/              # Schema e migrações do banco
├── shared/               # Código compartilhado
└── storage/              # Helpers de S3

```

## 🔐 Segurança

- Autenticação via Manus OAuth
- Controle de acesso baseado em roles (admin/user)
- Validação de entrada em todas as APIs
- Proteção contra SQL injection (Drizzle ORM)
- HTTPS obrigatório em produção

## 🧪 Testes

```bash
# Executar todos os testes
pnpm test

# Executar testes específicos
pnpm test location
pnpm test quantity

# Executar testes em modo watch
pnpm test --watch
```

## 📚 Glossário e Padrões

Antes de implementar qualquer alteração, consulte o [Glossary.md](./Glossary.md) para garantir a padronização de termos e conceitos utilizados no projeto. Este documento é a **Constituição Técnica** do WMS Med@x e define:

- Entidades de Governança (Tenant, Customer, User)
- Gestão de Inventário (Inventory, Batch, Unique Code)
- Ciclo de Saída (Order, Wave, Picking Allocation, Wave Item)
- Estados e Fluxos (Pending, In Progress, Picked, Shipped)
- **Regras de Ouro para Desenvolvedores** (Transacionalidade, Race Conditions, Incremento Atômico, Sincronização Multinível)

## 📝 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](./LICENSE) para detalhes.

## 👥 Contribuindo

Contribuições são bem-vindas! Por favor, leia o [CONTRIBUTING.md](./CONTRIBUTING.md) para detalhes sobre nosso código de conduta e processo de submissão de pull requests.

## 📧 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato através de [seu-email@exemplo.com](mailto:seu-email@exemplo.com).

## 🙏 Agradecimentos

- [Manus](https://manus.im) - Plataforma de desenvolvimento
- [shadcn/ui](https://ui.shadcn.com/) - Componentes UI
- [tRPC](https://trpc.io/) - Framework API type-safe

---

Desenvolvido com ❤️ por [Seu Nome](https://github.com/seu-usuario)
