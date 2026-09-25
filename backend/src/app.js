import express from "express";
import cors from "cors";
import "dotenv/config";

import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { ingestRouter } from "./routes/ingest.js";
import { itemsRouter } from "./routes/items.js";
import { queryRouter } from "./routes/query.js";
import { embeddingProviderInfo } from "./services/embeddings.js";
import { llmProviderInfo } from "./services/llm.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      embeddingProvider: embeddingProviderInfo(),
      llmProvider: llmProviderInfo(),
    });
  });

  app.use("/ingest", ingestRouter);
  app.use("/items", itemsRouter);
  app.use("/query", queryRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
