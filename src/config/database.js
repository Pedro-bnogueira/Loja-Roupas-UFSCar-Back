const { Sequelize } = require('sequelize');
require('dotenv').config({ path: "./.env" });

let sequelize;

if (process.env.NODE_ENV === 'test') {
  // Em ambiente de teste, usa SQLite em memória
  sequelize = new Sequelize('sqlite::memory:', {
    logging: false, // Desativa logs para testes
    define: {
      timestamps: false,
    },
  });
} else {
  // Configuração padrão para outros ambientes (ex.: development, production)
  sequelize = new Sequelize(
    process.env.DB_NAME,     // Nome do banco de dados
    process.env.DB_USER,     // Usuário do banco de dados
    process.env.DB_PASSWORD, // Senha do banco de dados
    {
      host: process.env.DB_HOST, // Host do banco de dados
      dialect: 'mysql',          // Por exemplo, MySQL
      define: {
        timestamps: false, // Desativa automaticamente os campos createdAt e updatedAt
      },
    }
  );
}

// Testa a conexão em ambientes não de teste
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await sequelize.authenticate();
      console.log('Conexão com o banco de dados estabelecida com sucesso.');
    } catch (error) {
      console.error('Não foi possível conectar ao banco de dados:', error);
    }
  })();
}

module.exports = sequelize;
