const request = require("supertest");
const app = require("../../../src/app");
const sequelize = require("../../../src/config/database");
const { Op } = require("sequelize"); // Importa os operadores
const User = require("../../../src/models/User");
const ActiveSession = require("../../../src/models/ActiveSession");
const Product = require("../../../src/models/Product");
const Category = require("../../../src/models/Category");
const TransactionHistory = require("../../../src/models/TransactionHistory");
const Stock = require("../../../src/models/Stock");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Monkey patch: substitui a chamada a DATE_FORMAT por strftime para SQLite
const originalFn = sequelize.fn;
sequelize.fn = function(name, ...args) {
  if (name === "DATE_FORMAT") {
    // Quando o controlador chamar DATE_FORMAT(col, '%Y-%m'),
    // substituímos por strftime('%Y-%m', col)
    return originalFn("strftime", "%Y-%m", args[0]);
  }
  return originalFn(name, ...args);
};

describe("Integration tests - Dashboard Routes", () => {
  let adminUser, adminToken, authCookie;

  beforeAll(async () => {
    // Sincroniza o banco de dados em memória
    await sequelize.sync({ force: true });

    // Cria um usuário administrador para os testes do dashboard
    const hashedPassword = await bcrypt.hash("adminpass", 8);
    adminUser = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      password: hashedPassword,
      accessLevel: "admin",
    });

    // Gera um token JWT para o usuário admin
    adminToken = jwt.sign(
      { id: adminUser.id, accessLevel: adminUser.accessLevel },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "120m" }
    );

    // Cria uma sessão ativa para o admin
    await ActiveSession.upsert({
      user: adminUser.email,
      session: adminToken,
      expiresat: new Date(Date.now() + 120 * 60 * 1000),
    });

    authCookie = `LojaRoupa=${adminToken}`;
  });

  beforeEach(async () => {
    // Limpa os dados das tabelas relevantes, exceto o usuário admin
    await User.destroy({ where: { email: { [Op.ne]: adminUser.email } } });
    await ActiveSession.destroy({ where: { user: { [Op.ne]: adminUser.email } } });
    await TransactionHistory.destroy({ where: {} });
    await Stock.destroy({ where: {} });
    await Product.destroy({ where: {} });
    await Category.destroy({ where: {} });

    // Insere dados de exemplo para o dashboard

    // Cria categorias
    const category1 = await Category.create({ name: "Category 1" });
    const category2 = await Category.create({ name: "Category 2" });

    // Cria produtos associados às categorias
    const product1 = await Product.create({
      name: "Product 1",
      brand: "Brand A",
      price: "100.00",
      size: "M",
      color: "Red",
      categoryId: category1.id,
      alertThreshold: 5,
    });
    const product2 = await Product.create({
      name: "Product 2",
      brand: "Brand B",
      price: "200.00",
      size: "L",
      color: "Blue",
      categoryId: category2.id,
      alertThreshold: 10,
    });

    // Cria transações de venda e compra para product1
    await TransactionHistory.create({
      productId: product1.id,
      type: "out",
      quantity: 5,
      transactionPrice: "500.00",
      supplierOrBuyer: "Customer A",
      transactionDate: new Date(),
      userId: adminUser.id,
    });
    await TransactionHistory.create({
      productId: product1.id,
      type: "in",
      quantity: 3,
      transactionPrice: "300.00",
      supplierOrBuyer: "Supplier X",
      transactionDate: new Date(),
      userId: adminUser.id,
    });

    // Cria transações de troca e devolução para product1
    await TransactionHistory.create({
      productId: product1.id,
      type: "exchange_out",
      quantity: 1,
      transactionPrice: "100.00",
      supplierOrBuyer: "Customer B",
      transactionDate: new Date(),
      userId: adminUser.id,
    });
    await TransactionHistory.create({
      productId: product1.id,
      type: "return",
      quantity: 1,
      transactionPrice: "100.00",
      supplierOrBuyer: "Customer C",
      transactionDate: new Date(),
      userId: adminUser.id,
    });

    // Cria registro de estoque para product1
    await Stock.create({
      productId: product1.id,
      quantity: 50,
      operationType: "in",
    });

    // Cria usuários adicionais para testar contagem e gráficos de usuários ao longo do tempo
    await User.create({
      name: "User One",
      email: "user1@example.com",
      password: await bcrypt.hash("senha1", 8),
      accessLevel: "user",
    });
    await User.create({
      name: "User Two",
      email: "user2@example.com",
      password: await bcrypt.hash("senha2", 8),
      accessLevel: "user",
    });
  });

  describe("GET /api/dashboard", () => {
    it("deve retornar 200 e as estatísticas do dashboard", async () => {
      const res = await request(app)
        .get("/api/dashboard")
        .set("Cookie", [authCookie])
        .send();

      expect(res.statusCode).toBe(200);

      // Verifica totais conforme os dados inseridos
      expect(res.body).toHaveProperty("totalSales", 500);
      expect(res.body).toHaveProperty("totalPurchases", 300);
      expect(res.body).toHaveProperty("totalExchanges", 1);
      expect(res.body).toHaveProperty("totalReturns", 1);

      // Verifica que o topProduct foi retornado (possui id e totalSold)
      expect(res.body).toHaveProperty("topProduct");
      if (res.body.topProduct) {
        expect(res.body.topProduct).toHaveProperty("id");
        expect(typeof res.body.topProduct.totalSold).toBe("number");
      }

      // Verifica que as séries temporais foram geradas
      expect(res.body).toHaveProperty("salesOverTime");
      expect(Array.isArray(res.body.salesOverTime)).toBe(true);
      expect(res.body).toHaveProperty("purchasesOverTime");
      expect(Array.isArray(res.body.purchasesOverTime)).toBe(true);

      // Verifica que o total de usuários foi retornado (admin pode ver essa informação)
      expect(res.body).toHaveProperty("totalUsers");
      expect(typeof res.body.totalUsers).toBe("number");

      // Verifica que o inventário formatado é retornado
      expect(res.body).toHaveProperty("formattedInventory");
      expect(Array.isArray(res.body.formattedInventory)).toBe(true);

      // Verifica que os usuários ao longo do tempo foram retornados
      expect(res.body).toHaveProperty("usersOverTime");
      expect(Array.isArray(res.body.usersOverTime)).toBe(true);

      // Verifica o nível de acesso do usuário
      expect(res.body).toHaveProperty("userRole", "admin");
    });

    it("deve retornar 401 se o usuário não estiver autenticado", async () => {
      const res = await request(app)
        .get("/api/dashboard")
        .send();

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Sem token de autenticação.");
    });
  });
});
