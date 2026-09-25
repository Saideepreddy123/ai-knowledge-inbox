import { Router } from "express";
import { validateIngestBody } from "../middleware/validate.js";
import { fetchUrlContent } from "../services/urlFetcher.js";
import { chunkText } from "../services/chunker.js";
import { embed } from "../services/embeddings.js";
import { insertItem, insertChunksTx } from "../db/repository.js";
import { logger } from "../services/logger.js";

export const ingestRouter = Router();

ingestRouter.post("/", async (req, res, next) => {
  try {
    const body = validateIngestBody(req.body);

    let sourceType, sourceUrl, title, rawContent;

    if (body.type === "note") {
      sourceType = "note";
      sourceUrl = null;
      rawContent = body.content.trim();
      title = body.title?.trim() || rawContent.slice(0, 60);
    } else {
      sourceType = "url";
      sourceUrl = body.url.trim();
      logger.info("fetching_url", { requestId: req.requestId, url: sourceUrl });
      const fetched = await fetchUrlContent(sourceUrl);
      rawContent = fetched.text;
      title = fetched.title;
    }

    const item = insertItem({ sourceType, sourceUrl, title, rawContent });

    const chunks = chunkText(rawContent);
    if (chunks.length === 0) {
      logger.warn("no_chunks_produced", { requestId: req.requestId, itemId: item.id });
    } else {
      const embeddings = await embed(chunks);
      insertChunksTx(item.id, chunks, embeddings);
    }

    logger.info("item_ingested", {
      requestId: req.requestId,
      itemId: item.id,
      sourceType,
      chunkCount: chunks.length,
    });

    res.status(201).json({
      item: {
        id: item.id,
        title: item.title,
        sourceType: item.source_type,
        sourceUrl: item.source_url,
        createdAt: item.created_at,
        chunkCount: chunks.length,
      },
    });
  } catch (err) {
    next(err);
  }
});
