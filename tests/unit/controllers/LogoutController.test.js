// Mock das dependências
jest.mock('jsonwebtoken');
jest.mock('../../../src/models/ActiveSession');
jest.mock('../../../src/models/User');
jest.mock('dotenv/config', () => ({ parsed: { JWT_SECRET: 'secret_key' } }));

const jwt = require('jsonwebtoken');
const { logout } = require('../../../src/controllers/LogoutController');
const ActiveSession = require('../../../src/models/ActiveSession');
const User = require('../../../src/models/User');


describe('LogoutController - logout', () => {
    let req, res;

    beforeEach(() => {
        req = {
            cookies: {
                LojaRoupa: 'valid.token.here'
            }
        };

        res = {
            clearCookie: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        // Resetar todos os mocks
        jest.clearAllMocks();
    });

    it('deve retornar 400 se nenhum token for fornecido', async () => {
        req.cookies = {};
        
        await logout(req, res);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "No token provided. Already logged out."
        });
    });

    it('deve retornar 401 se o token for inválido', async () => {
        jwt.verify.mockImplementation(() => {
            throw new jwt.JsonWebTokenError('Invalid token'); // Erro específico
        });

        await logout(req, res);
        
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid token" 
        });
    });

    it('deve retornar 404 se o usuário não for encontrado', async () => {
        jwt.verify.mockReturnValue({ id: 1 });
        User.findByPk.mockResolvedValue(null);

        await logout(req, res);
        
        expect(User.findByPk).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "User not found."
        });
    });

    it('deve retornar 500 se houver erro ao destruir a sessão', async () => {
        const mockUser = { email: 'user@test.com' };
        jwt.verify.mockReturnValue({ id: 1 });
        User.findByPk.mockResolvedValue(mockUser);
        ActiveSession.destroy.mockRejectedValue(new Error('Database error'));

        await logout(req, res);
        
        expect(ActiveSession.destroy).toHaveBeenCalledWith({
            where: { user: 'user@test.com' }
        });
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Internal server error during logout."
        });
    });

    it('deve executar logout com sucesso', async () => {
        const mockUser = { email: 'user@test.com' };
        jwt.verify.mockReturnValue({ id: 1 });
        User.findByPk.mockResolvedValue(mockUser);
        ActiveSession.destroy.mockResolvedValue(1);

        await logout(req, res);
        
        expect(User.findByPk).toHaveBeenCalledWith(1);
        expect(ActiveSession.destroy).toHaveBeenCalledWith({
            where: { user: 'user@test.com' }
        });
        expect(res.clearCookie).toHaveBeenCalledWith('LojaRoupa');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            status: "success",
            message: "Logged out successfully."
        });
    });

    it('deve retornar 500 para erros inesperados', async () => {
        jwt.verify.mockImplementation(() => {
            throw new Error('Unexpected error');
        });

        await logout(req, res);
        
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Internal server error during logout."
        });
    });
});