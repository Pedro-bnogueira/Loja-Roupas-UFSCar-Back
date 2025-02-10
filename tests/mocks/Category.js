// Cria um mock simples para Category com o método hasMany definido
module.exports = {
    // Métodos utilizados nos controllers
    findOne: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    // Métodos para associações
    hasMany: jest.fn(),
};
