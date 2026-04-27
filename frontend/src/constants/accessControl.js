export const ROLE_ACCESS = {
  admin: {
    key: 'admin',
    label: 'Admin',
    icon: 'admin_panel_settings',
    color: 'blue',
    permissions: {
      summary: true,
      sales: true,
      inventory: true,
      grn: true,
      stockMovement: true,
      users: true,
      suppliers: true,
      purchaseOrders: true,
      reports: true,
      settings: true,
    },
  },
  manager: {
    key: 'manager',
    label: 'Manager',
    icon: 'manage_accounts',
    color: 'indigo',
    permissions: {
      summary: true,
      sales: true,
      inventory: true,
      grn: true,
      stockMovement: true,
      users: false,
      suppliers: true,
      purchaseOrders: true,
      reports: true,
      settings: false,
    },
  },
  storekeeper: {
    key: 'storekeeper',
    label: 'StoreKeeper',
    icon: 'warehouse',
    color: 'teal',
    permissions: {
      summary: true,
      sales: false,
      inventory: true,
      grn: true,
      stockMovement: false,
      users: false,
      suppliers: true,
      purchaseOrders: true,
      reports: false,
      settings: false,
    },
  },
  cashier: {
    key: 'cashier',
    label: 'Cashier',
    icon: 'point_of_sale',
    color: 'amber',
    permissions: {
      summary: true,
      sales: true,
      inventory: false,
      grn: false,
      stockMovement: false,
      users: false,
      suppliers: false,
      purchaseOrders: false,
      reports: false,
      settings: false,
    },
  },
}

const FALLBACK_ROLE = ROLE_ACCESS.cashier

export const NAV_ITEMS = [
  { label: 'Dashboard', icon: 'dashboard', path: '/', permission: 'summary' },
  { label: 'Items', icon: 'inventory_2', path: '/items', permission: 'inventory' },
  { label: 'Suppliers', icon: 'local_shipping', path: '/suppliers', permission: 'suppliers' },
  { label: 'Purchase Orders', icon: 'receipt', path: '/po', permission: 'purchaseOrders' },
  { label: 'GRN', icon: 'input', path: '/grns', permission: 'grn' },
  { label: 'Sales', icon: 'point_of_sale', path: '/sales', permission: 'sales' },
  { label: 'Stock Movement', icon: 'compare_arrows', path: '/stock-movement', permission: 'stockMovement' },
  { label: 'Users', icon: 'group', path: '/users', permission: 'users' },
  { label: 'Reports', icon: 'assessment', path: '/reports', permission: 'reports' },
  { label: 'Settings', icon: 'settings', path: '/settings', permission: 'settings' },
]

export const normalizeRoleKey = (role) => {
  const roleName = typeof role === 'object' ? role?.name : role
  return String(roleName || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

export const resolveRoleConfig = (role) => {
  const key = normalizeRoleKey(role)
  return ROLE_ACCESS[key] || FALLBACK_ROLE
}

export const hasPermission = (role, permission) => {
  const roleConfig = resolveRoleConfig(role)
  return Boolean(roleConfig.permissions?.[permission])
}
