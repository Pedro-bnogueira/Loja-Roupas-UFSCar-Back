const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User")
const ActiveSession = require("../models/ActiveSession")
require('dotenv').config(); // Carrega variáveis de ambiente do arquivo .env

// Constante para o nome do cookie de autenticação
const COOKIE_NAME = "LojaRoupa";

/**
 * Função de autenticação que verifica o token JWT presente nos cookies.
 * 
 * @param {object} req - Objeto de requisição do Express.
 * @param {object} res - Objeto de resposta do Express.
 * @returns {object} Resposta JSON com dados do usuário ou mensagem de erro.
 */
const auth = async (req, res) => {
    try {
        // Recupera o token JWT do cookie
        const token = req.cookies[COOKIE_NAME];

        // Verifica se o token está presente
        if (!token) {
            // Responde com 401 Unauthorized se o token não estiver presente
            return res.status(401).json({ message: "Sem token de autenticação." });
        }

        let decoded;

        try {
            // Verifica e decodifica o token JWT usando a chave secreta e o algoritmo HS256
            decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
        } catch (err) {
            // Responde com 401 Unauthorized se a verificação do token falhar
            return res.status(401).json({ message: "Invalid or expired authentication token." });
        }

        // Busca o usuário no banco de dados pelo ID decodificado do token
        const user = await User.findOne({ where: { id: decoded.id } });

        // Verifica se o usuário foi encontrado
        if (!user) {
            // Responde com 404 Not Found se o usuário não existir
            return res.status(404).json({ message: "User not found." });
        }

        // Busca a sessão ativa do usuário pelo email
        const activeSession = await ActiveSession.findOne({ where: { user: user.email } });

        // Verifica se a sessão ativa foi encontrada
        if (!activeSession) {
            // Responde com 403 Forbidden se não houver sessão ativa
            return res.status(403).json({ message: "No active session found for the user." });
        }

        // Compara o token da sessão ativa com o token do cookie
        if (activeSession.session !== token) {
            // Responde com 403 Forbidden se os tokens não corresponderem
            return res.status(403).json({ message: "Session token does not match." });
        }

        // Se todas as verificações passarem, responde com os dados do usuário
        return res.status(200).json({ user });
    } catch (error) {
        // Loga o erro para depuração
        console.error("Authentication Error:", error);

        // Responde com 500 Internal Server Error para erros inesperados
        return res.status(500).json({ message: "Internal server error." });
    }
};

/**
 * Função de login que autentica o usuário, cria uma sessão ativa e gera um token JWT.
 * 
 * @param {object} req - Objeto de requisição do Express.
 * @param {object} res - Objeto de resposta do Express.
 * @returns {object} Resposta JSON com status de login ou mensagem de erro.
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const ip = req.ip;
        console.log('Received login request from IP:', ip);
        console.log('Email:', email);
        console.log('password:', password);

        // Validação básica de entrada
        if (!email || !password || email.trim() === '' || password.trim() === '') {
            return res.status(400).json({ message: 'Preencha os campos corretamente.' });
        }

        // Busca o usuário pelo email
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'Usuário não cadastrado.' });
        }

        // Verifica se a senha está correta
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log(user.password)
        console.log(isPasswordValid)
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }

        // Gera o token JWT
        const tokenPayload = { id: user.id, accessLevel: user.accessLevel, clientId: user.clientId };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
            expiresIn: '120m', // Token expira em 120 minutos
            algorithm: 'HS256',
        });

        // Cria uma sessão ativa ou atualiza a existente
        await ActiveSession.upsert({
            user: email,
            session: token,
            expiresat: new Date(Date.now() + 120 * 60 * 1000), // 120 minutos a partir de agora
        });

        // Define o cookie com o token JWT
        res.cookie(COOKIE_NAME, token, {
          httpOnly: true,          // Garante que o cookie não pode ser acessado via JavaScript no navegador
          sameSite: 'None',        // Permite o envio do cookie entre domínios diferentes
          secure: process.env.NODE_ENV === 'production',
        });


        // Log para verificar se o cookie foi setado
        console.log(`Cookie '${COOKIE_NAME}' criado com sucesso. Configurações:`);
        console.log({
          httpOnly: true,
          sameSite: 'None',
          secure: process.env.NODE_ENV === 'production',
          token: token
        });

        console.log('Authentication successful for user:', email);
        console.log('JWT Token:', token);

        return res.status(200).json({ status: 'success', message: 'Login realizado com sucesso.', token: token });
    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ message: 'Erro de servidor.' });
    }
};


module.exports = {
    auth,
    login
};
