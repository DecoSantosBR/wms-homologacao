import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./drizzle/schema.ts";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: "default" });

// Buscar IDs
const roles = await db.select().from(schema.roles);
const permissions = await db.select().from(schema.permissions);

const roleMap = Object.fromEntries(roles.map(r => [r.name, r.id]));
const permMap = Object.fromEntries(permissions.map(p => [p.code, p.id]));

// Definir permissões por perfil (usando códigos reais do banco)
const rolePermissions = {
  "Administrador": [
    // Administração completa
    "admin:manage_users",
    "admin:manage_roles",
    "admin:manage_permissions",
    "admin:view_audit_logs",
    "admin:cleanup_data",
    "admin:manage_zones",
    "admin:manage_locations",
    "admin:manage_products",
    "admin:manage_tenants",
    "admin:system_settings",
    // Recebimento completo
    "receiving:create_order",
    "receiving:edit_order",
    "receiving:view_orders",
    "receiving:confirm_receipt",
    "receiving:generate_labels",
    "receiving:blind_check",
    "receiving:preallocate_locations",
    "receiving:approve_adjustments",
    "receiving:view_audit",
    "receiving:undo_last_action",
    // Separação completa
    "picking:create_order",
    "picking:edit_order",
    "picking:view_orders",
    "picking:start_picking",
    "picking:confirm_items",
    "picking:manage_returns",
    "picking:confirm_shipment",
    "picking:view_audit",
    // Estoque completo
    "stock:view_positions",
    "stock:export_reports",
    "stock:view_movements",
    "stock:view_occupancy"
  ],
  "Gerente de Recebimento": [
    // Recebimento completo
    "receiving:create_order",
    "receiving:edit_order",
    "receiving:view_orders",
    "receiving:confirm_receipt",
    "receiving:generate_labels",
    "receiving:blind_check",
    "receiving:preallocate_locations",
    "receiving:approve_adjustments",
    "receiving:view_audit",
    "receiving:undo_last_action",
    // Estoque (leitura)
    "stock:view_positions",
    "stock:view_movements",
    "stock:view_occupancy",
    // Gestão de locais
    "admin:manage_locations"
  ],
  "Operador de Recebimento": [
    // Recebimento operacional (sem edição/aprovação)
    "receiving:create_order",
    "receiving:view_orders",
    "receiving:confirm_receipt",
    "receiving:generate_labels",
    "receiving:blind_check",
    "receiving:preallocate_locations",
    "receiving:view_audit",
    // Estoque (leitura)
    "stock:view_positions",
    "stock:view_movements"
  ],
  "Gerente de Separação": [
    // Separação completa
    "picking:create_order",
    "picking:edit_order",
    "picking:view_orders",
    "picking:start_picking",
    "picking:confirm_items",
    "picking:manage_returns",
    "picking:confirm_shipment",
    "picking:view_audit",
    // Estoque (leitura)
    "stock:view_positions",
    "stock:view_movements",
    "stock:view_occupancy"
  ],
  "Operador de Separação": [
    // Separação operacional (sem edição/criação)
    "picking:view_orders",
    "picking:start_picking",
    "picking:confirm_items",
    "picking:confirm_shipment",
    // Estoque (leitura)
    "stock:view_positions",
    "stock:view_movements"
  ],
  "Analista de Estoque": [
    // Estoque completo
    "stock:view_positions",
    "stock:export_reports",
    "stock:view_movements",
    "stock:view_occupancy",
    // Visualização de operações
    "receiving:view_orders",
    "receiving:view_audit",
    "picking:view_orders",
    "picking:view_audit"
  ],
  "Cliente": [
    // Separação (criação e visualização)
    "picking:create_order",
    "picking:view_orders",
    "picking:view_audit",
    // Estoque (leitura)
    "stock:view_positions",
    "stock:view_movements",
    // Gestão de tenant
    "admin:manage_tenants",
    // Gestão de produtos
    "admin:manage_products"
  ]
};

// Limpar associações existentes
await db.delete(schema.rolePermissions);

// Inserir associações
for (const [roleName, permCodes] of Object.entries(rolePermissions)) {
  const roleId = roleMap[roleName];
  if (!roleId) {
    console.log(`⚠️  Perfil não encontrado: ${roleName}`);
    continue;
  }
  
  let successCount = 0;
  for (const permCode of permCodes) {
    const permId = permMap[permCode];
    if (!permId) {
      console.log(`⚠️  Permissão não encontrada: ${permCode}`);
      continue;
    }
    
    await db.insert(schema.rolePermissions).values({
      roleId,
      permissionId: permId
    });
    successCount++;
  }
  
  console.log(`✅ ${roleName}: ${successCount} permissões associadas`);
}

console.log("\n✅ Associações criadas com sucesso!");
await connection.end();
