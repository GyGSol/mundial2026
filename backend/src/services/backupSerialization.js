import mongoose from 'mongoose';

const OID_KEY = '$oid';
const DATE_KEY = '$date';

export function serializeValue(value) {
  if (value == null) return value;
  if (value instanceof mongoose.Types.ObjectId) {
    return { [OID_KEY]: value.toString() };
  }
  if (value instanceof Date) {
    return { [DATE_KEY]: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return value;
}

export function deserializeValue(value) {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map(deserializeValue);
  }
  if (typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value[OID_KEY] === 'string') {
      return new mongoose.Types.ObjectId(value[OID_KEY]);
    }
    if (Object.keys(value).length === 1 && typeof value[DATE_KEY] === 'string') {
      return new Date(value[DATE_KEY]);
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = deserializeValue(v);
    }
    return out;
  }
  return value;
}

export function serializeDocument(doc) {
  return serializeValue(doc);
}

export function deserializeDocument(doc) {
  return deserializeValue(doc);
}
