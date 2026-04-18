import { Router } from "express";
import { findTimersByShop, findTimerByIdForShop } from "../db/timers.js";

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

router.get("/received", (req, res) => {
  res.status(200).send({
    success: true,
    message: "received",
    query: req.query,
  });
});

export default router;
