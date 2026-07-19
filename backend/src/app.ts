import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { registerRoutes } from "./modules/routes.js";
import { errorHandler } from "./shared/http.js";

dotenv.config();

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/", (_req, res) => {
    res.json({ message: "Backend running" });
  });

  registerRoutes(app);
  app.use(errorHandler);

  return app;
}
