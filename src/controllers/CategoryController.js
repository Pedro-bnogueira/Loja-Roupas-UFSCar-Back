const Category = require('../models/Category');
const Product = require('../models/Product');
const { fn, col } = require('sequelize');

/**
 * Cria uma nova categoria.
 * Espera do body: name
 */
const createCategory = async (req, res) => {
    try {
      const { name } = req.body;
  
      // Validação básica
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
      }
  
      // Verificar se a categoria já existe
      const existingCategory = await Category.findOne({ where: { name: name.trim() } });
      if (existingCategory) {
        return res.status(409).json({ message: 'Já existe uma categoria com este nome.' }); // 409 Conflict
      }
  
      // Criar a nova categoria
      const newCategory = await Category.create({ name: name.trim() });
      return res.status(201).json({ message: 'Categoria cadastrada com sucesso!', category: newCategory });
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
  
      // Verificar se o erro é devido à violação da restrição de unicidade
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'Já existe uma categoria com este nome.' });
      }
  
      return res.status(500).json({ message: 'Erro interno do servidor.' });
    }
  };

/**
 * Obtém todas as categorias, incluindo a contagem de produtos.
 */
const getCategories = async (req, res) => {
    try {
      // Agora que a associação está definida, podemos contar os produtos associados
      const categories = await Category.findAll({
        attributes: [
          'id',
          'name',
          [fn('COUNT', col('products.id')), 'productCount'] // Contagem de produtos
        ],
        include: [{
          model: Product,
          as: 'products',
          attributes: [] // Não precisamos dos atributos dos produtos, apenas a contagem
        }],
        group: ['Category.id'], // Agrupar por ID da categoria para contar corretamente
        order: [['name', 'ASC']] // Ordenar por nome (opcional)
      });
  
      // Mapear o resultado para um formato mais simples
      const categoriesWithCount = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        productCount: parseInt(cat.get('productCount'), 10) // Converter para número inteiro
      }));
  
      return res.status(200).json({ categories: categoriesWithCount });
    } catch (error) {
      console.error('Erro ao obter categorias:', error);
      return res.status(500).json({ message: 'Erro interno do servidor.' });
    }
  };

/**
 * Remove uma categoria por ID.
 * Antes de remover, idealmente você deveria verificar se existem produtos ligados a essa categoria.
 * Caso queira permitir a exclusão mesmo assim, poderá simplesmente deletar. Caso contrário, retornar um erro.
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id, {
      include: [{ model: Product, as: 'products' }]
    });
    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    // Caso não queira deletar se houver produtos, pode verificar:
    // if (category.products && category.products.length > 0) {
    //   return res.status(400).json({ message: 'Não é possível deletar uma categoria com produtos associados.' });
    // }

    await category.destroy();

    return res.status(200).json({ message: 'Categoria removida com sucesso!' });
  } catch (error) {
    console.error('Erro ao remover categoria:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

module.exports = {
  createCategory,
  getCategories,
  deleteCategory,
};
