// Função para validar os campos de usuário
const validateUserFields = (name, email, password, accessLevel) => {
    if (!name || !email || !password || !accessLevel) {
        throw new Error("Todos os campos são obrigatórios.");
    }

    // Validação do nome
    if (name.length < 2 || name.length > 100) {
        throw new Error("O nome deve ter entre 2 e 100 caracteres.");
    }

    // Validação do email
    const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
    if (!emailRegex.test(email)) {
        throw new Error("Email inválido.");
    }

    // Validação da senha
    if (password.length < 6 || password.length > 100) {
        throw new Error("A senha deve ter entre 6 e 100 caracteres.");
    }

    // Validação do nível de acesso
    const validAccessLevels = ["admin", "user", "guest"];
    if (!validAccessLevels.includes(accessLevel)) {
        throw new Error("Nível de acesso inválido.");
    }
};

module.exports = validateUserFields;
