
jest.mock('jsonwebtoken');
jest.mock("../../../src/models/User", () => require("../../mocks/User"));
jest.mock('../../../src/models/ActiveSession'); 

const jwt = require('jsonwebtoken');
const { authenticate } = require('../../../src/middlewares/authenticate');
const User = require("../../../src/models/User");
const ActiveSession = require('../../../src/models/ActiveSession');


describe('Authenticate Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { cookies: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('Deve bloquear se não houver token', async () => {
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('Deve bloquear token inválido', async () => {
    req.cookies.LojaRoupa = 'token_invalido';
    jwt.verify.mockImplementation(() => { throw new Error(); });

    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('Deve permitir token válido e sessão ativa', async () => {
    const mockUser = { id: 1, email: 'user@test.com' };
    const mockToken = 'token_valido';
    const mockSession = { session: mockToken };

    req.cookies.LojaRoupa = mockToken;
    jwt.verify.mockReturnValue({ id: mockUser.id });
    User.findOne.mockResolvedValue(mockUser);
    ActiveSession.findOne.mockResolvedValue(mockSession);

    await authenticate(req, res, next);
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
  });

  it('Deve retornar 404 se o usuário decodificado não existir', async () => {
    const mockToken = 'token_valido';
    req.cookies.LojaRoupa = mockToken;
    
    // Mock do JWT e User
    jwt.verify.mockReturnValue({ id: 999 }); // ID inexistente
    User.findOne.mockResolvedValue(null);
  
    await authenticate(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Usuário não encontrado."
    });
  });

  it('Deve bloquear se não houver sessão ativa para o usuário', async () => {
    const mockUser = { id: 1, email: 'user@test.com' };
    const mockToken = 'token_valido';
    
    req.cookies.LojaRoupa = mockToken;
    jwt.verify.mockReturnValue({ id: mockUser.id });
    User.findOne.mockResolvedValue(mockUser);
    ActiveSession.findOne.mockResolvedValue(null); // 👈 Sem sessão
  
    await authenticate(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Sessão ativa não encontrada para o usuário."
    });
  });

  it('Deve bloquear se o token da sessão for diferente', async () => {
    const mockUser = { id: 1, email: 'user@test.com' };
    const mockToken = 'token_valido';
    const mockSession = { session: 'outro_token' }; // 👈 Token diferente
    
    req.cookies.LojaRoupa = mockToken;
    jwt.verify.mockReturnValue({ id: mockUser.id });
    User.findOne.mockResolvedValue(mockUser);
    ActiveSession.findOne.mockResolvedValue(mockSession);
  
    await authenticate(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "O token da sessão não corresponde."
    });
  });

  it('Deve retornar 500 em caso de erro inesperado', async () => {
    const mockToken = 'token_valido';
    req.cookies.LojaRoupa = mockToken;
    
    // Configuração para passar pela verificação do JWT
    jwt.verify.mockReturnValue({ id: 1 });
    
    // Força um erro na busca do usuário
    User.findOne.mockImplementation(() => {
      throw new Error('Erro simulado no banco de dados');
    });
  
    await authenticate(req, res, next);
    
    // Verificações
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Erro interno do servidor."
    });
  });
});