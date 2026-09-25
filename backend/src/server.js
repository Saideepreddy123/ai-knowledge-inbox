import { createApp } from "./app.js";
import { logger } from "./services/logger.js";
import { embeddingProviderInfo } from "./services/embeddings.js";
import { llmProviderInfo } from "./services/llm.js";

const PORT = process.env.PORT || 8787;
const app = createApp();

app.listen(PORT, () => {
  logger.info("server_started", {
    port: PORT,
    embedding: embeddingProviderInfo(),
    llm: llmProviderInfo(),
  });
});
