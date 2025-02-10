// Criando os mocks
jest.mock('../../../src/config/database', () => require('../../mocks/database'));
jest.mock('../../../src/models/User', () => require('../../mocks/User'));
jest.mock('../../../src/models/Product', () => require('../../mocks/Product'));
jest.mock('../../../src/models/Category', () => require('../../mocks/Category'));
jest.mock('../../../src/models/ActiveSession');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const request = require('supertest');
const app = require('../../../src/app'); 

// Mocks necessários para simular as interações com o banco e funções externas
const User = require('../../../src/models/User');
const ActiveSession = require('../../../src/models/ActiveSession');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

if (!User.findOne.mockResolvedValue) {
  User.findOne = jest.fn();
}
if (!ActiveSession.upsert) {
  ActiveSession.upsert = jest.fn();
}

describe('Rotas de Autenticação', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Limpa os mocks antes de cada teste para garantir independência
  });

  it('POST /api/sign deve retornar token com credenciais válidas', async () => {
    // Mockando o comportamento esperado do banco de dados e funções externas
    const fakeUser = {
      id: 1,
      email: 'usuarioTeste@example.com',
      password: 'hashedPassword',
      accessLevel: 'user',
      clientId: 'client1',
    };

    // Simula a busca do usuário no banco
    User.findOne.mockResolvedValue(fakeUser);
    // Simula a comparação da senha
    bcrypt.compare.mockResolvedValue(true);
    // Simula a criação do token JWT
    jwt.sign.mockReturnValue('fakeToken');
    // Simula a criação da sessão ativa
    ActiveSession.upsert.mockResolvedValue();

    // Faz a requisição para a rota de login
    const res = await request(app)
      .post('/api/sign')
      .send({ email: 'usuarioTeste@example.com', password: 'senhaTeste' });

    // Verifica se o status está correto e se o token foi retornado
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');
    expect(res.body).toHaveProperty('message', 'Login realizado com sucesso.');
    
    // Verificando se o cookie foi setado corretamente
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /api/sign deve retornar erro com credenciais inválidas', async () => {
    // Simula que o usuário não existe no banco
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/sign')
      .send({ email: 'usuarioInexistente@example.com', password: 'senhaErrada' });

    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('message', 'Usuário não cadastrado.');
  });

  it('POST /api/sign deve retornar erro se a senha estiver incorreta', async () => {
    const fakeUser = {
      id: 1,
      email: 'usuarioTeste@example.com',
      password: 'hashedPassword',
      accessLevel: 'user',
      clientId: 'client1',
    };

    // Simula o usuário encontrado
    User.findOne.mockResolvedValue(fakeUser);
    // Simula a comparação de senha falha
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/sign')
      .send({ email: 'usuarioTeste@example.com', password: 'senhaErrada' });

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('message', 'Email ou senha inválidos.');
  });
});
