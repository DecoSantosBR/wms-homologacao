# WMS Med@x - Documentação Completa

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Autor:** Manus AI  
**Sistema:** WMS Farmacêutico - Sistema de Gerenciamento de Armazém

---

## Índice de Documentação

Esta documentação contém tudo que você precisa para entender, replicar e manter o WMS Med@x.

### Arquivos de Documentação

1. **DOCUMENTACAO_01_HOME_ADMIN.md**
   - Módulo Home (página inicial)
   - Módulo Admin Dashboard
   - Módulo Admin Cleanup (Limpeza de Dados)
   - Estrutura de componentes
   - Fluxos de navegação

2. **DOCUMENTACAO_02_RECEBIMENTO.md**
   - Módulo de Recebimento
   - Importação de NF-e
   - Conferência de itens
   - Endereçamento de produtos
   - Fluxos operacionais

3. **DOCUMENTACAO_03_SEPARACAO.md**
   - Módulo de Separação (Picking)
   - PickingWizard
   - Gerenciamento de devoluções
   - Confirmação de picking
   - Fluxos de operação

4. **DOCUMENTACAO_04_CADASTROS.md**
   - Submódulo Clientes (Tenants)
   - Submódulo Produtos
   - Submódulo Usuários
   - Submódulo Localizações
   - Submódulo Zonas
   - Funcionalidades comuns

5. **DOCUMENTACAO_05_INFRAESTRUTURA.md**
   - Arquitetura técnica
   - Schema de banco de dados
   - Configuração de routers tRPC
   - Autenticação e autorização
   - Variáveis de ambiente
   - Deployment

6. **DOCUMENTACAO_06_GUIA_IMPLEMENTACAO.md**
   - Guia passo a passo para replicar o sistema
   - Pré-requisitos
   - Configuração do ambiente
   - Criação do schema
   - Cópia de páginas e componentes
   - Testes e validações
   - Checklist de implementação

7. **DOCUMENTACAO_07_ESTOQUE.md**
   - Módulo Estoque (Stock)
   - Posições de estoque em tempo real
   - Movimentações entre endereços
   - Dashboard de ocupação
   - Sugestões de otimização
   - Exportação de relatórios

8. **DOCUMENTACAO_08_CONFERENCIA_ETIQUETAS.md**
   - Módulo Conferência Cega por Etiquetas
   - Leitura de código de barras
   - Associação automática de etiquetas
   - Detecção de divergências
   - Ajustes de quantidade
   - Auditoria completa

9. **DOCUMENTACAO_09_IMPRESSAO_ETIQUETAS.md**
   - Módulo Impressão de Etiquetas
   - Geração de PDF com código de barras
   - Formato otimizado para impressoras térmicas
   - Histórico de impressões
   - Reimpressão de etiquetas

10. **DOCUMENTACAO_10_PREALOCATION.md**
    - Módulo Pré-alocação de Endereços
    - Upload de planilha Excel
    - Validação automática de dados
    - Sugestão inteligente de endereços
    - Histórico de alocações

11. **DOCUMENTACAO_11_RBAC.md**
    - Sistema RBAC (Role-Based Access Control)
    - 6 papéis predefinidos
    - 40 permissões granulares
    - Controle de acesso em backend e frontend
    - Auditoria de acesso

12. **DOCUMENTACAO_12_IMPORTACAO_ENDERECOS.md**
    - Módulo Importação de Endereços via Excel
    - Upload de planilha com dados de endereços
    - Validação automática
    - Geração automática de códigos
    - Histórico de importações

13. **DOCUMENTACAO_13_VERSAO_MOBILE.md**
    - Versão Mobile do WMS
    - Interface mobile-first responsiva
    - Integração com câmera e scanner
    - Funcionalidade offline
    - Otimização de bateria e dados

---

## Visão Geral do Sistema

### Módulos Principais

| Módulo | Descrição | Status |
|--------|------| Módulo | Descrição | Status |
|--------|-----------|--------|
| Home | Página inicial com grid de módulos | ✅ Documentado |
| Admin | Gerenciamento do sistema | ✅ Documentado |
| Recebimento | Agendamento e conferência de mercadorias | ✅ Documentado |
| Separação | Picking e separação de pedidos | ✅ Documentado |
| Estoque | Controle de inventário | ✅ Documentado |
| Conferência Cega | Leitura de etiquetas com código de barras | ✅ Documentado |
| Impressão Etiquetas | Geração de etiquetas em PDF | ✅ Documentado |
| Pré-alocação | Alocação de endereços via Excel | ✅ Documentado |
| RBAC | Sistema de controle de acesso | ✅ Documentado |
| Importação Endereços | Importação de endereços via Excel | ✅ Documentado |
| Mobile | Versão mobile do WMS | ✅ Documentado |
| Expedição | Carregamento e rastreamento | ⏳ Planejado |
| Relatórios | KPIs e dashboards | ⏳ Planejado |ejado |

### Tecnologias

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend:** Express 4, tRPC 11, Node.js
- **Banco de Dados:** MySQL/TiDB com Drizzle ORM
- **Autenticação:** Manus OAuth + JWT
- **Hospedagem:** Manus Platform

---

## Estrutura de Pastas

```
wms-pharma/
├── DOCUMENTACAO_01_HOME_ADMIN.md
├── DOCUMENTACAO_02_RECEBIMENTO.md
├── DOCUMENTACAO_03_SEPARACAO.md
├── DOCUMENTACAO_04_CADASTROS.md
├── DOCUMENTACAO_05_INFRAESTRUTURA.md
├── DOCUMENTACAO_06_GUIA_IMPLEMENTACAO.md
├── README_DOCUMENTACAO.md (este arquivo)
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminCleanupNew.tsx
│   │   │   ├── Receiving.tsx
│   │   │   ├── Picking.tsx
│   │   │   └── ... (outros módulos)
│   │   ├── components/
│   │   ├── lib/
│   │   └── App.tsx
│   └── index.html
├── server/
│   ├── routers.ts
│   ├── db.ts
│   └── _core/
├── drizzle/
│   └── schema.ts
└── package.json
```

---

## Como Usar Esta Documentação

### Para Entender o Sistema

1. Leia **DOCUMENTACAO_01_HOME_ADMIN.md** para visão geral
2. Leia os módulos específicos conforme necessário
3. Consulte **DOCUMENTACAO_05_INFRAESTRUTURA.md** para detalhes técnicos

### Para Replicar o Sistema

1. Siga **DOCUMENTACAO_06_GUIA_IMPLEMENTACAO.md** passo a passo
2. Use as outras documentações como referência durante a implementação
3. Copie os códigos fornecidos em cada documentação

### Para Manter o Sistema

1. Consulte **DOCUMENTACAO_05_INFRAESTRUTURA.md** para configuração
2. Use **DOCUMENTACAO_06_GUIA_IMPLEMENTACAO.md** para troubleshooting
3. Verifique a documentação específica do módulo para mudanças

---

## Funcionalidades Principais

### Módulo de Limpeza de Dados (Admin Cleanup)

**Nova Funcionalidade:** Sistema seguro e auditado para limpeza de dados.

**Características:**
- Seleção de módulos via checkboxes
- Todos os módulos com Hard Delete (remoção permanente)
- Confirmação dupla com código aleatório
- Auditoria completa com motivo e usuário
- Snapshots para recuperação

**Módulos Disponíveis:**
- ☐ Clientes
- ☐ Produtos
- ☐ Ordens de Recebimento
- ☐ Ordens de Separação
- ☐ Endereços
- ☐ Zonas
- ☐ Movimentações

**Acesso:** Home > Card Admin > Acessar Limpeza

---

## Conformidade e Segurança

### ANVISA RDC 430/2020

O WMS Med@x foi desenvolvido com conformidade com a regulamentação ANVISA:

- ✅ Rastreabilidade completa de operações
- ✅ Auditoria de todas as mudanças
- ✅ Controle de acesso por usuário
- ✅ Validação de dados de entrada
- ✅ Backup automático
- ✅ Logs detalhados

### Segurança

- ✅ Autenticação OAuth
- ✅ Autorização baseada em roles
- ✅ Proteção contra SQL injection
- ✅ Validação de entrada
- ✅ CORS configurado
- ✅ Rate limiting
- ✅ Criptografia de senhas

---

## Suporte e Manutenção

### Problemas Comuns

Veja **DOCUMENTACAO_06_GUIA_IMPLEMENTACAO.md** seção "Troubleshooting" para:
- Erros de conexão com banco de dados
- Problemas de autenticação OAuth
- Erros de módulos não encontrados
- Falhas de compilação TypeScript

### Contato

Para suporte técnico, acesse: https://help.manus.im

---

## Changelog

### Versão 1.0 (Janeiro 2026)

**Novidades:**
- ✅ Módulo Home com grid de 8 módulos
- ✅ Módulo Admin Dashboard
- ✅ Módulo Admin Cleanup (Limpeza de Dados)
- ✅ Módulo Recebimento (importação NF-e, conferência, endereçamento)
- ✅ Módulo Separação (picking wizard, gerenciamento de devoluções)
- ✅ Módulo Cadastros (clientes, produtos, usuários, localizações, zonas)
- ✅ Módulo Estoque (posições, movimentações, dashboard de ocupação)
- ✅ Módulo Conferência Cega por Etiquetas
- ✅ Módulo Impressão de Etiquetas
- ✅ Módulo Pré-alocação de Endereços
- ✅ Sistema RBAC com 6 papéis e 40 permissões
- ✅ Módulo Importação de Endereços via Excel
- ✅ Versão Mobile com câmera e scanner
- ✅ Documentação completa (13 arquivos)

**Planejado:**
- ⏳ Módulo Expedição
- ⏳ Módulo Relatórios (KPIs avançados)
- ⏳ Integração com APIs externas

---

## Créditos

**Desenvolvido por:** Manus AI  
**Data:** Janeiro 2026  
**Versão:** 1.0  
**Licença:** Proprietária - WMS Farmacêutico

---

**Fim da Documentação - Índice Geral**
