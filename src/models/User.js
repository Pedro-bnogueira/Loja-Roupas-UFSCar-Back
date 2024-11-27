const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Importa a conexão centralizada
const bcrypt = require('bcrypt'); // Importa o bcrypt para hash de senhas

// 
//  Define o modelo User (Usuário).
//   
//  @typedef {object} User
//  @property {string} name - Nome do usuário.
//  @property {string} email - Email do usuário.
//  @property {string} password - Senha do usuário (hash).
//  @property {string} accessLevel - Nível de acesso do usuário.
//  
const User = sequelize.define('User', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [2, 100], // Valida que o nome tenha entre 2 e 100 caracteres
        },
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Garante unicidade do email
        validate: {
            isEmail: true, // Valida se o email é válido
        },
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [6, 100], // Valida que a senha tenha entre 6 e 100 caracteres
        },
    },
    accessLevel: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['admin', 'user', 'guest']], // Exemplo de níveis de acesso
        },
    },
}, {
    // Configurações do modelo
    tableName: 'users', // Nome real da tabela no banco de dados
    timestamps: false,   // Desativa os campos createdAt e updatedAt
    },
);



module.exports = User;
