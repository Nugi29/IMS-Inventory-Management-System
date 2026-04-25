const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('stock_movement', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'item',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    grn_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'grn',
        key: 'id'
      }
    },
    sale_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'sale',
        key: 'id'
      }
    },
    stock_adjustment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'stock_adjustment',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'user',
        key: 'id'
      }
    },
    movement_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'movement_type',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'stock_movement',
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
        name: "item_id",
        using: "BTREE",
        fields: [
          { name: "item_id" },
        ]
      },
      {
        name: "grn_id",
        using: "BTREE",
        fields: [
          { name: "grn_id" },
        ]
      },
      {
        name: "sale_id",
        using: "BTREE",
        fields: [
          { name: "sale_id" },
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
        name: "fk_stock_movement_movement_type1_idx",
        using: "BTREE",
        fields: [
          { name: "movement_type_id" },
        ]
      },
      {
        name: "fk_stock_movement_stock_adjustment1_idx",
        using: "BTREE",
        fields: [
          { name: "stock_adjustment_id" },
        ]
      },
    ]
  });
};
