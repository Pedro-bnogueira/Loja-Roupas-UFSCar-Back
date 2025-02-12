const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Category = require('./Category'); // Relacionamento com a categoria

const Product = sequelize.define('Product',
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    brand: {
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
    alertThreshold: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 5 // Valor padrão
    }
  },
  {
    tableName: 'Product',
  }
);

// Definir a associação: Uma categoria tem muitos produtos
Category.hasMany(Product, { as: 'products', foreignKey: 'categoryId' });

// Relacionamento: Um produto pertence a uma categoria
Product.belongsTo(Category, {
  foreignKey: 'categoryId',
  as: 'category',
});

module.exports = Product;
