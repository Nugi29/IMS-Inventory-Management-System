const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('grn', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    supplier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'supplier',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id'
      }
    },
    grn_date: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    },
    total_amount: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: true
    },
    purchase_order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'purchase_order',
        key: 'id'
      }
    },
    grn_status_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'grn_status',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'grn',
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
        name: "supplier_id",
        using: "BTREE",
        fields: [
          { name: "supplier_id" },
        ]
      },
      {
        name: "user_id",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
      {
        name: "fk_grn_purchase_order1_idx",
        using: "BTREE",
        fields: [
          { name: "purchase_order_id" },
        ]
      },
      {
        name: "fk_grn_po_status1_idx",
        using: "BTREE",
        fields: [
          { name: "grn_status_id" },
        ]
      },
    ]
  });
};
