import express from "express";
import morgan from "morgan";
import path from "path";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import initDB  from "./src/db/database.js";

export let db;

initDB().then((database) => {
  db = database;
  console.log("🔥 Database ready");
});

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(cors({
  origin: "*"
}));

app.use(express.json());
app.use(morgan("dev"));

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join("src/uploads")));

// =======================
// ✅ SWAGGER CONFIG
// =======================
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TokSort API",
      version: "1.0.0",
      description: "API untuk sistem TokSort",
    },
    servers: [
      // {
      //   url: "http://localhost:3000",
      // },
      {
        url: "https://toksort-backend-production.up.railway.app",
      },
    ],
  },
  apis: ["./src/routes/*.js"], // 🔥 baca komentar swagger di routes
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api", uploadRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📚 Swagger docs at http://localhost:${PORT}/api-docs`);
});