const sequelize = require("../config/database");
const { Op } = require("sequelize");
const TransactionHistory = require("../models/TransactionHistory");
const User = require("../models/User");
const Product = require("../models/Product");
const Stock = require("../models/Stock");
const Category = require("../models/Category");

/**
 * Obtém estatísticas gerais para o Dashboard.
 */
const getDashboardStats = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const user = req.user;
        if (!user) {
            await t.rollback();
            return res
                .status(401)
                .json({ message: "Sem token de autenticação" });
        }

        // Função para gerar série temporal completa
        const generateTimeSeries = (startDate, endDate) => {
            const series = [];
            let currentDate = new Date(startDate);

            while (currentDate <= endDate) {
                series.push({
                    month: currentDate.toISOString().slice(0, 7),
                    total: 0,
                });
                currentDate.setMonth(currentDate.getMonth() + 1);
            }

            return series;
        };

        // Datas para o período de 12 meses
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 11);
        startDate.setDate(1);

        // Total de Vendas
        const totalSales =
            (await TransactionHistory.sum("transactionPrice", {
                where: { type: "out" },
                transaction: t,
            })) || 0;

        // Total de Compras
        const totalPurchases =
            (await TransactionHistory.sum("transactionPrice", {
                where: { type: "in" },
                transaction: t,
            })) || 0;

        // Contagem de Trocas e Devoluções
        const [totalExchanges, totalReturns] = await Promise.all([
            TransactionHistory.count({
                where: { type: "exchange_out" },
                transaction: t,
            }),
            TransactionHistory.count({
                where: { type: "return" },
                transaction: t,
            }),
        ]);

        // Produto Mais Vendido
        const topProductQuery = await TransactionHistory.findOne({
            attributes: [
                "productId",
                [sequelize.fn("SUM", sequelize.col("quantity")), "totalSold"],
            ],
            where: { type: "out" },
            group: ["productId"],
            order: [[sequelize.fn("SUM", sequelize.col("quantity")), "DESC"]],
            limit: 1,
            include: [
                {
                    model: Product,
                    as: "product",
                    attributes: [
                        "id",
                        "name",
                        "brand",
                        "price",
                        "size",
                        "color",
                        "categoryId",
                    ],
                },
            ],
            transaction: t,
        });

        let topProduct = null;
        if (topProductQuery && topProductQuery.product) {
            topProduct = {
                ...topProductQuery.product.get({ plain: true }),
                totalSold: Number(topProductQuery.dataValues.totalSold),
            };
        }

        // Auxiliar para queries de série temporal
        const timeSeriesConfig = (type) => ({
            attributes: [
                [
                    sequelize.fn(
                        "DATE_FORMAT",
                        sequelize.col("transactionDate"),
                        "%Y-%m"
                    ),
                    "month",
                ],
                [
                    sequelize.fn("SUM", sequelize.col("transactionPrice")),
                    "total",
                ],
            ],
            where: {
                type,
                transactionDate: { [Op.between]: [startDate, endDate] },
            },
            group: "month",
            order: [["month", "ASC"]],
            raw: true,
            transaction: t,
        });

        // Buscar e formatar dados temporais
        const [rawSales, rawPurchases] = await Promise.all([
            TransactionHistory.findAll(timeSeriesConfig("out")),
            TransactionHistory.findAll(timeSeriesConfig("in")),
        ]);

        console.log(rawSales, rawPurchases);
        console.log("startDate:", startDate, "endDate:", endDate);
        // Preencher série temporal completa
        const fullTimeSeries = generateTimeSeries(startDate, endDate);
        console.log("fullTimeSeries:", fullTimeSeries);

        const processTimeData = (rawData, series) => {
            console.log("Inside processTimeData, series:", series);
            // Cria um objeto mapeando cada mês para seu total
            const dataMap = rawData.reduce((acc, item) => {
                acc[item.month] = Number(item.total);
                return acc;
            }, {});

            // Usa o array recebido (series) para mapear os dados, garantindo que é um array válido
            return series.map((item) => ({
                month: item.month,
                total: dataMap[item.month] || 0,
            }));
        };

        // Estoque por Categoria
        const inventoryByCategory = await Stock.findAll({
            attributes: [
                [
                    sequelize.literal("`product->category`.`name`"),
                    "categoryName",
                ],
                [
                    sequelize.fn(
                        "SUM",
                        sequelize.literal(
                            'CASE WHEN Stock.operationType = "in" THEN quantity ELSE -quantity END'
                        )
                    ),
                    "totalStock",
                ],
            ],
            include: [
                {
                    model: Product,
                    as: "product",
                    attributes: [],
                    include: [
                        {
                            model: Category,
                            attributes: [],
                            as: "category",
                        },
                    ],
                },
            ],
            group: ["categoryName"],
            raw: true,
        });

        // Mapear para o formato esperado
        const formattedInventory = inventoryByCategory.map((item) => ({
            categoryName: item.categoryName,
            totalStock: item.totalStock || 0,
        }));

        // Cadastro de usuários por tempo
        const usersOverTime = await User.findAll({
            attributes: [
                [
                    sequelize.fn(
                        "DATE_FORMAT",
                        sequelize.col("createdDate"),
                        "%Y-%m"
                    ),
                    "month",
                ],
                [sequelize.fn("COUNT", sequelize.col("id")), "totalUsers"],
            ],
            group: "month",
            order: [["month", "ASC"]],
            raw: true,
        });

        const salesOverTime = processTimeData(rawSales, fullTimeSeries);
        const purchasesOverTime = processTimeData(rawPurchases, fullTimeSeries);

        // Usuários
        let totalUsers = 0;
        if (user.accessLevel === "admin") {
            totalUsers = await User.count({ transaction: t });
        }

        await t.commit();

        return res.status(200).json({
            totalSales: Number(totalSales),
            totalPurchases: Number(totalPurchases),
            totalExchanges,
            totalReturns,
            topProduct,
            salesOverTime,
            purchasesOverTime,
            totalUsers,
            formattedInventory,
            usersOverTime,
            userRole: user.accessLevel,
        });
    } catch (error) {
        await t.rollback();
        console.error("Erro ao obter estatísticas do Dashboard:", error);
        return res.status(500).json({ message: "Erro interno do servidor." });
    }
};

module.exports = {
    getDashboardStats,
};
