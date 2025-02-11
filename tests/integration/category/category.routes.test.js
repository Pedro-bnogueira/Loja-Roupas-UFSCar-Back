const request = require("supertest");
const app = require("../../../src/app");
const sequelize = require("../../../src/config/database");
const User = require("../../../src/models/User");
const ActiveSession = require("../../../src/models/ActiveSession");
const Category = require("../../../src/models/Category");
const Product = require("../../../src/models/Product");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

describe("Integration tests - Category Routes", () => {
  let authCookie, adminUser, testCategory;

  beforeAll(async () => {
    // Sincroniza o banco de dados (SQLite em memória) para que as tabelas sejam criadas limpas
    await sequelize.sync({ force: true });

    // Cria um usuário administrador para autenticação
    const password = "adminpass";
    const hashedPassword = await bcrypt.hash(password, 8);
    adminUser = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      password: hashedPassword,
      accessLevel: "admin",
    });

    // Gera um token JWT para o usuário
    const token = jwt.sign({ id: adminUser.id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "120m",
    });

    // Cria uma sessão ativa para o usuário
    await ActiveSession.upsert({
      user: adminUser.email,
      session: token,
      expiresat: new Date(Date.now() + 120 * 60 * 1000),
    });

    authCookie = `LojaRoupa=${token}`;

    // (Opcional) Crie uma categoria inicial para ser usada em alguns testes, se necessário
    testCategory = await Category.create({ name: "Camisetas" });
  });

  beforeEach(async () => {
    // Limpa os dados de categoria e, se necessário, os de produtos, mas mantenha o usuário admin e a sessão ativa
    await Category.destroy({ where: {} });
    await Product.destroy({ where: {} });
  });

  describe("POST /api/new/category (Create Category)", () => {
    it("deve retornar 400 se o nome da categoria não for fornecido", async () => {
      const res = await request(app)
        .post("/api/new/category")
        .set("Cookie", [authCookie])
        .send({ name: "" });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message", "O nome da categoria é obrigatório.");
    });

    it("deve retornar 409 se a categoria já existir", async () => {
      // Cria uma categoria com o nome "Roupas"
      await Category.create({ name: "Roupas" });
      const res = await request(app)
        .post("/api/new/category")
        .set("Cookie", [authCookie])
        .send({ name: "Roupas" });
      expect(res.statusCode).toBe(409);
      expect(res.body).toHaveProperty("message", "Já existe uma categoria com este nome.");
    });

    it("deve criar uma nova categoria com sucesso", async () => {
      const payload = { name: "Calçados" };
      const res = await request(app)
        .post("/api/new/category")
        .set("Cookie", [authCookie])
        .send(payload);
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("message", "Categoria cadastrada com sucesso!");
      expect(res.body).toHaveProperty("category");
      expect(res.body.category).toHaveProperty("name", "Calçados");
    });
  });

  describe("GET /api/get/categories (Get Categories)", () => {
    it("deve retornar uma lista de categorias com contagem de produtos", async () => {
      // Cria duas categorias
      const cat1 = await Category.create({ name: "Roupas" });
      const cat2 = await Category.create({ name: "Calçados" });
      
      // Cria produtos associados à categoria "Roupas"
      await Product.create({
        name: "Camiseta",
        brand: "Marca X",
        price: 50,
        size: "M",
        color: "Vermelho",
        categoryId: cat1.id,
        alertThreshold: 5,
      });
      await Product.create({
        name: "Calça",
        brand: "Marca Y",
        price: 100,
        size: "G",
        color: "Azul",
        categoryId: cat1.id,
        alertThreshold: 5,
      });

      const res = await request(app)
        .get("/api/get/categories")
        .set("Cookie", [authCookie])
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("categories");
      expect(Array.isArray(res.body.categories)).toBe(true);

      const categories = res.body.categories;
      const roupas = categories.find(c => c.name === "Roupas");
      const calcados = categories.find(c => c.name === "Calçados");
      
      expect(roupas).toBeDefined();
      expect(calcados).toBeDefined();
      expect(roupas.productCount).toBe(2); // Dois produtos foram associados à categoria "Roupas"
      expect(calcados.productCount).toBe(0); // "Calçados" não tem produtos
    });
  });

  describe("DELETE /api/delete/category/:id (Delete Category)", () => {
    it("deve retornar 404 se a categoria não for encontrada", async () => {
      const res = await request(app)
        .delete("/api/delete/category/9999")
        .set("Cookie", [authCookie])
        .send();
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Categoria não encontrada.");
    });

    it("deve remover uma categoria com sucesso", async () => {
      // Cria uma categoria para exclusão
      const category = await Category.create({ name: "Acessórios" });
      const res = await request(app)
        .delete(`/api/delete/category/${category.id}`)
        .set("Cookie", [authCookie])
        .send();
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message", "Categoria removida com sucesso!");
      // Verifica que a categoria não existe mais
      const deleted = await Category.findByPk(category.id);
      expect(deleted).toBeNull();
    });
  });
});
