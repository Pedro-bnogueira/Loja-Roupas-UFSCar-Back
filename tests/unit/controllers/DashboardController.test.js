// Configuração dos mocks
jest.mock("../../../src/config/database", () =>
    require("../../mocks/database")
);
jest.mock("../../../src/models/TransactionHistory", () =>
    require("../../mocks/TransactionHistory")
);
jest.mock("../../../src/models/User", () => require("../../mocks/User"));
jest.mock("../../../src/models/Product", () => require("../../mocks/Product"));
jest.mock("../../../src/models/Stock", () => require("../../mocks/Stock"));
jest.mock("../../../src/models/Category", () =>
    require("../../mocks/Category")
);

const {
    getDashboardStats,
} = require("../../../src/controllers/DashboardController");
const sequelize = require("../../../src/config/database");
const TransactionHistory = require("../../../src/models/TransactionHistory");
const User = require("../../../src/models/User");
const Stock = require("../../../src/models/Stock");
const mockDate = require('mockdate');

describe("DashboardController - getDashboardStats", () => {
    let req, res, mockTransaction;

    beforeEach(() => {
        // Definir data fixa para todos os new Date()
        mockDate.set(new Date('2023-01-15T00:00:00Z'));
    
        // Configurar mocks de transação
        mockTransaction = {
            commit: jest.fn().mockResolvedValue(),
            rollback: jest.fn().mockResolvedValue(),
        };
        sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction));
    
        // Configurar mocks padrão para os modelos
        TransactionHistory.sum.mockImplementation((field, options) => {
            if (options.where.type === "out") return Promise.resolve(1000);
            if (options.where.type === "in") return Promise.resolve(500);
            return 0;
        });
    
        TransactionHistory.count.mockImplementation(({ where }) => {
            if (where.type === "exchange_out") return Promise.resolve(2);
            if (where.type === "return") return Promise.resolve(3);
            return 0;
        });
    
        TransactionHistory.findOne.mockResolvedValue({
            dataValues: { totalSold: "10" },
            product: {
                get: jest.fn(() => ({
                    id: 101,
                    name: "Product A",
                    brand: "Brand A",
                    price: 100,
                    size: "M",
                    color: "Red",
                    categoryId: 5,
                })),
            },
        });
    
        TransactionHistory.findAll.mockResolvedValue([]);
        Stock.findAll.mockResolvedValue([{ categoryName: "Category 1", totalStock: 10 }]);
        User.findAll.mockResolvedValue([{ month: "2022-12", totalUsers: 5 }]);
        User.count.mockResolvedValue(50);
    
        req = { user: { id: 1, accessLevel: "admin" } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    });
    
    afterEach(() => {
        mockDate.reset();
        jest.clearAllMocks();
    });

    it("deve retornar 401 se o usuário não estiver autenticado", async () => {
        req.user = null;
        await getDashboardStats(req, res);
        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: "Sem token de autenticação",
        });
    });

    it("deve retornar 200 e estatísticas do dashboard com dados simulados (admin)", async () => {
        // Mocks para total de vendas e compras
        TransactionHistory.sum.mockImplementation((field, options) => {
            if (options.where.type === "out") {
                return Promise.resolve(1000);
            }
            if (options.where.type === "in") {
                return Promise.resolve(500);
            }
        });

        // Mocks para contagem de trocas e devoluções
        TransactionHistory.count.mockImplementation(({ where }) => {
            if (where.type === "exchange_out") return Promise.resolve(2);
            if (where.type === "return") return Promise.resolve(3);
        });

        // Mocks para o produto mais vendido (topProduct)
        TransactionHistory.findOne.mockResolvedValue({
            dataValues: { totalSold: "10" },
            Product: {
                get: jest.fn(() => ({
                    id: 101,
                    name: "Product A",
                    brand: "Brand A",
                    price: 100,
                    size: "M",
                    color: "Red",
                    categoryId: 5,
                })),
            },
        });
        // Mocks para os dados temporais (rawSales e rawPurchases)
        TransactionHistory.findAll.mockImplementation(() => Promise.resolve([]));

        // Mocks para o estoque por categoria
        const fakeInventory = [{ categoryName: "Category 1", totalStock: 10 }];
        Stock.findAll.mockResolvedValue(fakeInventory);
        // Mocks para os usuários ao longo do tempo
        User.findAll.mockResolvedValue([{ month: "2022-12", totalUsers: 5 }]);
        // Mocks para total de usuários (já que o usuário é admin)
        User.count.mockResolvedValue(50);

        await getDashboardStats(req, res);

        // Verifica se a transação foi comprometida com commit
        expect(mockTransaction.commit).toHaveBeenCalled();

        // Verifica status 200
        expect(res.status).toHaveBeenCalledWith(200);

        // Valida a resposta JSON
        const response = res.json.mock.calls[0][0];
        expect(response).toHaveProperty("totalSales", 1000);
        expect(response).toHaveProperty("totalPurchases", 500);
        expect(response).toHaveProperty("totalExchanges", 2);
        expect(response).toHaveProperty("totalReturns", 3);
        expect(response).toHaveProperty("topProduct");
        expect(response.topProduct).toMatchObject({
            id: 101,
            name: "Product A",
        });
        expect(response).toHaveProperty("salesOverTime");
        expect(Array.isArray(response.salesOverTime)).toBe(true);
        // Como definimos a data fixa e rawSales como array vazio, a série temporal terá 12 meses com total 0
        expect(response.salesOverTime.length).toBe(12);
        response.salesOverTime.forEach((item) => {
            expect(item.total).toBe(0);
        });
        expect(response).toHaveProperty("purchasesOverTime");
        expect(Array.isArray(response.purchasesOverTime)).toBe(true);
        response.purchasesOverTime.forEach((item) => {
            expect(item.total).toBe(0);
        });
        expect(response).toHaveProperty("totalUsers", 50);
        expect(response).toHaveProperty("formattedInventory");
        expect(response.formattedInventory).toEqual(fakeInventory);
        expect(response).toHaveProperty("usersOverTime");
        expect(response.usersOverTime).toEqual([
            { month: "2022-12", totalUsers: 5 },
        ]);
        expect(response).toHaveProperty("userRole", "admin");
    });

    it("deve retornar 500 e realizar rollback se ocorrer um erro", async () => {
        // Simula erro em uma das operações, por exemplo, totalSales
        TransactionHistory.sum.mockRejectedValue(new Error("Simulated error"));
        await getDashboardStats(req, res);
        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Erro interno do servidor.",
        });
    });
});
