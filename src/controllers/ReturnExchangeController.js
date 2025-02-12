const TransactionHistory = require("../models/TransactionHistory");
const Product = require("../models/Product");
const Stock = require("../models/Stock");
const sequelize = require("../config/database");

/**
 * Função para registrar uma devolução de item.
 * Req:
 * - transactionId (a transação original)
 */
const registerReturn = async (req, res) => {
    const t = await sequelize.transaction();
    console.log(req.body);
    try {
        const { transactionId } = req.body;

        if (!transactionId) {
            await t.rollback();
            return res
                .status(400)
                .json({ message: "ID da transação é obrigatório." });
        }

        // Obter o usuário autenticado (autenticação populou req.user)
        const userId = req.user && req.user.id;
        if (!userId) {
            await t.rollback();
            return res
                .status(401)
                .json({ message: "Usuário não autenticado." });
        }

        // Buscar a transação original
        const originalTransaction = await TransactionHistory.findByPk(
            transactionId,
            {
                transaction: t,

                include: [
                    {
                        model: Product,
                        as: "Product",
                    },
                ],
            }
        );

        if (!originalTransaction) {
            await t.rollback();
            return res
                .status(404)
                .json({ message: "Transação não encontrada." });
        }

        // Marcar a transação original como devolvida
        originalTransaction.isReturned = true;
        await originalTransaction.save({ transaction: t });

        // Atualizar o estoque do produto
        const product = await Product.findByPk(originalTransaction.productId, {
            transaction: t,
        });
        const stockEntry = await Stock.findOne({
            where: { productId: product.id },
            transaction: t,
        });
        if (stockEntry) {
            stockEntry.quantity += originalTransaction.quantity;
            await stockEntry.save({ transaction: t });
        } else {
            // Criar novo registro de Stock se não existir
            await Stock.create({
              productId: product.id,
              quantity: originalTransaction.quantity,
              operationType: 'in'
            }, { transaction: t });
          }

        // Registrar no histórico de transações que foi feita uma devolução
        const newTransaction = await TransactionHistory.create(
            {
                type: "return",
                productId: originalTransaction.productId,
                quantity: originalTransaction.quantity,
                transactionPrice: originalTransaction.transactionPrice,
                supplierOrBuyer: originalTransaction.supplierOrBuyer,
                // Data e hora atual para a devolução
                transactionDate: new Date(),
                userId: userId || originalTransaction.userId, // se quiser manter ou sobrescrever o usuário
            },
            { transaction: t }
        );

        // Confirmar a transação
        await t.commit();

        return res.status(201).json({
            message: "Devolução registrada com sucesso!",
            transactionHistory: newTransaction,
        });
    } catch (error) {
        await t.rollback();
        console.error("Erro ao registrar devolução:", error);
        return res.status(500).json({ message: "Erro interno do servidor." });
    }
};

/**
 * Função para registrar uma troca de item.
 * Req:
 * - transactionId (a transação original)
 * - newProducts (array de objetos: { productId, quantity })
 */
const registerExchange = async (req, res) => {
    const t = await sequelize.transaction();
    console.log("Recebido no body:", req.body);
    try {
        const { transactionId, newProducts } = req.body;

        // Validação de campos obrigatórios
        if (!transactionId || !Array.isArray(newProducts) || newProducts.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: "transactionId e newProducts são obrigatórios." });
        }

        // Obter o usuário autenticado (autenticação populou req.user)
        const userId = req.user && req.user.id;
        if (!userId) {
            await t.rollback();
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        // Buscar a transação original
        const originalTransaction = await TransactionHistory.findByPk(
            transactionId,
            {
                transaction: t,

                include: [
                    {
                        model: Product,
                        as: "Product",
                    },
                ],
            }
        );
        console.log("------------------" + originalTransaction)

        if (!originalTransaction) {
            await t.rollback();
            console.log("Transação original não encontrada.")
            return res.status(404).json({ message: "Transação original não encontrada." });
        }

        // Verificar se a transação original é de saída ('out')
        if (originalTransaction.type !== 'out') {
            await t.rollback();
            return res.status(400).json({ message: "Apenas transações de saída podem ser trocadas." });
        }

        // Verificar se a transação já foi devolvida/trocada
        if (originalTransaction.isReturned) {
            await t.rollback();
            return res.status(400).json({ message: "Esta transação já foi devolvida/trocada." });
        }

        // Marcar a transação original como devolvida
        originalTransaction.isReturned = true;
        await originalTransaction.save({ transaction: t });

        // Calcular o valor total da transação original
        const originalTotalValue = parseFloat(originalTransaction.transactionPrice).toFixed(2);

        // Calcular o valor total dos novos produtos selecionados
        let newTotalValueRaw = 0;
        for (const np of newProducts) {
            const product = await Product.findByPk(np.productId, { transaction: t });
            if (!product) {
                await t.rollback();
                console.log(`Produto com ID ${np.productId} não encontrado.`)
                return res.status(404).json({ message: `Produto com ID ${np.productId} não encontrado.` });
            }
            newTotalValueRaw += parseFloat(product.price) * parseInt(np.quantity, 10);
        }

        const newTotalValue = parseFloat(newTotalValueRaw).toFixed(2);

        // Validar se o valor total dos novos produtos é igual ao original
        if (newTotalValue !== originalTotalValue) {
            await t.rollback();
            return res.status(400).json({ message: "A soma total dos novos produtos deve ser igual ao valor da transação original." });
        }

        // Array para coletar todas as transações criadas
        const createdTransactions = [];

        // Processar cada novo produto
        for (const np of newProducts) {
            const { productId, quantity } = np;

            const product = await Product.findByPk(productId, { transaction: t });
            if (!product) {
                await t.rollback();
                console.log(`Produto com ID ${productId} não encontrado.`)
                return res.status(404).json({ message: `Produto com ID ${productId} não encontrado.` });
            }

            // Verificar se há estoque suficiente do novo produto
            const stockEntry = await Stock.findOne({
                where: { productId },
                transaction: t,
            });

            if (!stockEntry || stockEntry.quantity < quantity) {
                await t.rollback();
                return res.status(400).json({ message: `Estoque insuficiente para o produto ID ${productId}.` });
            }

            // Atualizar o estoque: remover os novos produtos
            stockEntry.quantity -= quantity;
            await stockEntry.save({ transaction: t });

            // Registrar a nova saída no histórico de transações
            const exchangeOutTransaction = await TransactionHistory.create({
                type: "exchange_out",
                productId: productId,
                quantity: quantity,
                transactionPrice: (product.price * quantity).toFixed(2),
                supplierOrBuyer: originalTransaction.supplierOrBuyer, // Pode ser ajustado conforme a lógica
                transactionDate: new Date(),
                userId: userId,
                isReturned: false,
            }, { transaction: t });

            // Adicionar a transação criada ao array
            createdTransactions.push(exchangeOutTransaction);
        }

        // Atualizar o estoque: devolver o produto original
        const originalProductStock = await Stock.findOne({
            where: { productId: originalTransaction.productId },
            transaction: t,
        });

        if (originalProductStock) {
            originalProductStock.quantity += originalTransaction.quantity;
            await originalProductStock.save({ transaction: t });
        } else {
            // Se não houver entrada de estoque para o produto original, criar uma
            await Stock.create({
                productId: originalTransaction.productId,
                quantity: originalTransaction.quantity,
                operationType: 'in', 
            }, { transaction: t });
        }

        // Registrar a devolução no histórico de transações
        const exchangeInTransaction = await TransactionHistory.create({
            type: "exchange_in",
            productId: originalTransaction.productId,
            quantity: originalTransaction.quantity,
            transactionPrice: originalTransaction.transactionPrice,
            supplierOrBuyer: originalTransaction.supplierOrBuyer,
            transactionDate: new Date(),
            userId: userId,
            isReturned: true, // Marcar como devolvida/trocada
        }, { transaction: t });

        // Adicionar a transação criada ao array
        createdTransactions.push(exchangeInTransaction);

        // Confirmar a transação
        await t.commit();

        return res.status(201).json({
            message: "Troca registrada com sucesso!",
            transactions: createdTransactions, // Retorna todas as transações criadas
        });

    } catch (error) {
        await t.rollback();
        console.error("Erro ao registrar troca:", error);
        return res.status(500).json({ message: "Erro interno do servidor." });
    }
}


module.exports = {
    registerReturn,
    registerExchange,
};
