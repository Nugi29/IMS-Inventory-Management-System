const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('item', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: "barcode"
    },
    selling_price: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    reorder_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 10
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'category',
        key: 'id'
      }
    },
    supplier_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'supplier',
        key: 'id'
      }
    },
    item_status_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'item_status',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'item',
    hasTrigger: true,
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "barcode",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "code" },
        ]
      },
      {
        name: "category_id",
        using: "BTREE",
        fields: [
          { name: "category_id" },
        ]
      },
      {
        name: "supplier_id",
        using: "BTREE",
        fields: [
          { name: "supplier_id" },
        ]
      },
      {
        name: "fk_item_item_status1_idx",
        using: "BTREE",
        fields: [
          { name: "item_status_id" },
        ]
      },
    ]
  });
};
