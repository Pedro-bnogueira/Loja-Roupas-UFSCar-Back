const request = require("supertest");
const app = require("../../../src/app");
const sequelize = require("../../../src/config/database");

// Models usados
const User = require("../../../src/models/User");
const ActiveSession = require("../../../src/models/ActiveSession");
const Product = require("../../../src/models/Product");
const Stock = require("../../../src/models/Stock");
const TransactionHistory = require("../../../src/models/TransactionHistory");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

describe("Integration tests - Stock Routes", () => {
  let adminCookie; // Cookie de autenticação para admin
  let adminUser;   // Objeto do usuário admin
  let normalUser;  // (Opcional) Se precisar de um usuário não admin

  beforeAll(async () => {
    // Sincroniza o banco e garante que as tabelas sejam criadas no modo de teste (SQLite em memória)
    await sequelize.sync({ force: true });

    // Cria um usuário admin
    const adminPass = "adminpass";
    const hashedAdminPass = await bcrypt.hash(adminPass, 8);
    adminUser = await User.create({
      name: "Admin",
      email: "admin@example.com",
      password: hashedAdminPass,
      accessLevel: "admin",
    });

    // Gera token e cria sessão ativa para o admin
    const adminToken = jwt.sign({ id: adminUser.id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "120m",
    });
    await ActiveSession.upsert({
      user: adminUser.email,
      session: adminToken,
      expiresat: new Date(Date.now() + 120 * 60 * 1000),
    });
    adminCookie = `LojaRoupa=${adminToken}`;

    // (Opcional) Se quiser criar um usuário normal:
    // const userPass = "userpass";
    // const hashedUserPass = await bcrypt.hash(userPass, 8);
    // normalUser = await User.create({
    //   name: "Normal",
    //   email: "user@example.com",
    //   password: hashedUserPass,
    //   accessLevel: "user",
    // });
  });

  beforeEach(async () => {
    await TransactionHistory.destroy({ where: {} });
    await Stock.destroy({ where: {} });
    await Product.destroy({ where: {} }); // Agora seguro
  });

  //
  // Seção A: POST /movement/register
  //
  // Rotas protegidas: authenticate + authorizeAdmin
  //
  describe("POST /movement/register", () => {
    it("deve retornar 400 se algum campo obrigatório estiver faltando", async () => {
      const res = await request(app)
        .post("/api/movement/register")
        .set("Cookie", [adminCookie])
        .send({
          // omitimos algum campo, ex.: sem supplierOrBuyer
          productId: 1,
          quantity: 10,
          type: "in",
          transactionPrice: 100,
          // supplierOrBuyer: undefined
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Todos os campos são obrigatórios.");
    });

    it("deve retornar 400 se o tipo for inválido", async () => {
      const res = await request(app)
        .post("/api/movement/register")
        .set("Cookie", [adminCookie])
        .send({
          productId: 1,
          quantity: 5,
          type: "INVALID_TYPE",
          transactionPrice: 50,
          supplierOrBuyer: "Fornecedor X",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Tipo de transação inválido. Deve ser "in" ou "out".');
    });

    it("deve retornar 401 se o usuário não estiver autenticado", async () => {
      // Não define Cookie
      const res = await request(app)
        .post("/api/movement/register")
        .send({
          productId: 1,
          quantity: 5,
          type: "in",
          transactionPrice: 50,
          supplierOrBuyer: "Fornecedor X",
        });

      // O middleware authenticate deve retornar 401
      expect(res.statusCode).toBe(401);
      // "Usuário não autenticado." é checado dentro do middleware ou do controller
    });

    it("deve retornar 404 se o produto não for encontrado", async () => {
      const res = await request(app)
        .post("/api/movement/register")
        .set("Cookie", [adminCookie])
        .send({
          productId: 9999, // inexistente
          quantity: 10,
          type: "in",
          transactionPrice: 100,
          supplierOrBuyer: "Fornecedor X",
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Produto não encontrado.");
    });

    it("deve retornar 400 se o estoque for insuficiente para operação 'out'", async () => {
      // Cria um produto
      const product = await Product.create({
        name: "Produto X",
        brand: "Marca X",
        price: 100,
        size: "M",
        color: "Vermelho",
        alertThreshold: 5,
      });
      // Cria Stock com 5 unidades
      await Stock.create({
        productId: product.id,
        quantity: 5,
        operationType: "in",
      });

      const res = await request(app)
        .post("/api/movement/register")
        .set("Cookie", [adminCookie])
        .send({
          productId: product.id,
          quantity: 10, // maior do que 5
          type: "out",
          transactionPrice: 50,
          supplierOrBuyer: "Cliente Y",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Estoque insuficiente para a operação.");
    });

    it("deve registrar uma movimentação de entrada (in) com sucesso", async () => {
      // Cria um produto sem Stock
      const product = await Product.create({
        name: "Produto Novo",
        brand: "Marca Y",
        price: 200,
        size: "G",
        color: "Azul",
        alertThreshold: 3,
      });

      const res = await request(app)
        .post("/api/movement/register")
        .set("Cookie", [adminCookie])
        .send({
          productId: product.id,
          quantity: 10,
          type: "in",
          transactionPrice: 200,
          supplierOrBuyer: "Fornecedor XPTO",
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("transactionHistory");
      expect(res.body.transactionHistory).toHaveProperty("productId", product.id);

      // Verifica no banco se a Stock foi criada
      const stockEntry = await Stock.findOne({ where: { productId: product.id } });
      expect(stockEntry).not.toBeNull();
      expect(stockEntry.quantity).toBe(10);
      expect(stockEntry.operationType).toBe("in");
    });

    it("deve registrar uma movimentação de saída (out) com sucesso", async () => {
      // Cria um produto e stock com 10 unidades
      const product = await Product.create({
        name: "Produto Y",
        brand: "Marca Z",
        price: 300,
        size: "M",
        color: "Preto",
        alertThreshold: 2,
      });
      const stockEntry = await Stock.create({
        productId: product.id,
        quantity: 10,
        operationType: "in",
      });

      const res = await request(app)
        .post("/api/movement/register")
        .set("Cookie", [adminCookie])
        .send({
          productId: product.id,
          quantity: 3,
          type: "out",
          transactionPrice: 900, // total, ex.: 3 * 300
          supplierOrBuyer: "Cliente ABC",
        });

      expect(res.statusCode).toBe(201);
      // Checa se o stock diminuiu
      const updatedStock = await Stock.findByPk(stockEntry.id);
      expect(updatedStock.quantity).toBe(7); // 10 - 3
      expect(updatedStock.operationType).toBe("out");

      // Checa se gerou TransactionHistory
      const createdHistory = await TransactionHistory.findOne({
        where: { productId: product.id, type: "out" },
      });
      expect(createdHistory).not.toBeNull();
      expect(createdHistory.quantity).toBe(3);
    });
  });

  //
  // Seção B: GET /get/stock
  //
  describe("GET /api/get/stock", () => {
    it("deve retornar a lista de estoque com sucesso", async () => {
      // Cria um produto e respectivo Stock
      const product = await Product.create({
        name: "Produto Stock",
        brand: "Genérico",
        price: 80,
        size: "G",
        color: "Verde",
        alertThreshold: 5,
      });
      const stockCreated = await Stock.create({
        productId: product.id,
        quantity: 15,
        operationType: "in",
      });

      const res = await request(app).get("/api/get/stock").send();

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("stock");
      expect(Array.isArray(res.body.stock)).toBe(true);

      // Verifica se o item aparece
      const item = res.body.stock.find((s) => s.productId === product.id);
      expect(item).toBeDefined();
      expect(item.quantity).toBe(15);
      expect(item.product).toBeDefined();
      expect(item.product.name).toBe("Produto Stock");
    });

    it("deve retornar 200 mesmo se não houver nada no estoque", async () => {
      // Limpa as tabelas
      await Stock.destroy({ where: {} });
      await Product.destroy({ where: {} });

      const res = await request(app).get("/api/get/stock").send();

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("stock");
      expect(Array.isArray(res.body.stock)).toBe(true);
      expect(res.body.stock.length).toBe(0);
    });
  });

  //
  // Seção C: GET /api/get/transactions
  //
  describe("GET /api/get/transactions", () => {
    it("deve retornar o histórico de transações com sucesso", async () => {
      // Cria um produto e uma transação
      const product = await Product.create({
        name: "Produto Hist",
        brand: "Log",
        price: 123,
        size: "M",
        color: "Branco",
        alertThreshold: 3,
      });
      await TransactionHistory.create({
        productId: product.id,
        type: "in",
        supplierOrBuyer: "Forn Lala",
        quantity: 10,
        transactionPrice: 1230,
        transactionDate: new Date(),
        userId: adminUser.id,
      });

      const res = await request(app).get("/api/get/transactions").send();
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("transactions");
      expect(Array.isArray(res.body.transactions)).toBe(true);
      expect(res.body.transactions.length).toBeGreaterThanOrEqual(1);

      // Verifica se retorna o produto e usuário
      const tx = res.body.transactions[0];
      expect(tx).toHaveProperty("Product");
      expect(tx.Product).toHaveProperty("name", "Produto Hist");
      expect(tx).toHaveProperty("user");
      expect(tx.user).toHaveProperty("id", adminUser.id);
    });

    // Caso queira testar um erro 500, você poderia forçar exceções, mas não é comum
    // em ambiente real. Você pode simular com mocks também.
  });

  //
  // Seção D: PUT /update/stock/:id
  //
  describe("PUT /api/update/stock/:id", () => {
    it("deve retornar 400 se a quantidade for inválida", async () => {
      // Cria um Stock
      const product = await Product.create({ name: "Prod Quant", price: 45, size: "U", color: "Cinza" });
      const stock = await Stock.create({ productId: product.id, quantity: 10, operationType: "in" });

      const res = await request(app)
        .put(`/api/update/stock/${stock.id}`)
        .set("Cookie", [adminCookie])
        .send({ quantity: -5 }); // inválido
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Quantidade inválida. Deve ser um número maior ou igual a zero.");
    });

    it("deve retornar 404 se o stock não for encontrado", async () => {
      const res = await request(app).put(`/api/update/stock/9999`).send({ quantity: 20 });
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Entrada de estoque não encontrada.");
    });

    it("deve atualizar a quantidade com sucesso", async () => {
      // Cria
      const product = await Product.create({ name: "Prod Upd", price: 100, size: "P", color: "Rosa" });
      const stock = await Stock.create({ productId: product.id, quantity: 10, operationType: "in" });

      const res = await request(app).put(`/api/update/stock/${stock.productId}`).send({ quantity: 30 });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message", "Quantidade do estoque atualizada com sucesso!");
      expect(res.body).toHaveProperty("updatedStock");

      // Verifica no BD
      const updated = await Stock.findByPk(stock.id);
      expect(updated.quantity).toBe(30);
    });
  });
});
