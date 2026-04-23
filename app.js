import express from "express";
import morgan from "morgan";
import path from "path";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import initDB from "./src/db/database.js";
import { createTable } from "./src/models/orderModel.js";
import { fileURLToPath } from "url";

const app = express();

const startServer = async () => {
  try {
    const db = await initDB();
    await createTable(db);

    console.log("🔥 Database ready");

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err);
  }
};

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(morgan("dev"));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "src/uploads")));

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TokSort API",
      version: "1.0.0",
      description: "API untuk sistem TokSort",
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

app.use("/api", uploadRoutes);

startServer();