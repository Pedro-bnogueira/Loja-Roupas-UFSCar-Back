const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Product = require('./Product');
const User = require('./User'); // Supondo que você tenha um modelo User para os usuários

const TransactionHistory = sequelize.define('TransactionHistory',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      references: {
        model: Product,
        key: 'id',
      },
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('in', 'out', 'return'),
      allowNull: false,
    },
    supplierOrBuyer: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    transactionPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    transactionDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    isReturned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // False para transações normais
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: 'id',
      },
      allowNull: false,
    },
  },
  {
    tableName: 'transaction_history',
    timestamps: true, // Para createdAt e updatedAt
  }
);

// Configurar associação com o modelo Product
TransactionHistory.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'product',
});

// Configurar associação com o modelo User
TransactionHistory.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

module.exports = TransactionHistory;
