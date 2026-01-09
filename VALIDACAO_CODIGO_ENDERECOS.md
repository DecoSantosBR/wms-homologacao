# Validação de Código de Endereços

## Implementação Completa

Implementamos a validação e formatação correta do código de endereços seguindo o padrão especificado:

### Formato do Código

**Estrutura:** `RUA-PRÉDIO-ANDAR[QUADRANTE]`

**Exemplos:**
- **Whole (Inteira)**: `T01-01-01` (RUA-PRÉDIO-ANDAR com 2 dígitos)
- **Fraction (Fração)**: `T01-01-1A` (RUA-PRÉDIO-ANDAR+QUADRANTE)

### Regras de Validação

#### Endereço Tipo "Whole" (Inteira)
- **Formato**: `[A-Z]\d{2}-\d{2}-\d{2}`
- **Exemplo**: `T01-01-01`
- **Rua**: Letra maiúscula + 2 dígitos (ex: T01)
- **Prédio**: 2 dígitos (ex: 01)
- **Andar**: 2 dígitos (ex: 01)
- **Quadrante**: NÃO APLICÁVEL (campo desabilitado)

#### Endereço Tipo "Fraction" (Fração)
- **Formato**: `[A-Z]\d{2}-\d{2}-\d[A-Z]`
- **Exemplo**: `T01-01-1A`
- **Rua**: Letra maiúscula + 2 dígitos (ex: T01)
- **Prédio**: 2 dígitos (ex: 01)
- **Andar**: 1 dígito (ex: 1)
- **Quadrante**: OBRIGATÓRIO - Letra maiúscula (A, B, C, D)

### Arquivos Implementados

#### 1. Backend - Validação
**Arquivo**: `server/locationCodeValidator.ts`

Funções principais:
- `validateLocationCode(code, locationType)` - Valida formato do código
- `generateLocationCode(parts, locationType)` - Gera código a partir das partes
- `parseLocationCode(code, locationType)` - Extrai partes do código
- `validateQuadrantRequirement(locationType, position)` - Valida obrigatoriedade do quadrante

#### 2. Frontend - Formulário de Cadastro
**Arquivo**: `client/src/components/CreateLocationDialog.tsx`

Funcionalidades:
- **Geração automática de código**: Ao preencher Rua, Prédio, Andar e Quadrante, o código é gerado automaticamente
- **Campo código somente leitura**: Usuário não pode editar manualmente
- **Validação em tempo real**: Valida formato antes de submeter
- **Placeholders dinâmicos**: Mudam conforme o tipo de endereço selecionado
- **Campo Quadrante desabilitado**: Para endereços tipo "Whole"

#### 3. Backend - Pré-Alocação
**Arquivo**: `server/preallocation.ts`

Validações adicionadas:
- Valida formato do código na planilha Excel
- Verifica se o formato corresponde ao tipo de endereço cadastrado
- Mensagens de erro específicas para cada problema

### Fluxo de Uso

#### Cadastro de Endereço Whole (Inteira)
1. Selecionar tipo "Inteira (Whole)"
2. Preencher Rua: `T01`
3. Preencher Prédio: `01`
4. Preencher Andar: `01`
5. Campo Quadrante fica desabilitado
6. Código gerado automaticamente: `T01-01-01`

#### Cadastro de Endereço Fraction (Fração)
1. Selecionar tipo "Fração (Fraction)"
2. Preencher Rua: `T01`
3. Preencher Prédio: `01`
4. Preencher Andar: `1`
5. Preencher Quadrante: `A`
6. Código gerado automaticamente: `T01-01-1A`

### Validações Implementadas

#### No Formulário de Cadastro
- ✅ Formato correto conforme tipo (Whole vs Fraction)
- ✅ Quadrante obrigatório apenas para Fraction
- ✅ Quadrante deve ser A, B, C ou D
- ✅ Mensagens de erro específicas e claras

#### Na Pré-Alocação (Excel)
- ✅ Valida formato do código na planilha
- ✅ Verifica se endereço existe no cadastro
- ✅ Valida se formato corresponde ao tipo cadastrado
- ✅ Mensagens de erro detalhadas por linha

### Exemplos de Mensagens de Erro

**Formato inválido (Whole)**:
```
Código inválido para endereço Inteiro. Formato esperado: RUA-PRÉDIO-ANDAR (ex: T01-01-01)
```

**Formato inválido (Fraction)**:
```
Código inválido para endereço Fração. Formato esperado: RUA-PRÉDIO-ANDAR+QUADRANTE (ex: T01-01-1A)
```

**Quadrante inválido**:
```
Quadrante inválido. Valores permitidos: A, B, C, D
```

**Quadrante obrigatório**:
```
Quadrante é obrigatório para endereços do tipo Fração
```

### Benefícios da Implementação

1. **Consistência**: Todos os códigos seguem o mesmo padrão
2. **Prevenção de erros**: Validação em tempo real evita cadastros incorretos
3. **Usabilidade**: Geração automática facilita o cadastro
4. **Rastreabilidade**: Códigos padronizados facilitam busca e organização
5. **Integração**: Validação funciona em cadastro manual e importação Excel

### Testes Recomendados

- [ ] Cadastrar endereço Whole com código válido
- [ ] Cadastrar endereço Fraction com código válido
- [ ] Tentar cadastrar Whole com formato de Fraction (deve falhar)
- [ ] Tentar cadastrar Fraction sem quadrante (deve falhar)
- [ ] Importar planilha Excel com códigos válidos e inválidos
- [ ] Verificar mensagens de erro específicas
