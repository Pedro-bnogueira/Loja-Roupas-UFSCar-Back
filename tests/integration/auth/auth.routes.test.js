const request = require("supertest");
const app = require("../../../src/app");
const sequelize = require("../../../src/config/database");
const User = require("../../../src/models/User");
const ActiveSession = require("../../../src/models/ActiveSession");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


beforeAll(async () => {
  // Certifique-se de que as tabelas estão criadas
  await sequelize.sync({ force: true });
});


describe("Integration tests - Autenticação e Logout", () => {

  describe("POST /api/sign (Login)", () => {
    // Limpa os dados antes de cada teste
    beforeEach(async () => {
      await User.destroy({ where: {} });
      await ActiveSession.destroy({ where: {} });
    });

    it("deve retornar 200 e definir cookie se as credenciais forem válidas", async () => {
      const password = "senhaTeste";
      // Crie um usuário real no banco de dados em memória
      const hashedPassword = await bcrypt.hash(password, 8);
      const user = await User.create({
        name: "Usuário Teste",
        email: "usuarioTeste@example.com",
        password: hashedPassword,
        accessLevel: "user",
      });

      const res = await request(app)
        .post("/api/sign")
        .send({ email: user.email, password: password });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("status", "success");
      expect(res.body).toHaveProperty("message", "Login realizado com sucesso.");
      // Verifica se o cookie foi definido
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("deve retornar 404 se usuário não existe", async () => {
      const res = await request(app)
        .post("/api/sign")
        .send({ email: "naoexiste@example.com", password: "qualquer" });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Usuário não cadastrado.");
    });

    it("deve retornar 401 se a senha estiver incorreta", async () => {
      const password = "senhaTeste";
      const hashedPassword = await bcrypt.hash(password, 8);
      const user = await User.create({
        name: "Usuário Teste",
        email: "usuarioTeste@example.com",
        password: hashedPassword,
        accessLevel: "user",
      });

      const res = await request(app)
        .post("/api/sign")
        .send({ email: user.email, password: "senhaIncorreta" });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Email ou senha inválidos.");
    });

    it("deve retornar 400 se os campos estiverem vazios", async () => {
      const res = await request(app)
        .post("/api/sign")
        .send({ email: "", password: "" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Preencha os campos corretamente.");
    });
  });

  describe("POST /api/auth", () => {
    beforeEach(async () => {
      await User.destroy({ where: {} });
      await ActiveSession.destroy({ where: {} });
    });

    it("deve retornar 401 se não houver cookie", async () => {
      const res = await request(app).post("/api/auth").send();
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Sem token de autenticação.");
    });

    it("deve retornar 404 se user não existe", async () => {
      // Gere um token com um id inexistente
      const fakeToken = jwt.sign({ id: 99 }, process.env.JWT_SECRET, { algorithm: "HS256" });
      const res = await request(app)
        .post("/api/auth")
        .set("Cookie", [`LojaRoupa=${fakeToken}`])
        .send();
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found.");
    });

    it("deve retornar 403 se a active session não for encontrada", async () => {
      const password = "senhaTeste";
      const hashedPassword = await bcrypt.hash(password, 8);
      const user = await User.create({
        name: "Usuário Teste",
        email: "teste@example.com",
        password: hashedPassword,
        accessLevel: "user",
      });
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { algorithm: "HS256" });
      // Não cria ActiveSession
      const res = await request(app)
        .post("/api/auth")
        .set("Cookie", [`LojaRoupa=${token}`])
        .send();
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe("No active session found for the user.");
    });

    it("deve retornar 200 e o user se tudo estiver ok", async () => {
      const password = "senhaTeste";
      const hashedPassword = await bcrypt.hash(password, 8);
      const user = await User.create({
        name: "Usuário Teste",
        email: "ok@example.com",
        password: hashedPassword,
        accessLevel: "user",
      });
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { algorithm: "HS256" });
      // Cria ActiveSession para o usuário
      await ActiveSession.upsert({
        user: user.email,
        session: token,
        expiresat: new Date(Date.now() + 120 * 60 * 1000),
      });
      const res = await request(app)
        .post("/api/auth")
        .set("Cookie", [`LojaRoupa=${token}`])
        .send();
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toEqual(
        expect.objectContaining({ id: user.id, email: user.email })
      );
    });
  });

  describe("POST /logout", () => {
    beforeEach(async () => {
      await ActiveSession.destroy({ where: {} });
    });

    it("deve retornar 401 se não houver token", async () => {
      const res = await request(app).post("/api/logout").send();
      // O middleware de autenticação retorna 401 se não houver token
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Sem token de autenticação.");
    });

    it("deve retornar 200 e limpar cookie se logout com sucesso", async () => {
      const password = "senhaTeste";
      const hashedPassword = await bcrypt.hash(password, 8);
      const user = await User.create({
        name: "Usuário Teste",
        email: "logout@example.com",
        password: hashedPassword,
        accessLevel: "user",
      });
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { algorithm: "HS256" });
      await ActiveSession.upsert({
        user: user.email,
        session: token,
        expiresat: new Date(Date.now() + 120 * 60 * 1000),
      });
      const res = await request(app)
        .post("/api/logout")
        .set("Cookie", [`LojaRoupa=${token}`])
        .send();
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Logged out successfully.");
      // Você pode ainda verificar que o cookie foi limpo verificando os cabeçalhos, se necessário.
    });
  });
});
