# WMS Med@x - Documentação dos Módulos do Sistema

**Sistema de Gerenciamento de Armazém Farmacêutico**

Versão: 1.0
Data: 23 de Janeiro de 2026
Autor: André Santos

---

## Índice

1. [Visão Geral do Sistema](#vis%C3%A3o-geral-do-sistema)

1. [Módulo de Recebimento](#m%C3%B3dulo-de-recebimento)

1. [Módulo de Cadastros](#m%C3%B3dulo-de-cadastros)

1. [Módulo de Picking (Separação)](#m%C3%B3dulo-de-picking-separa%C3%A7%C3%A3o)

1. [Módulo de Estoques](#m%C3%B3dulo-de-estoques)

---

## Visão Geral do Sistema

O WMS Med@x é um sistema completo de gerenciamento de armazém farmacêutico que integra todos os processos logísticos, desde o recebimento até a expedição de mercadorias. O sistema foi desenvolvido com foco em rastreabilidade, conformidade regulatória e eficiência operacional.

![Tela Inicial](https://private-us-east-1.manuscdn.com/sessionFile/kceDRgQ51Rn5FUBTNSrMIl/sandbox/zlJHXPNKZiKqL4bZbStOHa-images_1769167116776_na1fn_L2hvbWUvdWJ1bnR1L3dtcy1tZWRheC9kb2NzLXNjcmVlbnNob3RzLzAxLXRlbGEtaW5pY2lhbA.webp?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUva2NlRFJnUTUxUm41RlVCVE5Tck1JbC9zYW5kYm94L3psSkhYUE5LWmlLcUw0YlpiU3RPSGEtaW1hZ2VzXzE3NjkxNjcxMTY3NzZfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzZHRjeTF0WldSaGVDOWtiMk56TFhOamNtVmxibk5vYjNSekx6QXhMWFJsYkdFdGFXNXBZMmxoYkEud2VicCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Vj1YlpTLUUFvEw~FXFlOcpw~A3D~MnEFRlol8Q4mBtG-bXgAYEI5KCyLnPyNz84zmteFSbEwJ5V2MExEg2XFr1PR3tU~LpPzgBWZ5wUNDuuJsiV4~nQJ8v9l5eIa9czWMwyCF9fuE8GZSrrd4~yiqE-1A26qFpWCKbLcJp1kLRJUb1k-866xQiOXP5VJmtQ38Q4ybrenQ36NoEcUUqd4tnuxDSlz5DTjE~ifcoRQ8l3z0XVy956THVXHHY5kfFzPs0M8EB1iQWdHHULg5PXXAX7J1xrAFMBg8zhcumqoJD~2mIdVz-6239eRG9Tf~pHtRxQvT0KvLNs-IIHhZY5fWw__)

### Principais Funcionalidades

O sistema está organizado em módulos especializados que cobrem todas as etapas da cadeia logística:

- **Recebimento**: Agendamento e conferência de mercadorias que chegam ao armazém

- **Separação**: Picking e separação de pedidos para expedição

- **Stage**: Conferência de expedição com validação cega

- **Expedição**: Carregamento e rastreamento de mercadorias

- **Cadastros**: Gestão de dados mestre do sistema (clientes, produtos, endereços, usuários)

- **Importação NF**: Upload de XML de notas fiscais com geração automática de ordens

- **Estoque**: Controle e rastreabilidade de inventário em tempo real

- **Relatórios**: KPIs, dashboards e auditoria

- **Admin**: Gerenciamento e limpeza de dados do sistema

### Indicadores em Tempo Real

O dashboard principal exibe métricas operacionais atualizadas em tempo real:

- **Recebimentos Hoje**: 12 ordens

- **Pedidos em Separação**: 28 pedidos

- **Expedições Pendentes**: 15 cargas

- **Total Processado**: 55 operações


---

## Módulo de Recebimento

O módulo de Recebimento é responsável pelo gerenciamento completo do processo de entrada de mercadorias no armazém, desde o agendamento até a conferência e endereçamento dos produtos.

![Módulo de Recebimento](https://private-us-east-1.manuscdn.com/sessionFile/kceDRgQ51Rn5FUBTNSrMIl/sandbox/zlJHXPNKZiKqL4bZbStOHa-images_1769167116776_na1fn_L2hvbWUvdWJ1bnR1L3dtcy1tZWRheC9kb2NzLXNjcmVlbnNob3RzLzAyLXJlY2ViaW1lbnRvLWxpc3Rh.webp?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUva2NlRFJnUTUxUm41RlVCVE5Tck1JbC9zYW5kYm94L3psSkhYUE5LWmlLcUw0YlpiU3RPSGEtaW1hZ2VzXzE3NjkxNjcxMTY3NzZfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzZHRjeTF0WldSaGVDOWtiMk56TFhOamNtVmxibk5vYjNSekx6QXlMWEpsWTJWaWFXMWxiblJ2TFd4cGMzUmgud2VicCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Fue6UefXqlFL65hlmP~7wkzJdJ2V2O4thuBkx3BuqOIUkQS0ENSfFfg4GiVvykZGLSe1WI-CHR8U-FHB2vZkfImxOqceFb~bhWlBezlY9Pj6DkUy5uVDGo2xYXpWzyCODnNnEqUuZjaA~IkboRYo~7lnYsEe4VTkMiajm0UdgCpix5ABIsFWGmL9-m5URfpMgtUnCOaH99bnrx~-9k1nRs3BfBMuT4csIoskCMXCTFQsBzjZTdQOxTYNagW7f08e9nBdeyLKQPqG0WfnkbwzJl8rlv3ABfitg9w29vi8-1tZAZv-ng4Hi~LgSuVvH0sEIAI7YF9RYm0K3m2YaAfleQ__)

### Funcionalidades Principais

#### 1. Gestão de Ordens de Recebimento

O sistema permite visualizar e gerenciar todas as ordens de recebimento cadastradas. Cada ordem contém as seguintes informações:

- **Número da Ordem**: Identificador único (ex: TEST-001)

- **Cliente/Fornecedor**: Nome do fornecedor (ex: Laboratórios B.Braun S/A)

- **NF-e**: Número da nota fiscal eletrônica

- **Data Agendada**: Data prevista para chegada da mercadoria

- **Status**: Estado atual da ordem (Agendado, Em Conferência, Concluído)

#### 2. Ações Disponíveis

Para cada ordem de recebimento, o operador pode executar as seguintes ações:

- **📅 Agendar**: Definir ou alterar a previsão de chegada da mercadoria

- **📋 Importar Pré-alocação**: Carregar arquivo com sugestões de endereçamento

- **✓ Conferir Itens**: Iniciar processo de conferência cega dos produtos

- **👁 Visualizar Itens**: Consultar lista de produtos da ordem

- **🗑 Deletar Ordem**: Remover ordem do sistema (requer permissão)

#### 3. Visualização de Itens da Ordem

Ao clicar em "Visualizar Itens", o sistema exibe um modal com todos os produtos incluídos na ordem de recebimento:

![Itens da Ordem de Recebimento](https://private-us-east-1.manuscdn.com/sessionFile/kceDRgQ51Rn5FUBTNSrMIl/sandbox/zlJHXPNKZiKqL4bZbStOHa-images_1769167116777_na1fn_L2hvbWUvdWJ1bnR1L3dtcy1tZWRheC9kb2NzLXNjcmVlbnNob3RzLzAzLXJlY2ViaW1lbnRvLWl0ZW5z.webp?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUva2NlRFJnUTUxUm41RlVCVE5Tck1JbC9zYW5kYm94L3psSkhYUE5LWmlLcUw0YlpiU3RPSGEtaW1hZ2VzXzE3NjkxNjcxMTY3NzdfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzZHRjeTF0WldSaGVDOWtiMk56TFhOamNtVmxibk5vYjNSekx6QXpMWEpsWTJWaWFXMWxiblJ2TFdsMFpXNXoud2VicCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=OiVwknyiQGh~GhvIR9RtC9pR3t8hn~hINK~lyrjBiU86iTs7scG-3sKpMYkjK60SFnhnFvKoq8q22aNoP-eNBRaBocg5i4qi0jIEDZaZeVNYZ4ZHFsqt4MLBBBZ3ODwL8TlwHdB3VW2xgDLWQP1Qe1dTTvu7VPR8UymYaMRR~ZeYZ8N~R3ThX3EhMxM1uMYSSKYKgJ2psfx1fWhlTx5hGoiVJJa2AxXnsqHQLIdVtvlhwtKv9TZydi2qPzz1kMPCSELB1yzb-7N9t-6ZGxeZRT615TFfZuX4kTQgOyOAUJWpogYczyqdSZppLfQb9K-~cF~N2cCKVOCxvDgX8KLhcA__)

A tabela de itens apresenta:

- **Produto**: Nome completo do medicamento ou material

- **SKU**: Código único do produto (ex: 401460P, 834207)

- **Lote**: Número do lote do fabricante (ex: 22D08LB109)

- **Qtd Esperada**: Quantidade prevista para recebimento

- **Ações**: Botão para impressão de etiquetas individuais

#### 4. Impressão de Etiquetas

O sistema oferece duas opções de impressão de etiquetas:

**Opção 1: Etiqueta PDF**

- Formato profissional com logo Med@x

- Código de barras Code-128

- Informações completas (SKU, lote, validade)

- Ideal para impressoras convencionais

**Opção 2: Etiqueta Zebra (ZPL)**

- Formato otimizado para impressoras térmicas Zebra

- Dimensões: 10cm x 5cm (4" x 2")

- Resolução: 203 DPI

- Preview visual via API Labelary antes da impressão

- Diálogo de impressão automático

### Fluxo de Trabalho do Recebimento

1. **Agendamento**: Criar ordem de recebimento com dados da NF-e

1. **Chegada da Mercadoria**: Atualizar status para "Em Conferência"

1. **Conferência Cega**: Operador confere produtos sem visualizar quantidades esperadas

1. **Impressão de Etiquetas**: Gerar etiquetas para cada produto/lote recebido

1. **Endereçamento**: Alocar produtos em endereços do armazém

1. **Finalização**: Atualizar estoque e concluir ordem

### Integração com Scanner

O sistema possui integração completa com scanners de código de barras:

- Reconhecimento automático de etiquetas Code-128

- Lookup instantâneo de produto+lote ao escanear código

- Tabela `productLabels` registra todas as etiquetas geradas

- Procedure `lookupProductByLabel` retorna dados completos do produto

### Configurações de Impressão

Os usuários podem personalizar preferências de impressão em `/settings/printing`:

- **Formato Padrão**: ZPL ou PDF

- **Número de Cópias**: Quantidade padrão de etiquetas

- **Tamanho da Etiqueta**: 10cm x 5cm (padrão)

- **Resolução**: 203 DPI ou 300 DPI

- **Impressão Automática**: Ativar/desativar diálogo automático

---

## Módulo de Cadastros

O módulo de Cadastros é o coração do sistema de dados mestre, centralizando todas as informações essenciais para operação do armazém. Este módulo garante a integridade e consistência dos dados utilizados em todos os outros módulos do WMS.

![Módulo de Cadastros](https://private-us-east-1.manuscdn.com/sessionFile/kceDRgQ51Rn5FUBTNSrMIl/sandbox/zlJHXPNKZiKqL4bZbStOHa-images_1769167116778_na1fn_L2hvbWUvdWJ1bnR1L3dtcy1tZWRheC9kb2NzLXNjcmVlbnNob3RzLzA0LWNhZGFzdHJvcy1tZW51.webp?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUva2NlRFJnUTUxUm41RlVCVE5Tck1JbC9zYW5kYm94L3psSkhYUE5LWmlLcUw0YlpiU3RPSGEtaW1hZ2VzXzE3NjkxNjcxMTY3NzhfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzZHRjeTF0WldSaGVDOWtiMk56TFhOamNtVmxibk5vYjNSekx6QTBMV05oWkdGemRISnZjeTF0Wlc1MS53ZWJwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=NI68-8-oiR6wM5aIsKrluu4A2-rIg8EbV8BwD4Rsd460wU5BNosDliCli1OOXWMSgORpSWsysqvrKDA1pVRqUctYeCSgS4dTi5liZAhvqXrcsPJRJQVERsmmQeQJcZID7AF5~35F3szixrqvGtueZMQJpNSSRy~cHefCgsPh2LLwPR~oB0xQQ4Z8l2xi6~52KH8DbSIUu2BE0JzP~A7OXmyV~Wukz0nSSj4DJFLwXabkqKIiXBVlhYnSQO-ZNJ9w6NopGp-QoSxAwYhfgsSuGVVec18dVFBPgj96-7MV~AjYaK-35VHJ7RG9cJD9oKHiuIe0nPBdKikLRiv75BMrCw__)

### 1. Cadastro de Clientes

Gerencia informações de clientes e contratos comerciais.

**Funcionalidades:**

- Cadastrar novos clientes com dados completos (CNPJ, razão social, endereço)

- Gerenciar contratos e condições comerciais

- Visualizar histórico de operações por cliente

- Configurar regras específicas de armazenagem por cliente

**Informações Armazenadas:**

- Dados cadastrais (CNPJ, IE, razão social, nome fantasia)

- Endereço completo e contatos

- Condições comerciais e prazos

- Regras de armazenagem e separação

- Histórico de movimentações

### 2. Cadastro de Produtos

Catálogo completo de produtos e medicamentos gerenciados no armazém.

**Funcionalidades:**

- Cadastrar produtos com informações regulatórias completas

- Controlar SKUs e códigos de barras

- Gerenciar estoque mínimo e máximo

- Configurar regras de armazenagem (temperatura, empilhamento)

- Definir unidades de medida e conversões

**Campos Obrigatórios:**

- **SKU**: Código único do produto (ex: 401460P)

- **Descrição**: Nome completo do produto

- **Unidade**: UN, CX, FR, etc.

- **Registro ANVISA**: Número de registro sanitário

- **Temperatura**: Ambiente, Refrigerado, Congelado

- **Quantidade por Caixa**: Preenchido automaticamente na primeira conferência cega

**Campos Opcionais:**

- Fabricante e fornecedor

- Dimensões e peso

- Empilhamento máximo

- Prazo de validade padrão

- Classificação ABC

### 3. Cadastro de Endereços

Estrutura física de armazenagem do depósito.

**Funcionalidades:**

- Cadastrar endereços físicos do armazém

- Definir zonas de armazenagem (Carga Seca, Refrigerado, Quarentena)

- Configurar regras de ocupação por endereço

- Imprimir etiquetas de localização (10cm x 5cm)

- Bloquear/desbloquear endereços

**Estrutura de Endereçamento:**

- **Formato**: RUA-NIVEL-POSIÇÃO (ex: H01-01-01)

- **Zona**: Área lógica do armazém (Carga Seca, Refrigerado, etc.)

- **Capacidade**: Limite de pallets ou volumes

- **Status**: Disponível, Ocupado, Bloqueado, Em Contagem

**Impressão de Etiquetas de Endereço:**

- Formato compatível com impressoras térmicas Zebra

- Dimensões: 10cm x 5cm

- Preview antes da impressão

- Geração em lote para múltiplos endereços

### 4. Cadastro de Usuários

Controle de acesso e permissões do sistema.

**Funcionalidades:**

- Gerenciar usuários do sistema

- Atribuir perfis e permissões

- Controlar acesso por módulo

- Auditar ações dos usuários

- Gerenciar senhas e autenticação

**Perfis Disponíveis:**

- **Admin**: Acesso total ao sistema

- **Supervisor**: Gestão operacional e relatórios

- **Operador**: Execução de operações (recebimento, separação)

- **Consulta**: Apenas visualização de dados

**Permissões Granulares:**

- Criar/editar/excluir registros

- Aprovar operações

- Visualizar relatórios gerenciais

- Acessar módulo de administração

---

## Módulo de Picking (Separação)

O módulo de Picking gerencia todo o processo de separação de pedidos, desde a criação até a expedição. O sistema suporta diferentes estratégias de picking e oferece ferramentas para otimização de rotas e produtividade.

![Módulo de Picking](https://private-us-east-1.manuscdn.com/sessionFile/kceDRgQ51Rn5FUBTNSrMIl/sandbox/zlJHXPNKZiKqL4bZbStOHa-images_1769167116778_na1fn_L2hvbWUvdWJ1bnR1L3dtcy1tZWRheC9kb2NzLXNjcmVlbnNob3RzLzA1LXBpY2tpbmctbGlzdGE.webp?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUva2NlRFJnUTUxUm41RlVCVE5Tck1JbC9zYW5kYm94L3psSkhYUE5LWmlLcUw0YlpiU3RPSGEtaW1hZ2VzXzE3NjkxNjcxMTY3NzhfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzZHRjeTF0WldSaGVDOWtiMk56TFhOamNtVmxibk5vYjNSekx6QTFMWEJwWTJ0cGJtY3RiR2x6ZEdFLndlYnAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=osLIbS0vpc0WuNveUnv02~olPx707iCw1Fm4lLGDd5Pb-7KYJTllJ5RqV9jwrNCvshVSHnLDEwJtpS9UbMc1ScJpsu1Rf6xYR4SEWrS64Zihv4Oq2FcxvArkTywpipWZcZIH4M7qFBr7z8hHe2HmoYlx0TD58yHlkXl10oH2KxiGFRVa687YNp6bQQFNLTaflGI-ez53MaIV-S45dWU1bMp3-spwrBICQ0WLoUtKqUfwc3UAqAMfedwAuJH-VjfsfMU6bCCzGN-NHo0x7DB3lo6lFVkk82fDnV93hyL2MUiL~E3qEB9r7ce2-EFELVKLEyNuKF2h0F0cDEJ1wWIHkA__)

### Funcionalidades Principais

#### 1. Gestão de Pedidos de Separação

O sistema exibe todos os pedidos de picking com informações consolidadas:

- **Número do Picking**: Identificador único (ex: PK1769009609633)

- **Status**: Pendente, Em Separação, Separado, Conferido

- **Prioridade**: Normal, Urgente, Expressa

- **Nº Pedido Cliente**: Referência do cliente (ex: PED-004)

- **Cliente**: Nome do destinatário (ex: Hapvida)

- **Itens**: Quantidade de SKUs diferentes

- **Quantidade Total**: Soma de todas as unidades

- **Data de Criação**: Timestamp completo

#### 2. Ações Disponíveis

Para cada pedido de separação:

- **Ver Detalhes**: Visualizar lista completa de itens a separar

- **Reimprimir Etiquetas**: Gerar novamente etiquetas de identificação

- **Iniciar Separação**: Marcar pedido como "Em Separação"

- **Confirmar Picking**: Finalizar separação e enviar para conferência

#### 3. Organização por Ondas

O sistema permite agrupar pedidos em ondas de separação para otimizar a operação:

**Abas Disponíveis:**

- **Pedidos**: Visualização individual de cada pedido

- **Ondas**: Agrupamento de pedidos por critérios (rota, cliente, prioridade)

**Benefícios das Ondas:**

- Redução de deslocamentos no armazém

- Otimização de rotas de picking

- Consolidação de pedidos para mesmo destino

- Melhor aproveitamento de recursos

#### 4. Importação e Criação de Pedidos

**Novo Pedido Manual:**

- Botão "Novo Pedido" permite criar pedidos diretamente no sistema

- Seleção de cliente e produtos

- Definição de quantidades e prioridade

**Importar Excel:**

- Upload de planilha com múltiplos pedidos

- Validação automática de SKUs e quantidades

- Criação em lote de ordens de separação

### Fluxo de Trabalho do Picking

1. **Recebimento do Pedido**: Sistema cria ordem de separação automaticamente

1. **Planejamento**: Agrupar pedidos em ondas (opcional)

1. **Impressão de Lista**: Gerar lista de picking otimizada por rota

1. **Separação**: Operador coleta produtos nos endereços indicados

1. **Confirmação**: Registrar conclusão da separação

1. **Conferência**: Enviar para módulo Stage (conferência cega)

1. **Expedição**: Liberar para carregamento

### Estratégias de Picking Suportadas

**Picking Discreto (Order Picking):**

- Um operador separa um pedido por vez

- Ideal para pedidos urgentes ou de alto valor

- Maior rastreabilidade individual

**Picking por Lote (Batch Picking):**

- Operador separa múltiplos pedidos simultaneamente

- Reduz deslocamentos no armazém

- Requer separação posterior por pedido

**Picking por Zona (Zone Picking):**

- Armazém dividido em zonas

- Cada operador responsável por uma zona

- Pedidos passam de zona em zona

### Integração com Scanner

O módulo de picking possui integração completa com scanners:

- Leitura de código de barras dos produtos

- Validação automática de SKU e lote

- Confirmação de quantidade separada

- Registro de divergências em tempo real

### Métricas e Indicadores

O sistema calcula automaticamente:

- **Produtividade**: Linhas separadas por hora

- **Acuracidade**: % de pedidos sem divergência

- **Tempo Médio**: Duração média de separação por pedido

- **Taxa de Ocupação**: % do tempo em atividade produtiva

---

## Módulo de Estoques

O módulo de Estoques oferece visibilidade completa do inventário em tempo real, permitindo consultas detalhadas por múltiplos critérios e exportação de relatórios gerenciais.

![Módulo de Estoques](https://private-us-east-1.manuscdn.com/sessionFile/kceDRgQ51Rn5FUBTNSrMIl/sandbox/zlJHXPNKZiKqL4bZbStOHa-images_1769167116779_na1fn_L2hvbWUvdWJ1bnR1L3dtcy1tZWRheC9kb2NzLXNjcmVlbnNob3RzLzA2LWVzdG9xdWUtcG9zaWNvZXM.webp?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUva2NlRFJnUTUxUm41RlVCVE5Tck1JbC9zYW5kYm94L3psSkhYUE5LWmlLcUw0YlpiU3RPSGEtaW1hZ2VzXzE3NjkxNjcxMTY3NzlfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzZHRjeTF0WldSaGVDOWtiMk56TFhOamNtVmxibk5vYjNSekx6QTJMV1Z6ZEc5eGRXVXRjRzl6YVdOdlpYTS53ZWJwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=eKPcs71KWm9EAoM6KDGgTUlprtPfJQAnLrMYzD34qImSsdnonIRBBILU~Tt-dxSHurwCR4oqQgr3fT9xBCoItKAWpY-vrIyJTay1srJCXGp0TPxG39n-uaC3a6CBm3jNrc8lti6NsPzDjMBvTxi5NzMx~kfqk1KoYLeYWnwlQ5J5YN5iCTLfXc~o177jri91T6SJLXsbp2v3TeZ7rwOBB3sKHgo2HvWTUop-DpDxh5sfcf0HC6G9mpXT0R5cQEw-acQKbDBwm4JMQ5L1qxOTAhgkz97a2ip5YIYGONeDXpwyO3vyypcWvuKgmA-nEa4U0sTw5nOfRf1iNn7QvEs6tg__)

### Indicadores Principais

O dashboard de estoque apresenta métricas consolidadas:

- **Total de Posições**: 8 posições ativas

- **Quantidade Total**: 4.050 unidades em estoque

- **Endereços Ocupados**: 8 endereços com mercadoria

- **Lotes Únicos**: 8 lotes diferentes armazenados

### Legenda de Status

O sistema utiliza código de cores para facilitar identificação visual:

- **Verde (Disponível)**: Endereço vazio, pronto para receber mercadoria

- **Azul (Ocupado)**: Endereço com estoque disponível para separação

- **Vermelho (Bloqueado)**: Endereço bloqueado por problema de qualidade ou inventário

- **Amarelo (Em Contagem)**: Inventário em andamento, não disponível para movimentação

### Filtros Avançados

O módulo oferece múltiplos filtros para consultas específicas:

**Filtros Disponíveis:**

- **Busca por SKU/Descrição**: Localizar produto específico

- **Cliente**: Filtrar estoque por proprietário

- **Zona**: Selecionar área do armazém (Carga Seca, Refrigerado, etc.)

- **Status**: Filtrar por disponibilidade (Todos, Disponível, Bloqueado)

- **Lote**: Buscar lote específico

- **Endereço**: Consultar endereço físico

**Botão "Limpar Filtros"**: Remove todos os filtros aplicados e exibe estoque completo

### Tabela de Posições de Estoque

A tabela principal exibe informações detalhadas de cada posição:

| Campo | Descrição | Exemplo |
| --- | --- | --- |
| **Cliente** | Proprietário da mercadoria | Hapvida |
| **Zona** | Área do armazém | Carga Seca |
| **Endereço** | Localização física | H01-01-01 |
| **Status** | Estado do endereço | Ocupado |
| **SKU** | Código do produto | 443060 |
| **Produto** | Descrição completa | EXTENSOFIX 60 CM |
| **Lote** | Número do lote | 22D14LA124 |
| **Quantidade** | Total de unidades | 480 |
| **Qtd. Reservada** | Unidades comprometidas | 20 |
| **Qtd. Disponível** | Unidades livres | 460 |
| **Validade** | Data de vencimento | 26/04/2027 |

### Funcionalidades Adicionais

#### 1. Exportação para Excel

Botão "Exportar Excel" gera relatório completo em formato .xlsx:

**Características do Arquivo:**

- 9 colunas com todas as informações da tabela

- Cabeçalho formatado em azul

- Larguras de coluna otimizadas

- Nome do arquivo: `estoque_YYYYMMDD_HHMMSS.xlsx`

- Download automático via conversão base64→blob

**Conteúdo Exportado:**

- Todas as posições visíveis após aplicação de filtros

- Formatação profissional para apresentações

- Compatível com Excel, Google Sheets, LibreOffice

#### 2. Dashboard de Ocupação

Acesso rápido ao dashboard visual de ocupação do armazém:

- Mapa de calor dos endereços

- Taxa de ocupação por zona

- Gráficos de evolução do estoque

- Alertas de endereços críticos

#### 3. Histórico de Etiquetas

Consulta de todas as etiquetas geradas no sistema:

- Data e hora de impressão

- Usuário responsável

- Produto e lote

- Código de barras gerado

- Status da etiqueta (ativa, cancelada)

#### 4. Movimentações

Rastreabilidade completa de todas as movimentações:

- Entradas (recebimento)

- Saídas (separação, expedição)

- Transferências entre endereços

- Ajustes de inventário

- Bloqueios e desbloqueios

### Gestão de Estoque Reservado

O sistema diferencia estoque físico de estoque disponível:

**Estoque Físico**: Quantidade total presente no endereço**Estoque Reservado**: Quantidade comprometida com pedidos em separação**Estoque Disponível**: Estoque físico - Estoque reservado

**Exemplo Prático:**

- Endereço H01-01-01 tem 480 unidades de EXTENSOFIX 60 CM

- 20 unidades estão reservadas para pedido PED-001

- 460 unidades estão disponíveis para novos pedidos

### Rastreabilidade por Lote

O sistema mantém rastreabilidade completa por lote:

- Cada lote possui registro único no sistema

- Movimentações registradas por lote

- Controle de validade por lote

- FEFO (First Expired, First Out) automático

- Bloqueio de lotes vencidos ou próximos ao vencimento

### Alertas e Notificações

O módulo de estoque gera alertas automáticos para:

- **Estoque Mínimo**: Produto abaixo do nível de reposição

- **Validade Próxima**: Lotes com vencimento em 30/60/90 dias

- **Lote Vencido**: Lotes que ultrapassaram data de validade

- **Divergência de Inventário**: Diferenças encontradas em contagens

- **Endereço Bloqueado**: Endereços indisponíveis para movimentação

### Integração com Outros Módulos

O módulo de Estoques se integra automaticamente com:

- **Recebimento**: Atualização de estoque após conferência

- **Picking**: Reserva automática de quantidades

- **Stage**: Baixa de estoque após conferência de expedição

- **Inventário**: Ajustes de estoque após contagem

- **Relatórios**: Fonte de dados para dashboards gerenciais

---

## Conclusão

O WMS Med@x oferece uma solução completa e integrada para gerenciamento de armazéns farmacêuticos, com foco em rastreabilidade, conformidade regulatória e eficiência operacional. Os quatro módulos documentados (Recebimento, Cadastros, Picking e Estoques) trabalham de forma integrada para garantir controle total sobre todas as operações logísticas.



---

**Med@x - Soluções Logísticas Para Saúde***Versão do Sistema: 1.0 | Data da Documentação: 23/01/2026*

