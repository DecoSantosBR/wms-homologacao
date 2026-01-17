# Correção de Bugs - Página /stock

## Data: 2026-01-09

## Bugs Corrigidos

### 1. Chaves Duplicadas (key `60002`)

**Problema:**
A tabela de posições de estoque estava usando `key={pos.id}` para renderizar as linhas, mas quando há múltiplos registros do mesmo produto em endereços diferentes, o ID pode se repetir, causando o erro:
```
Encountered two children with the same key, `60002`
```

**Causa Raiz:**
O endpoint `stock.getPositions` retorna múltiplas posições do mesmo produto (diferentes lotes ou endereços), e usar apenas `pos.id` como key não garante unicidade.

**Solução:**
Alterado para usar identificador composto único:
```tsx
// Antes
<TableRow key={pos.id}>

// Depois
<TableRow key={`${pos.id}-${pos.batch}-${pos.locationId}`}>
```

**Arquivo:** `client/src/pages/StockPositions.tsx` (linha 269)

---

### 2. Tags `<a>` Aninhadas

**Problema:**
Erro de HTML inválido:
```
<a> cannot contain a nested <a>
```

**Causa Raiz:**
Na página Home, os cards de módulos usavam `<Button asChild>` com `<Link>` dentro. O wouter's `Link` renderiza um `<a>`, e o `Button` com `asChild` também renderiza um `<a>`, causando aninhamento inválido:
```tsx
// Antes (INVÁLIDO)
<Button asChild className="w-full">
  <Link href={module.href}>Acessar Módulo</Link>
</Button>
```

**Solução:**
Invertido a estrutura - `Link` por fora, `Button` por dentro:
```tsx
// Depois (VÁLIDO)
<Link href={module.href}>
  <Button className="w-full">Acessar Módulo</Button>
</Link>
```

**Arquivo:** `client/src/pages/Home.tsx` (linha 234-236)

---

## Testes Realizados

1. ✅ Navegação para `/stock` sem erros de console
2. ✅ Renderização de múltiplas posições do mesmo produto sem warnings
3. ✅ Navegação pelos cards da Home sem erros de HTML inválido
4. ✅ TypeScript compilando sem erros

## Impacto

- **Severidade:** Média (avisos no console, não quebra funcionalidade)
- **Usuários Afetados:** Todos que acessam /stock e Home
- **Tempo de Correção:** 15 minutos

## Prevenção Futura

1. Sempre usar identificadores compostos quando houver possibilidade de duplicação
2. Evitar `asChild` com componentes que já renderizam `<a>` (Link, anchor tags)
3. Adicionar linting rules para detectar `<a>` aninhados
