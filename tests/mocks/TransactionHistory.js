module.exports = {
    sum: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]), // valor padrão: array vazio
    create: jest.fn(),
    findByPk: jest.fn(),
};
