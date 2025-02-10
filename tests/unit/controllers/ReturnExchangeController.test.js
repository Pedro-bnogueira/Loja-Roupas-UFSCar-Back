jest.mock("../../../src/config/database", () => require("../../mocks/database"));
jest.mock("../../../src/models/TransactionHistory", () => require("../../mocks/TransactionHistory"));
jest.mock("../../../src/models/Product", () => require("../../mocks/Product"));
jest.mock("../../../src/models/Stock", () => require("../../mocks/Stock"));
jest.mock("../../../src/models/Category", () => require("../../mocks/Category"));
jest.mock("../../../src/models/User", () => require("../../mocks/User"));

const { registerReturn, registerExchange } = require("../../../src/controllers/ReturnExchangeController");
const sequelize = require("../../../src/config/database");
const TransactionHistory = require("../../../src/models/TransactionHistory");
const Product = require("../../../src/models/Product");
const Stock = require("../../../src/models/Stock");
const User = require("../../../src/models/User");
const mockDate = require("mockdate");

describe("ReturnExchangeController", () => {
  let req, res, mockTransaction;

  beforeEach(() => {
    jest.resetModules();
    mockDate.set(new Date("2023-01-15T00:00:00Z"));

    // Configurar mock da transação
    mockTransaction = {
      commit: jest.fn(() => Promise.resolve()),
      rollback: jest.fn(() => Promise.resolve()),
    };
    sequelize.transaction = jest.fn(() => Promise.resolve(mockTransaction));

    req = { body: {}, user: { id: 1 } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    // Limpa o histórico dos mocks que serão configurados
    TransactionHistory.create.mockClear();
  });

  afterEach(() => {
    mockDate.reset();
  });

  describe("registerReturn", () => {
    it("deve retornar 400 se transactionId não for informado", async () => {
      req.body = {};
      await registerReturn(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "ID da transação é obrigatório." });
    });

    it("deve retornar 401 se usuário não estiver autenticado", async () => {
      req.body = { transactionId: 1 };
      req.user = null;
      await registerReturn(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Usuário não autenticado." });
    });

    it("deve retornar 404 se a transação original não for encontrada", async () => {
      req.body = { transactionId: 1 };
      TransactionHistory.findByPk.mockResolvedValue(null);
      await registerReturn(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Transação não encontrada." });
    });

    it("deve registrar devolução com sucesso", async () => {
      const originalTransaction = {
        id: 1,
        productId: 10,
        quantity: 2,
        transactionPrice: "50.00",
        supplierOrBuyer: "Fornecedor X",
        isReturned: false,
        save: jest.fn().mockResolvedValue(true),
      };
      req.body = { transactionId: 1 };
      TransactionHistory.findByPk.mockResolvedValue(originalTransaction);
      Product.findByPk.mockResolvedValue({ id: 10 });
      const stockEntry = {
        id: 1,
        productId: 10,
        quantity: 5,
        save: jest.fn().mockResolvedValue(true),
      };
      Stock.findOne.mockResolvedValue(stockEntry);
      const newTransaction = { id: 99, type: "return" };
      TransactionHistory.create.mockResolvedValue(newTransaction);

      await registerReturn(req, res);

      expect(originalTransaction.save).toHaveBeenCalled();
      expect(stockEntry.save).toHaveBeenCalled();
      expect(TransactionHistory.create).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Devolução registrada com sucesso!",
        transactionHistory: newTransaction,
      });
    });

    it("deve retornar 500 e realizar rollback se ocorrer um erro", async () => {
      req.body = { transactionId: 1 };
      TransactionHistory.findByPk.mockRejectedValue(new Error("Simulated error"));
      await registerReturn(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Erro interno do servidor." });
    });
  });

  describe("registerExchange", () => {
    it("deve retornar 400 se transactionId ou newProducts estiverem faltando", async () => {
      req.body = { transactionId: 1, newProducts: [] };
      await registerExchange(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "transactionId e newProducts são obrigatórios." });
    });

    it("deve retornar 401 se usuário não estiver autenticado", async () => {
      req.body = { transactionId: 1, newProducts: [{ productId: 10, quantity: 1 }] };
      req.user = null;
      await registerExchange(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Usuário não autenticado." });
    });

    it("deve retornar 404 se a transação original não for encontrada", async () => {
      req.body = { transactionId: 1, newProducts: [{ productId: 10, quantity: 1 }] };
      TransactionHistory.findByPk.mockResolvedValue(null);
      await registerExchange(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Transação original não encontrada." });
    });

    it("deve retornar 400 se a transação original não for de saída", async () => {
      const originalTransaction = {
        id: 1,
        type: "in", // não é "out"
        isReturned: false,
        save: jest.fn().mockResolvedValue(true),
      };
      req.body = { transactionId: 1, newProducts: [{ productId: 10, quantity: 1 }] };
      TransactionHistory.findByPk.mockResolvedValue(originalTransaction);
      await registerExchange(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Apenas transações de saída podem ser trocadas." });
    });

    it("deve retornar 400 se a transação original já foi devolvida/trocada", async () => {
      const originalTransaction = {
        id: 1,
        type: "out",
        isReturned: true,
        save: jest.fn().mockResolvedValue(true),
      };
      req.body = { transactionId: 1, newProducts: [{ productId: 10, quantity: 1 }] };
      TransactionHistory.findByPk.mockResolvedValue(originalTransaction);
      await registerExchange(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Esta transação já foi devolvida/trocada." });
    });

    it("deve retornar 404 se algum novo produto não for encontrado", async () => {
      const originalTransaction = {
        id: 1,
        type: "out",
        isReturned: false,
        productId: 20,
        transactionPrice: "100.00",
        quantity: 2,
        supplierOrBuyer: "Fornecedor X",
        save: jest.fn().mockResolvedValue(true),
      };
      req.body = { transactionId: 1, newProducts: [{ productId: 10, quantity: 1 }] };
      TransactionHistory.findByPk.mockResolvedValue(originalTransaction);
      Product.findByPk.mockResolvedValue(null);
      await registerExchange(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Produto com ID 10 não encontrado." });
    });

    it("deve retornar 400 se o valor total dos novos produtos for diferente do valor original", async () => {
      // Transação original com valor total 100.00
      const originalTransaction = {
        id: 1,
        type: "out",
        isReturned: false,
        productId: 20,
        transactionPrice: "100.00",
        quantity: 2,
        supplierOrBuyer: "Fornecedor X",
        save: jest.fn().mockResolvedValue(true),
      };
      req.body = { transactionId: 1, newProducts: [{ productId: 10, quantity: 1 }] };
      TransactionHistory.findByPk.mockResolvedValue(originalTransaction);
      Product.findByPk.mockResolvedValue({ id: 10, price: 30 });
      await registerExchange(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "A soma total dos novos produtos deve ser igual ao valor da transação original." });
    });

    it("deve retornar 400 se o estoque for insuficiente para algum novo produto", async () => {
      // Transação original com valor total 100.00
      const originalTransaction = {
        id: 1,
        type: "out",
        isReturned: false,
        productId: 20,
        transactionPrice: "100.00",
        quantity: 2,
        supplierOrBuyer: "Fornecedor X",
        save: jest.fn().mockResolvedValue(true),
      };
      req.body = { transactionId: 1, newProducts: [{ productId: 10, quantity: 2 }] };
      TransactionHistory.findByPk.mockResolvedValue(originalTransaction);
      Product.findByPk.mockResolvedValue({ id: 10, price: 50 });
      Stock.findOne.mockResolvedValue({ id: 1, productId: 10, quantity: 1, save: jest.fn().mockResolvedValue(true) });
      await registerExchange(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Estoque insuficiente para o produto ID 10." });
    });

    it("deve registrar troca com sucesso", async () => {
      // Transação original válida com tipo 'out'
      const originalTransaction = {
        id: 1,
        type: "out",
        isReturned: false,
        productId: 20,
        transactionPrice: "100.00",
        quantity: 2,
        supplierOrBuyer: "Fornecedor X",
        save: jest.fn().mockResolvedValue(true),
      };
      req.body = { 
        transactionId: 1, 
        newProducts: [{ productId: 10, quantity: 2 }]  // 2 * 50 = 100
      };
      TransactionHistory.findByPk.mockResolvedValue(originalTransaction);
      // Para o novo produto
      const newProduct = { id: 10, price: 50 };
      Product.findByPk.mockResolvedValue(newProduct);
      // Simule estoque suficiente para o novo produto (por exemplo, 5 em estoque)
      const stockEntryNew = { 
        id: 1, 
        productId: 10, 
        quantity: 5, 
        save: jest.fn().mockResolvedValue(true) 
      };
      // Para o estoque do produto original (para devolução)
      const stockEntryOrig = { 
        id: 2, 
        productId: 20, 
        quantity: 3, 
        save: jest.fn().mockResolvedValue(true) 
      };
      Stock.findOne
        .mockResolvedValueOnce(stockEntryNew)  // para o novo produto
        .mockResolvedValueOnce(stockEntryOrig); // para o produto original
      const exchangeOutTransaction = { id: 101, type: "exchange_out" };
      const exchangeInTransaction = { id: 102, type: "exchange_in" };
      TransactionHistory.create.mockClear();
      TransactionHistory.create
          .mockResolvedValueOnce(exchangeOutTransaction)
          .mockResolvedValueOnce(exchangeInTransaction);
      User.count.mockResolvedValue(50);
      User.findAll.mockResolvedValue([{ month: "2022-12", totalUsers: "5" }]);

      await registerExchange(req, res);

      expect(originalTransaction.save).toHaveBeenCalled();
      expect(stockEntryNew.save).toHaveBeenCalled();
      // Se o fluxo correto é criar 2 transações, ajuste a expectativa para 2.
      expect(TransactionHistory.create).toHaveBeenCalledTimes(2);
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty("message", "Troca registrada com sucesso!");
      expect(response).toHaveProperty("transactions");
      expect(Array.isArray(response.transactions)).toBe(true);
      expect(response.transactions).toEqual([exchangeOutTransaction, exchangeInTransaction]);
    });

    it("deve retornar 500 e realizar rollback se ocorrer um erro", async () => {
      req.body = { transactionId: 1, newProducts: [{ productId: 10, quantity: 2 }] };
      TransactionHistory.findByPk.mockRejectedValue(new Error("Simulated error"));
      await registerExchange(req, res);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Erro interno do servidor." });
    });
  });
});
