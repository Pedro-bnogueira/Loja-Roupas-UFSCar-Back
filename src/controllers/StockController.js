const Stock = require('../models/Stock');
const Product = require('../models/Product');

/**
 * Função para registrar uma movimentação de estoque (entrada ou saída).
 */
const registerStockMovement = async (req, res) => {
  try {
    const { productId, quantity, operationType, description } = req.body;

    if (!productId || !quantity || !operationType) {
      return res.status(400).json({ message: 'Produto, quantidade e tipo de operação são obrigatórios.' });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    // Atualiza a quantidade de estoque do produto
    if (operationType === 'in') {
      product.stockQuantity += quantity;
    } else if (operationType === 'out') {
      if (product.stockQuantity < quantity) {
        return res.status(400).json({ message: 'Estoque insuficiente para a operação.' });
      }
      product.stockQuantity -= quantity;
    }

    await product.save();

    // Registra a movimentação no histórico
    const stockMovement = await Stock.create({ productId, quantity, operationType, description });

    // Verifica se o estoque atingiu o limite de alerta
    if (product.stockQuantity <= 5) {
      // Alerta para reposição
      console.log(`Alerta: O produto ${product.name} está com estoque baixo. Quantidade restante: ${product.stockQuantity}`);
    }

    return res.status(200).json({ message: 'Movimentação de estoque registrada com sucesso!', stockMovement });
  } catch (error) {
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
          attributes: ['id', 'name', 'brand', 'price', 'size', 'color'], // Dados do produto
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
      },
    }));

    return res.status(200).json({ stock: formattedStock });
  } catch (error) {
    console.error('Erro ao obter estoque:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

/**
 * Função para registrar uma movimentação de estoque.
 */
const recordStockMovement = async (req, res) => {
  try {
    const { productId, quantity, type, alertThreshold } = req.body;

    if (!productId || !quantity || !type) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    const stockMovement = await Stock.create({
      productId,
      quantity,
      type,
      alertThreshold,
    });

    // Atualiza a quantidade no estoque do produto
    if (type === 'entrada') {
      product.stockQuantity += quantity;
    } else if (type === 'saída') {
      product.stockQuantity -= quantity;
    }

    await product.save();

    // Se o estoque do produto ficar abaixo do limite, gera um alerta
    if (product.stockQuantity <= alertThreshold) {
      console.log(`Alerta: O estoque do produto ${product.name} está baixo.`);
    }

    return res.status(201).json({ message: 'Movimentação de estoque registrada com sucesso!', stockMovement });
  } catch (error) {
    console.error('Erro ao registrar movimentação de estoque:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

module.exports = {
  registerStockMovement,
  getStock,
  recordStockMovement,
};
