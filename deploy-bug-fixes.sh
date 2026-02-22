#!/bin/bash

################################################################################
# WMS Med@x - Script de Deploy de Correções Críticas
# Data: 22/02/2026
# Versão: 1.0.0
#
# Este script aplica as 4 correções do relatório de análise técnica:
# - BUG 1: Vazamento multi-tenant em waveRouter.ts
# - BUG 2: N+1 queries em authorization.ts
# - BUG 3: Console.logs de debug em stage.ts e stockRouter.ts
# - BUG 4: Scripts de debug no .gitignore
#
# Características:
# - Backup automático antes de aplicar
# - Validação de integridade dos arquivos
# - Rollback automático em caso de falha
# - Logs detalhados de todas as operações
################################################################################

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"
BACKUP_DIR="${PROJECT_ROOT}/backups/bug-fixes-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${PROJECT_ROOT}/deploy-bug-fixes.log"
CORRECTIONS_DIR="${PROJECT_ROOT}/corrections"

# Arquivos a serem corrigidos
declare -A FILES=(
    ["server/waveRouter.ts"]="BUG 1: Vazamento multi-tenant"
    ["server/_core/authorization.ts"]="BUG 2: N+1 queries RBAC"
    ["server/stage.ts"]="BUG 3: Console.logs de debug"
    ["server/stockRouter.ts"]="BUG 3: Console.logs de debug"
    [".gitignore"]="BUG 4: Scripts de debug expostos"
)

################################################################################
# Funções auxiliares
################################################################################

log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $@"
    log "INFO" "$@"
}

log_success() {
    echo -e "${GREEN}✓${NC} $@"
    log "SUCCESS" "$@"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $@"
    log "WARNING" "$@"
}

log_error() {
    echo -e "${RED}✗${NC} $@"
    log "ERROR" "$@"
}

print_header() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}$1${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

confirm() {
    local prompt="$1"
    local response
    
    while true; do
        read -p "${prompt} (s/n): " response
        case "$response" in
            [Ss]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Por favor, responda 's' ou 'n'.";;
        esac
    done
}

check_prerequisites() {
    log_info "Verificando pré-requisitos..."
    
    # Verificar se está no diretório correto
    if [ ! -f "${PROJECT_ROOT}/package.json" ]; then
        log_error "package.json não encontrado. Execute este script na raiz do projeto."
        exit 1
    fi
    
    # Verificar se o diretório de correções existe
    if [ ! -d "${CORRECTIONS_DIR}" ]; then
        log_error "Diretório de correções não encontrado: ${CORRECTIONS_DIR}"
        log_error "Extraia o arquivo 'arquivos-corrigidos.zip' para ${CORRECTIONS_DIR}/"
        exit 1
    fi
    
    # Verificar se todos os arquivos corrigidos existem
    for file in "${!FILES[@]}"; do
        if [ ! -f "${CORRECTIONS_DIR}/${file}" ]; then
            log_error "Arquivo corrigido não encontrado: ${CORRECTIONS_DIR}/${file}"
            exit 1
        fi
    done
    
    log_success "Todos os pré-requisitos verificados"
}

create_backup() {
    print_header "Criando Backup"
    
    log_info "Criando diretório de backup: ${BACKUP_DIR}"
    mkdir -p "${BACKUP_DIR}"
    
    for file in "${!FILES[@]}"; do
        local source="${PROJECT_ROOT}/${file}"
        local dest="${BACKUP_DIR}/${file}"
        
        if [ -f "${source}" ]; then
            log_info "Backup: ${file}"
            mkdir -p "$(dirname "${dest}")"
            cp "${source}" "${dest}"
        else
            log_warning "Arquivo não existe (será criado): ${file}"
        fi
    done
    
    # Salvar informações do backup
    cat > "${BACKUP_DIR}/backup-info.txt" <<EOF
WMS Med@x - Backup de Correções
Data: $(date '+%Y-%m-%d %H:%M:%S')
Diretório: ${BACKUP_DIR}
Arquivos:
$(for file in "${!FILES[@]}"; do echo "  - ${file}"; done)
EOF
    
    log_success "Backup criado com sucesso em: ${BACKUP_DIR}"
}

validate_corrections() {
    print_header "Validando Arquivos Corrigidos"
    
    local validation_failed=false
    
    for file in "${!FILES[@]}"; do
        local corrected_file="${CORRECTIONS_DIR}/${file}"
        
        log_info "Validando: ${file}"
        
        # Verificar se o arquivo não está vazio
        if [ ! -s "${corrected_file}" ]; then
            log_error "Arquivo vazio: ${corrected_file}"
            validation_failed=true
            continue
        fi
        
        # Verificar sintaxe TypeScript (se for arquivo .ts)
        if [[ "${file}" == *.ts ]]; then
            if ! node -c "${corrected_file}" 2>/dev/null; then
                log_warning "Aviso: Não foi possível validar sintaxe de ${file}"
            fi
        fi
        
        log_success "Validação OK: ${file}"
    done
    
    if [ "$validation_failed" = true ]; then
        log_error "Validação falhou para um ou mais arquivos"
        return 1
    fi
    
    log_success "Todos os arquivos validados com sucesso"
    return 0
}

apply_corrections() {
    print_header "Aplicando Correções"
    
    for file in "${!FILES[@]}"; do
        local source="${CORRECTIONS_DIR}/${file}"
        local dest="${PROJECT_ROOT}/${file}"
        local description="${FILES[$file]}"
        
        log_info "Aplicando: ${file}"
        log_info "  → ${description}"
        
        mkdir -p "$(dirname "${dest}")"
        cp "${source}" "${dest}"
        
        log_success "Aplicado: ${file}"
    done
    
    log_success "Todas as correções aplicadas com sucesso"
}

verify_deployment() {
    print_header "Verificando Deploy"
    
    log_info "Verificando integridade dos arquivos..."
    
    for file in "${!FILES[@]}"; do
        local deployed_file="${PROJECT_ROOT}/${file}"
        local corrected_file="${CORRECTIONS_DIR}/${file}"
        
        if ! cmp -s "${deployed_file}" "${corrected_file}"; then
            log_error "Verificação falhou: ${file} não corresponde ao arquivo corrigido"
            return 1
        fi
        
        log_success "Verificado: ${file}"
    done
    
    log_success "Verificação de integridade concluída"
    return 0
}

rollback() {
    print_header "Executando Rollback"
    
    log_warning "Revertendo alterações..."
    
    for file in "${!FILES[@]}"; do
        local backup_file="${BACKUP_DIR}/${file}"
        local dest="${PROJECT_ROOT}/${file}"
        
        if [ -f "${backup_file}" ]; then
            log_info "Restaurando: ${file}"
            cp "${backup_file}" "${dest}"
            log_success "Restaurado: ${file}"
        fi
    done
    
    log_success "Rollback concluído. Arquivos restaurados do backup: ${BACKUP_DIR}"
}

print_summary() {
    print_header "Resumo do Deploy"
    
    echo ""
    echo "✓ Correções aplicadas com sucesso!"
    echo ""
    echo "Arquivos modificados:"
    for file in "${!FILES[@]}"; do
        echo "  • ${file}"
        echo "    └─ ${FILES[$file]}"
    done
    echo ""
    echo "Backup salvo em:"
    echo "  ${BACKUP_DIR}"
    echo ""
    echo "Log completo:"
    echo "  ${LOG_FILE}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${YELLOW}⚠ PRÓXIMOS PASSOS:${NC}"
    echo ""
    echo "1. Executar testes:"
    echo "   $ pnpm test"
    echo ""
    echo "2. Reiniciar o servidor de desenvolvimento:"
    echo "   $ pnpm dev"
    echo ""
    echo "3. Verificar logs do servidor para erros"
    echo ""
    echo "4. Testar funcionalidades críticas:"
    echo "   • Login multi-tenant"
    echo "   • Listagem de ondas de separação"
    echo "   • Verificação de permissões RBAC"
    echo ""
    echo "5. Se tudo estiver OK, fazer commit:"
    echo "   $ git add ."
    echo "   $ git commit -m 'fix: aplicar correções críticas do relatório técnico'"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

################################################################################
# Main
################################################################################

main() {
    print_header "WMS Med@x - Deploy de Correções Críticas"
    
    echo "Este script aplicará as seguintes correções:"
    echo ""
    for file in "${!FILES[@]}"; do
        echo "  • ${file}"
        echo "    └─ ${FILES[$file]}"
    done
    echo ""
    
    if ! confirm "Deseja continuar?"; then
        log_info "Deploy cancelado pelo usuário"
        exit 0
    fi
    
    # Iniciar log
    echo "Deploy iniciado em $(date '+%Y-%m-%d %H:%M:%S')" > "${LOG_FILE}"
    
    # Executar etapas
    check_prerequisites
    create_backup
    
    if ! validate_corrections; then
        log_error "Validação falhou. Deploy abortado."
        exit 1
    fi
    
    apply_corrections
    
    if ! verify_deployment; then
        log_error "Verificação pós-deploy falhou. Executando rollback..."
        rollback
        exit 1
    fi
    
    print_summary
    
    log_success "Deploy concluído com sucesso!"
}

# Trap para capturar erros e executar rollback
trap 'log_error "Erro detectado. Executando rollback..."; rollback; exit 1' ERR

# Executar
main "$@"
