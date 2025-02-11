const { validateUserFields, validateUpdateUserFields } = require('../../../src/validators/userValidators');

describe('User Validators', () => {
  describe('validateUserFields', () => {
    const validInput = {
      name: 'João Silva',
      email: 'joao@example.com',
      password: 'senhaSegura123',
      accessLevel: 'user'
    };

    it('Deve passar com dados válidos', () => {
      expect(() => validateUserFields(
        validInput.name,
        validInput.email,
        validInput.password,
        validInput.accessLevel
      )).not.toThrow();
    });

    it('Deve falhar com campo faltante', () => {
      expect(() => validateUserFields(
        null,
        validInput.email,
        validInput.password,
        validInput.accessLevel
      )).toThrow('Todos os campos são obrigatórios.');
    });

    it('Deve falhar com nome curto', () => {
      expect(() => validateUserFields(
        'J', // Nome com 1 caractere
        validInput.email,
        validInput.password,
        validInput.accessLevel
      )).toThrow('O nome deve ter entre 2 e 100 caracteres.');
    });

    it('Deve falhar com nome longo', () => {
      const longName = 'A'.repeat(101);
      expect(() => validateUserFields(
        longName,
        validInput.email,
        validInput.password,
        validInput.accessLevel
      )).toThrow('O nome deve ter entre 2 e 100 caracteres.');
    });

    it('Deve falhar com email inválido', () => {
      expect(() => validateUserFields(
        validInput.name,
        'email-invalido',
        validInput.password,
        validInput.accessLevel
      )).toThrow('Email inválido.');
    });

    it('Deve falhar com senha curta', () => {
      expect(() => validateUserFields(
        validInput.name,
        validInput.email,
        '12345', // 5 caracteres
        validInput.accessLevel
      )).toThrow('A senha deve ter entre 6 e 100 caracteres.');
    });

    it('Deve falhar com nível de acesso inválido', () => {
      expect(() => validateUserFields(
        validInput.name,
        validInput.email,
        validInput.password,
        'invalid_level'
      )).toThrow('Nível de acesso inválido.');
    });
  });

  describe('validateUpdateUserFields', () => {
    const validInput = {
      name: 'Maria Oliveira',
      email: 'maria@example.com',
      accessLevel: 'admin'
    };

    it('Deve passar com dados válidos', () => {
      expect(() => validateUpdateUserFields(
        validInput.name,
        validInput.email,
        validInput.accessLevel
      )).not.toThrow();
    });

    it('Deve falhar com campo faltante', () => {
      expect(() => validateUpdateUserFields(
        null,
        validInput.email,
        validInput.accessLevel
      )).toThrow('Todos os campos são obrigatórios.');
    });

    it('Deve falhar com email inválido na atualização', () => {
      expect(() => validateUpdateUserFields(
        validInput.name,
        'email@invalido',
        validInput.accessLevel
      )).toThrow('Email inválido.');
    });

    it('Deve aceitar todos os níveis de acesso válidos', () => {
      const levels = ['admin', 'user', 'guest'];
      levels.forEach(level => {
        expect(() => validateUpdateUserFields(
          validInput.name,
          validInput.email,
          level
        )).not.toThrow();
      });
    });
  });
});