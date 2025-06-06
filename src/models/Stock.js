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
    operationType: {
      type: DataTypes.ENUM('in', 'out'),
      allowNull: false,
    },
  },
  {
    tableName: 'stock',
  }
);

Stock.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'Product',
});

module.exports = Stock;
