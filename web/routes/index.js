import { Router } from "express";
import {
  findTimersByShop,
  findTimerByIdForShop,
  deleteTimersByIdsForShop,
} from "../db/timers.js";
import { getAnalyticsSummary } from "../db/analytics.js";
import { enrichTimerWithResourceTitles } from "../lib/enrichTimerTitles.js";

const router = Router();

router.get("/analytics/summary", async (req, res) => {
  try {
    const shop = res.locals.shopify?.session?.shop;
    if (!shop || typeof shop !== "string") {
      return res.status(500).json({
        success: false,
        errors: ["Shop session is missing. Cannot load analytics."],
      });
    }

    const productId =
      typeof req.query.productId === "string" && req.query.productId.trim()
        ? req.query.productId.trim()
        : undefined;
    const timerId =
      typeof req.query.timerId === "string" && req.query.timerId.trim()
        ? req.query.timerId.trim()
        : undefined;

    const summary = await getAnalyticsSummary(shop, { productId, timerId });

    if (!summary) {
      return res.status(400).json({
        success: false,
        errors: ["Unable to build analytics for this shop."],
      });
    }

    return res.status(200).json({
      success: true,
      impressions: summary.impressions,
      addToCart: summary.addToCart,
      conversionRate: summary.conversionRate,
    });
  } catch (error) {
    console.error("GET /api/analytics/summary failed", error);
    return res.status(500).json({
      success: false,
      errors: ["Unable to load analytics summary."],
    });
  }
});

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

    const session = res.locals.shopify?.session;
    const timerWithTitles = await enrichTimerWithResourceTitles(timer, session);

    return res.status(200).json({ success: true, timer: timerWithTitles });
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

export default router;
