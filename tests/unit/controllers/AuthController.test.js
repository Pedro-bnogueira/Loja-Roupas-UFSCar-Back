const { auth, login } = require('../../../src/controllers/AuthController');
const User = require('../../../src/models/User');
const ActiveSession = require('../../../src/models/ActiveSession');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Garanta que os mocks sejam configurados antes de importar qualquer coisa
jest.mock('../../../src/models/User', () => require('../../mocks/User'));
jest.mock('../../../src/models/ActiveSession'); 
jest.mock('jsonwebtoken');
jest.mock('bcrypt');

describe('AuthController - auth function', () => {
  let req, res;

  beforeEach(() => {
    req = { cookies: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn()
    };
    jest.clearAllMocks();
  });

  it('deve retornar 401 se não houver token de autenticação', async () => {
    // Sem token em req.cookies
    await auth(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Sem token de autenticação." });
  });

  it('deve retornar 401 se a verificação do token falhar', async () => {
    req.cookies["LojaRoupa"] = "tokenInvalido";
    jwt.verify.mockImplementation(() => { throw new Error("Invalid token"); });
    await auth(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired authentication token." });
  });

  it('deve retornar 404 se o usuário não for encontrado', async () => {
    req.cookies["LojaRoupa"] = "tokenValido";
    const fakeDecoded = { id: 1 };
    jwt.verify.mockReturnValue(fakeDecoded);
    User.findOne.mockResolvedValue(null);
    await auth(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found." });
  });

  it('deve retornar 403 se não houver sessão ativa para o usuário', async () => {
    req.cookies["LojaRoupa"] = "tokenValido";
    const fakeDecoded = { id: 1 };
    jwt.verify.mockReturnValue(fakeDecoded);
    const fakeUser = { id: 1, email: "test@example.com" };
    User.findOne.mockResolvedValue(fakeUser);
    ActiveSession.findOne.mockResolvedValue(null);
    await auth(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "No active session found for the user." });
  });

  it('deve retornar 403 se o token da sessão não corresponder ao cookie', async () => {
    req.cookies["LojaRoupa"] = "tokenValido";
    const fakeDecoded = { id: 1 };
    jwt.verify.mockReturnValue(fakeDecoded);
    const fakeUser = { id: 1, email: "test@example.com" };
    User.findOne.mockResolvedValue(fakeUser);
    ActiveSession.findOne.mockResolvedValue({ session: "outroToken" });
    await auth(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Session token does not match." });
  });

  it('deve retornar 200 e os dados do usuário se a autenticação passar', async () => {
    req.cookies["LojaRoupa"] = "tokenValido";
    const fakeDecoded = { id: 1 };
    jwt.verify.mockReturnValue(fakeDecoded);
    const fakeUser = { id: 1, email: "test@example.com" };
    User.findOne.mockResolvedValue(fakeUser);
    ActiveSession.findOne.mockResolvedValue({ session: "tokenValido" });
    await auth(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ user: fakeUser });
  });
});

describe('AuthController - login function', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, ip: "127.0.0.1" };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn()
    };
    jest.clearAllMocks();
  });

  it('deve retornar 400 se email ou senha não forem informados', async () => {
    req.body = { email: '', password: '' };
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Preencha os campos corretamente.' });
  });

  it('deve retornar 404 se o usuário não for encontrado', async () => {
    req.body = { email: "naocadastrado@example.com", password: "qualquer" };
    User.findOne.mockResolvedValue(null);
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuário não cadastrado.' });
  });

  it('deve retornar 401 se a senha estiver incorreta', async () => {
    req.body = { email: "test@example.com", password: "senhaErrada" };
    const fakeUser = { id: 1, email: "test@example.com", password: "hashedPassword" };
    User.findOne.mockResolvedValue(fakeUser);
    bcrypt.compare.mockResolvedValue(false);
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email ou senha inválidos.' });
  });

  it('deve retornar 200 e configurar o cookie se o login for bem-sucedido', async () => {
    req.body = { email: "test@example.com", password: "senhaCorreta" };
    const fakeUser = { id: 1, email: "test@example.com", password: "hashedPassword", accessLevel: "user", clientId: "client1" };
    User.findOne.mockResolvedValue(fakeUser);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("fakeToken");
    // Mock para o upsert da sessão
    ActiveSession.upsert = jest.fn().mockResolvedValue();
    await login(req, res);
    expect(bcrypt.compare).toHaveBeenCalledWith("senhaCorreta", "hashedPassword");
    expect(jwt.sign).toHaveBeenCalled();
    expect(ActiveSession.upsert).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith("LojaRoupa", "fakeToken");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Login realizado com sucesso.' });
  });
});
