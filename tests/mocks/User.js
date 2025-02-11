// tests/mocks/User.js
const SequelizeMock = require("sequelize-mock");
const dbMock = new SequelizeMock();

// Define o modelo com dados iniciais
const User = dbMock.define("User", {
    id: 1,
    email: "usuarioTeste@example.com",
    password: "hashedPassword",
    accessLevel: "admin",
});

// Sobrescreve o método findOne para permitir o uso de .mockResolvedValue()
User.findOne = jest.fn();

module.exports = {
    User,
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
};
