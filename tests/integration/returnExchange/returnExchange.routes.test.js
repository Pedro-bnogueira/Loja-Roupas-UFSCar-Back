const request = require("supertest");
const app = require("../../../src/app");
const sequelize = require("../../../src/config/database");

// Models necessários
const User = require("../../../src/models/User");
const ActiveSession = require("../../../src/models/ActiveSession");
const Product = require("../../../src/models/Product");
const TransactionHistory = require("../../../src/models/TransactionHistory");
const Stock = require("../../../src/models/Stock");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

describe("Integration tests - Return/Exchange Routes", () => {
  let authCookie, testUser;

  beforeAll(async () => {
    // Sincroniza o banco (SQLite em memória, se estiver configurado assim)
    await sequelize.sync({ force: true });

    // Cria um usuário de teste (pode ser admin ou user, conforme a lógica)
    const password = "testpassword";
    const hashedPassword = await bcrypt.hash(password, 8);
    testUser = await User.create({
      name: "Test User",
      email: "testuser@example.com",
      password: hashedPassword,
      accessLevel: "user",
    });

    // Cria uma sessão ativa para esse usuário
    const token = jwt.sign({ id: testUser.id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "120m",
    });
    await ActiveSession.upsert({
      user: testUser.email,
      session: token,
      expiresat: new Date(Date.now() + 120 * 60 * 1000),
    });
    authCookie = `LojaRoupa=${token}`;
  });

  beforeEach(async () => {
    await TransactionHistory.destroy({ where: {} });
    await Stock.destroy({ where: {} }); 
    await Product.destroy({ where: {} }); 
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Garante que mocks não vazem entre testes
  });

  // Testes para POST /api/return/register
  describe("POST /api/return/register", () => {
    it("deve retornar 400 se transactionId não for informado", async () => {
      const res = await request(app)
        .post("/api/return/register")
        .set("Cookie", [authCookie])
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("ID da transação é obrigatório.");
    });

    it("deve retornar 401 se usuário não estiver autenticado", async () => {
      const res = await request(app)
        .post("/api/return/register")
        .send({ transactionId: 1 });
      expect(res.statusCode).toBe(401);
      // A mensagem pode vir do middleware de autenticação, por exemplo: "Sem token de autenticação."
    });

    it("deve retornar 404 se a transação original não for encontrada", async () => {
      const res = await request(app)
        .post("/api/return/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: 9999 });
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Transação não encontrada.");
    });

    it("deve registrar devolução com sucesso", async () => {
      // Cria um produto
      const product = await Product.create({
        name: "Produto Return",
        brand: "Marca X",
        price: 100,
        size: "M",
        color: "Vermelho",
        alertThreshold: 5,
      });

      // Cria uma transação original de saída (type "out") que ainda não foi devolvida
      const originalTx = await TransactionHistory.create({
        productId: product.id,
        type: "out",
        supplierOrBuyer: "Cliente A",
        quantity: 2,
        transactionPrice: "200.00",
        transactionDate: new Date(),
        userId: testUser.id,
        isReturned: false,
      });

      // Cria um registro de estoque para o produto (por exemplo, com 10 unidades)
      await Stock.create({
        productId: product.id,
        quantity: 10,
        operationType: "in",
      });

      const res = await request(app)
        .post("/api/return/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: originalTx.id });

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe("Devolução registrada com sucesso!");
      expect(res.body.transactionHistory).toHaveProperty("type", "return");

      // Verifica que a transação original foi marcada como devolvida
      const updatedOriginalTx = await TransactionHistory.findByPk(originalTx.id);
      expect(updatedOriginalTx.isReturned).toBe(true);

      // Verifica que o estoque foi atualizado (10 + 2 = 12)
      const stockEntry = await Stock.findOne({ where: { productId: product.id } });
      expect(stockEntry.quantity).toBe(12);
    });

    it("deve retornar 500 e realizar rollback se ocorrer um erro", async () => {
      // Força um erro simulando que o método findByPk falhe
      const originalFindByPk = TransactionHistory.findByPk;
      TransactionHistory.findByPk = jest.fn().mockRejectedValue(new Error("Simulated error"));

      const res = await request(app)
        .post("/api/return/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: 1 });
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Erro interno do servidor.");

      // Restaura o método original
      TransactionHistory.findByPk = originalFindByPk;
    });
  });

  // Testes para POST /api/exchange/register
  describe("POST /api/exchange/register", () => {
    it("deve retornar 400 se transactionId ou newProducts estiverem faltando", async () => {
      const res = await request(app)
        .post("/api/exchange/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: 1, newProducts: [] });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("transactionId e newProducts são obrigatórios.");
    });

    it("deve retornar 401 se usuário não estiver autenticado", async () => {
      const res = await request(app)
        .post("/api/exchange/register")
        .send({ transactionId: 1, newProducts: [{ productId: 2, quantity: 1 }] });
      expect(res.statusCode).toBe(401);
    });

    it("deve retornar 404 se a transação original não for encontrada", async () => {
      const res = await request(app)
        .post("/api/exchange/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: 9999, newProducts: [{ productId: 2, quantity: 1 }] });
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Transação original não encontrada.");
    });

    it("deve retornar 400 se a transação original não for de saída", async () => {
      // Cria uma transação original do tipo "in"
      const product = await Product.create({
        name: "Produto Exchange In",
        brand: "Marca In",
        price: 150,
        size: "L",
        color: "Azul",
        alertThreshold: 5,
      });
      const originalTx = await TransactionHistory.create({
        productId: product.id,
        type: "in",
        supplierOrBuyer: "Fornecedor A",
        quantity: 2,
        transactionPrice: "300.00",
        transactionDate: new Date(),
        userId: testUser.id,
        isReturned: false,
      });

      const res = await request(app)
        .post("/api/exchange/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: originalTx.id, newProducts: [{ productId: product.id, quantity: 1 }] });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/apenas transações de saída/i);
    });

    it("deve retornar 400 se a transação original já foi devolvida/trocada", async () => {
      // Cria uma transação original de saída já marcada como devolvida
      const product = await Product.create({
        name: "Produto Exchange Returned",
        brand: "Marca Returned",
        price: 200,
        size: "S",
        color: "Verde",
        alertThreshold: 5,
      });
      const originalTx = await TransactionHistory.create({
        productId: product.id,
        type: "out",
        supplierOrBuyer: "Fornecedor B",
        quantity: 2,
        transactionPrice: "400.00",
        transactionDate: new Date(),
        userId: testUser.id,
        isReturned: true,
      });

      const res = await request(app)
        .post("/api/exchange/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: originalTx.id, newProducts: [{ productId: product.id, quantity: 1 }] });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Esta transação já foi devolvida/trocada.");
    });

    it("deve retornar 404 se algum novo produto não for encontrado", async () => {
      // Cria uma transação original de saída válida
      const productOrig = await Product.create({
        name: "Produto Exchange Original",
        brand: "Marca Orig",
        price: 100,
        size: "M",
        color: "Preto",
        alertThreshold: 5,
      });
      const originalTx = await TransactionHistory.create({
        productId: productOrig.id,
        type: "out",
        supplierOrBuyer: "Fornecedor C",
        quantity: 2,
        transactionPrice: "200.00",
        transactionDate: new Date(),
        userId: testUser.id,
        isReturned: false,
      });

      const res = await request(app)
        .post("/api/exchange/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: originalTx.id, newProducts: [{ productId: 9999, quantity: 1 }] });
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Produto com ID 9999 não encontrado.");
    });

    it("deve retornar 400 se o valor total dos novos produtos for diferente do valor original", async () => {
      // Cria uma transação original de saída com valor total 200.00 (2 * 100)
      const productOrig = await Product.create({
        name: "Produto Exchange Total",
        brand: "Marca Total",
        price: 100,
        size: "M",
        color: "Branco",
        alertThreshold: 5,
      });
      const originalTx = await TransactionHistory.create({
        productId: productOrig.id,
        type: "out",
        supplierOrBuyer: "Fornecedor D",
        quantity: 2,
        transactionPrice: "200.00",
        transactionDate: new Date(),
        userId: testUser.id,
        isReturned: false,
      });

      // Cria um novo produto com preço diferente
      const newProduct = await Product.create({
        name: "Produto Exchange Diferente",
        brand: "Marca Diferente",
        price: 150, // 150 * 1 ≠ 200
        size: "L",
        color: "Roxo",
        alertThreshold: 5,
      });

      const res = await request(app)
        .post("/api/exchange/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: originalTx.id, newProducts: [{ productId: newProduct.id, quantity: 1 }] });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("A soma total dos novos produtos deve ser igual ao valor da transação original.");
    });

    it("deve retornar 400 se o estoque for insuficiente para algum novo produto", async () => {
      // Cria uma transação original de saída com valor total 200.00 (2 * 100)
      const productOrig = await Product.create({
        name: "Produto Exchange Estoque",
        brand: "Marca Estoque",
        price: 100,
        size: "M",
        color: "Laranja",
        alertThreshold: 5,
      });
      const originalTx = await TransactionHistory.create({
        productId: productOrig.id,
        type: "out",
        supplierOrBuyer: "Fornecedor E",
        quantity: 2,
        transactionPrice: "200.00",
        transactionDate: new Date(),
        userId: testUser.id,
        isReturned: false,
      });

      // Cria um novo produto para troca com preço 100
      const newProduct = await Product.create({
        name: "Produto Exchange Insuficiente",
        brand: "Marca Insuf",
        price: 100,
        size: "M",
        color: "Rosa",
        alertThreshold: 5,
      });
      // Cria estoque para o novo produto com quantidade insuficiente (por exemplo, 1 unidade)
      await Stock.create({
        productId: newProduct.id,
        quantity: 1,
        operationType: "in",
      });

      const res = await request(app)
        .post("/api/exchange/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: originalTx.id, newProducts: [{ productId: newProduct.id, quantity: 2 }] });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(`Estoque insuficiente para o produto ID ${newProduct.id}.`);
    });

    it("deve registrar troca com sucesso", async () => {
      // Cria uma transação original válida de saída com valor total 200.00 (2 * 100)
      const productOrig = await Product.create({
        name: "Produto Exchange Sucesso",
        brand: "Marca Sucesso",
        price: 100,
        size: "M",
        color: "Preto",
        alertThreshold: 5,
      });
      const originalTx = await TransactionHistory.create({
        productId: productOrig.id,
        type: "out",
        supplierOrBuyer: "Fornecedor F",
        quantity: 2,
        transactionPrice: "200.00",
        transactionDate: new Date(),
        userId: testUser.id,
        isReturned: false,
      });
      // Cria um novo produto para troca com preço 100
      const newProduct = await Product.create({
        name: "Produto Novo para Troca",
        brand: "Marca Nova",
        price: 100,
        size: "M",
        color: "Azul",
        alertThreshold: 5,
      });
      // Cria estoque para o novo produto com quantidade suficiente (por exemplo, 10 unidades)
      await Stock.create({
        productId: newProduct.id,
        quantity: 10,
        operationType: "in",
      });
      // Cria estoque para o produto original, que será devolvido, com quantidade arbitrária (por exemplo, 5 unidades)
      await Stock.create({
        productId: productOrig.id,
        quantity: 5,
        operationType: "in",
      });

      const res = await request(app)
        .post("/api/exchange/register")
        .set("Cookie", [authCookie])
        .send({
          transactionId: originalTx.id,
          newProducts: [{ productId: newProduct.id, quantity: 2 }],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe("Troca registrada com sucesso!");
      expect(res.body).toHaveProperty("transactions");
      expect(Array.isArray(res.body.transactions)).toBe(true);
      expect(res.body.transactions.length).toBe(2);

      // Verifica que o estoque do novo produto foi decrementado: 10 - 2 = 8
      const updatedStockNew = await Stock.findOne({ where: { productId: newProduct.id } });
      expect(updatedStockNew.quantity).toBe(8);

      // Verifica que o estoque do produto original foi incrementado: 5 + 2 = 7
      const updatedStockOrig = await Stock.findOne({ where: { productId: productOrig.id } });
      expect(updatedStockOrig.quantity).toBe(7);
    });

    it("deve retornar 500 e realizar rollback se ocorrer um erro", async () => {
      // Força um erro na busca da transação original
      const originalFindByPk = TransactionHistory.findByPk;
      TransactionHistory.findByPk = jest.fn().mockRejectedValue(new Error("Simulated error"));

      const res = await request(app)
        .post("/api/exchange/register")
        .set("Cookie", [authCookie])
        .send({ transactionId: 1, newProducts: [{ productId: 2, quantity: 1 }] });
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Erro interno do servidor.");

      TransactionHistory.findByPk = originalFindByPk;
    });
  });

  // Testes para PUT /api/update/stock/:id
  describe("PUT /api/update/stock/:id", () => {
    it("deve retornar 400 se a quantidade for inválida", async () => {
      // Cria um registro de estoque
      const product = await Product.create({
        name: "Produto Upd",
        brand: "Marca Upd",
        price: 80,
        size: "P",
        color: "Verde",
        alertThreshold: 5,
      });
      const stock = await Stock.create({
        productId: product.id,
        quantity: 10,
        operationType: "in",
      });

      const res = await request(app)
        .put(`/api/update/stock/${stock.id}`)
        .set("Cookie", [authCookie]) 
        .send({ quantity: -5 });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Quantidade inválida. Deve ser um número maior ou igual a zero.");
    });

    it("deve retornar 404 se o stock não for encontrado", async () => {
      const res = await request(app)
        .put(`/api/update/stock/9999`)
        .send({ quantity: 20 });
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Entrada de estoque não encontrada.");
    });

    it("deve atualizar a quantidade com sucesso", async () => {
      // Cria um registro de estoque
      const product = await Product.create({
        name: "Produto Atualização",
        brand: "Marca Atual",
        price: 100,
        size: "M",
        color: "Rosa",
        alertThreshold: 5,
      });
      const stock = await Stock.create({
        productId: product.id,
        quantity: 10,
        operationType: "in",
      });

      const res = await request(app)
        .put(`/api/update/stock/${stock.productId}`)
        .send({ quantity: 30 });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message", "Quantidade do estoque atualizada com sucesso!");
      expect(res.body).toHaveProperty("updatedStock");

      // Verifica no banco de dados
      const updated = await Stock.findByPk(stock.id);
      expect(updated.quantity).toBe(30);
    });
  });

  // Testes para GET /api/get/transactions
  describe("GET /api/get/transactions", () => {
    it("deve retornar o histórico de transações com sucesso", async () => {
      // Cria um produto e uma transação
      const product = await Product.create({
        name: "Produto Transação",
        brand: "Marca Transação",
        price: 120,
        size: "M",
        color: "Azul",
        alertThreshold: 5,
      });
      const transaction = await TransactionHistory.create({
        productId: product.id,
        type: "in",
        supplierOrBuyer: "Fornecedor T",
        quantity: 5,
        transactionPrice: "600.00",
        transactionDate: new Date(),
        userId: testUser.id,
      });

      const res = await request(app).get("/api/get/transactions").send();
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("transactions");
      expect(Array.isArray(res.body.transactions)).toBe(true);
      expect(res.body.transactions.length).toBeGreaterThanOrEqual(1);

      const tx = res.body.transactions[0];
      expect(tx).toHaveProperty("product");
      expect(tx.product).toHaveProperty("name", product.name);
      expect(tx).toHaveProperty("user");
      expect(tx.user).toHaveProperty("id", testUser.id);
    });

    it("deve retornar 500 em caso de erro", async () => {
      // Força erro simulando que TransactionHistory.findAll rejeite
      const originalFindAll = TransactionHistory.findAll;
      TransactionHistory.findAll = jest.fn().mockRejectedValue(new Error("Database error"));

      const res = await request(app).get("/api/get/transactions").send();
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Erro interno do servidor.");

      TransactionHistory.findAll = originalFindAll;
    });
  });
});
