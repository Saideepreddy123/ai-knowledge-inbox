import { Router } from "express";
import { validateQueryBody } from "../middleware/validate.js";
import { embed, embeddingProviderInfo } from "../services/embeddings.js";
import { generateAnswer, llmProviderInfo } from "../services/llm.js";
import { topKChunks, countChunks } from "../db/repository.js";
import { logger } from "../services/logger.js";

export const queryRouter = Router();

const TOP_K = parseInt(process.env.TOP_K || "4", 10);

queryRouter.post("/", async (req, res, next) => {
  try {
    const { question } = validateQueryBody(req.body);

    if (countChunks() === 0) {
      return res.status(200).json({
        answer:
          "You haven't saved any notes or URLs yet. Add some content first, then ask a question about it.",
        sources: [],
      });
    }

    const [queryEmbedding] = await embed([question]);
    const topChunks = topKChunks(queryEmbedding, TOP_K);

    const answer = await generateAnswer(question, topChunks);

    logger.info("query_answered", {
      requestId: req.requestId,
      question,
      retrievedChunks: topChunks.length,
      topScore: topChunks[0]?.score ?? null,
    });

    res.status(200).json({
      answer,
      sources: topChunks.map((c, i) => ({
        rank: i + 1,
        itemId: c.itemId,
        title: c.itemTitle,
        sourceType: c.sourceType,
        sourceUrl: c.sourceUrl,
        snippet: c.content,
        score: Number(c.score.toFixed(4)),
      })),
      meta: {
        embeddingProvider: embeddingProviderInfo(),
        llmProvider: llmProviderInfo(),
      },
    });
  } catch (err) {
    next(err);
  }
});
