const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ActiveSession = require("../models/ActiveSession");
require('dotenv').config(); // Carrega variáveis de ambiente do arquivo .env

// Constante para o nome do cookie de autenticação
const COOKIE_NAME = "LojaRoupa";

/**
 * Middleware de autenticação que verifica o token JWT presente nos cookies.
 * 
 * @param {object} req - Objeto de requisição do Express.
 * @param {object} res - Objeto de resposta do Express.
 * @param {function} next - Função para passar para o próximo middleware.
 */
const authenticate = async (req, res, next) => {
    try {
        // Recupera o token JWT do cookie
        const token = req.cookies[COOKIE_NAME];

        // Verifica se o token está presente
        if (!token) {
            return res.status(401).json({ message: "Sem token de autenticação." });
        }

        let decoded;

        try {
            // Verifica e decodifica o token JWT usando a chave secreta e o algoritmo HS256
            decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
        } catch (err) {
            return res.status(401).json({ message: "Token de autenticação inválido ou expirado." });
        }

        // Busca o usuário no banco de dados pelo ID decodificado do token
        const user = await User.findOne({ where: { id: decoded.id } });

        // Verifica se o usuário foi encontrado
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }

        // Busca a sessão ativa do usuário pelo email
        const activeSession = await ActiveSession.findOne({ where: { user: user.email } });

        // Verifica se a sessão ativa foi encontrada
        if (!activeSession) {
            return res.status(403).json({ message: "Sessão ativa não encontrada para o usuário." });
        }

        // Compara o token da sessão ativa com o token do cookie
        if (activeSession.session !== token) {
            return res.status(403).json({ message: "O token da sessão não corresponde." });
        }

        // Anexa o usuário à requisição para uso posterior nos controladores
        req.user = user;
        next();
    } catch (error) {
        console.error("Erro no middleware de autenticação:", error);
        return res.status(500).json({ message: "Erro interno do servidor." });
    }
};

module.exports = { authenticate };