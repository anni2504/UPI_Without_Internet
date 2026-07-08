import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  mongoUri: process.env.MONGODB_URI || '',
  useInMemoryDb: process.env.MONGODB_URI ? false : (process.env.USE_IN_MEMORY_DB !== 'false'),
  idempotencyTtlSeconds: parseInt(process.env.UPI_MESH_IDEMPOTENCY_TTL_SECONDS || '86400', 10),
  packetMaxAgeSeconds: parseInt(process.env.UPI_MESH_PACKET_MAX_AGE_SECONDS || '86400', 10),
};
