import { Router } from "express";
import {
  findTimersByShop,
  findTimerByIdForShop,
  deleteTimersByIdsForShop,
} from "../db/timers.js";

const router = Router();

router.get("/timers", async (req, res) => {
  try {
    const shop = res.locals.shopify?.session?.shop;
    if (!shop || typeof shop !== "string") {
      return res.status(500).json({
        success: false,
        errors: ["Shop session is missing. Cannot load timers."],
      });
    }

    const timers = await findTimersByShop(shop);
    return res.status(200).json({ success: true, timers });
  } catch (error) {
    console.error("GET /api/timers failed", error);
    return res.status(500).json({
      success: false,
      errors: ["Unable to load timers."],
    });
  }
});

router.get("/timers/:id", async (req, res) => {
  try {
    const shop = res.locals.shopify?.session?.shop;
    if (!shop || typeof shop !== "string") {
      return res.status(500).json({
        success: false,
        errors: ["Shop session is missing. Cannot load timer."],
      });
    }

    const timer = await findTimerByIdForShop(shop, req.params.id);
    if (!timer) {
      return res.status(404).json({
        success: false,
        errors: ["Timer not found."],
      });
    }

    return res.status(200).json({ success: true, timer });
  } catch (error) {
    console.error("GET /api/timers/:id failed", error);
    return res.status(500).json({
      success: false,
      errors: ["Unable to load timer."],
    });
  }
});

router.delete("/timers", async (req, res) => {
  try {
    const shop = res.locals.shopify?.session?.shop;
    if (!shop || typeof shop !== "string") {
      return res.status(500).json({
        success: false,
        errors: ["Shop session is missing. Cannot delete timers."],
      });
    }

    const bodyIds = Array.isArray(req.body?.ids)
      ? req.body.ids
      : req.body?.id
        ? [req.body.id]
        : [];

    const queryId =
      typeof req.query?.id === "string" && req.query.id.trim() ? req.query.id.trim() : null;
    const timerIds = queryId ? [...bodyIds, queryId] : bodyIds;

    if (timerIds.length === 0) {
      return res.status(400).json({
        success: false,
        errors: ["Provide timer id or ids to delete."],
      });
    }

    const result = await deleteTimersByIdsForShop(shop, timerIds);
    return res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      requestedCount: result.requestedCount,
      validCount: result.validCount,
    });
  } catch (error) {
    console.error("DELETE /api/timers failed", error);
    return res.status(500).json({
      success: false,
      errors: ["Unable to delete timers."],
    });
  }
});

router.get("/received", (req, res) => {
  res.status(200).send({
    success: true,
    message: "received",
    query: req.query,
  });
});

export default router;
