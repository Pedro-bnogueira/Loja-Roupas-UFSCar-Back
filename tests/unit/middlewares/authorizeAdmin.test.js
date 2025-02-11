const { authorizeAdmin } = require('../../../src/middlewares/authorizeAdmin');

describe('AuthorizeAdmin Middleware', () => {
  let req, res, next;
  const originalConsoleError = console.error;

  beforeAll(() => {
    console.error = jest.fn(); // Mock do console.error
  });

  afterAll(() => {
    console.error = originalConsoleError; // Restaura o console.error original
  });

  beforeEach(() => {
    req = { user: null };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('Cenários de sucesso', () => {
    it('Deve permitir acesso quando o usuário é admin', () => {
      req.user = { accessLevel: 'admin' };
      authorizeAdmin(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('Cenários de falha', () => {
    it('Deve retornar 401 quando não há usuário autenticado', () => {
      authorizeAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'Usuário não autenticado.' 
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('Deve retornar 403 para accessLevel "user"', () => {
      req.user = { accessLevel: 'user' };
      authorizeAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Acesso proibido. Administradores apenas.'
      });
    });

    it('Deve retornar 403 para accessLevel "guest"', () => {
      req.user = { accessLevel: 'guest' };
      authorizeAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('Deve retornar 403 para accessLevel inválido', () => {
      req.user = { accessLevel: 'invalid_role' };
      authorizeAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Tratamento de erros', () => {
    it('Deve retornar 500 e logar erro em caso de exceção', () => {
        const mockError = new Error('Erro inesperado');
        
        req.user = {
          get accessLevel() { // 👈 Getter que lança erro quando acessado
            throw mockError;
          }
        };
        
        authorizeAdmin(req, res, next);
        
        expect(console.error).toHaveBeenCalledWith(
          'Erro no middleware authorizeAdmin:',
          mockError
        );
        expect(res.status).toHaveBeenCalledWith(500);
      });

    it('Deve manter a stack trace original em caso de erro', () => {
      const errorWithStack = new Error('Erro detalhado');
      errorWithStack.stack = 'stack_trace_details';
      
      req.user = { 
        get accessLevel() { throw errorWithStack; } 
      };
      
      authorizeAdmin(req, res, next);
      
      expect(console.error).toHaveBeenCalledWith(
        'Erro no middleware authorizeAdmin:',
        errorWithStack
      );
    });
  });

  describe('Validação de payload', () => {
    it('Deve tratar corretamente objetos user incompletos', () => {
      req.user = { }; // Sem accessLevel
      authorizeAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('Deve tratar accessLevel como case-sensitive', () => {
      req.user = { accessLevel: 'Admin' }; // Letra maiúscula
      authorizeAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});