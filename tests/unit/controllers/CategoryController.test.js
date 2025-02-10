jest.mock('../../../src/models/Category', () => require('../../mocks/Category'));
jest.mock('../../../src/models/Product', () => require('../../mocks/Product'));

const { createCategory, getCategories, deleteCategory } = require('../../../src/controllers/CategoryController');
const Category = require('../../../src/models/Category');
const Product = require('../../../src/models/Product');

describe("CategoryController - createCategory", () => {
  let req, res;
  
  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });
  
  it('deve retornar 400 se o nome da categoria não for informado', async () => {
    req.body.name = "   "; // valor em branco
    await createCategory(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'O nome da categoria é obrigatório.' });
  });
  
  it('deve retornar 409 se a categoria já existir', async () => {
    req.body.name = "Test Category";
    // Simula que já existe uma categoria com esse nome
    Category.findOne.mockResolvedValue({ id: 1, name: "Test Category" });
    
    await createCategory(req, res);
    
    expect(Category.findOne).toHaveBeenCalledWith({ where: { name: "Test Category" } });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Já existe uma categoria com este nome.' });
  });
  
  it('deve criar a categoria e retornar 201 em caso de sucesso', async () => {
    req.body.name = "New Category";
    // Simula que não existe categoria com esse nome
    Category.findOne.mockResolvedValue(null);
    const fakeCategory = { id: 2, name: "New Category" };
    Category.create.mockResolvedValue(fakeCategory);
    
    await createCategory(req, res);
    
    expect(Category.create).toHaveBeenCalledWith({ name: "New Category" });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Categoria cadastrada com sucesso!', category: fakeCategory });
  });
  
  it('deve retornar 409 se ocorrer erro de violação de unicidade (SequelizeUniqueConstraintError)', async () => {
    req.body.name = "Unique Category";
    Category.findOne.mockResolvedValue(null);
    const error = new Error("Unique constraint error");
    error.name = 'SequelizeUniqueConstraintError';
    Category.create.mockRejectedValue(error);
    
    await createCategory(req, res);
    
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Já existe uma categoria com este nome.' });
  });
  
  it('deve retornar 500 para outros erros inesperados', async () => {
    req.body.name = "Another Category";
    Category.findOne.mockResolvedValue(null);
    Category.create.mockRejectedValue(new Error("Some error"));
    
    await createCategory(req, res);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro interno do servidor.' });
  });
});

describe("CategoryController - getCategories", () => {
  let req, res;
  
  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });
  
  it("deve retornar 200 e as categorias com contagem de produtos", async () => {
    // Simula o resultado do Category.findAll, onde cada categoria possui um método get() para recuperar o atributo virtual 'productCount'
    const fakeCategory1 = {
      id: 1,
      name: "Category 1",
      get: jest.fn().mockReturnValue("3")
    };
    const fakeCategory2 = {
      id: 2,
      name: "Category 2",
      get: jest.fn().mockReturnValue("5")
    };
    Category.findAll.mockResolvedValue([fakeCategory1, fakeCategory2]);
    
    await getCategories(req, res);
    
    expect(Category.findAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      categories: [
        { id: 1, name: "Category 1", productCount: 3 },
        { id: 2, name: "Category 2", productCount: 5 }
      ]
    });
  });
  
  it("deve retornar 500 se ocorrer um erro ao obter as categorias", async () => {
    Category.findAll.mockRejectedValue(new Error("Error"));
    
    await getCategories(req, res);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro interno do servidor.' });
  });
});

describe("CategoryController - deleteCategory", () => {
  let req, res;
  
  beforeEach(() => {
    req = { params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });
  
  it("deve retornar 404 se a categoria não for encontrada", async () => {
    req.params.id = "1";
    Category.findByPk.mockResolvedValue(null);
    
    await deleteCategory(req, res);
    
    expect(Category.findByPk).toHaveBeenCalledWith("1", { include: [{ model: Product, as: 'products' }] });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Categoria não encontrada.' });
  });
  
  it("deve deletar a categoria e retornar 200 em caso de sucesso", async () => {
    req.params.id = "2";
    // Cria um objeto de categoria com o método destroy mockado
    const fakeCategory = {
      id: 2,
      name: "Category to delete",
      destroy: jest.fn().mockResolvedValue()
    };
    Category.findByPk.mockResolvedValue(fakeCategory);
    
    await deleteCategory(req, res);
    
    expect(Category.findByPk).toHaveBeenCalledWith("2", { include: [{ model: Product, as: 'products' }] });
    expect(fakeCategory.destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Categoria removida com sucesso!' });
  });
  
  it("deve retornar 500 se ocorrer um erro durante a exclusão", async () => {
    req.params.id = "3";
    Category.findByPk.mockRejectedValue(new Error("Error"));
    
    await deleteCategory(req, res);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro interno do servidor.' });
  });
});
