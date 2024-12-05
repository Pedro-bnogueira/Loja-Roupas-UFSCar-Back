const express = require('express');
const routes = express.Router();
const { auth, login } = require('../controllers/AuthController');
const { registerUser, editUser, deleteUser } = require('../controllers/CrudUser');

//AUTH
routes.post('/sign', login)
routes.post('/auth', auth)

//USER
routes.post('/new/user', registerUser);
routes.post('/edit/user/:id', editUser);
routes.post('/delete/user/:id', deleteUser);

module.exports = routes;
