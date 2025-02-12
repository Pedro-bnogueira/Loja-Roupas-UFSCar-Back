const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Product = require('./Product');
const User = require('./User'); 

const ReturnExchange = sequelize.define('ReturnExchange',
  {
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      // Pode ser 'troca' ou 'devolução'
    },
    reason: {
      type: DataTypes.TEXT,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pendente', // Status pode ser 'pendente', 'aprovado', 'rejeitado'
    },
  },
  {
    tableName: 'return_exchange',
  }
);

// Relacionamento: Cada troca ou devolução é associada a um produto e a um usuário
ReturnExchange.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'product',
});

ReturnExchange.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

module.exports = ReturnExchange;
