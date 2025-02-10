const SequelizeMock = require("sequelize-mock");
const sequelize = new SequelizeMock();

// Impede que o código de autenticação real seja chamado nos testes
sequelize.authenticate = jest.fn().mockResolvedValue();

// Mock explícito para o método transaction
sequelize.transaction = jest.fn().mockImplementation(() => {
    return Promise.resolve({
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
    });
});

// Mocks para as funções auxiliares do Sequelize
sequelize.col = jest.fn((colName) => colName);
sequelize.fn = jest.fn((fnName, col) => `${fnName}(${col})`);
sequelize.literal = jest.fn((value) => value);

module.exports = sequelize;
