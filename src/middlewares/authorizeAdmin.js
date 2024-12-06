/**
 * Middleware para verificar se o usuário é administrador.
 * Deve ser usado após o middleware de autenticação.
 * 
 * @param {object} req - Objeto de requisição do Express.
 * @param {object} res - Objeto de resposta do Express.
 * @param {function} next - Função para passar para o próximo middleware.
 */
const authorizeAdmin = (req, res, next) => {
    try {
        // Verifica se o usuário está autenticado e anexado à requisição
        if (!req.user) {
            return res.status(401).json({ message: 'Usuário não autenticado.' });
        }

        // Verifica se o nível de acesso é 'admin'
        if (req.user.accessLevel !== 'admin') {
            return res.status(403).json({ message: 'Acesso proibido. Administradores apenas.' });
        }

        // Permite o acesso
        next();
    } catch (error) {
        console.error('Erro no middleware authorizeAdmin:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

module.exports = { authorizeAdmin };
