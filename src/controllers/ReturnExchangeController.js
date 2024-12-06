// src/controllers/returnExchangeController.js

const ReturnExchange = require('../models/ReturnExchange');
const Product = require('../models/Product');
const User = require('../models/User');

/**
 * Função para registrar uma troca ou devolução.
 */
const createReturnExchange = async (req, res) => {
  try {
    const { productId, userId, type, reason } = req.body;

    if (!productId || !userId || !type) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    const product = await Product.findByPk(productId);
    const user = await User.findByPk(userId);

    if (!product || !user) {
      return res.status(404).json({ message: 'Produto ou usuário não encontrado.' });
    }

    const returnExchange = await ReturnExchange.create({
      productId,
      userId,
      type,
      reason,
    });

    return res.status(201).json({ message: 'Troca ou devolução registrada com sucesso!', returnExchange });
  } catch (error) {
    console.error('Erro ao registrar troca ou devolução:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

module.exports = {
  createReturnExchange,
};
