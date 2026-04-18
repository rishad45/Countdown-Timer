import { ObjectId } from "mongodb";
import { getDb } from "./mongo.js";
import { normalizeShopDomain } from "./timers.js";

const ANALYTICS_COLLECTION = "analytics";

const EVENT_TYPES = ["IMPRESSION", "ADD_TO_CART"];
const SOURCE_TYPES = ["theme", "pixel"];

const analyticsCollectionValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["shop", "productId", "eventType", "timestamp"],
    additionalProperties: false,
    properties: {
      _id: {
        bsonType: "objectId",
        description: "Set by MongoDB on insert",
      },
      shop: {
        bsonType: "string",
        minLength: 1,
        description: "Shop domain, e.g. example.myshopify.com",
      },
      productId: {
        bsonType: "string",
        minLength: 1,
        description: "Normalized product id (numeric string)",
      },
      eventType: {
        enum: EVENT_TYPES,
      },
      timerId: {
        bsonType: "string",
        minLength: 1,
        maxLength: 64,
        description: "Timer document ObjectId as hex string",
      },
      timestamp: {
        bsonType: "date",
        description: "When the event occurred (UTC)",
      },
      sessionId: {
        bsonType: "string",
        minLength: 1,
        maxLength: 256,
      },
      source: {
        enum: SOURCE_TYPES,
      },
    },
  },
};

/**
 * Product id as digits or Product GID → numeric string.
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeProductId(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!trimmed) return "";
  const gidMatch = trimmed.match(/^gid:\/\/shopify\/Product\/(\d+)$/i);
  if (gidMatch) return gidMatch[1];
  return trimmed;
}

/**
 * @param {unknown} body
 * @returns {{
 *   shop: string;
 *   productId: string;
 *   eventType: string;
 *   timerId: string | null;
 *   timestamp: Date;
 *   sessionId: string | null;
 *   source: string | null;
 * }}
 */
export function sanitizeAnalyticsPayload(body) {
  const shop = normalizeShopDomain(
    typeof body?.shop === "string" ? body.shop : typeof body?.shopDomain === "string" ? body.shopDomain : ""
  );

  const productId = normalizeProductId(body?.productId ?? body?.product_id);

  const eventTypeRaw =
    typeof body?.eventType === "string"
      ? body.eventType.trim().toUpperCase()
      : typeof body?.event_type === "string"
        ? body.event_type.trim().toUpperCase()
        : "";

  let timerId = null;
  if (body?.timerId != null && body.timerId !== "") {
    const t = String(body.timerId).trim();
    timerId = t === "" ? null : t;
  }

  let ts = new Date();
  if (body?.timestamp != null) {
    const d = new Date(
      typeof body.timestamp === "string" || typeof body.timestamp === "number" ? body.timestamp : String(body.timestamp)
    );
    if (!Number.isNaN(d.getTime())) ts = d;
  }

  let sessionId = null;
  if (typeof body?.sessionId === "string" && body.sessionId.trim()) {
    sessionId = body.sessionId.trim();
  }

  let source = null;
  const srcRaw = typeof body?.source === "string" ? body.source.trim().toLowerCase() : "";
  if (srcRaw === "theme" || srcRaw === "pixel") {
    source = srcRaw;
  }

  return {
    shop,
    productId,
    eventType: eventTypeRaw,
    timerId,
    timestamp: ts,
    sessionId,
    source,
  };
}

/**
 * @param {ReturnType<typeof sanitizeAnalyticsPayload>} payload
 */
export function validateAnalyticsPayload(payload) {
  const errors = [];

  if (!payload.shop) {
    errors.push("shop is required.");
  }
  if (!payload.productId) {
    errors.push("productId is required.");
  }
  if (!EVENT_TYPES.includes(payload.eventType)) {
    errors.push(`eventType must be one of: ${EVENT_TYPES.join(", ")}.`);
  }
  if (payload.timerId != null && payload.timerId !== "") {
    if (!ObjectId.isValid(payload.timerId)) {
      errors.push("timerId must be a valid id when provided.");
    }
  }
  if (Number.isNaN(payload.timestamp.getTime())) {
    errors.push("timestamp must be a valid date.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * @param {ReturnType<typeof sanitizeAnalyticsPayload>} payload
 */
export function buildAnalyticsDocument(payload) {
  /** @type {import("mongodb").OptionalId<import("mongodb").Document>} */
  const doc = {
    shop: payload.shop,
    productId: payload.productId,
    eventType: payload.eventType,
    timestamp: payload.timestamp,
  };

  if (payload.timerId != null && payload.timerId !== "") {
    doc.timerId = payload.timerId;
  }
  if (payload.sessionId != null && payload.sessionId !== "") {
    doc.sessionId = payload.sessionId;
  }
  if (payload.source === "theme" || payload.source === "pixel") {
    doc.source = payload.source;
  }

  return doc;
}

export async function initializeAnalyticsCollection() {
  const db = await getDb();
  const collections = await db
    .listCollections({ name: ANALYTICS_COLLECTION }, { nameOnly: true })
    .toArray();

  if (collections.length === 0) {
    await db.createCollection(ANALYTICS_COLLECTION, {
      validator: analyticsCollectionValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    await db.command({
      collMod: ANALYTICS_COLLECTION,
      validator: analyticsCollectionValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  }

  const coll = db.collection(ANALYTICS_COLLECTION);
  await coll.createIndexes([
    { name: "shop_timestamp_idx", key: { shop: 1, timestamp: -1 } },
    { name: "shop_product_event_idx", key: { shop: 1, productId: 1, eventType: 1, timestamp: -1 } },
  ]);
}

export async function getAnalyticsCollection() {
  const db = await getDb();
  return db.collection(ANALYTICS_COLLECTION);
}

/**
 * @param {ReturnType<typeof sanitizeAnalyticsPayload>} payload
 * @returns {Promise<ObjectId>}
 */
export async function insertAnalyticsEvent(payload) {
  const collection = await getAnalyticsCollection();
  const doc = buildAnalyticsDocument(payload);
  const result = await collection.insertOne(doc);
  return result.insertedId;
}

/**
 * Aggregate IMPRESSION / ADD_TO_CART counts for the whole shop, or a single product (optional timer scope).
 * @param {string} shop
 * @param {{ productId?: unknown; timerId?: string | undefined }} [options]
 * @returns {Promise<{ impressions: number; addToCart: number; conversionRate: number } | null>}
 */
export async function getAnalyticsSummary(shop, options = {}) {
  const { productId: rawProductId, timerId } = options;
  const shopDomain = normalizeShopDomain(typeof shop === "string" ? shop : "");
  if (!shopDomain) {
    return null;
  }

  /** @type {import("mongodb").Filter<import("mongodb").Document>} */
  const filter = {
    shop: shopDomain,
  };

  if (rawProductId != null && String(rawProductId).trim() !== "") {
    const productId = normalizeProductId(rawProductId);
    if (!productId) {
      return null;
    }
    filter.productId = productId;
  }

  if (typeof timerId === "string" && timerId.trim() && ObjectId.isValid(timerId.trim())) {
    filter.timerId = timerId.trim();
  }

  const collection = await getAnalyticsCollection();
  const [impressions, addToCart] = await Promise.all([
    collection.countDocuments({ ...filter, eventType: "IMPRESSION" }),
    collection.countDocuments({ ...filter, eventType: "ADD_TO_CART" }),
  ]);

  const conversionRate =
    impressions > 0 ? Math.round((addToCart / impressions) * 10000) / 100 : 0;

  return { impressions, addToCart, conversionRate };
}
