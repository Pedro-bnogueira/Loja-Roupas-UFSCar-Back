const request = require('supertest');
const app = require('../../../src/app');
const sequelize = require('../../../src/config/database');
const User = require('../../../src/models/User');
const ActiveSession = require('../../../src/models/ActiveSession');
const Product = require('../../../src/models/Product');
const Category = require('../../../src/models/Category');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

describe("Integration tests - Product Routes", () => {
  let authCookie;
  let testUser;
  let category;

  // beforeAll: Configura o banco de dados (em memória) e semeia os dados essenciais
  beforeAll(async () => {
    // Sincroniza todas as tabelas (force: true garante um ambiente limpo)
    await sequelize.sync({ force: true });

    // Cria um usuário para autenticação (não precisa ser admin para produtos)
    const password = "testpass";
    const hashedPassword = await bcrypt.hash(password, 8);
    testUser = await User.create({
      name: "Test User",
      email: "testuser@example.com",
      password: hashedPassword,
      accessLevel: "user",
    });

    // Gera um token JWT válido para o usuário
    const token = jwt.sign({ id: testUser.id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "120m",
    });

    // Cria uma sessão ativa para o usuário
    await ActiveSession.upsert({
      user: testUser.email,
      session: token,
      expiresat: new Date(Date.now() + 120 * 60 * 1000),
    });
    authCookie = `LojaRoupa=${token}`;

    // Cria uma categoria que será utilizada para os produtos
    category = await Category.create({ name: "Camisetas" });
  });

  //
  // Testes para o endpoint de criação de produto (POST /api/new/product)
  //
  describe("POST /api/new/product (Create Product)", () => {
    // Limpa os produtos (exceto se houver dependências que você deseje manter)
    beforeEach(async () => {
      await Product.destroy({ where: {} });
    });

    it("deve retornar 400 se dados obrigatórios estiverem faltando", async () => {
      // Envia apenas o nome, deixando de fora price, size e color
      const res = await request(app)
        .post("/api/new/product")
        .set("Cookie", [authCookie])
        .send({ name: "Produto Teste" });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty(
        "message",
        "Dados insuficientes. É necessário fornecer nome, preço, tamanho e cor."
      );
    });

    it("deve retornar 404 se a categoria não for encontrada", async () => {
      const payload = {
        name: "Produto Teste",
        brand: "Marca X",
        price: 100,
        size: "M",
        color: "Azul",
        category: "Inexistente", // Categoria não cadastrada
      };

      const res = await request(app)
        .post("/api/new/product")
        .set("Cookie", [authCookie])
        .send(payload);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Categoria não encontrada.");
    });

    it("deve criar produto com sucesso", async () => {
      const payload = {
        name: "Produto Teste",
        brand: "Marca X",
        price: 100,
        size: "M",
        color: "Azul",
        category: category.name, // Utiliza a categoria existente
        alertThreshold: 10,
      };

      const res = await request(app)
        .post("/api/new/product")
        .set("Cookie", [authCookie])
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("message", "Produto cadastrado com sucesso!");
      expect(res.body).toHaveProperty("product");
      // Verifica se os dados do produto foram criados conforme o payload
      expect(res.body.product).toHaveProperty("name", payload.name);
      // Verifica que o produto foi associado à categoria correta
      expect(res.body.product).toHaveProperty("category");
      expect(res.body.product.category).toHaveProperty("name", category.name);
    });
  });

  //
  // Testes para o endpoint de listagem de produtos (GET /api/get/products)
  //
  describe("GET /api/get/products (Get Products)", () => {
    beforeEach(async () => {
      // Limpa e cria pelo menos um produto para os testes
      await Product.destroy({ where: {} });
      await Product.create({
        name: "Produto A",
        brand: "Marca A",
        price: 50,
        size: "P",
        color: "Vermelho",
        categoryId: category.id,
        alertThreshold: 5,
      });
    });

    it("deve retornar lista de produtos com sucesso", async () => {
      const res = await request(app)
        .get("/api/get/products")
        .set("Cookie", [authCookie])
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("products");
      expect(Array.isArray(res.body.products)).toBe(true);
      // Verifica que cada produto possui a associação com categoria (se houver)
      res.body.products.forEach(prod => {
        expect(prod).toHaveProperty("category");
      });
    });
  });

  //
  // Testes para o endpoint de atualização de produto (PUT /api/update/product/:id)
  //
  describe("PUT /api/update/product/:id (Update Product)", () => {
    let product;
    beforeEach(async () => {
      // Cria um produto para ser atualizado
      product = await Product.create({
        name: "Produto Original",
        brand: "Marca Original",
        price: 80,
        size: "G",
        color: "Verde",
        categoryId: category.id,
        alertThreshold: 10,
      });
    });

    it("deve retornar 404 se o produto não for encontrado", async () => {
      const res = await request(app)
        .put("/api/update/product/9999")
        .set("Cookie", [authCookie])
        .send({ name: "Produto Atualizado" });

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Produto não encontrado.");
    });

    it("deve retornar 404 se a nova categoria não for encontrada", async () => {
      const res = await request(app)
        .put(`/api/update/product/${product.id}`)
        .set("Cookie", [authCookie])
        .send({ category: "Inexistente" });

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Categoria não encontrada.");
    });

    it("deve atualizar produto com sucesso", async () => {
      const updatePayload = {
        name: "Produto Atualizado",
        brand: "Marca Atualizada",
        price: 90,
        size: "M",
        color: "Preto",
        category: category.name, // Mantém ou atualiza para a categoria existente
        alertThreshold: 5,
      };

      const res = await request(app)
        .put(`/api/update/product/${product.id}`)
        .set("Cookie", [authCookie])
        .send(updatePayload);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message", "Produto atualizado com sucesso!");
      expect(res.body).toHaveProperty("editedProduct");
      expect(res.body.editedProduct).toHaveProperty("name", updatePayload.name);
      expect(res.body.editedProduct).toHaveProperty("brand", updatePayload.brand);
      expect(Number(res.body.editedProduct.price)).toBe(90);
    });
  });

  //
  // Testes para o endpoint de exclusão de produto (DELETE /api/delete/product/:id)
  //
  describe("DELETE /api/delete/product/:id (Delete Product)", () => {
    let product;
    beforeEach(async () => {
      // Cria um produto para ser removido
      product = await Product.create({
        name: "Produto para Deletar",
        brand: "Marca Deletar",
        price: 70,
        size: "P",
        color: "Amarelo",
        categoryId: category.id,
        alertThreshold: 10,
      });
    });

    it("deve retornar 404 se o produto não for encontrado", async () => {
      const res = await request(app)
        .delete("/api/delete/product/9999")
        .set("Cookie", [authCookie])
        .send();

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Produto não encontrado.");
    });

    it("deve excluir um produto com sucesso", async () => {
      const res = await request(app)
        .delete(`/api/delete/product/${product.id}`)
        .set("Cookie", [authCookie])
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message", "Produto removido com sucesso!");
      const deletedProduct = await Product.findByPk(product.id);
      expect(deletedProduct).toBeNull();
    });
  });
});
