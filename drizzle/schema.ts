import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index, unique, uniqueIndex, json, date } from "drizzle-orm/mysql-core";

/**
 * Sistema WMS Med@x - Modelo de Dados Completo
 * Multi-tenant com conformidade ANVISA e rastreabilidade total
 */

// ============================================================================
// TABELA DE USUÁRIOS E AUTENTICAÇÃO
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "operator", "quality", "manager"]).default("user").notNull(),
  tenantId: int("tenantId"), // Relacionamento com cliente (tenant)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ============================================================================
// SISTEMA DE USUÁRIOS E PERMISSÕES (RBAC)
// ============================================================================

/**
 * Tabela de usuários do sistema WMS
 * Cada usuário pertence a um cliente (tenant) e possui login/senha próprios
 */
export const systemUsers = mysqlTable("systemUsers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(), // Cliente ao qual o usuário pertence
  fullName: varchar("fullName", { length: 255 }).notNull(),
  login: varchar("login", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(), // bcrypt hash
  active: boolean("active").default(true).notNull(),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("approved").notNull(), // Status de aprovação
  approvedBy: int("approvedBy"), // ID do admin que aprovou
  approvedAt: timestamp("approvedAt"), // Data/hora da aprovação
  failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"), // Bloqueio temporário por tentativas inválidas
  lastLogin: timestamp("lastLogin"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"), // ID do usuário que criou este registro
}, (table) => ({
  tenantLoginIdx: unique().on(table.tenantId, table.login), // Login único por cliente
}));

/**
 * Perfis de acesso (roles)
 * Define conjuntos de permissões que podem ser atribuídos a usuários
 */
export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // Ex: ADMIN_SISTEMA, SUPERVISOR
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isSystemRole: boolean("isSystemRole").default(false).notNull(), // Perfis do sistema não podem ser editados
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Permissões granulares do sistema
 * Cada permissão representa uma ação específica que pode ser executada
 */
export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(), // Ex: USUARIO_CRIAR, ESTOQUE_MOVIMENTAR
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  module: varchar("module", { length: 50 }).notNull(), // Ex: USUARIO, ESTOQUE, RECEBIMENTO
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Relacionamento entre perfis e permissões
 * Define quais permissões cada perfil possui
 */
export const rolePermissions = mysqlTable("rolePermissions", {
  id: int("id").autoincrement().primaryKey(),
  roleId: int("roleId").notNull(),
  permissionId: int("permissionId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  rolePermissionIdx: unique().on(table.roleId, table.permissionId),
}));

/**
 * Relacionamento entre usuários e perfis
 * Um usuário pode ter múltiplos perfis
 */
export const userRoles = mysqlTable("userRoles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  roleId: int("roleId").notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(), // Perfil principal do usuário
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"), // Quem atribuiu este perfil
}, (table) => ({
  userRoleIdx: unique().on(table.userId, table.roleId),
}));

/**
 * Permissões extras concedidas diretamente a usuários
 * Permite override de permissões além das herdadas dos perfis
 */
export const userPermissions = mysqlTable("userPermissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  permissionId: int("permissionId").notNull(),
  granted: boolean("granted").default(true).notNull(), // true = conceder, false = revogar
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
}, (table) => ({
  userPermissionIdx: unique().on(table.userId, table.permissionId),
}));

// ============================================================================
// MÓDULO 1: GESTÃO DE CLIENTES (MULTI-TENANT)
// ============================================================================

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  tradeName: varchar("tradeName", { length: 255 }),
  cnpj: varchar("cnpj", { length: 18 }).notNull().unique(),
  afe: varchar("afe", { length: 50 }), // Autorização de Funcionamento de Empresa (ANVISA)
  ae: varchar("ae", { length: 50 }), // Autorização Especial (ANVISA)
  licenseNumber: varchar("licenseNumber", { length: 100 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  pickingRule: mysqlEnum("pickingRule", ["FIFO", "FEFO", "Direcionado"]).default("FIFO").notNull(),
  shippingAddress: varchar("shippingAddress", { length: 50 }), // Endereço de expedição (ex: EXP-01-A)
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  contractNumber: varchar("contractNumber", { length: 50 }).notNull().unique(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  slaReceivingHours: int("slaReceivingHours").default(24), // SLA de recebimento em horas
  slaPickingHours: int("slaPickingHours").default(4), // SLA de separação em horas
  slaShippingHours: int("slaShippingHours").default(2), // SLA de expedição em horas
  pickingStrategy: mysqlEnum("pickingStrategy", ["FEFO", "FIFO", "LIFO"]).default("FEFO").notNull(),
  expiryDaysThreshold: int("expiryDaysThreshold").default(90), // Dias mínimos de validade no recebimento
  status: mysqlEnum("status", ["active", "inactive", "expired"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// MÓDULO 2: CADASTRO MESTRE
// ============================================================================

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(), // Multi-tenant: produto pertence a um cliente
  sku: varchar("sku", { length: 100 }).notNull(), // Código interno único
  supplierCode: varchar("supplierCode", { length: 100 }), // Código do fornecedor (usado em NF-e de entrada)
  customerCode: varchar("customerCode", { length: 100 }), // Código do cliente (usado em NF-e de saída)
  description: text("description").notNull(),
  gtin: varchar("gtin", { length: 14 }), // EAN/DUN (código de barras)
  anvisaRegistry: varchar("anvisaRegistry", { length: 100 }), // Registro ANVISA
  therapeuticClass: varchar("therapeuticClass", { length: 100 }),
  manufacturer: varchar("manufacturer", { length: 255 }),
  unitOfMeasure: varchar("unitOfMeasure", { length: 20 }).default("UN").notNull(),
  unitsPerBox: int("unitsPerBox"), // Quantidade de unidades por caixa/volume
  category: varchar("category", { length: 100 }), // Categoria do produto
  costPrice: decimal("costPrice", { precision: 10, scale: 2 }), // Preço de custo
  salePrice: decimal("salePrice", { precision: 10, scale: 2 }), // Preço de venda
  minQuantity: int("minQuantity").default(0), // Quantidade mínima em estoque
  dispensingQuantity: int("dispensingQuantity").default(1), // Quantidade mínima de dispensação/separação
  requiresBatchControl: boolean("requiresBatchControl").default(true).notNull(),
  requiresExpiryControl: boolean("requiresExpiryControl").default(true).notNull(),
  requiresSerialControl: boolean("requiresSerialControl").default(false).notNull(),
  storageCondition: mysqlEnum("storageCondition", ["ambient", "refrigerated_2_8", "frozen_minus_20", "controlled"]).default("ambient").notNull(),
  minTemperature: decimal("minTemperature", { precision: 5, scale: 2 }),
  maxTemperature: decimal("maxTemperature", { precision: 5, scale: 2 }),
  requiresHumidityControl: boolean("requiresHumidityControl").default(false).notNull(),
  isControlledSubstance: boolean("isControlledSubstance").default(false).notNull(), // Medicamento controlado
  isPsychotropic: boolean("isPsychotropic").default(false).notNull(), // Psicotrópico
  status: mysqlEnum("status", ["active", "inactive", "discontinued"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantSkuIdx: unique().on(table.tenantId, table.sku),
}));

// Tabela para vincular códigos de barras (etiquetas) a produtos
// Permite múltiplas etiquetas por produto, cada uma com lote/validade específicos
export const productBarcodes = mysqlTable("productBarcodes", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  barcode: varchar("barcode", { length: 100 }).notNull().unique(), // Código da etiqueta
  batch: varchar("batch", { length: 50 }), // Lote associado (opcional)
  expiryDate: date("expiryDate"), // Validade associada (opcional)
  locationId: int("locationId"), // Endereço onde está armazenado (opcional)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const warehouseZones = mysqlTable("warehouseZones", {
  id: int("id").autoincrement().primaryKey(),
  warehouseId: int("warehouseId").notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  storageCondition: mysqlEnum("storageCondition", ["ambient", "refrigerated_2_8", "frozen_minus_20", "controlled", "quarantine"]).default("ambient").notNull(),
  hasTemperatureControl: boolean("hasTemperatureControl").default(false).notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  warehouseCodeIdx: unique().on(table.warehouseId, table.code),
}));

export const warehouseLocations = mysqlTable("warehouseLocations", {
  id: int("id").autoincrement().primaryKey(),
  zoneId: int("zoneId").notNull(),
  zoneCode: varchar("zoneCode", { length: 20 }), // Código da zona (ex: 'NCG', 'REC', 'EXP')
  tenantId: int("tenantId").notNull(), // Cliente dono do endereço (OBRIGATÓRIO)
  code: varchar("code", { length: 50 }).notNull().unique(),
  aisle: varchar("aisle", { length: 10 }), // Rua
  rack: varchar("rack", { length: 10 }), // Prédio
  level: varchar("level", { length: 10 }), // Andar
  position: varchar("position", { length: 10 }), // Quadrante (obrigatório apenas para tipo "fraction")
  locationType: mysqlEnum("locationType", ["whole", "fraction"]).default("whole").notNull(), // Inteira ou Fração
  storageRule: mysqlEnum("storageRule", ["single", "multi"]).default("single").notNull(), // Único item/lote ou Multi-item
  status: mysqlEnum("status", ["livre", "available", "occupied", "blocked", "counting"]).default("livre").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  zoneStatusIdx: index("zone_status_idx").on(table.zoneId, table.status),
  tenantStatusIdx: index("tenant_status_idx").on(table.tenantId, table.status),
  statusIdx: index("location_status_idx").on(table.status),
}));

// ============================================================================
// MÓDULO 3: RECEBIMENTO
// ============================================================================

export const receivingOrders = mysqlTable("receivingOrders", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  nfeKey: varchar("nfeKey", { length: 44 }), // Chave da NF-e (44 dígitos)
  nfeNumber: varchar("nfeNumber", { length: 20 }),
  supplierName: varchar("supplierName", { length: 255 }),
  supplierCnpj: varchar("supplierCnpj", { length: 18 }),
  scheduledDate: timestamp("scheduledDate"),
  receivedDate: timestamp("receivedDate"),
  receivingLocationId: int("receivingLocationId"), // Endereço REC alocado automaticamente
  addressingPlan: json("addressingPlan"), // Pré-alocação: [{productSku, batch, quantity, locationCode}]
  status: mysqlEnum("status", ["scheduled", "in_progress", "in_quarantine", "addressing", "completed", "cancelled"]).default("scheduled").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const receivingOrderItems = mysqlTable("receivingOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(), // Multi-tenant: item pertence a um cliente
  receivingOrderId: int("receivingOrderId").notNull(),
  productId: int("productId").notNull(),
  expectedQuantity: int("expectedQuantity").notNull(),
  receivedQuantity: int("receivedQuantity").default(0).notNull(),
  blockedQuantity: int("blockedQuantity").default(0).notNull(), // Quantidade avariada/bloqueada
  addressedQuantity: int("addressedQuantity").default(0).notNull(), // Saldo líquido endereçável (received - blocked)
  // Códigos esperados da NF-e
  expectedGtin: varchar("expectedGtin", { length: 14 }),
  expectedSupplierCode: varchar("expectedSupplierCode", { length: 50 }),
  expectedInternalCode: varchar("expectedInternalCode", { length: 50 }),
  // Códigos conferidos
  scannedGtin: varchar("scannedGtin", { length: 14 }),
  scannedSupplierCode: varchar("scannedSupplierCode", { length: 50 }),
  scannedInternalCode: varchar("scannedInternalCode", { length: 50 }),
  batch: varchar("batch", { length: 50 }),
  expiryDate: date("expiryDate"),
  serialNumber: varchar("serialNumber", { length: 100 }),
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  labelCode: varchar("labelCode", { length: 100 }), // Código da etiqueta vinculada (após conferência)
  status: mysqlEnum("status", ["pending", "in_quarantine", "approved", "rejected", "awaiting_approval"]).default("pending").notNull(),
  rejectionReason: text("rejectionReason"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Tabela de pré-alocações de endereços (definidas antes do recebimento)
export const receivingPreallocations = mysqlTable("receivingPreallocations", {
  id: int("id").autoincrement().primaryKey(),
  receivingOrderId: int("receivingOrderId").notNull(),
  productId: int("productId").notNull(),
  locationId: int("locationId").notNull(), // Endereço de armazenagem pré-definido
  batch: varchar("batch", { length: 50 }),
  quantity: int("quantity").notNull(),
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  status: mysqlEnum("status", ["pending", "allocated", "cancelled"]).default("pending").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Tabela de conferências parciais (múltiplas conferências por item/lote)
export const receivingConferences = mysqlTable("receivingConferences", {
  id: int("id").autoincrement().primaryKey(),
  receivingOrderItemId: int("receivingOrderItemId").notNull(),
  batch: varchar("batch", { length: 50 }),
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  quantityConferenced: int("quantityConferenced").notNull(), // Quantidade conferida nesta conferência
  conferencedBy: int("conferencedBy").notNull(), // Operador que fez a conferência
  conferencedAt: timestamp("conferencedAt").defaultNow().notNull(),
  notes: text("notes"), // Observações (ex: "Palete 1 de 4")
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Tabela de divergências (sobras e faltas)
export const receivingDivergences = mysqlTable("receivingDivergences", {
  id: int("id").autoincrement().primaryKey(),
  receivingOrderItemId: int("receivingOrderItemId").notNull(),
  divergenceType: mysqlEnum("divergenceType", ["shortage", "surplus"]).notNull(), // falta ou sobra
  expectedQuantity: int("expectedQuantity").notNull(),
  receivedQuantity: int("receivedQuantity").notNull(),
  differenceQuantity: int("differenceQuantity").notNull(), // Diferença (positivo = sobra, negativo = falta)
  batch: varchar("batch", { length: 50 }),
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reportedBy: int("reportedBy").notNull(), // Operador que reportou
  reportedAt: timestamp("reportedAt").defaultNow().notNull(),
  approvedBy: int("approvedBy"), // Supervisor que aprovou
  approvedAt: timestamp("approvedAt"),
  justification: text("justification"), // Justificativa do supervisor
  fiscalAdjustment: boolean("fiscalAdjustment").default(false).notNull(), // Se já foi feito ajuste fiscal
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Tabela de não-conformidades (NCG)
export const nonConformities = mysqlTable("nonConformities", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(), // Multi-tenant
  receivingOrderItemId: int("receivingOrderItemId").notNull(), // ID do item da ordem de recebimento
  labelCode: varchar("labelCode", { length: 100 }).notNull(), // Código da etiqueta com NCG
  conferenceId: int("conferenceId").notNull(), // ID da conferência onde foi registrado
  // REGRA XOR: locationId OU shippingId (nunca ambos, nunca nenhum)
  // - Em estoque: locationId preenchido, shippingId NULL
  // - Expedido: locationId NULL, shippingId preenchido
  // - CHECK CONSTRAINT: (locationId IS NOT NULL AND shippingId IS NULL) OR (locationId IS NULL AND shippingId IS NOT NULL)
  locationId: int("locationId"), // Localização atual do produto NCG (NCG inicialmente)
  shippingId: int("shippingId"), // ID da expedição (NULL se ainda em estoque)
  description: text("description").notNull(), // Descrição da não-conformidade (motivo)
  photoUrl: varchar("photoUrl", { length: 500 }), // URL da foto (opcional)
  registeredBy: int("registeredBy").notNull(), // userId do operador
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
}, (table) => ({
  labelCodeIdx: index("ncg_label_code_idx").on(table.labelCode),
  conferenceIdx: index("ncg_conference_idx").on(table.conferenceId),
  tenantIdIdx: index("ncg_tenant_id_idx").on(table.tenantId),
  locationIdx: index("ncg_location_idx").on(table.locationId),
  shippingIdx: index("ncg_shipping_idx").on(table.shippingId),
}));

export const divergenceApprovals = mysqlTable("divergenceApprovals", {
  id: int("id").autoincrement().primaryKey(),
  receivingOrderItemId: int("receivingOrderItemId").notNull(),
  requestedBy: int("requestedBy").notNull(),
  divergenceType: mysqlEnum("divergenceType", ["quantity", "code_mismatch", "expiry_date", "multiple"]).notNull(),
  divergenceDetails: text("divergenceDetails").notNull(), // JSON com detalhes da divergência
  justification: text("justification").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedBy: int("approvedBy"),
  approvalJustification: text("approvalJustification"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// MÓDULO 4: ESTOQUE E ARMAZENAGEM
// ============================================================================

export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  productId: int("productId").notNull(),
  locationId: int("locationId").notNull(),
  batch: varchar("batch", { length: 50 }),
  expiryDate: date("expiryDate"),
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  labelCode: varchar("labelCode", { length: 255 }), // ✅ Código da etiqueta (LPN) para rastreabilidade
  serialNumber: varchar("serialNumber", { length: 100 }),
  locationZone: varchar("locationZone", { length: 10 }), // Zona do endereço (EXP, REC, NCG, DEV, etc.)
  quantity: int("quantity").default(0).notNull(),
  reservedQuantity: int("reservedQuantity").default(0).notNull(), // Quantidade reservada para separação
  status: mysqlEnum("status", ["available", "quarantine", "blocked", "damaged", "expired"]).default("available").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantProductIdx: index("tenant_product_idx").on(table.tenantId, table.productId),
  locationIdx: index("location_idx").on(table.locationId),
  uniqueLabelIdx: uniqueIndex("unique_label_tenant_idx").on(table.labelCode, table.tenantId), // ✅ 1 LPN = 1 Inventory
}));

export const inventoryMovements = mysqlTable("inventoryMovements", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  productId: int("productId").notNull(),
  batch: varchar("batch", { length: 50 }),
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  labelCode: varchar("labelCode", { length: 100 }), // ✅ Código da etiqueta (rastreabilidade completa)
  serialNumber: varchar("serialNumber", { length: 100 }),
  fromLocationId: int("fromLocationId"),
  toLocationId: int("toLocationId"),
  quantity: int("quantity").notNull(),
  movementType: mysqlEnum("movementType", ["receiving", "put_away", "picking", "transfer", "adjustment", "return", "disposal", "quality"]).notNull(),
  referenceType: varchar("referenceType", { length: 50 }), // Ex: "receiving_order", "picking_order"
  referenceId: int("referenceId"),
  performedBy: int("performedBy").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantProductIdx: index("tenant_product_movement_idx").on(table.tenantId, table.productId),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

// ============================================================================
// MÓDULO 5: SEPARAÇÃO DE PEDIDOS (PICKING)
// ============================================================================

export const pickingOrders = mysqlTable("pickingOrders", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  customerOrderNumber: varchar("customerOrderNumber", { length: 100 }), // Número do pedido do cliente (numeração interna)
  customerName: varchar("customerName", { length: 255 }), // Nome do destinatário (texto livre do pedido original)
  deliveryAddress: text("deliveryAddress"),
  priority: mysqlEnum("priority", ["emergency", "urgent", "normal", "low"]).default("normal").notNull(),
  status: mysqlEnum("status", ["pending", "validated", "in_wave", "in_progress", "paused", "picking", "picked", "divergent", "checking", "packed", "staged", "invoiced", "shipped", "cancelled"]).default("pending").notNull(),
  shippingStatus: mysqlEnum("shippingStatus", ["awaiting_invoice", "invoice_linked", "in_manifest", "shipped"]), // Status de expedição
  totalItems: int("totalItems").default(0).notNull(), // Total de linhas de itens
  totalQuantity: int("totalQuantity").default(0).notNull(), // Quantidade total de unidades
  scheduledDate: timestamp("scheduledDate"), // Data agendada para separação
  assignedTo: int("assignedTo"), // Separador atribuído
  pickedBy: int("pickedBy"), // Quem realmente separou
  pickedAt: timestamp("pickedAt"),
  checkedBy: int("checkedBy"), // Conferente (DEVE ser diferente de pickedBy)
  checkedAt: timestamp("checkedAt"),
  packedBy: int("packedBy"),
  packedAt: timestamp("packedAt"),
  shippedAt: timestamp("shippedAt"),
  waveId: int("waveId"), // Onda de separação (futuro)
  notes: text("notes"), // Observações gerais
  nfeNumber: varchar("nfeNumber", { length: 20 }), // Número da NF-e de saída
  nfeKey: varchar("nfeKey", { length: 44 }), // Chave de acesso da NF-e (44 dígitos)
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pickingOrderItems = mysqlTable("pickingOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  pickingOrderId: int("pickingOrderId").notNull(),
  productId: int("productId").notNull(),
  requestedQuantity: int("requestedQuantity").notNull(),
  requestedUM: mysqlEnum("requestedUM", ["unit", "box", "pallet"]).default("unit").notNull(), // Unidade de Medida solicitada
  unit: mysqlEnum("unit", ["unit", "box"]).default("unit").notNull(), // Unidade do pedido original (para rastreabilidade)
  unitsPerBox: int("unitsPerBox"), // Unidades por caixa (quando unit=box)
  pickedQuantity: int("pickedQuantity").default(0).notNull(),
  pickedUM: mysqlEnum("pickedUM", ["unit", "box", "pallet"]).default("unit").notNull(),
  batch: varchar("batch", { length: 50 }), // Lote separado (FEFO)
  expiryDate: date("expiryDate"), // Validade do lote
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única para rastreabilidade)
  serialNumber: varchar("serialNumber", { length: 100 }),
  fromLocationId: int("fromLocationId"), // Endereço de origem
  inventoryId: int("inventoryId"), // Referência ao registro de estoque usado
  status: mysqlEnum("status", ["pending", "picking", "picked", "short_picked", "exception", "cancelled"]).default("pending").notNull(),
  pickedBy: int("pickedBy"),
  pickedAt: timestamp("pickedAt"),
  exceptionReason: text("exceptionReason"), // Motivo de exceção (falta, avaria, etc)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});



// ============================================================================
// MÓDULO 6: EXPEDIÇÃO
// ============================================================================

export const shipments = mysqlTable("shipments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  shipmentNumber: varchar("shipmentNumber", { length: 50 }).notNull().unique(),
  pickingOrderId: int("pickingOrderId"),
  carrierName: varchar("carrierName", { length: 255 }),
  vehiclePlate: varchar("vehiclePlate", { length: 20 }),
  driverName: varchar("driverName", { length: 255 }),
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  shippedAt: timestamp("shippedAt"),
  deliveredAt: timestamp("deliveredAt"),
  status: mysqlEnum("status", ["pending", "loaded", "in_transit", "delivered", "returned"]).default("pending").notNull(),
  requiresColdChain: boolean("requiresColdChain").default(false).notNull(),
  temperatureLoggerSerial: varchar("temperatureLoggerSerial", { length: 100 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// MÓDULO 7: INVENTÁRIO
// ============================================================================

export const inventoryCounts = mysqlTable("inventoryCounts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  countNumber: varchar("countNumber", { length: 50 }).notNull().unique(),
  countType: mysqlEnum("countType", ["full_blind", "cyclic", "spot"]).notNull(),
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled").notNull(),
  scheduledDate: timestamp("scheduledDate"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const inventoryCountItems = mysqlTable("inventoryCountItems", {
  id: int("id").autoincrement().primaryKey(),
  inventoryCountId: int("inventoryCountId").notNull(),
  locationId: int("locationId").notNull(),
  productId: int("productId"),
  batch: varchar("batch", { length: 50 }),
  expiryDate: date("expiryDate"),
  serialNumber: varchar("serialNumber", { length: 100 }),
  systemQuantity: int("systemQuantity").default(0).notNull(),
  countedQuantity: int("countedQuantity"),
  variance: int("variance").default(0).notNull(),
  countedBy: int("countedBy"),
  countedAt: timestamp("countedAt"),
  adjustmentReason: text("adjustmentReason"),
  adjustedBy: int("adjustedBy"),
  adjustedAt: timestamp("adjustedAt"),
  status: mysqlEnum("status", ["pending", "counted", "variance", "adjusted"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// MÓDULO 8: QUALIDADE E RECALL
// ============================================================================

export const recalls = mysqlTable("recalls", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  recallNumber: varchar("recallNumber", { length: 50 }).notNull().unique(),
  productId: int("productId").notNull(),
  affectedBatches: text("affectedBatches").notNull(), // JSON array de lotes afetados
  reason: text("reason").notNull(),
  severity: mysqlEnum("severity", ["critical", "high", "medium", "low"]).default("high").notNull(),
  status: mysqlEnum("status", ["active", "in_progress", "completed", "cancelled"]).default("active").notNull(),
  initiatedBy: int("initiatedBy").notNull(),
  initiatedAt: timestamp("initiatedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const returns = mysqlTable("returns", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  returnNumber: varchar("returnNumber", { length: 50 }).notNull().unique(),
  shipmentId: int("shipmentId"),
  returnReason: text("returnReason"),
  status: mysqlEnum("status", ["pending", "received", "inspected", "approved", "rejected", "disposed"]).default("pending").notNull(),
  inspectedBy: int("inspectedBy"),
  inspectedAt: timestamp("inspectedAt"),
  disposition: mysqlEnum("disposition", ["restock", "quarantine", "dispose"]),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// MÓDULO 8.5: ENDEREÇAMENTO PRÉ-DEFINIDO
// ============================================================================

export const productLocationMapping = mysqlTable("productLocationMapping", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  productId: int("productId").notNull(),
  suggestedLocationId: int("suggestedLocationId").notNull(), // Endereço sugerido para armazenagem
  priority: int("priority").default(1).notNull(), // Prioridade (1 = maior prioridade)
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  productIdx: index("product_idx").on(table.productId),
  tenantProductIdx: index("tenant_product_idx").on(table.tenantId, table.productId),
}));

// ============================================================================
// MÓDULO 9: AUDITORIA E LOGS
// ============================================================================

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // Ex: "approve_quarantine", "adjust_inventory"
  entityType: varchar("entityType", { length: 50 }).notNull(), // Ex: "receiving_order", "inventory"
  entityId: int("entityId"),
  oldValue: text("oldValue"), // JSON do estado anterior
  newValue: text("newValue"), // JSON do novo estado
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  signature: text("signature"), // Assinatura eletrônica (hash)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantUserIdx: index("tenant_user_idx").on(table.tenantId, table.userId),
  entityIdx: index("entity_idx").on(table.entityType, table.entityId),
  createdAtIdx: index("audit_created_at_idx").on(table.createdAt),
}));

// ============================================================================
// HISTÓRICO DE IMPRESSÃO DE ETIQUETAS
// ============================================================================

export const labelPrintHistory = mysqlTable("labelPrintHistory", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  userId: int("userId").notNull(),
  receivingOrderId: int("receivingOrderId").notNull(),
  nfeNumber: varchar("nfeNumber", { length: 50 }),
  labelCount: int("labelCount").notNull(),
  labelData: text("labelData").notNull(), // JSON com dados das etiquetas impressas
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantUserIdx: index("label_print_tenant_user_idx").on(table.tenantId, table.userId),
  receivingOrderIdx: index("label_print_order_idx").on(table.receivingOrderId),
  createdAtIdx: index("label_print_created_at_idx").on(table.createdAt),
}));

// ============================================================================
// CONFERÊNCIA CEGA POR ASSOCIAÇÃO DE ETIQUETAS
// ============================================================================

// Sessão de conferência cega
export const blindConferenceSessions = mysqlTable("blindConferenceSessions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  receivingOrderId: int("receivingOrderId").notNull(),
  startedBy: int("startedBy").notNull(), // userId
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
  finishedBy: int("finishedBy"), // userId
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
}, (table) => ({
  receivingOrderIdx: index("blind_conf_order_idx").on(table.receivingOrderId),
  statusIdx: index("blind_conf_status_idx").on(table.status),
}));

// Itens da conferência cega (progresso por produto)
export const blindConferenceItems = mysqlTable("blindConferenceItems", {
  id: int("id").autoincrement().primaryKey(),
  conferenceId: int("conferenceId").notNull(), // FK para blindConferenceSessions
  productId: int("productId").notNull(), // FK para products
  batch: varchar("batch", { length: 100 }).notNull(), // Lote do produto
  expiryDate: date("expiryDate"), // Data de validade do lote
  packagesRead: int("packagesRead").default(0).notNull(), // Contador de embalagens bipadas
  unitsRead: int("unitsRead").default(0).notNull(), // Total de unidades lidas (packagesRead * unitsPerBox)
  expectedQuantity: int("expectedQuantity").default(0).notNull(), // Quantidade esperada (da NF)
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").onUpdateNow(),
}, (table) => ({
  // CONSTRAINT CRÍTICA: 1 registro por conferência + produto + lote
  conferenceProductBatchUnique: uniqueIndex("conf_product_batch_idx").on(table.conferenceId, table.productId, table.batch),
  conferenceIdx: index("blind_conf_items_conf_idx").on(table.conferenceId),
  productIdx: index("blind_conf_items_product_idx").on(table.productId),
}));

// Associações de etiquetas a produtos/lotes
export const labelAssociations = mysqlTable("labelAssociations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(), // Multi-tenant: etiqueta pertence a um cliente
  labelCode: varchar("labelCode", { length: 100 }).notNull().unique(), // Código da etiqueta lida (1 etiqueta = 1 registro)
  uniqueCode: varchar("uniqueCode", { length: 200 }).notNull(), // SKU+Lote (garantidor de 100% rastreabilidade)
  productId: int("productId").notNull(),
  batch: varchar("batch", { length: 100 }),
  expiryDate: date("expiryDate"), // Data de validade do lote
  unitsPerBox: int("unitsPerBox").notNull(), // Quantidade de unidades por caixa
  totalUnits: int("totalUnits").default(0).notNull(), // Total de unidades armazenadas
  status: mysqlEnum("status", ["RECEIVING", "AVAILABLE", "BLOCKED", "EXPIRED"]).default("AVAILABLE").notNull(), // Status da etiqueta no fluxo de recebimento
  associatedBy: int("associatedBy").notNull(), // userId
  associatedAt: timestamp("associatedAt").defaultNow().notNull(),
}, (table) => ({
  labelCodeIdx: index("label_assoc_label_code_idx").on(table.labelCode),
  uniqueCodeIdx: index("label_assoc_unique_code_idx").on(table.uniqueCode),
  tenantIdIdx: index("label_assoc_tenant_id_idx").on(table.tenantId),
}));

// Histórico de leituras de etiquetas
export const labelReadings = mysqlTable("labelReadings", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 20 }).notNull(), // "R10002" ou "P10002"
  associationId: int("associationId").notNull(),
  labelCode: varchar("labelCode", { length: 100 }).notNull(),
  readBy: int("readBy").notNull(), // userId
  readAt: timestamp("readAt").defaultNow().notNull(),
  unitsAdded: int("unitsAdded").notNull(), // Unidades adicionadas nesta leitura
}, (table) => ({
  sessionIdx: index("label_read_session_idx").on(table.sessionId),
  associationIdx: index("label_read_assoc_idx").on(table.associationId),
}));

// Ajustes manuais de quantidade
export const blindConferenceAdjustments = mysqlTable("blindConferenceAdjustments", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  associationId: int("associationId").notNull(),
  previousQuantity: int("previousQuantity").notNull(),
  newQuantity: int("newQuantity").notNull(),
  reason: text("reason"),
  adjustedBy: int("adjustedBy").notNull(), // userId
  adjustedAt: timestamp("adjustedAt").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("blind_adj_session_idx").on(table.sessionId),
}));

// Auditoria de Picking (rastreabilidade de regras aplicadas)
export const pickingAuditLogs = mysqlTable("pickingAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  pickingOrderId: int("pickingOrderId").notNull(),
  tenantId: int("tenantId").notNull(),
  pickingRule: mysqlEnum("pickingRule", ["FIFO", "FEFO", "Direcionado"]).notNull(),
  productId: int("productId").notNull(),
  requestedQuantity: int("requestedQuantity").notNull(),
  allocatedLocations: json("allocatedLocations").notNull(), // Array de alocações
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdx: index("picking_audit_order_idx").on(table.pickingOrderId),
  tenantIdx: index("picking_audit_tenant_idx").on(table.tenantId),
  ruleIdx: index("picking_audit_rule_idx").on(table.pickingRule),
}));

// ============================================================================
// MÓDULO: SEPARAÇÃO POR ONDA (WAVE PICKING)
// ============================================================================

/**
 * Tabela de ondas de separação
 * Agrupa múltiplos pedidos do mesmo cliente para otimizar picking
 */
export const pickingWaves = mysqlTable("pickingWaves", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(), // Cliente da onda
  waveNumber: varchar("waveNumber", { length: 50 }).notNull().unique(), // Número único da OS
  status: mysqlEnum("status", ["pending", "picking", "picked", "staged", "completed", "cancelled"]).default("pending").notNull(),
  totalOrders: int("totalOrders").default(0).notNull(), // Quantidade de pedidos agrupados
  totalItems: int("totalItems").default(0).notNull(), // Total de linhas consolidadas
  totalQuantity: int("totalQuantity").default(0).notNull(), // Quantidade total de unidades
  pickingRule: mysqlEnum("pickingRule", ["FIFO", "FEFO", "Direcionado"]).notNull(), // Regra aplicada
  assignedTo: int("assignedTo"), // Separador atribuído
  pickedBy: int("pickedBy"), // Quem realmente separou
  pickedAt: timestamp("pickedAt"),
  stagedBy: int("stagedBy"), // Quem fez a segregação em stage
  stagedAt: timestamp("stagedAt"),
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("wave_tenant_idx").on(table.tenantId),
  statusIdx: index("wave_status_idx").on(table.status),
}));

/**
 * Tabela de itens consolidados da onda
 * Produtos + quantidades totais + endereços alocados
 */
export const pickingWaveItems = mysqlTable("pickingWaveItems", {
  id: int("id").autoincrement().primaryKey(),
  waveId: int("waveId").notNull(),
  pickingOrderId: int("pickingOrderId").notNull(), // Pedido de origem do item
  productId: int("productId").notNull(),
  productSku: varchar("productSku", { length: 100 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  totalQuantity: int("totalQuantity").notNull(), // Quantidade consolidada
  pickedQuantity: int("pickedQuantity").default(0).notNull(), // Quantidade já separada
  unit: mysqlEnum("unit", ["unit", "box"]).default("unit").notNull(), // Unidade do pedido original
  unitsPerBox: int("unitsPerBox"),
  locationId: int("locationId").notNull(), // Endereço alocado (FIFO/FEFO)
  locationCode: varchar("locationCode", { length: 50 }).notNull(), // Código do endereço (ex: H01-08-02)
  batch: varchar("batch", { length: 100 }), // Lote sugerido
  expiryDate: date("expiryDate"), // Validade do lote
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  labelCode: varchar("labelCode", { length: 200 }), // Código da etiqueta (rastreabilidade)
  status: mysqlEnum("status", ["pending", "picking", "picked"]).default("pending").notNull(),
  pickedAt: timestamp("pickedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  waveIdx: index("wave_item_wave_idx").on(table.waveId),
  productIdx: index("wave_item_product_idx").on(table.productId),
  locationIdx: index("wave_item_location_idx").on(table.locationId),
  orderIdx: index("wave_item_order_idx").on(table.pickingOrderId), // Índice para buscar por pedido
}));

// ============================================================================
// MÓDULO 9: PRÉ-ALOCAÇÃO DE PICKING (FEFO/FIFO/Direcionado)
// ============================================================================

/**
 * Tabela de pré-alocações de picking
 * Persiste lotes e endereços pré-alocados ao gerar pedido/onda
 * Permite fluxo guiado por endereço no coletor
 */
export const pickingAllocations = mysqlTable("pickingAllocations", {
  id: int("id").autoincrement().primaryKey(),
  pickingOrderId: int("pickingOrderId").notNull(),
  waveId: int("waveId"), // 🚀 Onda associada (para cancelamento atômico)
  inventoryId: int("inventoryId"), // 🚀 Registro exato de estoque reservado (rastreabilidade atômica)
  productId: int("productId").notNull(),
  productSku: varchar("productSku", { length: 100 }).notNull(),
  locationId: int("locationId").notNull(), // Endereço pré-alocado
  locationCode: varchar("locationCode", { length: 50 }).notNull(),
  batch: varchar("batch", { length: 100 }), // Lote pré-alocado
  expiryDate: date("expiryDate"), // Validade do lote
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  quantity: int("quantity").notNull(), // Quantidade a separar
  isFractional: boolean("isFractional").default(false).notNull(), // Item fracionado?
  sequence: int("sequence").notNull(), // Ordem de visitação (endereços ordenados)
  status: mysqlEnum("status", ["pending", "in_progress", "picked", "short_picked"]).default("pending").notNull(),
  pickedQuantity: int("pickedQuantity").default(0).notNull(), // Quantidade efetivamente separada
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdx: index("allocation_order_idx").on(table.pickingOrderId),
  locationIdx: index("allocation_location_idx").on(table.locationId),
  sequenceIdx: index("allocation_sequence_idx").on(table.pickingOrderId, table.sequence),
}));

/**
 * Tabela de progresso de picking
 * Salva estado atual do picking para permitir pausa/retomada
 */
export const pickingProgress = mysqlTable("pickingProgress", {
  id: int("id").autoincrement().primaryKey(),
  pickingOrderId: int("pickingOrderId").notNull(), // Um progresso por pedido
  currentSequence: int("currentSequence").default(1).notNull(), // Índice do endereço atual
  currentLocationId: int("currentLocationId"), // Endereço em que o operador está
  scannedItems: json("scannedItems"), // JSON com itens já bipados
  pausedAt: timestamp("pausedAt"),
  pausedBy: int("pausedBy"), // Operador que pausou
  resumedAt: timestamp("resumedAt"),
  resumedBy: int("resumedBy"), // Operador que retomou
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orderIdx: unique().on(table.pickingOrderId), // Um progresso por pedido
}));

// ============================================================================
// MÓDULO 10: STAGE (CONFERÊNCIA DE EXPEDIÇÃO)
// ============================================================================

/**
 * Tabela de conferências de expedição (Stage)
 * Registra conferências cegas de pedidos antes da expedição
 */
export const stageChecks = mysqlTable("stageChecks", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  pickingOrderId: int("pickingOrderId").notNull(),
  customerOrderNumber: varchar("customerOrderNumber", { length: 100 }).notNull(),
  operatorId: int("operatorId").notNull(), // Usuário que fez a conferência
  status: mysqlEnum("status", ["in_progress", "completed", "divergent"]).default("in_progress").notNull(),
  hasDivergence: boolean("hasDivergence").default(false).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("stage_check_tenant_idx").on(table.tenantId),
  orderIdx: index("stage_check_order_idx").on(table.pickingOrderId),
  statusIdx: index("stage_check_status_idx").on(table.status),
}));

/**
 * Tabela de itens conferidos no Stage
 * Registra cada produto conferido com quantidade esperada vs conferida
 */
export const stageCheckItems = mysqlTable("stageCheckItems", {
  id: int("id").autoincrement().primaryKey(),
  stageCheckId: int("stageCheckId").notNull(),
  productId: int("productId").notNull(),
  productSku: varchar("productSku", { length: 100 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  batch: varchar("batch", { length: 100 }), // Lote esperado (null = sem validação de lote)
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  expectedQuantity: int("expectedQuantity").notNull(), // Quantidade separada
  checkedQuantity: int("checkedQuantity").default(0).notNull(), // Quantidade conferida
  divergence: int("divergence").default(0).notNull(), // Diferença (conferido - esperado)
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  checkIdx: index("stage_item_check_idx").on(table.stageCheckId),
  productIdx: index("stage_item_product_idx").on(table.productId),
}));

/**
 * Tabela global de etiquetas de produtos
 * Mapeia códigos de etiqueta (SKU+Lote) para produtos e lotes de forma permanente
 * Permite reconhecimento de etiquetas em qualquer módulo do sistema
 */
export const productLabels = mysqlTable("productLabels", {
  id: int("id").autoincrement().primaryKey(),
  labelCode: varchar("labelCode", { length: 200 }).notNull().unique(), // SKU + Lote (ex: 401460P22D08LB109)
  productId: int("productId").notNull(),
  productSku: varchar("productSku", { length: 100 }).notNull(),
  batch: varchar("batch", { length: 100 }).notNull(),
  expiryDate: date("expiryDate"), // Data de validade do lote
  createdBy: int("createdBy").notNull(), // userId que gerou a etiqueta
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  labelCodeIdx: index("product_label_code_idx").on(table.labelCode),
  productIdx: index("product_label_product_idx").on(table.productId),
  skuBatchIdx: index("product_label_sku_batch_idx").on(table.productSku, table.batch),
}));

// ============================================================================
// PREFERÊNCIAS DE IMPRESSÃO
// ============================================================================

/**
 * Tabela de preferências de impressão por usuário
 * Armazena configurações personalizadas para impressão de etiquetas
 */
export const printSettings = mysqlTable("printSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Relacionamento com users.id
  defaultFormat: mysqlEnum("defaultFormat", ["zpl", "pdf"]).default("zpl").notNull(),
  defaultCopies: int("defaultCopies").default(1).notNull(),
  labelSize: varchar("labelSize", { length: 50 }).default("4x2").notNull(), // 4x2 polegadas
  printerDpi: int("printerDpi").default(203).notNull(), // 203 DPI (8dpmm)
  autoPrint: boolean("autoPrint").default(true).notNull(), // Abrir diálogo automaticamente
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: unique().on(table.userId), // Um registro por usuário
}));

// ============================================================================
// MÓDULO DE EXPEDIÇÃO (SHIPPING)
// ============================================================================

/**
 * Notas Fiscais (Invoices)
 * Armazena XMLs de NF-e importados e vinculação com pedidos
 */
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 20 }).notNull(), // Número da NF
  series: varchar("series", { length: 5 }).notNull(), // Série da NF
  invoiceKey: varchar("invoiceKey", { length: 44 }).notNull().unique(), // Chave de acesso (44 dígitos)
  customerId: int("customerId").notNull(), // Cliente (tenant)
  customerName: varchar("customerName", { length: 255 }),
  customerCity: varchar("customerCity", { length: 100 }), // Município do destinatário
  customerState: varchar("customerState", { length: 2 }), // UF do destinatário
  pickingOrderId: int("pickingOrderId"), // Pedido vinculado
  xmlData: json("xmlData"), // Dados completos do XML
  volumes: int("volumes"), // Quantidade de volumes
  pesoB: decimal("pesoB", { precision: 10, scale: 3 }), // Peso bruto em kg
  totalValue: decimal("totalValue", { precision: 15, scale: 2 }), // Valor total da NF
  issueDate: timestamp("issueDate"), // Data de emissão
  status: mysqlEnum("status", ["imported", "linked", "in_manifest", "shipped"]).default("imported").notNull(),
  importedBy: int("importedBy").notNull(),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  linkedAt: timestamp("linkedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Itens de Notas Fiscais de Saída (Picking Invoice Items)
 * Armazena itens individuais da NF-e de saída para rastreabilidade e queries eficientes
 */
export const pickingInvoiceItems = mysqlTable("pickingInvoiceItems", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(), // Referência à NF-e
  productId: int("productId"), // Produto vinculado (pode ser null se não encontrado)
  sku: varchar("sku", { length: 100 }).notNull(), // SKU/Código do produto na NF-e
  productName: varchar("productName", { length: 255 }).notNull(), // Nome do produto
  batch: varchar("batch", { length: 50 }), // Lote
  expiryDate: date("expiryDate"), // Validade
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  quantity: int("quantity").notNull(), // Quantidade (sempre em unidades)
  quantityUM: mysqlEnum("quantityUM", ["unit", "box", "pallet"]).default("unit").notNull(),lue: decimal("totalValue", { precision: 15, scale: 2 }), // Valor total do item
  ncm: varchar("ncm", { length: 10 }), // Código NCM
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  invoiceIdx: index("picking_invoice_items_invoice_idx").on(table.invoiceId),
  productIdx: index("picking_invoice_items_product_idx").on(table.productId),
  uniqueCodeIdx: index("picking_invoice_items_unique_code_idx").on(table.uniqueCode),
}));

/**
 * Itens de Notas Fiscais de Entrada (Receiving Invoice Items)
 * Armazena itens individuais da NF-e de entrada para rastreabilidade e queries eficientes
 */
export const receivingInvoiceItems = mysqlTable("receivingInvoiceItems", {
  id: int("id").autoincrement().primaryKey(),
  receivingOrderId: int("receivingOrderId").notNull(), // Referência ao pedido de recebimento
  nfeKey: varchar("nfeKey", { length: 44 }), // Chave da NF-e (44 dígitos)
  nfeNumber: varchar("nfeNumber", { length: 20 }), // Número da NF-e
  productId: int("productId"), // Produto vinculado (pode ser null se não encontrado)
  sku: varchar("sku", { length: 100 }).notNull(), // SKU/Código do produto na NF-e
  productName: varchar("productName", { length: 255 }).notNull(), // Nome do produto
  batch: varchar("batch", { length: 50 }), // Lo  expiryDate: date("expiryDate"), // Validade
  uniqueCode: varchar("uniqueCode", { length: 200 }), // SKU+Lote (chave única)
  quantity: int("quantity").notNull(), // Quantidade (sempre em unidades)
  divergence: int("divergence"), // Diferença (conferido - esperado)/ Valor unitário
  totalValue: decimal("totalValue", { precision: 15, scale: 2 }), // Valor total do item
  ncm: varchar("ncm", { length: 10 }), // Código NCM
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  receivingOrderIdx: index("receiving_invoice_items_order_idx").on(table.receivingOrderId),
  productIdx: index("receiving_invoice_items_product_idx").on(table.productId),
  uniqueCodeIdx: index("receiving_invoice_items_unique_code_idx").on(table.uniqueCode),
  nfeKeyIdx: index("receiving_invoice_items_nfe_key_idx").on(table.nfeKey),
}));

/**
 * Romaneios de Transporte (Shipment Manifests)
 * Consolida múltiplos pedidos e NFs para uma transportadora
 */
export const shipmentManifests = mysqlTable("shipmentManifests", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  manifestNumber: varchar("manifestNumber", { length: 50 }).notNull().unique(),
  carrierId: int("carrierId"), // Transportadora (relacionamento futuro)
  carrierName: varchar("carrierName", { length: 255 }),
  totalOrders: int("totalOrders").default(0).notNull(),
  totalInvoices: int("totalInvoices").default(0).notNull(),
  totalVolumes: int("totalVolumes").default(0).notNull(),
  status: mysqlEnum("status", ["draft", "ready", "collected", "shipped"]).default("draft").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  collectedAt: timestamp("collectedAt"),
  shippedAt: timestamp("shippedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Itens do Romaneio
 * Relaciona pedidos e NFs a um romaneio específico
 */
export const shipmentManifestItems = mysqlTable("shipmentManifestItems", {
  id: int("id").autoincrement().primaryKey(),
  manifestId: int("manifestId").notNull(),
  pickingOrderId: int("pickingOrderId").notNull(),
  invoiceId: int("invoiceId").notNull(),
  volumes: int("volumes"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
}, (table) => ({
  manifestOrderIdx: unique().on(table.manifestId, table.pickingOrderId), // Pedido não pode estar em mais de um romaneio
}));

// ============================================================================
// TIPOS EXPORTADOS
// ============================================================================

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Warehouse = typeof warehouses.$inferSelect;
export type WarehouseZone = typeof warehouseZones.$inferSelect;
export type WarehouseLocation = typeof warehouseLocations.$inferSelect;
export type ReceivingOrder = typeof receivingOrders.$inferSelect;
export type ReceivingOrderItem = typeof receivingOrderItems.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type PickingOrder = typeof pickingOrders.$inferSelect;
export type PickingOrderItem = typeof pickingOrderItems.$inferSelect;
export type Shipment = typeof shipments.$inferSelect;
export type InventoryCount = typeof inventoryCounts.$inferSelect;
export type InventoryCountItem = typeof inventoryCountItems.$inferSelect;
export type Recall = typeof recalls.$inferSelect;
export type Return = typeof returns.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type LabelPrintHistory = typeof labelPrintHistory.$inferSelect;
export type InsertLabelPrintHistory = typeof labelPrintHistory.$inferInsert;
export type BlindConferenceSession = typeof blindConferenceSessions.$inferSelect;
export type InsertBlindConferenceSession = typeof blindConferenceSessions.$inferInsert;
export type LabelAssociation = typeof labelAssociations.$inferSelect;
export type InsertLabelAssociation = typeof labelAssociations.$inferInsert;
export type LabelReading = typeof labelReadings.$inferSelect;
export type InsertLabelReading = typeof labelReadings.$inferInsert;
export type BlindConferenceAdjustment = typeof blindConferenceAdjustments.$inferSelect;
export type InsertBlindConferenceAdjustment = typeof blindConferenceAdjustments.$inferInsert;
export type PickingWave = typeof pickingWaves.$inferSelect;
export type InsertPickingWave = typeof pickingWaves.$inferInsert;
export type PickingWaveItem = typeof pickingWaveItems.$inferSelect;
export type InsertPickingWaveItem = typeof pickingWaveItems.$inferInsert;
export type StageCheck = typeof stageChecks.$inferSelect;
export type InsertStageCheck = typeof stageChecks.$inferInsert;
export type StageCheckItem = typeof stageCheckItems.$inferSelect;
export type InsertStageCheckItem = typeof stageCheckItems.$inferInsert;
export type ProductLabel = typeof productLabels.$inferSelect;
export type InsertProductLabel = typeof productLabels.$inferInsert;
export type PrintSettings = typeof printSettings.$inferSelect;
export type InsertPrintSettings = typeof printSettings.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
export type PickingInvoiceItem = typeof pickingInvoiceItems.$inferSelect;
export type InsertPickingInvoiceItem = typeof pickingInvoiceItems.$inferInsert;
export type ReceivingInvoiceItem = typeof receivingInvoiceItems.$inferSelect;
export type InsertReceivingInvoiceItem = typeof receivingInvoiceItems.$inferInsert;
export type ShipmentManifest = typeof shipmentManifests.$inferSelect;
export type InsertShipmentManifest = typeof shipmentManifests.$inferInsert;
export type ShipmentManifestItem = typeof shipmentManifestItems.$inferSelect;
export type InsertShipmentManifestItem = typeof shipmentManifestItems.$inferInsert;
export type PickingAllocation = typeof pickingAllocations.$inferSelect;
export type InsertPickingAllocation = typeof pickingAllocations.$inferInsert;
export type PickingProgress = typeof pickingProgress.$inferSelect;
export type InsertPickingProgress = typeof pickingProgress.$inferInsert;


// ============================================================================
// MÓDULO DE RELATÓRIOS
// ============================================================================

/**
 * Tabela de logs de geração de relatórios
 * Registra auditoria de quem gerou qual relatório e quando
 */
export const reportLogs = mysqlTable("reportLogs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"), // null = relatório global (admin)
  userId: int("userId").notNull(), // Quem gerou o relatório
  reportType: varchar("reportType", { length: 100 }).notNull(), // ex: "stock_position", "productivity"
  reportCategory: mysqlEnum("reportCategory", ["stock", "operational", "shipping", "audit"]).notNull(),
  filters: json("filters"), // Filtros aplicados (JSON)
  exportFormat: mysqlEnum("exportFormat", ["screen", "excel", "pdf", "csv"]),
  recordCount: int("recordCount"), // Quantidade de registros retornados
  executionTime: int("executionTime"), // Tempo de execução em ms
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("reportLogs_tenantId_idx").on(table.tenantId),
  userIdx: index("reportLogs_userId_idx").on(table.userId),
  typeIdx: index("reportLogs_reportType_idx").on(table.reportType),
  dateIdx: index("reportLogs_generatedAt_idx").on(table.generatedAt),
}));

/**
 * Tabela de filtros favoritos salvos por usuário
 * Permite que usuários salvem combinações de filtros frequentes
 */
export const reportFavorites = mysqlTable("reportFavorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  reportType: varchar("reportType", { length: 100 }).notNull(),
  favoriteName: varchar("favoriteName", { length: 255 }).notNull(), // Nome dado pelo usuário
  filters: json("filters").notNull(), // Filtros salvos (JSON)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("reportFavorites_userId_idx").on(table.userId),
  typeIdx: index("reportFavorites_reportType_idx").on(table.reportType),
}));

// Type exports
export type ReportLog = typeof reportLogs.$inferSelect;
export type InsertReportLog = typeof reportLogs.$inferInsert;
export type ReportFavorite = typeof reportFavorites.$inferSelect;
export type InsertReportFavorite = typeof reportFavorites.$inferInsert;

// ============================================================================
// MÓDULO PORTAL DO CLIENTE
// ============================================================================

/**
 * Sessões de acesso ao Portal do Cliente
 * Usuários do systemUsers fazem login aqui com token próprio (independente do OAuth do WMS).
 * Token JWT é armazenado em cookie "client_portal_session".
 */
export const clientPortalSessions = mysqlTable("clientPortalSessions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  systemUserId: int("systemUserId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("cps_tenant_idx").on(table.tenantId),
  userIdx: index("cps_user_idx").on(table.systemUserId),
  expiresIdx: index("cps_expires_idx").on(table.expiresAt),
}));

export type ClientPortalSession = typeof clientPortalSessions.$inferSelect;
export type InsertClientPortalSession = typeof clientPortalSessions.$inferInsert;
