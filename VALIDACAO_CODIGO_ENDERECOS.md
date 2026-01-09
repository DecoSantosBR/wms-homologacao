# Validação de Código de Endereços

## Implementação Completa

Implementamos a validação e formatação correta do código de endereços seguindo o padrão especificado:

### Formato do Código

**Estrutura:** `RUA-PRÉDIO-ANDAR[QUADRANTE]`

**Exemplos:**
- **Whole (Inteira)**: `A10-01-73` (RUA-PRÉDIO-ANDAR)
- **Fraction (Fração)**: `BI-A201-1D` (RUA-PRÉDIO-ANDAR+QUADRANTE, sem hífen antes do quadrante)

### Regras de Validação

#### Endereço Tipo "Whole" (Inteira)
- **Formato**: `[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+`
- **Exemplo**: `A10-01-73`
- **Rua**: Alfanumérico (ex: A10, BI, T01)
- **Prédio**: Alfanumérico (ex: 01, A201)
- **Andar**: Alfanumérico (ex: 73, 01)
- **Quadrante**: NÃO APLICÁVEL (campo desabilitado)

#### Endereço Tipo "Fraction" (Fração)
- **Formato**: `[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+[A-Z]`
- **Exemplo**: `BI-A201-1D`
- **Rua**: Alfanumérico (ex: A10, BI, T01)
- **Prédio**: Alfanumérico (ex: 01, A201)
- **Andar**: Alfanumérico (ex: 1, 2)
- **Quadrante**: OBRIGATÓRIO - Letra maiúscula (A, B, C, D) - SEM HÍFEN antes

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
2. Preencher Rua: `A10`
3. Preencher Prédio: `01`
4. Preencher Andar: `73`
5. Campo Quadrante fica desabilitado
6. Código gerado automaticamente: `A10-01-73`

#### Cadastro de Endereço Fraction (Fração)
1. Selecionar tipo "Fração (Fraction)"
2. Preencher Rua: `BI`
3. Preencher Prédio: `A201`
4. Preencher Andar: `1`
5. Preencher Quadrante: `D`
6. Código gerado automaticamente: `BI-A201-1D`

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
Código inválido para endereço Inteiro. Formato esperado: RUA-PRÉDIO-ANDAR (ex: A10-01-73)
```

**Formato inválido (Fraction)**:
```
Código inválido para endereço Fração. Formato esperado: RUA-PRÉDIO-ANDAR+QUADRANTE (ex: BI-A201-1D)
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
6. **Flexibilidade**: Formato alfanumérico aceita diferentes padrões de nomenclatura

### Testes Recomendados

- [ ] Cadastrar endereço Whole: `A10-01-73`
- [ ] Cadastrar endereço Fraction: `BI-A201-1D`
- [ ] Tentar cadastrar Whole com formato de Fraction (deve falhar)
- [ ] Tentar cadastrar Fraction sem quadrante (deve falhar)
- [ ] Importar planilha Excel com códigos válidos e inválidos
- [ ] Verificar mensagens de erro específicas

### Observações Importantes

1. **Formato Alfanumérico Flexível**: O sistema aceita qualquer combinação de letras e números em cada parte do código (Rua, Prédio, Andar)
2. **Sem Hífen Antes do Quadrante**: Para endereços Fraction, o quadrante é concatenado diretamente após o andar (ex: `1D` não `1-D`)
3. **Endereços Antigos**: Endereços cadastrados antes desta correção podem ter formato incorreto no banco de dados
4. **Novos Cadastros**: A partir desta versão, todos os novos endereços seguirão o formato correto automaticamente
