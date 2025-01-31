// controllers/StockController.js

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Stock = require('../models/Stock');
const Product = require('../models/Product');
const TransactionHistory = require('../models/TransactionHistory');
const User = require('../models/User'); // Supondo que você tenha um modelo User

/**
 * Registra uma movimentação de estoque (entrada ou saída):
 * - Se for 'in': Aumenta o estoque de um produto existente.
 * - Se for 'out': Diminui o estoque de um produto existente (ex. venda).
 * Em ambos os casos, registra a operação no TransactionHistory.
 */
const registerStockMovement = async (req, res) => {
  const t = await sequelize.transaction(); // Inicia uma transação

  try {
    const { productId, quantity, type, transactionPrice, supplierOrBuyer } = req.body;

    // Validação dos campos obrigatórios
    if (!productId || !quantity || !type || !transactionPrice || !supplierOrBuyer) {
      await t.rollback();
      return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    // Validação do tipo de operação
    if (!['in', 'out'].includes(type)) {
      await t.rollback();
      return res.status(400).json({ message: 'Tipo de transação inválido. Deve ser "in" ou "out".' });
    }

    // Obter o usuário autenticado (autenticação populou req.user)
    const userId = req.user && req.user.id;
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: 'Usuário não autenticado.' });
    }

    // Buscar o produto com seu alertThreshold
    const product = await Product.findByPk(productId, { 
      transaction: t,
      attributes: ['id', 'name', 'alertThreshold']
    });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    // Verificar se o produto tem campo stockQuantity ou algo similar
    // Se não tiver, crie esse campo no model Product (ex. "stockQuantity: { type: DataTypes.INTEGER, ... }")
    if (type === 'out') {
      // Se for saída, verifica se há quantidade suficiente
      if (product.stockQuantity < quantity) {
        await t.rollback();
        return res.status(400).json({ message: 'Estoque insuficiente para a operação.' });
      }
      // Decrementar quantidade
      product.stockQuantity -= quantity;
    } else {
      // Se for entrada ('in'), incrementa quantidade
      product.stockQuantity += quantity;
    }

    // Salvar atualização do produto
    await product.save({ transaction: t });

    // Registro no "TransactionHistory"
    const transactionHistory = await TransactionHistory.create({
      productId,
      type,
      supplierOrBuyer,
      quantity,
      transactionPrice,
      transactionDate: new Date(),
      userId,
    }, { transaction: t });

    // Registro no Model "Stock"
    // Verifica se já existe um registro de Stock para esse productId
    let stockEntry = await Stock.findOne({
      where: { productId },
      transaction: t,
    });

    if (!stockEntry) {
      // Se não existir, cria
      stockEntry = await Stock.create({
        productId,
        quantity: quantity, 
        operationType: type,
      }, { transaction: t });
    } else {
      // Ajusta o 'Stock' com base nessa movimentação
      if (type === 'in') {
        // Incrementa o campo "quantity" do Stock
        stockEntry.quantity += quantity;
      } else {
        // Decrementa
        // Verifica se não vai ficar negativo (pode variar conforme sua lógica)
        if (stockEntry.quantity < quantity) {
          // Se o stockEntry não puder ficar negativo
          // ou se você quiser apenas registrar o movimento:
          // fica a critério da regra de negócio
          stockEntry.quantity -= quantity;
        } else {
          stockEntry.quantity -= quantity;
        }
      }
    }

    

    stockEntry.operationType = type;

     // Verificação de estoque baixo
    if (product.alertThreshold && stockEntry.quantity <= product.alertThreshold) {
      console.log(`Alerta: ${product.name} está abaixo do limite (${stockEntry.quantity}/${product.alertThreshold})`);
      // Disparar notificação...
    }

    await stockEntry.save({ transaction: t });

    // Confirma a transação
    await t.commit();

    console.log(transactionHistory)

    // Retorna o registro de transação recém-criado
    return res.status(201).json({
      message: 'Movimentação de estoque registrada com sucesso!',
      transactionHistory,
    });

  } catch (error) {
    await t.rollback(); // Reverter a transação em caso de erro
    console.error('Erro ao registrar movimentação de estoque:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

/**
 * Função para obter o histórico de movimentações de estoque.
 */
const getStock = async (req, res) => {
  try {
    // Buscar todos os estoques, incluindo os dados do produto associado
    const stockData = await Stock.findAll({
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'price', 'size', 'color', 'alertThreshold'], // Dados do produto
        },
      ],
    });

    // Transformar os dados no formato desejado, se necessário
    const formattedStock = stockData.map((stock) => ({
      stockId: stock.id,
      productId: stock.productId,
      quantity: stock.quantity,
      product: {
        id: stock.product.id,
        name: stock.product.name,
        brand: stock.product.brand,
        price: stock.product.price,
        size: stock.product.size,
        color: stock.product.color,
        alertThreshold: stock.product.alertThreshold,
      },
    }));

    return res.status(200).json({ stock: formattedStock });
  } catch (error) {
    console.error('Erro ao obter estoque:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

/**
 * Atualiza a quantidade de um item no estoque com base no productId.
 * 
 * @param {object} req - Requisição do Express
 * @param {object} res - Resposta do Express
 */
const updateStockQuantity = async (req, res) => {
  const t = await sequelize.transaction();
  console.log(req.body)
  try {
      const { id } = req.params; // ID do estoque
      const { quantity } = req.body; // Nova quantidade

      // Validação: Certificar-se de que a quantidade foi fornecida e é um número válido
      if (quantity === undefined || isNaN(quantity) || quantity < 0) {
          await t.rollback();
          return res.status(400).json({ message: "Quantidade inválida. Deve ser um número maior ou igual a zero." });
      }

      // Buscar a entrada de estoque pelo ID
      const stockEntry = await Stock.findByPk(id, { transaction: t });

      if (!stockEntry) {
          await t.rollback();
          return res.status(404).json({ message: "Entrada de estoque não encontrada." });
      }

      // Atualizar a quantidade no banco de dados
      stockEntry.quantity = quantity;
      await stockEntry.save({ transaction: t });

      // Confirmar a transação
      await t.commit();

      return res.status(200).json({
          message: "Quantidade do estoque atualizada com sucesso!",
          updatedStock: stockEntry
      });

  } catch (error) {
      await t.rollback();
      console.error("Erro ao atualizar a quantidade do estoque:", error);
      return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * Função para obter o histórico de transações.
 */
const getTransactionHistory = async (req, res) => {
  try {
    const transactions = await TransactionHistory.findAll({
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'price', 'size', 'color'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'], // Ajuste conforme seu modelo User
        },
      ],
      order: [['transactionDate', 'DESC']],
    });

    return res.status(200).json({ transactions });
  } catch (error) {
    console.error('Erro ao obter histórico de transações:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

module.exports = {
  registerStockMovement,
  getStock,
  getTransactionHistory,
  updateStockQuantity
};
