const sequelize = require('../src/config/database');

beforeAll(async () => {
  // Sincroniza todos os modelos com o banco de dados em memória
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});
