import { exec } from "child_process";
import { promisify } from "util";
import * as dotenv from "dotenv";
import * as path from "path";

const execAsync = promisify(exec);

// Carregar variáveis de ambiente E2E
dotenv.config({ path: path.join(process.cwd(), ".env.e2e") });

async function setupE2EDatabase() {
  console.log("\n🗄️  Configurando banco de dados E2E...\n");

  try {
    // Validar que variáveis de ambiente estão configuradas
    if (!process.env.E2E_DATABASE_URL) {
      throw new Error("E2E_DATABASE_URL não está definido. Execute 'pnpm test:e2e:validate' primeiro.");
    }

    console.log("📋 Banco de dados E2E:", process.env.E2E_DATABASE_URL.replace(/:[^:@]+@/, ":****@"));

    // Extrair nome do banco da URL
    const dbUrlMatch = process.env.E2E_DATABASE_URL.match(/\/([^/?]+)(\?|$)/);
    const dbName = dbUrlMatch ? dbUrlMatch[1] : "wms_medax_e2e";

    console.log("\n1. Verificando conexão com MySQL...");
    try {
      await execAsync("mysql --version");
      console.log("   ✅ MySQL client encontrado");
    } catch {
      console.log("   ⚠️  MySQL client não encontrado. Tentando continuar...");
    }

    // Dropar banco se existir (apenas em ambiente E2E!)
    console.log("\n2. Limpando banco de dados anterior...");
    try {
      const dropCmd = `mysql -h localhost -u root -e "DROP DATABASE IF EXISTS ${dbName};"`;
      await execAsync(dropCmd);
      console.log(`   ✅ Banco ${dbName} removido (se existia)`);
    } catch (error: any) {
      console.log(`   ⚠️  Não foi possível dropar banco: ${error.message}`);
      console.log("   (Isso é normal se o banco não existia)");
    }

    // Criar banco
    console.log("\n3. Criando banco de dados...");
    try {
      const createCmd = `mysql -h localhost -u root -e "CREATE DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`;
      await execAsync(createCmd);
      console.log(`   ✅ Banco ${dbName} criado`);
    } catch (error: any) {
      console.log(`   ⚠️  Erro ao criar banco: ${error.message}`);
      console.log("   Tentando continuar...");
    }

    // Executar migrações usando DATABASE_URL temporariamente
    console.log("\n4. Executando migrações...");
    try {
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
      
      await execAsync("pnpm db:push");
      
      process.env.DATABASE_URL = originalDbUrl;
      console.log("   ✅ Migrações executadas");
    } catch (error: any) {
      console.log(`   ❌ Erro ao executar migrações: ${error.message}`);
      throw error;
    }

    console.log("\n✅ Banco de dados E2E configurado com sucesso!\n");
    console.log("💡 Próximo passo: Execute 'pnpm test:e2e' para rodar os testes.\n");
  } catch (error: any) {
    console.error("\n❌ Erro ao configurar banco de dados E2E:");
    console.error(error.message);
    console.log("\n💡 Dicas:");
    console.log("   - Verifique se o MySQL está rodando");
    console.log("   - Verifique se as credenciais em .env.e2e estão corretas");
    console.log("   - Verifique se o usuário tem permissão para criar bancos\n");
    process.exit(1);
  }
}

setupE2EDatabase();
