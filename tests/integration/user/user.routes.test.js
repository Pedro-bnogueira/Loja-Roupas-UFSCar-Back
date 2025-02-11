// tests/integration/user/user.routes.test.js

// Importa os módulos necessários
const request = require("supertest");
const app = require("../../../src/app");
const sequelize = require("../../../src/config/database");
const User = require("../../../src/models/User");
const ActiveSession = require("../../../src/models/ActiveSession");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

describe("Integration tests - User Routes", () => {
  let adminUser;
  let adminCookie;

  // Antes de todos os testes, sincronize o banco de dados e crie o usuário admin
  beforeAll(async () => {
    // Sincroniza as tabelas no banco em memória
    await sequelize.sync({ force: true });

    // Cria um usuário administrador
    const adminPassword = "adminpassword";
    const hashedPassword = await bcrypt.hash(adminPassword, 8);
    adminUser = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      password: hashedPassword,
      accessLevel: "admin",
    });

    // Cria uma sessão ativa para o admin gerando um token JWT válido
    const token = jwt.sign({ id: adminUser.id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "120m",
    });
    await ActiveSession.upsert({
      user: adminUser.email,
      session: token,
      expiresat: new Date(Date.now() + 120 * 60 * 1000),
    });
    adminCookie = `LojaRoupa=${token}`;
  });

  //
  // Grupo de testes para o cadastro de usuário
  //
  describe("POST /api/new/user (Register User)", () => {
    // Antes de cada teste, limpa os usuários que não sejam o admin.
    // Isso garante que o admin permaneça para as rotas protegidas.
    beforeEach(async () => {
      await User.destroy({ where: { email: { [Op.ne]: adminUser.email } } });
      await ActiveSession.destroy({ where: { user: { [Op.ne]: adminUser.email } } });
    });

    it("deve cadastrar um novo usuário com sucesso", async () => {
      const res = await request(app)
        .post("/api/new/user")
        .set("Cookie", [adminCookie])
        .send({
          name: "New User",
          email: "newuser@example.com",
          password: "userpassword",
          accessLevel: "user",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("message", "Usuário cadastrado com sucesso!");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toHaveProperty("email", "newuser@example.com");
    });

    it("deve retornar 409 se o usuário já estiver cadastrado", async () => {
      // Cria um usuário previamente
      await User.create({
        name: "Existing User",
        email: "existing@example.com",
        password: await bcrypt.hash("somepassword", 8),
        accessLevel: "user",
      });

      const res = await request(app)
        .post("/api/new/user")
        .set("Cookie", [adminCookie])
        .send({
          name: "Existing User",
          email: "existing@example.com",
          password: "somepassword",
          accessLevel: "user",
        });

      expect(res.statusCode).toBe(409);
      expect(res.body).toHaveProperty("message", "Usuário já cadastrado.");
    });
  });

  //
  // Grupo de testes para a edição de usuário
  //
  describe("POST /api/edit/user/:id (Edit User)", () => {
    let testUser;
    beforeEach(async () => {
      // Cria um usuário para edição (certifique-se de não apagar o admin)
      testUser = await User.create({
        name: "Test User",
        email: "testuser@example.com",
        password: await bcrypt.hash("testpassword", 8),
        accessLevel: "user",
      });
    });

    it("deve atualizar um usuário com sucesso", async () => {
      const res = await request(app)
        .post(`/api/edit/user/${testUser.id}`)
        .set("Cookie", [adminCookie])
        .send({
          name: "Updated User",
          email: "updated@example.com",
          accessLevel: "user",
        });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message", "Usuário atualizado com sucesso!");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toHaveProperty("name", "Updated User");
      expect(res.body.user).toHaveProperty("email", "updated@example.com");
    });

    it("deve retornar 404 se o usuário não for encontrado", async () => {
      const res = await request(app)
        .post("/api/edit/user/99999")
        .set("Cookie", [adminCookie])
        .send({
          name: "Nonexistent",
          email: "nonexistent@example.com",
          accessLevel: "user",
        });
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Usuário não encontrado.");
    });
  });

  //
  // Grupo de testes para a exclusão de usuário
  //
  describe("POST /api/delete/user/:id (Delete User)", () => {
    let testUser;
    beforeEach(async () => {
      // Cria um usuário para exclusão
      testUser = await User.create({
        name: "User To Delete",
        email: "delete@example.com",
        password: await bcrypt.hash("deletepass", 8),
        accessLevel: "user",
      });
    });

    it("deve excluir um usuário com sucesso", async () => {
      const res = await request(app)
        .post(`/api/delete/user/${testUser.id}`)
        .set("Cookie", [adminCookie])
        .send();
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message", "Usuário removido com sucesso!");
      const deletedUser = await User.findByPk(testUser.id);
      expect(deletedUser).toBeNull();
    });

    it("deve retornar 404 se o usuário não for encontrado", async () => {
      const res = await request(app)
        .post("/api/delete/user/99999")
        .set("Cookie", [adminCookie])
        .send();
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Usuário não encontrado.");
    });
  });

  //
  // Grupo de testes para a listagem de usuários
  //
  describe("POST /api/get/users (Get All Users)", () => {
    beforeEach(async () => {
      // Limpa todos os usuários exceto o admin e cria usuários adicionais
      await User.destroy({ where: { email: { [Op.ne]: adminUser.email } } });
      await ActiveSession.destroy({ where: { user: { [Op.ne]: adminUser.email } } });

      await User.create({
        name: "User One",
        email: "one@example.com",
        password: await bcrypt.hash("onepass", 8),
        accessLevel: "user",
      });
      await User.create({
        name: "User Two",
        email: "two@example.com",
        password: await bcrypt.hash("twopass", 8),
        accessLevel: "user",
      });
    });

    it("deve retornar uma lista de usuários sem o campo password", async () => {
      const res = await request(app)
        .post("/api/get/users")
        .set("Cookie", [adminCookie])
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("users");
      expect(Array.isArray(res.body.users)).toBe(true);
      // Verifica que nenhum usuário possui o campo "password"
      res.body.users.forEach((user) => {
        expect(user).not.toHaveProperty("password");
      });
      // Opcional: verifica a ordem (por ID ascendente)
      const emails = res.body.users.map((u) => u.email);
      expect(emails).toEqual([
        "admin@example.com",
        "one@example.com",
        "two@example.com",
      ]);
    });
  });
});
