const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Importa a conexão centralizada

/**
 * Define o modelo ActiveSession.
 * 
 * @typedef {object} ActiveSession
 * @property {string} user - Email do usuário.
 * @property {string} session - Token de sessão.
 * @property {Date} expiresat - Data de expiração da sessão.
 */
const ActiveSession = sequelize.define('ActiveSession', {
  user: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Supondo que cada usuário pode ter apenas uma sessão ativa
    validate: {
      isEmail: true,
    },
  },
  session: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expiresat: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  // Configurações do modelo
  tableName: 'active_sessions', // Nome real da tabela no banco de dados
  timestamps: false,   // Desativa os campos createdAt e updatedAt
  },);

module.exports = ActiveSession;