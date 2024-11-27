const bcrypt = require('bcrypt');
const  User  = require('../models/User'); // Importa o modelo User
require('dotenv').config(); // Carrega variáveis de ambiente do arquivo .env

/**
 * Função para cadastrar um novo usuário.
 * 
 * @param {object} req - Objeto de requisição do Express.
 * @param {object} res - Objeto de resposta do Express.
 * @returns {object} Resposta JSON com status de cadastro ou mensagem de erro.
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, accessLevel } = req.body;

    // Validação básica de entrada
    if (!name || !email || !password || !accessLevel) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    // Verifica se o usuário já existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Usuário já cadastrado.' });
    }

    // Hash da senha
    
    const hashedPassword = await bcrypt.hash(password, 8)

    // Criação do novo usuário
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      accessLevel
    });

    return res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser });
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

module.exports = {
  registerUser
};
