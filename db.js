import { MongoClient } from 'mongodb';
import { MONGODB_URI } from './config.js';

let client = null;
let db = null;

export async function connectDB() {
  if (db) return db;
  if (!MONGODB_URI) {
    console.error('[ABIS DB] No MONGODB_URI set — running without persistence');
    return null;
  }
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db('abis');

    // Ensure indexes
    const sessions = db.collection('mcp_sessions');
    const scores = db.collection('mcp_message_scores');
    const logs = db.collection('mcp_conversation_logs');
    const triggers = db.collection('mcp_benchmark_triggers');

    await Promise.all([
      sessions.createIndex({ started_at: -1 }),
      sessions.createIndex({ session_id: 1 }, { unique: true }),
      scores.createIndex({ timestamp: -1 }),
      scores.createIndex({ session_id: 1 }),
      scores.createIndex({ model_hint: 1, timestamp: -1 }),
      logs.createIndex({ timestamp: -1 }),
      logs.createIndex({ session_id: 1 }),
      triggers.createIndex({ timestamp: -1 }),
      triggers.createIndex({ session_id: 1 }),
    ]);

    console.error('[ABIS DB] Connected to MongoDB Atlas');
    return db;
  } catch (err) {
    console.error('[ABIS DB] Connection failed:', err.message);
    return null;
  }
}

export async function getCollection(name) {
  const database = await connectDB();
  if (database === null) return null;
  return database.collection(name);
}

export async function insertDoc(collectionName, doc) {
  const col = await getCollection(collectionName);
  if (col === null) return null;
  const enriched = {
    ...doc,
    created_at: new Date(),
    schema_version: '1.0',
  };
  try {
    return await col.insertOne(enriched);
  } catch (err) {
    console.error(`[ABIS DB] Insert to ${collectionName} failed:`, err.message);
    return null;
  }
}
