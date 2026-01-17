import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index, unique, json, date } from "drizzle-orm/mysql-core";

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
  expiryDate: timestamp("expiryDate"), // Validade associada (opcional)
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
  tenantId: int("tenantId"), // Cliente dono do endereço (null = compartilhado)
  code: varchar("code", { length: 50 }).notNull().unique(),
  aisle: varchar("aisle", { length: 10 }), // Rua
  rack: varchar("rack", { length: 10 }), // Prédio
  level: varchar("level", { length: 10 }), // Andar
  position: varchar("position", { length: 10 }), // Quadrante (obrigatório apenas para tipo "fraction")
  locationType: mysqlEnum("locationType", ["whole", "fraction"]).default("whole").notNull(), // Inteira ou Fração
  storageRule: mysqlEnum("storageRule", ["single", "multi"]).default("single").notNull(), // Único item/lote ou Multi-item
  status: mysqlEnum("status", ["available", "occupied", "blocked", "counting"]).default("available").notNull(),
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
  receivingOrderId: int("receivingOrderId").notNull(),
  productId: int("productId").notNull(),
  expectedQuantity: int("expectedQuantity").notNull(),
  receivedQuantity: int("receivedQuantity").default(0).notNull(),
  addressedQuantity: int("addressedQuantity").default(0).notNull(),
  // Códigos esperados da NF-e
  expectedGtin: varchar("expectedGtin", { length: 14 }),
  expectedSupplierCode: varchar("expectedSupplierCode", { length: 50 }),
  expectedInternalCode: varchar("expectedInternalCode", { length: 50 }),
  // Códigos conferidos
  scannedGtin: varchar("scannedGtin", { length: 14 }),
  scannedSupplierCode: varchar("scannedSupplierCode", { length: 50 }),
  scannedInternalCode: varchar("scannedInternalCode", { length: 50 }),
  batch: varchar("batch", { length: 50 }),
  expiryDate: timestamp("expiryDate"),
  serialNumber: varchar("serialNumber", { length: 100 }),
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
  expiryDate: timestamp("expiryDate"),
  serialNumber: varchar("serialNumber", { length: 100 }),
  quantity: int("quantity").default(0).notNull(),
  reservedQuantity: int("reservedQuantity").default(0).notNull(), // Quantidade reservada para separação
  status: mysqlEnum("status", ["available", "quarantine", "blocked", "damaged", "expired"]).default("available").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantProductIdx: index("tenant_product_idx").on(table.tenantId, table.productId),
  locationIdx: index("location_idx").on(table.locationId),
}));

export const inventoryMovements = mysqlTable("inventoryMovements", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  productId: int("productId").notNull(),
  batch: varchar("batch", { length: 50 }),
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
  customerId: int("customerId"), // Relacionamento com cliente (tenant)
  customerName: varchar("customerName", { length: 255 }),
  deliveryAddress: text("deliveryAddress"),
  priority: mysqlEnum("priority", ["emergency", "urgent", "normal", "low"]).default("normal").notNull(),
  status: mysqlEnum("status", ["pending", "validated", "in_wave", "picking", "picked", "checking", "packed", "invoiced", "shipped", "cancelled"]).default("pending").notNull(),
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
  pickedQuantity: int("pickedQuantity").default(0).notNull(),
  pickedUM: mysqlEnum("pickedUM", ["unit", "box", "pallet"]).default("unit").notNull(),
  batch: varchar("batch", { length: 50 }), // Lote separado (FEFO)
  expiryDate: timestamp("expiryDate"), // Validade do lote
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

/**
 * Tabela de reservas de estoque para pedidos de separação
 * Rastreia quais posições de estoque foram reservadas para cada pedido
 */
export const pickingReservations = mysqlTable("pickingReservations", {
  id: int("id").autoincrement().primaryKey(),
  pickingOrderId: int("pickingOrderId").notNull(),
  productId: int("productId").notNull(),
  inventoryId: int("inventoryId").notNull(), // Posição de estoque reservada
  quantity: int("quantity").notNull(), // Quantidade reservada desta posição
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
  expiryDate: timestamp("expiryDate"),
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

// Associações de etiquetas a produtos/lotes
export const labelAssociations = mysqlTable("labelAssociations", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  labelCode: varchar("labelCode", { length: 100 }).notNull(), // Código da etiqueta lida
  productId: int("productId").notNull(),
  batch: varchar("batch", { length: 100 }),
  expiryDate: date("expiryDate"), // Data de validade do lote
  unitsPerPackage: int("unitsPerPackage").notNull(), // Quantidade de unidades por embalagem
  packagesRead: int("packagesRead").default(0).notNull(), // Quantidade de volumes/embalagens lidos
  totalUnits: int("totalUnits").default(0).notNull(), // Total de unidades (packagesRead * unitsPerPackage)
  associatedBy: int("associatedBy").notNull(), // userId
  associatedAt: timestamp("associatedAt").defaultNow().notNull(),
}, (table) => ({
  sessionLabelIdx: index("label_assoc_session_label_idx").on(table.sessionId, table.labelCode),
  sessionIdx: index("label_assoc_session_idx").on(table.sessionId),
}));

// Histórico de leituras de etiquetas
export const labelReadings = mysqlTable("labelReadings", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
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
  pickingOrderId: int("pickingOrderId").notNull(), // Referência ao pedido de origem
  productId: int("productId").notNull(),
  productSku: varchar("productSku", { length: 100 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  totalQuantity: int("totalQuantity").notNull(), // Quantidade consolidada
  pickedQuantity: int("pickedQuantity").default(0).notNull(), // Quantidade já separada
  locationId: int("locationId").notNull(), // Endereço alocado (FIFO/FEFO)
  locationCode: varchar("locationCode", { length: 50 }).notNull(), // Código do endereço (ex: H01-08-02)
  batch: varchar("batch", { length: 100 }), // Lote sugerido
  expiryDate: date("expiryDate"), // Validade do lote
  status: mysqlEnum("status", ["pending", "picking", "picked"]).default("pending").notNull(),
  pickedAt: timestamp("pickedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  waveIdx: index("wave_item_wave_idx").on(table.waveId),
  productIdx: index("wave_item_product_idx").on(table.productId),
  locationIdx: index("wave_item_location_idx").on(table.locationId),
  orderIdx: index("wave_item_order_idx").on(table.pickingOrderId),
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
