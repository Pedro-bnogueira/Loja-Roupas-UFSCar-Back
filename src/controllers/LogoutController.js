const ActiveSession = require("../models/ActiveSession"); // Modelo de sessão ativa
const User = require("../models/User"); // Importa o modelo User
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Constante para o nome do cookie de autenticação
const COOKIE_NAME = "LojaRoupa";

/**
 * Função de logout que encerra a sessão ativa do usuário e limpa o token JWT do cookie.
 *
 * @param {object} req - Objeto de requisição do Express.
 * @param {object} res - Objeto de resposta do Express.
 * @returns {object} Resposta JSON com status de logout ou mensagem de erro.
 */
const logout = async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME]; // Recupera o token do cookie
        // Verifica se o token está presente
        if (!token) {
            return res
                .status(401) 
                .json({ message: "Sem token de autenticação." });
        }

        // Decodifica o token para obter o email do usuário
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.id);

        // Modifique após User.findByPk:
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Remove a sessão ativa do banco de dados
        await ActiveSession.destroy({
            where: { user: user.email },
        });

        // Limpa o cookie com o token
        res.clearCookie(COOKIE_NAME);

        console.log("Logout successful for user:", user.email);
        return res
            .status(200)
            .json({ status: "success", message: "Logged out successfully." });
    } catch (error) {
        console.error("Logout Error:", error);
        // Tratamento de erros
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: "Token expired" });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ message: "Invalid token" });
        }

        return res
            .status(500)
            .json({ message: "Internal server error during logout." });
    }
};

module.exports = {
    logout,
};
