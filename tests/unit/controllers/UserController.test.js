jest.mock("../../../src/models/User", () => require("../../mocks/User"));
jest.mock("../../../src/validators/userValidators", () =>
  require("../../mocks/userValidators")
);
jest.mock("bcrypt", () => require("../../mocks/bcrypt"));

const { registerUser, editUser, deleteUser, getAllUsers } = require("../../../src/controllers/UserController");
const User = require("../../../src/models/User");
const bcrypt = require("bcrypt");
const {
  validateUserFields,
  validateUpdateUserFields,
} = require("../../../src/validators/userValidators");

describe("UserController", () => {
  let req, res;

  beforeEach(() => {
    // Resposta padrão
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    // Limpa todos os mocks
    jest.clearAllMocks();
  });

  describe("registerUser", () => {
    beforeEach(() => {
      req = { body: {} };
    });

    it("deve retornar 409 se o usuário já existir", async () => {
      // Simula que o validador não joga erro
      validateUserFields.mockImplementation(() => {});

      // Simula que findOne retorna algo (usuário existente)
      User.findOne.mockResolvedValue({ id: 1, email: "usuarioTeste@example.com" });

      req.body = {
        name: "Teste",
        email: "usuarioTeste@example.com",
        password: "senha123",
        accessLevel: "user",
      };

      await registerUser(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ where: { email: "usuarioTeste@example.com" } });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ message: "Usuário já cadastrado." });
    });

    it("deve criar usuário com sucesso (201) se não existir", async () => {
      validateUserFields.mockImplementation(() => {});
      User.findOne.mockResolvedValue(null); // não existe
      User.create.mockResolvedValue({
        id: 99,
        name: "Teste Novo",
        email: "novo@example.com",
        accessLevel: "user",
      });
      // Simula bcrypt.hash
      bcrypt.hash.mockResolvedValue("hash_senha");

      req.body = {
        name: "Teste Novo",
        email: "novo@example.com",
        password: "senha123",
        accessLevel: "user",
      };

      await registerUser(req, res);

      expect(validateUserFields).toHaveBeenCalledWith(
        "Teste Novo",
        "novo@example.com",
        "senha123",
        "user"
      );
      expect(User.findOne).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith("senha123", 8);
      expect(User.create).toHaveBeenCalledWith({
        name: "Teste Novo",
        email: "novo@example.com",
        password: "hash_senha",
        accessLevel: "user",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Usuário cadastrado com sucesso!",
        user: expect.objectContaining({
          id: 99,
          name: "Teste Novo",
          email: "novo@example.com",
        }),
      });
    });

    it("deve retornar 500 se ocorrer um erro inesperado", async () => {
      validateUserFields.mockImplementation(() => {});
      // Simula erro no findOne
      User.findOne.mockRejectedValue(new Error("Simulated error"));

      req.body = {
        name: "Erro",
        email: "erro@example.com",
        password: "senha",
        accessLevel: "admin",
      };

      await registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Erro interno do servidor.",
      });
    });
  });

  describe("editUser", () => {
    beforeEach(() => {
      req = { params: {}, body: {} };
    });

    it("deve retornar 404 se o usuário não for encontrado", async () => {
      validateUpdateUserFields.mockImplementation(() => {});
      User.findByPk.mockResolvedValue(null); // Não existe

      req.params.id = 999;
      await editUser(req, res);

      expect(User.findByPk).toHaveBeenCalledWith(999);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Usuário não encontrado.",
      });
    });

    it("deve atualizar usuário sem trocar senha se password não for fornecido", async () => {
      validateUpdateUserFields.mockImplementation(() => {});
      const mockUser = {
        id: 10,
        name: "Antigo Nome",
        email: "antigo@example.com",
        accessLevel: "user",
        password: "hash_antigo",
        save: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      req.params.id = 10;
      req.body = {
        name: "Novo Nome",
        email: "novo@example.com",
        accessLevel: "admin",
      };

      await editUser(req, res);

      expect(validateUpdateUserFields).toHaveBeenCalledWith(
        "Novo Nome",
        "novo@example.com",
        "admin"
      );
      expect(mockUser.name).toBe("Novo Nome");
      expect(mockUser.email).toBe("novo@example.com");
      expect(mockUser.accessLevel).toBe("admin");
      expect(mockUser.password).toBe("hash_antigo"); // não alterou
      expect(mockUser.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Usuário atualizado com sucesso!",
        user: mockUser,
      });
    });

    it("deve atualizar a senha se for fornecida", async () => {
      validateUpdateUserFields.mockImplementation(() => {});
      const mockUser = {
        id: 10,
        name: "Antigo Nome",
        email: "antigo@example.com",
        accessLevel: "user",
        password: "hash_antigo",
        save: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      // Simula bcrypt.hash
      bcrypt.hash.mockResolvedValue("novo_hash");

      req.params.id = 10;
      req.body = {
        name: "Outro Nome",
        email: "outro@example.com",
        password: "nova_senha",
        accessLevel: "user",
      };

      await editUser(req, res);

      expect(bcrypt.hash).toHaveBeenCalledWith("nova_senha", 10);
      expect(mockUser.password).toBe("novo_hash");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Usuário atualizado com sucesso!",
        user: mockUser,
      });
    });

    it("deve retornar 500 se ocorrer um erro inesperado", async () => {
      validateUpdateUserFields.mockImplementation(() => {});
      User.findByPk.mockRejectedValue(new Error("DB error"));

      req.params.id = 77;
      req.body = { name: "Nome" };

      await editUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Erro interno do servidor.",
      });
    });
  });

  describe("deleteUser", () => {
    beforeEach(() => {
      req = { params: {} };
    });

    it("deve retornar 404 se o usuário não for encontrado", async () => {
      User.findByPk.mockResolvedValue(null);

      req.params.id = 999;
      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Usuário não encontrado.",
      });
    });

    it("deve deletar o usuário com sucesso", async () => {
      const mockUser = {
        id: 11,
        destroy: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      req.params.id = 11;
      await deleteUser(req, res);

      expect(mockUser.destroy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Usuário removido com sucesso!",
      });
    });

    it("deve retornar 500 se ocorrer um erro inesperado", async () => {
      User.findByPk.mockRejectedValue(new Error("DB error"));

      req.params.id = 66;
      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Erro interno do servidor.",
      });
    });
  });

  describe("getAllUsers", () => {
    it("deve retornar todos os usuários com status 200", async () => {
      const mockUsers = [
        { id: 1, name: "User1", email: "u1@example.com" },
        { id: 2, name: "User2", email: "u2@example.com" },
      ];
      User.findAll.mockResolvedValue(mockUsers);

      await getAllUsers(req, res);

      expect(User.findAll).toHaveBeenCalledWith({
        attributes: { exclude: ["password"] },
        order: [["id", "ASC"]],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ users: mockUsers });
    });

    it("deve retornar 500 se ocorrer um erro", async () => {
      User.findAll.mockRejectedValue(new Error("algum erro"));

      await getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Erro interno do servidor.",
      });
    });
  });
});
