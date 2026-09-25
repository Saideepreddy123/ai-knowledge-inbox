import { Router } from "express";
import { listItems, countItems, countChunks } from "../db/repository.js";

export const itemsRouter = Router();

itemsRouter.get("/", (req, res) => {
  const items = listItems().map((row) => ({
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    preview: row.preview,
    contentLength: row.content_length,
    createdAt: row.created_at,
  }));

  res.status(200).json({
    items,
    meta: { totalItems: countItems(), totalChunks: countChunks() },
  });
});
