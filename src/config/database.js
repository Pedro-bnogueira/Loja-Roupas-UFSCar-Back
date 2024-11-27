const { Sequelize } = require('sequelize');
require("dotenv").config({ path: "./.env" }); // Carrega as variáveis de ambiente

// Inicializa a conexão Sequelize usando variáveis de ambiente para segurança
const sequelize = new Sequelize(
  process.env.DB_NAME,     // Nome do banco de dados
  process.env.DB_USER,     // Usuário do banco de dados
  process.env.DB_PASSWORD, // Senha do banco de dados
  {
    host: process.env.DB_HOST, // Host do banco de dados
    dialect: 'mysql',          // Dialeto do Sequelize para MySQL
    define: {
      timestamps: false, // Desativa automaticamente os campos createdAt e updatedAt
    },
  }
);

// Testa a conexão com o banco de dados
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com o MySQL estabelecida com sucesso.');
  } catch (error) {
    console.error('Não foi possível conectar ao MySQL:', error);
  }
})();

module.exports = sequelize;
