const Product = require('../models/Product');
const Category = require('../models/Category');

/**
 * Função para cadastrar um novo produto.
 */
const createProduct = async (req, res) => {
  try {
    const { name, description, price, size, color, categoryId } = req.body;

    if (!name || !price || !size || !color || !categoryId) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    const newProduct = await Product.create({ name, description, price, size, color, categoryId });
    return res.status(201).json({ message: 'Produto criado com sucesso!', product: newProduct });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

/**
 * Função para obter todos os produtos.
 */
const getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      include: [{ model: Category, as: 'category' }]
    });
    return res.status(200).json({ products });
  } catch (error) {
    console.error('Erro ao obter produtos:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};



module.exports = {
  createProduct,
  getProducts,
};
