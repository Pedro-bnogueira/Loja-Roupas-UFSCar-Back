const express = require('express');
const routes = express.Router();

// Authentication Requirements
const { auth, login } = require('../controllers/AuthController');
const { authenticate } = require('../middlewares/authenticate');
const { authorizeAdmin } = require('../middlewares/authorizeAdmin');

// Logout Requirements
const { logout } = require('../controllers/LogoutController')

// User Requirements 
const { registerUser, editUser, deleteUser, getAllUsers } = require('../controllers/UserController');

// Product Requirements
const { createProduct, getProducts, updateProduct, deleteProduct } = require('../controllers/ProductController');

// Category Requirements
const { createCategory, getCategories, deleteCategory } = require('../controllers/CategoryController');

// Stock Requirements
const { registerStockMovement, getStock, getTransactionHistory, updateStockQuantity } = require('../controllers/StockController');

// Return/Exchange Requirements
const { registerReturn } = require('../controllers/ReturnExchangeController');
const { registerExchange } = require('../controllers/ReturnExchangeController');

// Dashboard Requirements
const { getDashboardStats } = require('../controllers/DashboardController')

//AUTH
routes.post('/sign', login)
routes.post('/auth', auth)

//LOGOUT
routes.post("/logout", authenticate, logout);

//USER
routes.post('/new/user', authenticate, authorizeAdmin, registerUser);
routes.post('/edit/user/:id', authenticate, authorizeAdmin, editUser);
routes.post('/delete/user/:id', authenticate, authorizeAdmin, deleteUser);
routes.post('/get/users', authenticate, authorizeAdmin, getAllUsers);

//PRODUCT
routes.post('/new/product', authenticate, createProduct);
routes.get('/get/products', authenticate, getProducts);
routes.put('/update/product/:id', authenticate, updateProduct);
routes.delete('/delete/product/:id', authenticate, deleteProduct);

//CATEGORY
routes.post('/new/category', authenticate, createCategory);
routes.get('/get/categories', authenticate, getCategories);
routes.delete('/delete/category/:id', authenticate, deleteCategory);

//STOCK
routes.post('/movement/register', authenticate, authorizeAdmin, registerStockMovement);
routes.get('/get/stock', getStock);
routes.get('/get/transactions', getTransactionHistory);
routes.put('/update/stock/:id', updateStockQuantity);

//RETURN/EXCHANGE
routes.post('/return/register', authenticate, registerReturn);
routes.post('/exchange/register', authenticate, registerExchange);

// DASHBOARD
routes.get("/dashboard", authenticate, getDashboardStats);

module.exports = routes;
