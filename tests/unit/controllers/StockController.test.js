// Configuração dos mocks
jest.mock("../../../src/config/database", () => require("../../mocks/database"));
jest.mock("../../../src/models/TransactionHistory", () => require("../../mocks/TransactionHistory"));
jest.mock("../../../src/models/Product", () => require("../../mocks/Product"));
jest.mock("../../../src/models/Stock", () => require("../../mocks/Stock"));
jest.mock("../../../src/models/Category", () => require("../../mocks/Category"));
jest.mock("../../../src/models/User", () => require("../../mocks/User"));

// Importações
const {
    registerStockMovement,
    getStock,
    updateStockQuantity,
    getTransactionHistory,
} = require("../../../src/controllers/StockController");
const sequelize = require("../../../src/config/database");
const TransactionHistory = require("../../../src/models/TransactionHistory");
const Product = require("../../../src/models/Product");
const Stock = require("../../../src/models/Stock");
const User = require("../../../src/models/User");

describe("StockController", () => {
    let req, res, mockTransaction;

    // Configuração comum para todos os testes
    beforeEach(() => {
        // Mock da transação
        mockTransaction = {
            commit: jest.fn(() => Promise.resolve()),
            rollback: jest.fn(() => Promise.resolve()),
        };
        sequelize.transaction = jest.fn(() => Promise.resolve(mockTransaction));

        // Configuração padrão de req e res
        req = { body: {}, params: {}, user: { id: 1 } }; // Usuário autenticado por padrão
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        // Resetar todos os mocks
        jest.clearAllMocks();
    });

    // Testes para registerStockMovement
    describe("registerStockMovement", () => {
        const basePayload = {
            productId: 1,
            quantity: 10,
            type: "in",
            transactionPrice: 200,
            supplierOrBuyer: "Fornecedor X",
        };

        // Testes de validação
        it("deve retornar 400 se algum campo obrigatório estiver faltando", async () => {
            req.body = { ...basePayload, supplierOrBuyer: undefined }; // Campo obrigatório faltando
            await registerStockMovement(req, res);
            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Todos os campos são obrigatórios.",
            });
        });

        it("deve retornar 400 se o tipo de transação for inválido", async () => {
            req.body = { ...basePayload, type: "invalid" }; // Tipo inválido
            await registerStockMovement(req, res);
            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Tipo de transação inválido. Deve ser "in" ou "out".',
            });
        });

        it("deve retornar 401 se o usuário não estiver autenticado", async () => {
            req.user = null; // Usuário não autenticado
            req.body = basePayload;
            await registerStockMovement(req, res);
            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: "Usuário não autenticado.",
            });
        });

        it("deve retornar 404 se o produto não for encontrado", async () => {
            req.body = basePayload;
            Product.findByPk.mockResolvedValue(null); // Produto não encontrado
            await registerStockMovement(req, res);
            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: "Produto não encontrado.",
            });
        });

        // Testes para operação de entrada (in)
        describe("Operação de Entrada (in)", () => {
            it("deve criar novo registro de stock quando não existir", async () => {
                req.body = basePayload;
              
                // Agora 'mockProduct' não tem 'quantity'
                const mockProduct = { id: 1, alertThreshold: 5 };
                Product.findByPk.mockResolvedValue(mockProduct);
              
                // Stock.findOne -> null
                Stock.findOne.mockResolvedValue(null);
              
                // Stock.create deve retornar um novo objeto
                Stock.create.mockResolvedValue({
                  productId: 1,
                  quantity: 10,
                  operationType: "in",
                  save: jest.fn().mockResolvedValue(true),
                });
              
                // TransactionHistory
                TransactionHistory.create.mockResolvedValue({ id: 1 });
              
                await registerStockMovement(req, res);
              
                // Retiramos as verificações de product.quantity
                // Verificamos se Stock.create foi chamado
                expect(Stock.create).toHaveBeenCalledWith({
                  productId: 1,
                  quantity: 10,
                  operationType: "in",
                }, { transaction: mockTransaction });
              
                // E se a transação foi comitada
                expect(mockTransaction.commit).toHaveBeenCalled();
                expect(res.status).toHaveBeenCalledWith(201);
              });
              

            it("deve atualizar registro existente de stock", async () => {
                req.body = basePayload;
                const mockProduct = {
                    id: 1,
                    quantity: 5,
                    save: jest.fn().mockResolvedValue(true),
                };
                const mockStock = {
                    quantity: 8,
                    operationType: "in",
                    save: jest.fn().mockResolvedValue(true),
                };
                Product.findByPk.mockResolvedValue(mockProduct);
                Stock.findOne.mockResolvedValue(mockStock);

                await registerStockMovement(req, res);

                expect(mockStock.quantity).toBe(18); // 8 + 10
                expect(mockStock.save).toHaveBeenCalled();
            });
        });

        // Testes para operação de saída (out)
        describe("Operação de Saída (out)", () => {
            it("deve retornar 400 se o estoque for insuficiente", async () => {
                req.body = { ...basePayload, type: "out", quantity: 20 };
                const mockProduct = {
                    id: 1,
                    quantity: 15,
                    save: jest.fn().mockResolvedValue(true),
                };
                Product.findByPk.mockResolvedValue(mockProduct);

                await registerStockMovement(req, res);

                expect(mockTransaction.rollback).toHaveBeenCalled();
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith({
                    message: "Estoque insuficiente para a operação.",
                });
            });

            it("deve atualizar stock corretamente com estoque suficiente", async () => {
                req.body = { ...basePayload, type: "out", quantity: 5 };
              
                const mockProduct = { id: 1, alertThreshold: 3 };
                Product.findByPk.mockResolvedValue(mockProduct);
              
                const mockStock = {
                  quantity: 8,
                  operationType: "in",
                  save: jest.fn().mockResolvedValue(true),
                };
                Stock.findOne.mockResolvedValue(mockStock);
              
                TransactionHistory.create.mockResolvedValue({ id: 999 });
              
                await registerStockMovement(req, res);
              
                // Em vez de mockProduct.quantity -> 5, verificamos stockEntry
                expect(mockStock.quantity).toBe(3); // 8 - 5
                expect(mockStock.save).toHaveBeenCalled();
                expect(TransactionHistory.create).toHaveBeenCalled();
                expect(mockTransaction.commit).toHaveBeenCalled();
                expect(res.status).toHaveBeenCalledWith(201);
              });
              
        });

        // Teste de erro interno
        it("deve retornar 500 e realizar rollback em caso de erro", async () => {
            req.body = basePayload;
            Product.findByPk.mockRejectedValue(new Error("Database error"));
            await registerStockMovement(req, res);
            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Erro interno do servidor.",
            });
        });
    });

    // Testes para getStock
    describe("getStock", () => {
        it("deve retornar a lista de estoque com sucesso", async () => {
            const stockData = [
              {
                id: 1,           // db primary key
                productId: 1,
                quantity: 20,
                Product: {
                  id: 1,
                  name: "Produto A",
                  brand: "Marca A",
                  price: 100,
                  size: "M",
                  color: "Azul",
                  alertThreshold: 5,
                },
              },
            ];
          
            // Mock
            Stock.findAll.mockResolvedValue(stockData);
          
            await getStock(req, res);
          
            // Ajuste se for usar "stockId: stock.id" no controller
            expect(res.json).toHaveBeenCalledWith({
              stock: [
                {
                  stockId: 1,         //  <-- não "id"
                  productId: 1,
                  quantity: 20,
                  product: {
                    id: 1,
                    name: "Produto A",
                    brand: "Marca A",
                    price: 100,
                    size: "M",
                    color: "Azul",
                    alertThreshold: 5,
                  },
                },
              ],
            });
          });
          

        it("deve retornar 500 em caso de erro", async () => {
            Stock.findAll.mockRejectedValue(new Error("Database error"));
            await getStock(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Erro interno do servidor.",
            });
        });
    });

    // Testes para updateStockQuantity
    describe("updateStockQuantity", () => {
        it("deve retornar 400 se a quantidade for inválida", async () => {
            req.params = { id: 1 };
            req.body = { quantity: -5 }; // Quantidade inválida
            await updateStockQuantity(req, res);
            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Quantidade inválida. Deve ser um número maior ou igual a zero.",
            });
        });

        it("deve retornar 404 se a entrada de estoque não for encontrada", async () => {
            req.params = { id: 1 };
            req.body = { quantity: 10 };
            Stock.findOne.mockResolvedValue(null); // Estoque não encontrado
            await updateStockQuantity(req, res);
            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: "Entrada de estoque não encontrada.",
            });
        });

        it("deve atualizar a quantidade do estoque com sucesso", async () => {
            req.params = { id: 1 };
            req.body = { quantity: 30 };
            const mockStock = {
                productId: 1,
                quantity: 20,
                save: jest.fn().mockResolvedValue(true),
            };
            Stock.findOne.mockResolvedValue(mockStock);
            await updateStockQuantity(req, res);
            expect(mockStock.quantity).toBe(30);
            expect(mockStock.save).toHaveBeenCalled();
            expect(mockTransaction.commit).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                message: "Quantidade do estoque atualizada com sucesso!",
                updatedStock: mockStock,
            });
        });
    });

    // Testes para getTransactionHistory
    describe("getTransactionHistory", () => {
        it("deve retornar o histórico de transações com sucesso", async () => {
            const transactions = [
                {
                    id: 1,
                    productId: 1,
                    transactionDate: new Date("2023-01-10"),
                    product: {
                        id: 1,
                        name: "Produto A",
                        brand: "Marca A",
                        price: 100,
                        size: "M",
                        color: "Azul",
                    },
                    user: { id: 1, name: "User A", email: "usera@example.com" },
                },
            ];
            TransactionHistory.findAll.mockResolvedValue(transactions);
            await getTransactionHistory(req, res);
            expect(TransactionHistory.findAll).toHaveBeenCalledWith({
                include: [
                    {
                        model: Product,
                        as: "Product",
                        attributes: ["id", "name", "brand", "price", "size", "color"],
                    },
                    {
                        model: User,
                        as: "user",
                        attributes: ["id", "name", "email"],
                    },
                ],
                order: [["transactionDate", "DESC"]],
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ transactions });
        });

        it("deve retornar 500 em caso de erro", async () => {
            TransactionHistory.findAll.mockRejectedValue(new Error("Database error"));
            await getTransactionHistory(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Erro interno do servidor.",
            });
        });
    });
});