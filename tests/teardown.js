const sequelize = require('../src/config/database');

module.exports = async () => {
  await sequelize.close();
};
