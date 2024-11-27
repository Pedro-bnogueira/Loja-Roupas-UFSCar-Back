const express = require('express');
const routes = express.Router();
const { auth, login } = require('../controllers/AuthController');
const { registerUser } = require('../controllers/NewUser');

//AUTH
routes.post('/sign', login)
routes.post('/auth', auth)

//CREATE
routes.post('/new/user', registerUser);

module.exports = routes;
