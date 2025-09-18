// api/ip.js
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.DB_NAME || "ipdb";
let cachedClient = null;
let cachedDb = null;

async function connectToMongo() {
  if (!MONGODB_URI) return null;
  if (cachedDb) return cachedDb;
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await cachedClient.connect();
  }
  cachedDb = cachedClient.db(DB_NAME);
  return cachedDb;
}

function getIpFromReq(req) {
  // X-Forwarded-For puede traer lista: tomar el primer elemento
  const xff = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'];
  if (xff) return xff.split(',')[0].trim();
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  if (req.connection && req.connection.remoteAddress) return req.connection.remoteAddress;
  return null;
}

export default async function handler(req, res) {
  const ip = getIpFromReq(req) || "unknown";
  const ua = req.headers['user-agent'] || "";
  const referer = req.headers.referer || req.headers.referrer || "";
  const now = new Date().toISOString();

  // Intento de guardar en MongoDB (si está configurado)
  try {
    const db = await connectToMongo();
    if (db) {
      const coll = db.collection("visitors");
      await coll.insertOne({ ip, ua, referer, path: req.url, ts: now });
    }
  } catch (err) {
    // si falla DB, no bloqueamos la respuesta
    console.error("Mongo error:", err);
  }

  // Respuesta pública (la que verá quien entre al enlace)
  res.setHeader("Content-Type", "application/json");
  res.status(200).send(JSON.stringify({ ip, ua, referer, ts: now }));
}
