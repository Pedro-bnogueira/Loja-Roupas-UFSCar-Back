const Product = require('../models/Product');
const Category = require('../models/Category');

/**
 * Cria um novo produto.
 * Espera do body: name, brand, price, size, color, category 
 */
const createProduct = async (req, res) => {
  try {
    const { name, brand, price, size, color, category } = req.body;

    // Validação básica
    if (!name || !price || !size || !color) {
      return res.status(400).json({ message: 'Dados insuficientes. É necessário fornecer nome, preço, tamanho e cor.' });
    }
    
    // Se a categoria for informada, verificar se existe
    let validCategory = null;
    if (category) {
      validCategory = await Category.findOne({where: {name: category}});
      if (!validCategory) {
        return res.status(404).json({ message: 'Categoria não encontrada.' });
      }
    }
    console.log(category)
    console.log("++++++++++++++++++++++++++++++++")
    console.log(validCategory)
    const newProduct = await Product.create({
      name,
      brand: brand || '',
      price,
      size,
      color,
      categoryId: validCategory ? validCategory.id : null,
    });

    // Objeto para retorar para o front com a categoria completa para correta visualização
    // Buscar o produto criado com a categoria associada
    const createdProduct = await Product.findByPk(newProduct.id, {
      include: [{ model: Category, as: 'category' }],
    });

    return res.status(201).json({ message: 'Produto cadastrado com sucesso!', product: createdProduct });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

/**
 * Obtém todos os produtos, incluindo a categoria (caso exista).
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
 * Atualiza um produto por ID.
 * Espera do body: name, brand, price, size, color, categoryId (opcional)
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, price, size, color, category } = req.body;
    console.log("ENTROUUUUUUUUUUUUUU")
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    console.log('+__+_+_+_+_+_+_+__')
    console.log(category)

    // Se for atualizar a categoria, verificar se existe
    let validCategory = null;
    if (category) {
      const validCategory = await Category.findOne({where: {name: category}});
      if (!category) {
        return res.status(404).json({ message: 'Categoria não encontrada.' });
      }
      product.categoryId = category.id;
    }

    if (name !== undefined) product.name = name;
    if (brand !== undefined) product.brand = brand;
    if (price !== undefined) product.price = price;
    if (size !== undefined) product.size = size;
    if (color !== undefined) product.color = color;

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
    console.log("--------------------------------------------")
    console.log(id)
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
