# 🤝 Guia de Contribuição - WMS Med@x

Obrigado por considerar contribuir para o WMS Med@x! Este documento fornece diretrizes para contribuir com o projeto.

## 📋 Código de Conduta

Ao participar deste projeto, você concorda em manter um ambiente respeitoso e inclusivo para todos. Esperamos que todos os contribuidores:

- Usem linguagem acolhedora e inclusiva
- Respeitem pontos de vista e experiências diferentes
- Aceitem críticas construtivas com elegância
- Foquem no que é melhor para a comunidade

## 🚀 Como Contribuir

### Reportar Bugs

Se você encontrou um bug, por favor abra uma issue com:

1. **Título claro e descritivo**
2. **Passos para reproduzir** o problema
3. **Comportamento esperado** vs **comportamento atual**
4. **Screenshots** (se aplicável)
5. **Informações do ambiente:**
   - Versão do Node.js
   - Sistema operacional
   - Navegador (se aplicável)

### Sugerir Melhorias

Para sugerir novas funcionalidades:

1. Verifique se já não existe uma issue similar
2. Abra uma issue com:
   - Descrição clara da funcionalidade
   - Justificativa (por que seria útil?)
   - Exemplos de uso
   - Mockups ou wireframes (se aplicável)

### Pull Requests

#### Antes de Começar

1. **Fork** o repositório
2. **Clone** seu fork:
   ```bash
   git clone https://github.com/seu-usuario/wms-medax.git
   ```
3. **Crie uma branch** para sua feature:
   ```bash
   git checkout -b feature/nome-da-feature
   ```

#### Desenvolvendo

1. **Instale as dependências:**
   ```bash
   pnpm install
   ```

2. **Execute os testes:**
   ```bash
   pnpm test
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   pnpm dev
   ```

#### Padrões de Código

**TypeScript:**
- Use tipos explícitos sempre que possível
- Evite `any` - use `unknown` se necessário
- Prefira interfaces para objetos públicos
- Use tipos utilitários do TypeScript

**React:**
- Componentes funcionais com hooks
- Props tipadas com TypeScript
- Use `memo` apenas quando necessário
- Extraia lógica complexa para custom hooks

**Naming Conventions:**
- Componentes: `PascalCase` (ex: `CollectorLayout`)
- Funções: `camelCase` (ex: `getUserData`)
- Constantes: `UPPER_SNAKE_CASE` (ex: `MAX_RETRIES`)
- Arquivos: `kebab-case` ou `PascalCase` para componentes

**Estrutura de Arquivos:**
```
client/src/
├── components/        # Componentes reutilizáveis
├── pages/            # Páginas da aplicação
├── hooks/            # Custom hooks
├── contexts/         # React contexts
└── lib/              # Utilitários

server/
├── _core/            # Infraestrutura
├── routers.ts        # Definição de rotas
├── db.ts             # Helpers de banco
└── *.ts              # Lógica de negócio
```

#### Testes

- **Escreva testes** para novas funcionalidades
- **Atualize testes** existentes se necessário
- **Execute todos os testes** antes de submeter:
  ```bash
  pnpm test
  ```

**Estrutura de Teste:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(async () => {
    // Setup
  });

  it('should do something', async () => {
    // Arrange
    const input = { /* ... */ };

    // Act
    const result = await someFunction(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

#### Commit Messages

Use commits semânticos:

```
feat: adiciona scanner de código de barras
fix: corrige validação de lote
docs: atualiza README com instruções de instalação
style: formata código com prettier
refactor: reorganiza estrutura de pastas
test: adiciona testes para movimentação de estoque
chore: atualiza dependências
```

**Formato:**
```
<tipo>(<escopo>): <descrição curta>

<descrição detalhada opcional>

<footer opcional>
```

**Tipos:**
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação de código
- `refactor`: Refatoração
- `test`: Testes
- `chore`: Tarefas de manutenção

#### Submeter Pull Request

1. **Push** para seu fork:
   ```bash
   git push origin feature/nome-da-feature
   ```

2. **Abra um Pull Request** no GitHub

3. **Preencha o template** do PR:
   - Descrição das mudanças
   - Issue relacionada (se houver)
   - Screenshots (se aplicável)
   - Checklist de revisão

4. **Aguarde revisão** - responda aos comentários prontamente

## 🏗️ Arquitetura do Projeto

### Frontend (React + tRPC)

- **Componentes:** Reutilizáveis e isolados
- **Pages:** Uma por rota, compõem componentes
- **Hooks:** Lógica compartilhada
- **tRPC:** Type-safe API calls

### Backend (Express + tRPC)

- **Routers:** Definem endpoints tRPC
- **DB Helpers:** Queries reutilizáveis
- **Business Logic:** Separada em arquivos por domínio

### Banco de Dados (Drizzle ORM)

- **Schema:** Definido em `drizzle/schema.ts`
- **Migrations:** Geradas automaticamente
- **Queries:** Type-safe com Drizzle

## 📝 Documentação

Ao adicionar novas funcionalidades:

1. **Atualize o README.md** se necessário
2. **Documente APIs** em comentários JSDoc
3. **Adicione exemplos** de uso
4. **Atualize INSTALL.md** se houver novos requisitos

## 🔍 Revisão de Código

Todos os PRs passam por revisão. Esperamos:

- ✅ Código limpo e legível
- ✅ Testes passando
- ✅ Sem conflitos com `main`
- ✅ Documentação atualizada
- ✅ Commits bem formatados

## 🎯 Prioridades

Áreas que precisam de contribuições:

1. **Testes** - Aumentar cobertura de testes
2. **Documentação** - Melhorar guias e exemplos
3. **Acessibilidade** - ARIA labels, navegação por teclado
4. **Performance** - Otimizações de queries e rendering
5. **Mobile** - Melhorias na interface do coletor

## 💬 Comunicação

- **Issues:** Para bugs e features
- **Discussions:** Para perguntas e ideias
- **Email:** Para questões privadas

## 📜 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a mesma licença MIT do projeto.

---

**Obrigado por contribuir com o WMS Med@x! 🎉**
