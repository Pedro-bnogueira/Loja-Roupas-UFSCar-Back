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

// Stock Requirements
const { registerStockMovement, getStockMovements, recordStockMovement } = require('../controllers/stockController');

// Return/Exchange Requirements
const { createReturnExchange } = require('../controllers/ReturnExchangeController');

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
routes.get('/update/product/:id', authenticate, updateProduct);
routes.get('/delete/product/:id', authenticate, deleteProduct);

//STOCK
routes.post('/movement/register', authenticate, authorizeAdmin, registerStockMovement);
routes.post('/movement/record', authenticate, authorizeAdmin, recordStockMovement);
routes.get('/get/movements', getStockMovements);

//RETURN/EXCHANGE
routes.post('/create/exchange', authenticate, createReturnExchange);

module.exports = routes;
