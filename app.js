import express from "express";
import morgan from "morgan";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import { createTable } from "./src/models/orderModel.js";

const app = express();

const PORT = process.env.PORT || 3000;
const BASE_URL =
  process.env.BASE_URL || "https://toksort-backend-backend.up.railway.app";

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TokSort API",
      version: "1.0.0",
      description:
        "Backend API untuk upload CSV, normalisasi order, grouping, carry-over, dan progress tracking TokSort.",
    },
    servers: [
      {
        url: BASE_URL,
      },
    ],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "TokSort Backend API is running",
    docs: "/api-docs",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api", uploadRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route tidak ditemukan",
  });
});

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err.message);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const start = async () => {
  try {
    console.log("Starting TokSort backend...");

    await createTable();

    console.log("Database ready");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("START ERROR:", err);
    process.exit(1);
  }
};

start();