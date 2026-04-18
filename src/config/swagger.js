const BASE_URL =
  process.env.BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://swapping-baffling-pasta.ngrok-free.dev"
    : "http://localhost:3000");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TokSort API",
      version: "1.0.0",
      description: "API untuk sistem sorting CSV TokSort"
    },
    servers: [
      {
        url: BASE_URL
      }
    ]
  },
  apis: ["./src/routes/*.js"],
};