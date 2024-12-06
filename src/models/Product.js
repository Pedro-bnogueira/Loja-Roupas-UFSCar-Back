const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Category = require('./Category'); // Relacionamento com a categoria

const Product = sequelize.define('Product',
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    size: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    stockQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: 'Product',
  }
);

// Relacionamento: Um produto pertence a uma categoria
Product.belongsTo(Category, {
  foreignKey: 'categoryId',
  as: 'category',
});

module.exports = Product;
