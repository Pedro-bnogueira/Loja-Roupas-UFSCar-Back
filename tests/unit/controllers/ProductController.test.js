// Mock das dependências
jest.mock("../../../src/models/Product", () => ({
    belongsTo: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    destroy: jest.fn(),
}));

jest.mock("../../../src/models/Category", () => ({
    findOne: jest.fn(),
    hasMany: jest.fn(),
}));

const {
    createProduct,
    getProducts,
    updateProduct,
    deleteProduct,
} = require("../../../src/controllers/ProductController");
const Product = require("../../../src/models/Product");
const Category = require("../../../src/models/Category");

describe("ProductController", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe("createProduct", () => {
        it("deve retornar 400 se dados obrigatórios estiverem faltando", async () => {
            req.body = { name: "Produto Teste" };
            await createProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message:
                    "Dados insuficientes. É necessário fornecer nome, preço, tamanho e cor.",
            });
        });

        it("deve retornar 404 se categoria não existir", async () => {
            req.body = {
                name: "Produto Teste",
                price: 100,
                size: "M",
                color: "Azul",
                category: "Inexistente",
            };
            Category.findOne.mockResolvedValue(null);

            await createProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: "Categoria não encontrada.",
            });
        });

        it("deve criar produto com sucesso", async () => {
            const mockCategory = { id: 1, name: "Camisetas" };
            const mockProduct = {
                id: 1,
                name: "Produto Teste",
                categoryId: 1,
                toJSON: () => ({ ...mockProduct, category: mockCategory }),
            };

            req.body = {
                name: "Produto Teste",
                price: 100,
                size: "M",
                color: "Azul",
                category: "Camisetas",
            };

            Category.findOne.mockResolvedValue(mockCategory);
            Product.create.mockResolvedValue(mockProduct);
            Product.findByPk.mockResolvedValue({
                ...mockProduct,
                category: mockCategory,
            });

            await createProduct(req, res);

            expect(Product.create).toHaveBeenCalledWith({
                name: "Produto Teste",
                brand: "",
                price: 100,
                size: "M",
                color: "Azul",
                categoryId: 1,
                alertThreshold: 10,
            });
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe("getProducts", () => {
        it("deve retornar lista de produtos com sucesso", async () => {
            const mockProducts = [{ id: 1, name: "Produto Teste" }];
            Product.findAll.mockResolvedValue(mockProducts);

            await getProducts(req, res);

            expect(Product.findAll).toHaveBeenCalledWith({
                include: [{ model: Category, as: "category" }],
            });
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe("updateProduct", () => {
        it("deve retornar 404 se produto não existir", async () => {
            req.params = { id: 999 };
            Product.findByPk.mockResolvedValue(null);

            await updateProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: "Produto não encontrado.",
            });
        });

        it("deve retornar 404 se nova categoria não existir", async () => {
            const mockProduct = { id: 1, categoryId: 1 };
            req.params = { id: 1 };
            req.body = { category: "Nova Categoria" };

            Product.findByPk.mockResolvedValue(mockProduct);
            Category.findOne.mockResolvedValue(null);

            await updateProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: "Categoria não encontrada.",
            });
        });

        it("deve atualizar produto com sucesso", async () => {
            const mockCategory = { id: 2, name: "Novas Categorias" };
            const mockProduct = {
                id: 1,
                name: "Produto Antigo",
                categoryId: 1,
                save: jest.fn().mockResolvedValue(true),
            };

            req.params = { id: 1 };
            req.body = {
                name: "Produto Atualizado",
                category: "Novas Categorias",
            };

            // Configure o mock para retornar o mesmo objeto atualizado em todas as chamadas
            Product.findByPk.mockResolvedValue(mockProduct);
            Category.findOne.mockResolvedValue(mockCategory);

            await updateProduct(req, res);

            expect(mockProduct.name).toBe("Produto Atualizado");
            expect(mockProduct.categoryId).toBe(2);
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe("deleteProduct", () => {
        it("deve retornar 404 se produto não existir", async () => {
            req.params = { id: 999 };
            Product.findByPk.mockResolvedValue(null);

            await deleteProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("deve deletar produto com sucesso", async () => {
            const mockProduct = {
                id: 1,
                destroy: jest.fn().mockResolvedValue(true),
            };
            Product.findByPk.mockResolvedValue(mockProduct);

            await deleteProduct(req, res);

            expect(mockProduct.destroy).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });
});
