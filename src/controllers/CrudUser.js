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

/**
 * Função para atualizar um usuário existente.
 * 
 * @param {object} req - Objeto de requisição do Express.
 * @param {object} res - Objeto de resposta do Express.
 * @returns {object} Resposta JSON com status de atualização ou mensagem de erro.
 */
const editUser = async (req, res) => {
  try {
    const { id } = req.params; // ID do usuário a ser atualizado
    const { name, email, password, accessLevel } = req.body;

    // Encontre o usuário pelo ID
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Atualize os campos fornecidos
    if (name) user.name = name;
    if (email) user.email = email;
    if (accessLevel) user.accessLevel = accessLevel;

    // Se a senha for fornecida, faça o hash antes de atualizar
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    // Salve as alterações no banco de dados
    await user.save();

    return res.status(200).json({ message: 'Usuário atualizado com sucesso!', user });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

/**
 * Função para remover um usuário existente.
 * 
 * @param {object} req - Objeto de requisição do Express.
 * @param {object} res - Objeto de resposta do Express.
 * @returns {object} Resposta JSON com status de remoção ou mensagem de erro.
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params; // ID do usuário a ser removido

    // Encontre o usuário pelo ID
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Remova o usuário do banco de dados
    await user.destroy();

    return res.status(200).json({ message: 'Usuário removido com sucesso!' });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

module.exports = {
  registerUser,
  updateUser,
  deleteUser
};
