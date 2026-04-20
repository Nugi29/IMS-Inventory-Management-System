var DataTypes = require("sequelize").DataTypes;
var _category = require("./category");
var _customer = require("./customer");
var _grn = require("./grn");
var _grn_item = require("./grn_item");
var _grn_status = require("./grn_status");
var _item = require("./item");
var _item_status = require("./item_status");
var _movement_type = require("./movement_type");
var _po_status = require("./po_status");
var _purchase_order = require("./purchase_order");
var _purchase_order_item = require("./purchase_order_item");
var _sale = require("./sale");
var _sale_item = require("./sale_item");
var _stock_adjustment = require("./stock_adjustment");
var _stock_movement = require("./stock_movement");
var _supplier = require("./supplier");
var _supplier_status = require("./supplier_status");
var _user = require("./user");
var _user_role = require("./user_role");
var _user_status = require("./user_status");

function initModels(sequelize) {
  var category = _category(sequelize, DataTypes);
  var customer = _customer(sequelize, DataTypes);
  var grn = _grn(sequelize, DataTypes);
  var grn_item = _grn_item(sequelize, DataTypes);
  var grn_status = _grn_status(sequelize, DataTypes);
  var item = _item(sequelize, DataTypes);
  var item_status = _item_status(sequelize, DataTypes);
  var movement_type = _movement_type(sequelize, DataTypes);
  var po_status = _po_status(sequelize, DataTypes);
  var purchase_order = _purchase_order(sequelize, DataTypes);
  var purchase_order_item = _purchase_order_item(sequelize, DataTypes);
  var sale = _sale(sequelize, DataTypes);
  var sale_item = _sale_item(sequelize, DataTypes);
  var stock_adjustment = _stock_adjustment(sequelize, DataTypes);
  var stock_movement = _stock_movement(sequelize, DataTypes);
  var supplier = _supplier(sequelize, DataTypes);
  var supplier_status = _supplier_status(sequelize, DataTypes);
  var user = _user(sequelize, DataTypes);
  var user_role = _user_role(sequelize, DataTypes);
  var user_status = _user_status(sequelize, DataTypes);

  item.belongsTo(category, { as: "category", foreignKey: "category_id"});
  category.hasMany(item, { as: "items", foreignKey: "category_id"});
  sale.belongsTo(customer, { as: "customer", foreignKey: "customer_id"});
  customer.hasMany(sale, { as: "sales", foreignKey: "customer_id"});
  grn_item.belongsTo(grn, { as: "grn", foreignKey: "grn_id"});
  grn.hasMany(grn_item, { as: "grn_items", foreignKey: "grn_id"});
  stock_movement.belongsTo(grn, { as: "grn", foreignKey: "grn_id"});
  grn.hasMany(stock_movement, { as: "stock_movements", foreignKey: "grn_id"});
  grn.belongsTo(grn_status, { as: "grn_status", foreignKey: "grn_status_id"});
  grn_status.hasMany(grn, { as: "grns", foreignKey: "grn_status_id"});
  grn_item.belongsTo(item, { as: "item", foreignKey: "item_id"});
  item.hasMany(grn_item, { as: "grn_items", foreignKey: "item_id"});
  purchase_order_item.belongsTo(item, { as: "item", foreignKey: "item_id"});
  item.hasMany(purchase_order_item, { as: "purchase_order_items", foreignKey: "item_id"});
  sale_item.belongsTo(item, { as: "item", foreignKey: "item_id"});
  item.hasMany(sale_item, { as: "sale_items", foreignKey: "item_id"});
  stock_adjustment.belongsTo(item, { as: "item", foreignKey: "item_id"});
  item.hasMany(stock_adjustment, { as: "stock_adjustments", foreignKey: "item_id"});
  stock_movement.belongsTo(item, { as: "item", foreignKey: "item_id"});
  item.hasMany(stock_movement, { as: "stock_movements", foreignKey: "item_id"});
  item.belongsTo(item_status, { as: "item_status", foreignKey: "item_status_id"});
  item_status.hasMany(item, { as: "items", foreignKey: "item_status_id"});
  stock_movement.belongsTo(movement_type, { as: "movement_type", foreignKey: "movement_type_id"});
  movement_type.hasMany(stock_movement, { as: "stock_movements", foreignKey: "movement_type_id"});
  purchase_order.belongsTo(po_status, { as: "po_status", foreignKey: "po_status_id"});
  po_status.hasMany(purchase_order, { as: "purchase_orders", foreignKey: "po_status_id"});
  grn.belongsTo(purchase_order, { as: "purchase_order", foreignKey: "purchase_order_id"});
  purchase_order.hasMany(grn, { as: "grns", foreignKey: "purchase_order_id"});
  purchase_order_item.belongsTo(purchase_order, { as: "purchase_order", foreignKey: "purchase_order_id"});
  purchase_order.hasMany(purchase_order_item, { as: "purchase_order_items", foreignKey: "purchase_order_id"});
  sale_item.belongsTo(sale, { as: "sale", foreignKey: "sale_id"});
  sale.hasMany(sale_item, { as: "sale_items", foreignKey: "sale_id"});
  stock_movement.belongsTo(sale, { as: "sale", foreignKey: "sale_id"});
  sale.hasMany(stock_movement, { as: "stock_movements", foreignKey: "sale_id"});
  stock_movement.belongsTo(stock_adjustment, { as: "stock_adjustment", foreignKey: "stock_adjustment_id"});
  stock_adjustment.hasMany(stock_movement, { as: "stock_movements", foreignKey: "stock_adjustment_id"});
  grn.belongsTo(supplier, { as: "supplier", foreignKey: "supplier_id"});
  supplier.hasMany(grn, { as: "grns", foreignKey: "supplier_id"});
  item.belongsTo(supplier, { as: "supplier", foreignKey: "supplier_id"});
  supplier.hasMany(item, { as: "items", foreignKey: "supplier_id"});
  purchase_order.belongsTo(supplier, { as: "supplier", foreignKey: "supplier_id"});
  supplier.hasMany(purchase_order, { as: "purchase_orders", foreignKey: "supplier_id"});
  supplier.belongsTo(supplier_status, { as: "supplier_status", foreignKey: "supplier_status_id"});
  supplier_status.hasMany(supplier, { as: "suppliers", foreignKey: "supplier_status_id"});
  grn.belongsTo(user, { as: "user", foreignKey: "user_id"});
  user.hasMany(grn, { as: "grns", foreignKey: "user_id"});
  purchase_order.belongsTo(user, { as: "created_by_user", foreignKey: "created_by"});
  user.hasMany(purchase_order, { as: "purchase_orders", foreignKey: "created_by"});
  sale.belongsTo(user, { as: "user", foreignKey: "user_id"});
  user.hasMany(sale, { as: "sales", foreignKey: "user_id"});
  stock_adjustment.belongsTo(user, { as: "user", foreignKey: "user_id"});
  user.hasMany(stock_adjustment, { as: "stock_adjustments", foreignKey: "user_id"});
  stock_movement.belongsTo(user, { as: "user", foreignKey: "user_id"});
  user.hasMany(stock_movement, { as: "stock_movements", foreignKey: "user_id"});
  user.belongsTo(user_role, { as: "role", foreignKey: "role_id"});
  user_role.hasMany(user, { as: "users", foreignKey: "role_id"});
  user.belongsTo(user_status, { as: "user_status", foreignKey: "user_status_id"});
  user_status.hasMany(user, { as: "users", foreignKey: "user_status_id"});

  return {
    category,
    customer,
    grn,
    grn_item,
    grn_status,
    item,
    item_status,
    movement_type,
    po_status,
    purchase_order,
    purchase_order_item,
    sale,
    sale_item,
    stock_adjustment,
    stock_movement,
    supplier,
    supplier_status,
    user,
    user_role,
    user_status,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
