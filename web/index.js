// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import { MongoServerError, ObjectId } from "mongodb";

function jsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (v instanceof ObjectId ? v.toString() : v))
  );
}

import shopify from "./shopify.js";
import PrivacyWebhookHandlers from "./privacy.js";
import apiRoutes from "./routes/index.js";
import { validateApiSession } from "./middleware/validateApiSession.js";
import {
  initializeTimersCollection,
  sanitizeTimerPayload,
  validateTimerPayload,
  getTimersCollection,
  buildTimerDocument,
  findActiveTimerForProduct,
  toPublicTimer,
} from "./db/timers.js";
import { initializeShopsCollection, upsertShopFromSession } from "./db/shops.js";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

await initializeTimersCollection();
await initializeShopsCollection();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  async (_req, res, next) => {
    try {
      const session = res.locals.shopify?.session;
      if (session) {
        await upsertShopFromSession(session);
      }
    } catch (error) {
      console.error("OAuth callback: failed to persist shop record", error);
    }
    next();
  },
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js
app.use("/api", express.json({ limit: "1mb" }));

/**
 * Storefront: no session auth. Requires `shop` (myshopify.com domain) to scope data.
 * Query: productId (numeric or Product GID), optional collectionIds=comma-separated ids for collection-scoped timers.
 */
function corsPublicTimer(_req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
}

app.options("/api/public/timer", corsPublicTimer, (_req, res) => {
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(204).end();
});

app.get("/api/public/timer", corsPublicTimer, async (req, res) => {
  try {
    const shop =
      typeof req.query.shop === "string" ? req.query.shop.trim() : "";
    const productId = req.query.productId;
    const collectionIdsRaw = req.query.collectionIds;

    if (!shop) {
      return res.status(400).json({
        success: false,
        errors: ["Missing shop query parameter (e.g. shop=your-store.myshopify.com)."],
      });
    }

    if (productId === undefined || productId === null || String(productId).trim() === "") {
      return res.status(400).json({
        success: false,
        errors: ["Missing productId query parameter."],
      });
    }

    let collectionIds = [];
    if (typeof collectionIdsRaw === "string" && collectionIdsRaw.trim() !== "") {
      collectionIds = collectionIdsRaw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }

    const timer = await findActiveTimerForProduct(shop, String(productId), collectionIds);

    if (!timer) {
      return res.status(200).json({ success: true, timer: null });
    }

    return res.status(200).json({
      success: true,
      timer: toPublicTimer(timer),
    });
  } catch (error) {
    console.error("GET /api/public/timer failed", error);
    return res.status(500).json({
      success: false,
      errors: ["Unable to load timer."],
    });
  }
});

app.use("/api/*", shopify.validateAuthenticatedSession());
app.use("/api/*", async (_req, res, next) => {
  try {
    const session = res.locals.shopify?.session;
    if (session) {
      await upsertShopFromSession(session);
    }
  } catch (error) {
    console.error("Persist shop from session failed", error);
  }
  next();
});

// const skipApiSessionValidation = (req) => {
//   if (req.path.startsWith("/auth")) return true;
//   if (req.path === "/webhooks" && req.method === "POST") return true;
//   return false;
// };

// app.use("/api", (req, res, next) => {
//   if (skipApiSessionValidation(req)) return next();
//   return validateApiSession(shopify)(req, res, next);
// });

app.post("/api/timers", async (req, res) => {
  try {
    const sanitizedPayload = sanitizeTimerPayload(req.body);
    const validation = validateTimerPayload(sanitizedPayload);

    if (!validation.isValid) {
      return res.status(400).send({
        success: false,
        errors: validation.errors,
      });
    }

    const shop = res.locals.shopify?.session?.shop;
    if (!shop || typeof shop !== "string") {
      console.error("Create timer: session missing shop", {
        hasSession: Boolean(res.locals.shopify?.session),
      });
      return res.status(500).send({
        success: false,
        errors: ["Shop session is missing. Cannot save timer."],
      });
    }

    const timersCollection = await getTimersCollection();
    const timerDocument = buildTimerDocument(shop, sanitizedPayload);
    const inserted = await timersCollection.insertOne(timerDocument);

    return res.status(201).send({
      success: true,
      timerId: inserted.insertedId.toString(),
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 121) {
      console.error(
        "Create timer: MongoDB document validation failed",
        jsonSafe(error.errInfo ?? null)
      );
      return res.status(400).send({
        success: false,
        errors: ["Timer data did not pass database validation."],
        validationDetails: jsonSafe(error.errInfo?.details ?? null),
      });
    }

    if (error instanceof Error && error.message.startsWith("Missing shop")) {
      console.error("Create timer:", error.message);
      return res.status(500).send({
        success: false,
        errors: [error.message],
      });
    }

    if (
      error instanceof Error &&
      (error.message.includes("Invalid start or end date") ||
        error.message.includes("Invalid evergreen duration"))
    ) {
      return res.status(400).send({
        success: false,
        errors: [error.message],
      });
    }

    console.error("Failed to create timer", error);
    return res.status(500).send({
      success: false,
      errors: ["Unable to create timer right now."],
    });
  }
});

app.use("/api", apiRoutes);

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

app.use((error, _req, res, _next) => {
  console.error("Unhandled backend error", error);
  if (res.headersSent) return;
  res.status(500).send({
    success: false,
    errors: ["Unexpected server error."],
  });
});

app.listen(PORT, () => {
  console.log('*********************');
  console.log(`listening on ${PORT}`);
  console.log('*********************');
});
