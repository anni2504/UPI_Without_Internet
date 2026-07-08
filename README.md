# UPI Offline Mesh System — MERN Stack

A Node.js/Express backend and React frontend that implements **offline UPI payments routed through a Bluetooth-style mesh network**. In environments with zero connectivity (e.g., basements or remote locations), a user's device encrypts the payment, broadcasts it to nearby devices via Bluetooth/BLE gossip, and the packet hops device-to-device until a node with internet access (the bridge node) reaches the network perimeter (gets 4G) and uploads it to this backend. The backend then decrypts, deduplicates, and settles the transaction.

This project is built using **MongoDB + Express + React + Node.js (MERN)**, featuring MongoDB transactions and optimistic locking to guarantee duplicate-storm proof settlement.

---

## Table of Contents

1. [What this demo proves](#what-this-demo-proves)
2. [Quick Start & How to Run](#quick-start--how-to-run)
3. [The Demo Flow (Step by Step)](#the-demo-flow-step-by-step)
4. [Architecture](#architecture)
5. [The Three Hard Problems & How They're Solved](#the-three-hard-problems--how-theyre-solved)
6. [File-by-File Walkthrough](#file-by-file-walkthrough)
7. [API Reference](#api-reference)
8. [Running Tests](#running-tests)
9. [Production Scaling Strategy](#production-scaling-strategy)
10. [Honest Technical Limitations](#honest-technical-limitations)

---

## What this demo proves

The system shows three things working end-to-end:

1. **Secure Transits Over Untrusted Intermediaries**: A payment packet travels from an offline sender to the backend through untrusted relays without any intermediary being able to read or tamper with the payment instructions (using hybrid RSA-OAEP + AES-GCM encryption).
2. **Duplicate-Storm Proof (Atomic Settlement)**: Even if a payment packet is flooded through the mesh and reaches the backend simultaneously from multiple bridge nodes, it settles exactly once (enforced by the idempotency cache and Mongoose unique index constraints).
3. **Tamper Rejection**: Any alteration to the packet transit payload is detected instantly, and the packet is rejected before touching the ledger.

---

## Quick Start & How to Run

### Prerequisites

- **Node.js 18 or newer** installed. Check with `node -v`.
- Zero database setup required. By default, it runs MongoDB in-memory (`mongodb-memory-server` in replica set mode) for quick evaluation.

### Running the App

1. Navigate to the `mern` folder:
   ```bash
   cd mern
   ```
2. Install root dependencies:
   ```bash
   npm install
   ```
3. Install frontend and backend packages:
   ```bash
   npm run install:all
   ```
4. Start the application in development mode:
   ```bash
   npm run dev
   ```

- **Backend server**: Runs at [http://localhost:8080](http://localhost:8080)
- **React frontend**: Starts at [http://localhost:5173](http://localhost:5173) (or next available port, e.g., `5174` if `5173` is in use) and proxies all `/api` traffic to port `8080`.

---

## The Demo Flow (Step by Step)

The dashboard UI allows you to step through the mesh pipeline:

### Step 1 — Compose a Payment
Select a sender, receiver, amount, and enter a PIN (e.g., `1234`). Click **"Inject into Mesh"**.
- **What happens**: The server pretends to be the sender's offline phone. It builds a `PaymentInstruction` with a unique nonce and timestamp, encrypts it with the server's RSA public key (hybrid envelope), wraps it in a `MeshPacket` with a TTL of 5, and loads it into `phone-alice`'s offline queue.

### Step 2 — Run Gossip Rounds
Click **"Run Gossip Round"** once or twice.
- **What happens**: Each round, devices broadcast their packets to other offline nodes in bluetooth range (all nodes in our simulator). The TTL decrements each hop. You will see the packet propagate from `phone-alice` through `phone-relay1`, `phone-relay2`, `phone-relay3`, and eventually to the online `phone-bridge`.

### Step 3 — Bridges Upload to Backend
Click **"Bridges Upload to Backend"**.
- **What happens**: `phone-bridge` (the only node with `hasInternet=true`) uploads its queue to the backend. The backend computes the SHA-256 hash of the ciphertext, checks the idempotency cache, decrypts the payload, checks that it is fresh (within 24 hours), and runs the debit/credit settlement inside a database transaction.
- Balances in the **Account Balances** table will update, and the transaction is written to the ledger.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SENDER PHONE (offline)                          │
│  PaymentInstruction { sender, receiver, amount, pinHash, nonce, time }  │
│              │                                                          │
│              ▼ encrypt with server's RSA public key                     │
│   MeshPacket { packetId, ttl, createdAt, ciphertext }                   │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │ Bluetooth gossip
                                       ▼
        ┌─────────┐  hop   ┌─────────┐  hop   ┌─────────┐
        │ relay1  │ ─────▶ │ relay2  │ ─────▶ │ bridge  │ ◀── walks outside
        └─────────┘        └─────────┘        └────┬────┘     gets 4G
                                                   │
                                                   ▼ HTTPS POST
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS / NODE BACKEND (this project)               │
│                                                                         │
│  /api/bridge/ingest                                                     │
│       │                                                                 │
│       ▼                                                                 │
│  [1] hash ciphertext (SHA-256)                                          │
│       │                                                                 │
│       ▼                                                                 │
│  [2] IdempotencyService.claim(hash)  ◀── atomic in-memory check.        │
│       │                                  Duplicates rejected before work.│
│       ▼                                                                 │
│  [3] HybridCryptoService.decrypt(ciphertext)                            │
│       │       (RSA-OAEP unwraps AES key, AES-GCM decrypts payload       │
│       │        AND verifies the auth tag — tampering = exception)       │
│       ▼                                                                 │
│  [4] Freshness check: signedAt within last 24h                          │
│       │                                                                 │
│       ▼                                                                 │
│  [5] SettlementService.settle()                                         │
│       Session Transaction: debit sender, credit receiver, write ledger   │
│       optimistic locking on Account version (defense in depth)           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Three Hard Problems & How They're Solved

### 1. Untrusted Intermediaries
Since random phones carry the transaction, they must not read or edit the amount.
- **Solution**: **Hybrid Encryption (RSA-OAEP + AES-GCM)**. The sender encrypts the payload with the server's public key.
  1. A one-time AES-256 key is generated for the packet.
  2. The payload is encrypted with **AES-256-GCM** (authenticated encryption).
  3. The AES key is encrypted with **RSA-256** (RSA-OAEP).
  4. Decryption on the server will fail if any bit is modified, because the GCM auth tag won't match.

### 2. Duplicate Storms
If multiple bridge nodes upload the same packet simultaneously, the sender must not be double debited.
- **Solution**: **Atomic Compare-and-Set on the Ciphertext Hash**.
  - Node.js is single-threaded, making the local in-memory Map check (`idempotencyService.claim(hash)`) synchronous and atomic.
  - For database safety, we enforce a `unique` index constraint on the `packetHash` field in our `Transaction` schema.
  - Settlement operations are executed inside a **MongoDB Transaction Session** with **Optimistic Locking** (matching the Account version document).

### 3. Replay Attacks
Attackers capturing ciphertext to replay it later.
- **Solution**:
  1. The payload contains `signedAt`. The server rejects packets older than 24 hours.
  2. The payload contains a random UUID `nonce`. Valid duplicates are caught by the `packetHash` idempotency cache, preventing older captured packets from settling again.

---

## File-by-File Walkthrough

```
mern/
├── package.json                   # Project scripts and concurrently helper
├── backend/
│   ├── package.json               # Backend Node.js scripts & dependencies
│   ├── src/
│   │   ├── index.js               # Express application entry point
│   │   ├── config.js              # Ports, TTL configs, and MongoDB URIs
│   │   ├── db.js                  # MongoMemoryReplSet connection setup
│   │   ├── crypto/
│   │   │   ├── serverKeyHolder.js # Generates RSA keypair on boot
│   │   │   └── hybridCrypto.service.js # AES-GCM + RSA-OAEP encryption utilities
│   │   ├── models/
│   │   │   ├── Account.js         # Mongoose schema with version fields
│   │   │   └── Transaction.js     # Mongoose schema with unique indexes
│   │   ├── services/
│   │   │   ├── demo.service.js    # Pre-seeds accounts & creates simulated packets
│   │   │   ├── virtualDevice.js   # Represents a mesh node (holding queues)
│   │   │   ├── meshSimulator.service.js # Gossip protocol & routing simulation
│   │   │   ├── idempotency.service.js # Evictable map for duplicate detection
│   │   │   ├── settlement.service.js # Runs ACID transactions and balance updates
│   │   │   └── bridgeIngestion.service.js # Coordinates the ingestion pipeline
│   │   └── routes/
│   │       └── api.routes.js      # Directs endpoints for dashboard & ingestion
│   └── test/
│       └── idempotency.test.js    # Concurrency and tamper proof tests
└── frontend/
    ├── package.json               # Vite + React + Tailwind configs
    ├── vite.config.js             # Local proxies pointing to backend
    ├── index.html                 # App container
    └── src/
        ├── main.jsx               # React launcher
        ├── index.css              # Custom Tailwind styles
        └── App.jsx                # Mesh dashboard and controller panel
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/server-key` | Gets the server's RSA public key (base64) |
| GET | `/api/accounts` | Fetch all demo accounts and balances |
| GET | `/api/transactions` | Fetch latest 20 transaction ledger records |
| GET | `/api/mesh/state` | Returns the current queues/packet lists for all nodes |
| POST | `/api/demo/send` | Simulate offline payment creation (injects encrypted packet) |
| POST | `/api/mesh/gossip` | Broadcasts packets across neighboring simulator nodes |
| POST | `/api/mesh/flush` | Commands bridge nodes to upload their packets to backend |
| POST | `/api/mesh/reset` | Clear simulation state and wipe idempotency cache |
| POST | `/api/bridge/ingest` | Production ingestion endpoint where bridge nodes POST packets |

---

## Running Tests

Run backend tests using:
```bash
cd mern
npm test
```
The test suite validates:
- **`encryptDecryptRoundTrip`**: Basic correctness of RSA-OAEP + AES-GCM hybrid encryption.
- **`tamperedCiphertextIsRejected`**: Verifies that altering one byte of the ciphertext triggers GCM tag failures and rejects ingestion.
- **`singlePacketDeliveredByThreeBridgesSettlesExactlyOnce`**: Simulates 3 parallel bridge uploads of the same transaction at the same millisecond, verifying that exactly 1 settlements completes, 2 are dropped, and balances change only once.

---

## Production Scaling Strategy

| Component | Current Demo Setup | Production Upgrade |
|---|---|---|
| Database | In-Memory Replica Set | MongoDB Atlas Cluster or PostgreSQL |
| Idempotency Cache | Local JavaScript Map | Redis Cluster (`SETNX` with TTL) |
| Key Management | Regenerated on Startup | HSM (AWS KMS / HashiCorp Vault) |
| Client Cryptography | Node-side wrapper | Kotlin (Android KeyStore) / Swift (Secure Enclave) |
| Mesh Routing | Simulated Gossip Loop | Bluetooth LE GATT / WiFi Direct |
| Core Bank Settlement | In-Memory balance update | NPCI UPI Engine API Integration |

---

## Honest Technical Limitations

1. **Funds Verification**: Because transactions are initiated offline, the sender's balance is verified only when the packet reaches the backend. If the sender does not have sufficient funds, the transaction is marked as `REJECTED` upon ingestion.
2. **Double Spending**: Double spending is physically possible before packets hit the server. The packet that reaches the backend first settles, and subsequent double spends are caught and discarded.
3. **Gossip Range and background BLE**: Mobile operating systems aggressively throttle background Bluetooth activity, requiring optimized connection pooling on real clients.
