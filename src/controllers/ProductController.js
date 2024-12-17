const Product = require('../models/Product');
const Category = require('../models/Category');

/**
 * Cria um novo produto.
 * Espera receber do body: name, description, price, size, color, stockQuantity, categoryId
 */
const createProduct = async (req, res) => {
  try {
    const { name, description, price, size, color, stockQuantity, categoryId } = req.body;

    // Validação básica
    if (!name || !price ) {
      return res.status(400).json({ message: 'Dados insuficientes.' });
    }

    // Verificar se a categoria existe
    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    const newProduct = await Product.create({
      name,
      description,
      price,
      size,
      color,
      stockQuantity: stockQuantity || 0,
      categoryId
    });

    return res.status(201).json({ message: 'Produto cadastrado com sucesso!', product: newProduct });
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

/**
 * Atualiza um produto existente por ID.
 * Espera receber do body quaisquer campos: name, description, price, size, color, stockQuantity, categoryId
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, size, color, stockQuantity, categoryId } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    // Se for atualizar a categoria, verificar se existe
    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({ message: 'Categoria não encontrada.' });
      }
    }

    // Atualização dos campos
    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (size) product.size = size;
    if (color) product.color = color;
    if (stockQuantity !== undefined) product.stockQuantity = stockQuantity;
    if (categoryId) product.categoryId = categoryId;

    await product.save();

    return res.status(200).json({ message: 'Produto atualizado com sucesso!', product });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

/**
 * Remove um produto por ID.
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    await product.destroy();

    return res.status(200).json({ message: 'Produto removido com sucesso!' });
  } catch (error) {
    console.error('Erro ao remover produto:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
};
