const express = require("express");
const bodyparser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const routes = require("./routes/routes");
require("dotenv").config({ path: "./.env" }); // Carrega as variáveis de ambiente

const app = express();
const port = process.env.PORT;

app.use(bodyparser.json({ limit: "10mb" }));
app.use(express.urlencoded());
app.use(cookieParser());
app.use(cors({ origin: ["http://localhost:3000"], credentials: true }));

// Rotas
app.use("/api", routes);

// Se o arquivo for executado diretamente, inicia o servidor
if (require.main === module) {
    app.listen(port, () => {
        console.log(
            "Servidor backend da loja de roupas iniciado na porta " + port
        );
    });
}

module.exports = app