const express = require('express');
const bodyparser = require('body-parser');
const routes = require('./routes/routes');
const cookieParser = require('cookie-parser');
const cors = require('cors')
const app = express();
require("dotenv").config({ path: "./.env" }); // Carrega as variáveis de ambiente
const port = process.env.PORT
app.use(bodyparser.json({limit: '10mb'}));
app.use(express.urlencoded());
app.use(cookieParser())
app.use(cors({ origin: ['http://localhost:3000'], credentials: true }));


app.listen(port, ()=>{
    console.log('Servidor backend da loja de roupas iniciado na porta '+port);
})

// Rotas
app.use('/api', routes);
