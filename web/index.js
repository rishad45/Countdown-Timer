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
} from "./db/timers.js";

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

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js
app.use("/api", express.json({ limit: "1mb" }));
app.use("/api/*", shopify.validateAuthenticatedSession());

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

    if (error instanceof Error && error.message.includes("Invalid start or end date")) {
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

app.listen(PORT);
