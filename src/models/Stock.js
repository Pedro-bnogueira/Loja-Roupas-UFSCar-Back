const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Product = require('./Product');

const Stock = sequelize.define('Stock',
  {
    productId: {
      type: DataTypes.INTEGER,
      references: {
        model: Product,
        key: 'id',
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      // Pode ser 'entrada' ou 'saída'
    },
    operationType: {
      type: DataTypes.ENUM('entrada', 'saida'),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
    },
    alertThreshold: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'Stock',
  }
);

Stock.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'product',
});

module.exports = Stock;