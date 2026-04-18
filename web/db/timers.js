import { ObjectId } from "mongodb";
import { getDb } from "./mongo.js";

const TIMERS_COLLECTION = "timers";
const TIMER_SCOPE_TYPES = ["ALL_PRODUCTS", "SELECTED_PRODUCTS", "SELECTED_COLLECTIONS"];
const TIMER_STATUSES = ["ACTIVE", "INACTIVE", "EXPIRED"];
const TIMER_TYPES = ["FIXED_WINDOW", "EVERGREEN"];

const timerCollectionValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "shop",
      "label",
      "timerType",
      "scopeType",
      "startAtUtc",
      "endAtUtc",
      "evergreenDurationSeconds",
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
      timerType: {
        enum: TIMER_TYPES,
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
        bsonType: ["date", "null"],
        description: "Timer start in UTC",
      },
      endAtUtc: {
        bsonType: ["date", "null"],
        description: "Timer end in UTC",
      },
      evergreenDurationSeconds: {
        bsonType: ["int", "long", "null"],
        minimum: 1,
        description: "Evergreen timer duration in seconds",
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

/**
 * Values that may appear in stored `productIds` / query params so Mongo matches reliably.
 * @param {string} numericProductId digits-only id
 * @returns {string[]}
 */
function productIdQueryVariants(numericProductId) {
  const id = typeof numericProductId === "string" ? numericProductId.trim() : "";
  if (!id) return [];
  const gid = `gid://shopify/Product/${id}`;
  return [...new Set([id, gid])];
}

/**
 * Same idea for `collectionIds` arrays (numeric id + Collection GID).
 * @param {string} numericCollectionId
 * @returns {string[]}
 */
function collectionIdQueryVariants(numericCollectionId) {
  const id = typeof numericCollectionId === "string" ? numericCollectionId.trim() : "";
  if (!id) return [];
  const gid = `gid://shopify/Collection/${id}`;
  return [...new Set([id, gid])];
}

/**
 * Match how `shop` is stored on timer docs (session shop domain), tolerating casing
 * or accidental `https://` in query strings.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeShopDomain(raw) {
  let s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "";
  s = s.toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  const slash = s.indexOf("/");
  if (slash !== -1) s = s.slice(0, slash);
  const colon = s.indexOf(":");
  if (colon !== -1) s = s.slice(0, colon);
  return s;
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
  const timerTypeRaw = typeof payload?.timerType === "string" ? payload.timerType : "FIXED_WINDOW";
  const timerType = timerTypeRaw.trim() || "FIXED_WINDOW";
  const scopeRaw =
    typeof payload?.applyTo === "string"
      ? payload.applyTo
      : typeof payload?.scopeType === "string"
        ? payload.scopeType
        : "";
  const scopeType = scopeRaw.trim();
  const durationFromPayload = Number(payload?.evergreenDurationSeconds);
  const evergreenDays = Number(payload?.evergreenDays);
  const evergreenHours = Number(payload?.evergreenHours);
  const evergreenMinutes = Number(payload?.evergreenMinutes);
  const durationFromParts = Math.floor(
    (Number.isFinite(evergreenDays) ? Math.max(0, evergreenDays) : 0) * 86400 +
      (Number.isFinite(evergreenHours) ? Math.max(0, evergreenHours) : 0) * 3600 +
      (Number.isFinite(evergreenMinutes) ? Math.max(0, evergreenMinutes) : 0) * 60
  );
  const evergreenDurationSeconds = Number.isFinite(durationFromPayload)
    ? Math.floor(durationFromPayload)
    : durationFromParts;

  return {
    label,
    timerType,
    scopeType,
    productIds: sanitizeIdArray(payload?.selectedProducts ?? payload?.productIds),
    collectionIds: sanitizeIdArray(payload?.selectedCollections ?? payload?.collectionIds),
    startAtUtc:
      payload?.startAtUtc ??
      normalizeUtcDate(payload?.startDate, payload?.startTime)?.toISOString(),
    endAtUtc:
      payload?.endAtUtc ?? normalizeUtcDate(payload?.endDate, payload?.endTime)?.toISOString(),
    evergreenDurationSeconds,
  };
}

export function validateTimerPayload(payload) {
  const errors = [];
  const {
    label,
    timerType,
    scopeType,
    productIds = [],
    collectionIds = [],
    startAtUtc,
    endAtUtc,
    evergreenDurationSeconds,
  } = payload;

  if (!label || typeof label !== "string" || !label.trim()) {
    errors.push("Label is required.");
  } else if (label.length > 120) {
    errors.push("Label must be 120 characters or fewer.");
  }

  if (!TIMER_TYPES.includes(timerType)) {
    errors.push("Timer type is invalid.");
  }

  if (!TIMER_SCOPE_TYPES.includes(scopeType)) {
    errors.push("Scope type is invalid.");
  }

  if (timerType === "FIXED_WINDOW") {
    const startDate = new Date(startAtUtc);
    const endDate = new Date(endAtUtc);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      errors.push("Start and end dates must be valid UTC date values.");
    } else if (endDate <= startDate) {
      errors.push("End date/time must be later than start date/time.");
    }
  }

  if (timerType === "EVERGREEN") {
    if (
      !Number.isFinite(evergreenDurationSeconds) ||
      Math.floor(evergreenDurationSeconds) <= 0
    ) {
      errors.push("Evergreen duration must be greater than zero.");
    }
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
    timerType: doc.timerType || "FIXED_WINDOW",
    scopeType: doc.scopeType,
    productIds: Array.isArray(doc.productIds) ? doc.productIds : [],
    collectionIds: Array.isArray(doc.collectionIds) ? doc.collectionIds : [],
    startAtUtc: doc.startAtUtc instanceof Date ? doc.startAtUtc.toISOString() : null,
    endAtUtc: doc.endAtUtc instanceof Date ? doc.endAtUtc.toISOString() : null,
    evergreenDurationSeconds:
      Number.isFinite(doc.evergreenDurationSeconds) && doc.evergreenDurationSeconds > 0
        ? Number(doc.evergreenDurationSeconds)
        : null,
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
      timerType: 1,
      scopeType: 1,
      startAtUtc: 1,
      endAtUtc: 1,
      evergreenDurationSeconds: 1,
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

/**
 * Delete timers by one or more ids for a shop.
 *
 * @param {string} shop
 * @param {string[] | string} timerIds
 * @returns {Promise<{deletedCount:number; requestedCount:number; validCount:number}>}
 */
export async function deleteTimersByIdsForShop(shop, timerIds) {
  const shopDomain = typeof shop === "string" ? shop.trim() : "";
  if (!shopDomain) {
    return { deletedCount: 0, requestedCount: 0, validCount: 0 };
  }

  const idsArray = Array.isArray(timerIds) ? timerIds : [timerIds];
  const normalized = [...new Set(idsArray.map((id) => String(id || "").trim()).filter(Boolean))];
  const objectIds = normalized.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));

  if (objectIds.length === 0) {
    return { deletedCount: 0, requestedCount: normalized.length, validCount: 0 };
  }

  const collection = await getTimersCollection();
  const result = await collection.deleteMany({
    shop: shopDomain,
    _id: { $in: objectIds },
  });

  return {
    deletedCount: result.deletedCount ?? 0,
    requestedCount: normalized.length,
    validCount: objectIds.length,
  };
}

/**
 * Public storefront payload (no internal targeting lists required for display).
 * @param {ReturnType<typeof serializeTimerDocument>} timer
 */
export function toPublicTimer(timer) {
  return {
    id: timer.id,
    label: timer.label,
    timerType: timer.timerType || "FIXED_WINDOW",
    scopeType: timer.scopeType,
    startAtUtc: timer.startAtUtc,
    endAtUtc: timer.endAtUtc,
    evergreenDurationSeconds: timer.evergreenDurationSeconds ?? null,
    status: timer.status,
  };
}

/**
 * Active timer for a product: selected product > selected collection (if collectionIds provided) > all products.
 * Fixed-window timers must be within [startAtUtc, endAtUtc]; evergreen only needs ACTIVE + positive duration.
 *
 * @param {string} shop
 * @param {string} productIdRaw numeric id or Shopify Product GID
 * @param {string[]} [collectionIdsFromTheme] numeric collection ids from Liquid (product.collections), optional
 */
export async function findActiveTimerForProduct(
  shop,
  productIdRaw,
  collectionIdsFromTheme = []
) {
  const shopDomain = normalizeShopDomain(shop);
  const productId = normalizeShopifyGidToId(String(productIdRaw ?? ""));
  if (!shopDomain || !productId) {
    return null;
  }

  const productIdVariants = productIdQueryVariants(productId);

  const now = new Date();
  const collection = await getTimersCollection();

  const activeFilter = {
    shop: shopDomain,
    status: "ACTIVE",
    $or: [
      {
        timerType: "FIXED_WINDOW",
        startAtUtc: { $lte: now },
        endAtUtc: { $gte: now },
      },
      {
        timerType: "EVERGREEN",
        evergreenDurationSeconds: { $gt: 0 },
      },
      {
        timerType: { $exists: false },
        evergreenDurationSeconds: { $gt: 0 },
      },
      {
        timerType: { $exists: false },
        startAtUtc: { $lte: now },
        endAtUtc: { $gte: now },
      },
    ],
  };

  const productMatch = await collection.findOne(
    {
      ...activeFilter,
      scopeType: "SELECTED_PRODUCTS",
      productIds: { $in: productIdVariants },
    },
    { sort: { updatedAt: -1 } }
  );
  if (productMatch) {
    return serializeTimerDocument(productMatch);
  }

  const collectionIdSet = new Set(
    collectionIdsFromTheme
      .map((c) => normalizeShopifyGidToId(String(c)))
      .filter(Boolean)
  );
  if (collectionIdSet.size > 0) {
    const inList = [...collectionIdSet].flatMap((cid) => collectionIdQueryVariants(cid));
    const collectionScopeDocs = await collection
      .find({
        ...activeFilter,
        scopeType: "SELECTED_COLLECTIONS",
        collectionIds: { $in: [...new Set(inList)] },
      })
      .sort({ updatedAt: -1 })
      .limit(1)
      .toArray();
    if (collectionScopeDocs[0]) {
      return serializeTimerDocument(collectionScopeDocs[0]);
    }
  }

  const allProductsMatch = await collection.findOne(
    {
      scopeType: "ALL_PRODUCTS",
    },
    { sort: { updatedAt: -1 } }
  );
  return allProductsMatch ? serializeTimerDocument(allProductsMatch) : null;
}

export function buildTimerDocument(shop, payload, now = new Date()) {
  const shopDomain = typeof shop === "string" ? shop.trim() : "";
  if (!shopDomain) {
    throw new Error("Missing shop for timer document.");
  }

  const timerType = payload.timerType || "FIXED_WINDOW";
  let startAtUtc = null;
  let endAtUtc = null;
  let evergreenDurationSeconds = null;

  if (timerType === "FIXED_WINDOW") {
    startAtUtc = new Date(payload.startAtUtc);
    endAtUtc = new Date(payload.endAtUtc);
    if (Number.isNaN(startAtUtc.getTime()) || Number.isNaN(endAtUtc.getTime())) {
      throw new Error("Invalid start or end date for timer document.");
    }
  } else if (timerType === "EVERGREEN") {
    const parsedDuration = Number(payload.evergreenDurationSeconds);
    if (!Number.isFinite(parsedDuration) || Math.floor(parsedDuration) <= 0) {
      throw new Error("Invalid evergreen duration for timer document.");
    }
    evergreenDurationSeconds = Math.floor(parsedDuration);
  }

  return {
    shop: shopDomain,
    label: payload.label,
    timerType,
    scopeType: payload.scopeType,
    productIds: payload.scopeType === "SELECTED_PRODUCTS" ? [...payload.productIds] : [],
    collectionIds:
      payload.scopeType === "SELECTED_COLLECTIONS" ? [...payload.collectionIds] : [],
    startAtUtc,
    endAtUtc,
    evergreenDurationSeconds,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
}
