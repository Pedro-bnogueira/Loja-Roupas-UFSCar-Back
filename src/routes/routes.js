const express = require('express');
const routes = express.Router();

// Authentication Requirements
const { auth, login } = require('../controllers/AuthController');
const { authenticate } = require('../middlewares/authenticate');
const { authorizeAdmin } = require('../middlewares/authorizeAdmin');

// User Requirements 
const { registerUser, editUser, deleteUser, getAllUsers } = require('../controllers/UserController');

// Product Requirements
const { createProduct, getProducts } = require('../controllers/ProductController');

// Stock Requirements
const { registerStockMovement, getStockMovements, recordStockMovement } = require('../controllers/stockController');

// Return/Exchange Requirements
const { createReturnExchange } = require('../controllers/ReturnExchangeController');

//AUTH
routes.post('/sign', login)
routes.post('/auth', auth)

//USER
routes.post('/new/user', authenticate, authorizeAdmin, registerUser);
routes.post('/edit/user/:id', authenticate, authorizeAdmin, editUser);
routes.post('/delete/user/:id', authenticate, authorizeAdmin, deleteUser);
routes.post('/get/users', authenticate, authorizeAdmin, getAllUsers);

//PRODUCT
routes.post('/create/products', authenticate, authorizeAdmin, createProduct);
routes.get('/get/products', getProducts);

//STOCK
routes.post('/movement/register', authenticate, authorizeAdmin, registerStockMovement);
routes.post('/movement/record', authenticate, authorizeAdmin, recordStockMovement);
routes.get('/get/movements', getStockMovements);

//RETURN/EXCHANGE
routes.post('/create/exchange', authenticate, createReturnExchange);

module.exports = routes;
