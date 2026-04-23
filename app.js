import express from "express";
import morgan from "morgan";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import { pool } from "./src/config/db.js";
import { createTable } from "./src/models/orderModel.js";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(morgan("dev"));

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TokSort API",
      version: "1.0.0",
    },
    servers: [
      {
        url: "https://toksort-backend-production.up.railway.app",
      },
    ],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// routes
app.use("/api", uploadRoutes);

const start = async () => {
  try {
    console.log("🚀 Starting app...");

    await createTable(); // 🔥 sekarang TANPA param

    console.log("🔥 DB ready");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ START ERROR:", err);
  }
};

console.log("DATABASE_URL:", process.env.DATABASE_URL);

start();