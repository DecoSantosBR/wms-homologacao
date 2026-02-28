#!/usr/bin/env python3
"""
Script para aplicar todas as migrations SQL do WMS Med@x no banco de homologação.
Lê o journal.json e aplica cada migration em ordem.
"""
import json
import os
import re
import subprocess
import sys

DRIZZLE_DIR = "/home/ubuntu/wms-homologacao/drizzle"
JOURNAL_FILE = os.path.join(DRIZZLE_DIR, "meta", "_journal.json")
DB_USER = "wms_user"
DB_PASS = "wms_homolog_2024"
DB_HOST = "localhost"
DB_PORT = "3306"
DB_NAME = "wms_medax_homolog"

def run_sql_string(sql):
    """Executa uma string SQL no MySQL."""
    cmd = [
        "mysql",
        f"-u{DB_USER}",
        f"-p{DB_PASS}",
        f"-h{DB_HOST}",
        f"-P{DB_PORT}",
        DB_NAME
    ]
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True)
    return result

def split_sql_statements(sql_content):
    """Divide o SQL em statements individuais usando o breakpoint do Drizzle."""
    # Dividir pelo marcador de breakpoint do Drizzle
    parts = re.split(r'--> statement-breakpoint', sql_content)
    statements = []
    for part in parts:
        stmt = part.strip()
        if stmt:
            statements.append(stmt)
    return statements

def apply_migration(tag, sql_file):
    """Aplica uma migration e retorna True se bem-sucedida."""
    with open(sql_file) as f:
        sql_content = f.read()
    
    statements = split_sql_statements(sql_content)
    
    migration_ok = True
    errors = []
    
    for i, stmt in enumerate(statements):
        if not stmt.strip():
            continue
        result = run_sql_string(stmt)
        if result.returncode != 0:
            stderr = result.stderr
            # Filtrar warnings de password do MySQL
            stderr_lines = [l for l in stderr.split('\n') 
                          if 'Warning' not in l or 'password' not in l.lower()]
            stderr_clean = '\n'.join(stderr_lines).strip()
            
            if stderr_clean:
                # Ignorar erros de "já existe" (idempotência)
                if any(err in stderr_clean for err in [
                    'already exists', 'Duplicate', 'duplicate',
                    "Can't DROP", "doesn't exist"
                ]):
                    print(f"    [WARN] Stmt {i+1}: {stderr_clean[:120]}")
                else:
                    errors.append(f"Stmt {i+1}: {stderr_clean[:200]}")
                    migration_ok = False
    
    return migration_ok, errors

def main():
    print("=" * 60)
    print("WMS Med@x - Aplicando Migrations de Homologação")
    print("=" * 60)
    
    # Ler o journal
    with open(JOURNAL_FILE) as f:
        journal = json.load(f)
    
    entries = journal['entries']
    print(f"\nTotal de migrations no journal: {len(entries)}")
    
    # Criar tabela de controle de migrations se não existir
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `hash` TEXT NOT NULL,
        `created_at` BIGINT
    );
    """
    result = run_sql_string(create_table_sql)
    if result.returncode != 0:
        stderr = [l for l in result.stderr.split('\n') if 'Warning' not in l]
        print(f"Aviso ao criar tabela de controle: {' '.join(stderr)}")
    
    # Verificar quais migrations já foram aplicadas
    check_sql = "SELECT hash FROM `__drizzle_migrations`;"
    result = run_sql_string(check_sql)
    applied = set()
    if result.returncode == 0:
        for line in result.stdout.strip().split('\n'):
            if line and line != 'hash':
                applied.add(line.strip())
    
    print(f"Migrations já aplicadas: {len(applied)}")
    
    success_count = 0
    error_count = 0
    skip_count = 0
    
    for entry in entries:
        tag = entry['tag']
        sql_file = os.path.join(DRIZZLE_DIR, f"{tag}.sql")
        
        if not os.path.exists(sql_file):
            print(f"  [SKIP] {tag} - arquivo SQL não encontrado")
            skip_count += 1
            continue
        
        if tag in applied:
            print(f"  [SKIP] {tag} - já aplicada anteriormente")
            skip_count += 1
            continue
        
        print(f"  [APLICANDO] {tag}...")
        
        ok, errors = apply_migration(tag, sql_file)
        
        if ok:
            # Registrar migration como aplicada
            when = entry.get('when', 0)
            register_sql = f"INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES ('{tag}', {when});"
            run_sql_string(register_sql)
            print(f"  [OK] {tag}")
            success_count += 1
        else:
            for err in errors:
                print(f"    [ERRO] {err}")
            print(f"  [FALHOU] {tag}")
            error_count += 1
    
    print("\n" + "=" * 60)
    print(f"Resultado: {success_count} aplicadas, {skip_count} puladas, {error_count} com erros")
    
    # Verificar tabelas criadas
    tables_sql = "SHOW TABLES;"
    result = run_sql_string(tables_sql)
    if result.returncode == 0:
        tables = [l for l in result.stdout.strip().split('\n') 
                 if l and not l.startswith('Tables')]
        print(f"\nTabelas no banco ({len(tables)}):")
        for t in sorted(tables):
            print(f"  - {t}")
    
    return 0 if error_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
