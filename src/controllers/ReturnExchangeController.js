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
                        as: "product",
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

module.exports = {
    registerReturn,
};
