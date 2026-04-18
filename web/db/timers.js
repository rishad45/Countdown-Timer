import { ObjectId } from "mongodb";
import { getDb } from "./mongo.js";

const TIMERS_COLLECTION = "timers";
const TIMER_SCOPE_TYPES = ["ALL_PRODUCTS", "SELECTED_PRODUCTS", "SELECTED_COLLECTIONS"];
const TIMER_STATUSES = ["ACTIVE", "INACTIVE", "EXPIRED"];

const timerCollectionValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "shop",
      "label",
      "scopeType",
      "startAtUtc",
      "endAtUtc",
      "status",
      "createdAt",
      "updatedAt",
    ],
    additionalProperties: false,
    properties: {
      _id: {
        bsonType: "objectId",
        description: "Set by MongoDB on insert; must be allowed when additionalProperties is false",
      },
      shop: {
        bsonType: "string",
        minLength: 1,
        description: "Shop domain that owns this timer",
      },
      label: {
        bsonType: "string",
        minLength: 1,
        maxLength: 120,
      },
      scopeType: {
        enum: TIMER_SCOPE_TYPES,
      },
      productIds: {
        bsonType: "array",
        items: { bsonType: "string", minLength: 1 },
      },
      collectionIds: {
        bsonType: "array",
        items: { bsonType: "string", minLength: 1 },
      },
      startAtUtc: {
        bsonType: "date",
        description: "Timer start in UTC",
      },
      endAtUtc: {
        bsonType: "date",
        description: "Timer end in UTC",
      },
      status: {
        enum: TIMER_STATUSES,
      },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

/**
 * Store only the numeric id from Shopify Admin GIDs, e.g.
 * `gid://shopify/Product/7778588688445` → `7778588688445`
 * `gid://shopify/Collection/123` → `123`
 * Plain numeric strings are left unchanged.
 *
 * @param {string} raw
 * @returns {string}
 */
function normalizeShopifyGidToId(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return "";

  const gidMatch = trimmed.match(/^gid:\/\/shopify\/(?:Product|Collection)\/(\d+)$/i);
  if (gidMatch) {
    return gidMatch[1];
  }

  return trimmed;
}

function sanitizeIdArray(value) {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .map((item) => {
      if (typeof item === "string") return normalizeShopifyGidToId(item);
      if (item && typeof item.id === "string") return normalizeShopifyGidToId(item.id);
      return "";
    })
    .filter(Boolean);

  return [...new Set(normalized)];
}

function normalizeUtcDate(dateString, timeString) {
  if (typeof dateString !== "string" || typeof timeString !== "string") {
    return null;
  }

  const normalizedDate = dateString.trim();
  const normalizedTime = timeString.trim();
  if (!normalizedDate || !normalizedTime) return null;

  const parsedDate = new Date(`${normalizedDate}T${normalizedTime}:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

export function sanitizeTimerPayload(payload) {
  const label = typeof payload?.label === "string" ? payload.label.trim() : "";
  const scopeRaw =
    typeof payload?.applyTo === "string"
      ? payload.applyTo
      : typeof payload?.scopeType === "string"
        ? payload.scopeType
        : "";
  const scopeType = scopeRaw.trim();

  return {
    label,
    scopeType,
    productIds: sanitizeIdArray(payload?.selectedProducts ?? payload?.productIds),
    collectionIds: sanitizeIdArray(payload?.selectedCollections ?? payload?.collectionIds),
    startAtUtc:
      payload?.startAtUtc ??
      normalizeUtcDate(payload?.startDate, payload?.startTime)?.toISOString(),
    endAtUtc:
      payload?.endAtUtc ?? normalizeUtcDate(payload?.endDate, payload?.endTime)?.toISOString(),
  };
}

export function validateTimerPayload(payload) {
  const errors = [];
  const {
    label,
    scopeType,
    productIds = [],
    collectionIds = [],
    startAtUtc,
    endAtUtc,
  } = payload;

  if (!label || typeof label !== "string" || !label.trim()) {
    errors.push("Label is required.");
  } else if (label.length > 120) {
    errors.push("Label must be 120 characters or fewer.");
  }

  if (!TIMER_SCOPE_TYPES.includes(scopeType)) {
    errors.push("Scope type is invalid.");
  }

  const startDate = new Date(startAtUtc);
  const endDate = new Date(endAtUtc);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    errors.push("Start and end dates must be valid UTC date values.");
  } else if (endDate <= startDate) {
    errors.push("End date/time must be later than start date/time.");
  }

  if (scopeType === "SELECTED_PRODUCTS" && (!Array.isArray(productIds) || productIds.length === 0)) {
    errors.push("At least one product is required for SELECTED_PRODUCTS.");
  }

  if (
    scopeType === "SELECTED_COLLECTIONS" &&
    (!Array.isArray(collectionIds) || collectionIds.length === 0)
  ) {
    errors.push("At least one collection is required for SELECTED_COLLECTIONS.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export async function initializeTimersCollection() {
  const db = await getDb();
  const collections = await db
    .listCollections({ name: TIMERS_COLLECTION }, { nameOnly: true })
    .toArray();

  if (collections.length === 0) {
    await db.createCollection(TIMERS_COLLECTION, {
      validator: timerCollectionValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    await db.command({
      collMod: TIMERS_COLLECTION,
      validator: timerCollectionValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  }

  const timers = db.collection(TIMERS_COLLECTION);
  await timers.createIndexes([
    {
      name: "shop_status_time_idx",
      key: { shop: 1, status: 1, startAtUtc: 1, endAtUtc: 1 },
    },
    {
      name: "shop_scope_products_idx",
      key: { shop: 1, scopeType: 1, productIds: 1 },
    },
    {
      name: "shop_scope_collections_idx",
      key: { shop: 1, scopeType: 1, collectionIds: 1 },
    },
  ]);
}

export async function getTimersCollection() {
  const db = await getDb();
  return db.collection(TIMERS_COLLECTION);
}

/**
 * @param {string} shop
 * @returns {Promise<Array<{ id: string; label: string; scopeType: string; startAtUtc: string | null; endAtUtc: string | null; status: string; createdAt: string | null }>>}
 */
/**
 * @param {import("mongodb").Document} doc
 */
function serializeTimerDocument(doc) {
  return {
    id: doc._id.toString(),
    shop: doc.shop,
    label: doc.label,
    scopeType: doc.scopeType,
    productIds: Array.isArray(doc.productIds) ? doc.productIds : [],
    collectionIds: Array.isArray(doc.collectionIds) ? doc.collectionIds : [],
    startAtUtc: doc.startAtUtc instanceof Date ? doc.startAtUtc.toISOString() : null,
    endAtUtc: doc.endAtUtc instanceof Date ? doc.endAtUtc.toISOString() : null,
    status: doc.status,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
  };
}

export async function findTimersByShop(shop) {
  const shopDomain = typeof shop === "string" ? shop.trim() : "";
  if (!shopDomain) {
    return [];
  }

  const collection = await getTimersCollection();
  const docs = await collection
    .find({ shop: shopDomain })
    .sort({ createdAt: -1 })
    .project({
      label: 1,
      scopeType: 1,
      startAtUtc: 1,
      endAtUtc: 1,
      status: 1,
      createdAt: 1,
    })
    .toArray();

  return docs.map((doc) => serializeTimerDocument(doc));
}

/**
 * @param {string} shop
 * @param {string} timerId
 * @returns {Promise<ReturnType<typeof serializeTimerDocument> | null>}
 */
export async function findTimerByIdForShop(shop, timerId) {
  const shopDomain = typeof shop === "string" ? shop.trim() : "";
  if (!shopDomain || typeof timerId !== "string" || !ObjectId.isValid(timerId)) {
    return null;
  }

  const collection = await getTimersCollection();
  const doc = await collection.findOne({
    _id: new ObjectId(timerId),
    shop: shopDomain,
  });

  return doc ? serializeTimerDocument(doc) : null;
}

export function buildTimerDocument(shop, payload, now = new Date()) {
  const shopDomain = typeof shop === "string" ? shop.trim() : "";
  if (!shopDomain) {
    throw new Error("Missing shop for timer document.");
  }

  const startAtUtc = new Date(payload.startAtUtc);
  const endAtUtc = new Date(payload.endAtUtc);
  if (Number.isNaN(startAtUtc.getTime()) || Number.isNaN(endAtUtc.getTime())) {
    throw new Error("Invalid start or end date for timer document.");
  }

  return {
    shop: shopDomain,
    label: payload.label,
    scopeType: payload.scopeType,
    productIds: payload.scopeType === "SELECTED_PRODUCTS" ? [...payload.productIds] : [],
    collectionIds:
      payload.scopeType === "SELECTED_COLLECTIONS" ? [...payload.collectionIds] : [],
    startAtUtc,
    endAtUtc,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
}
