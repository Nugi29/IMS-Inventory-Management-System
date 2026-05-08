const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('supplier', {
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
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    supplier_status_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'supplier_status',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'supplier',
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
        name: "fk_supplier_supplier_status1_idx",
        using: "BTREE",
        fields: [
          { name: "supplier_status_id" },
        ]
      },
    ]
  });
};
