let accounts = [
  { vpa: 'alice@demo', holderName: 'Alice', balance: 5000.00, version: 0 },
  { vpa: 'bob@demo', holderName: 'Bob', balance: 1000.00, version: 0 },
  { vpa: 'carol@demo', holderName: 'Carol', balance: 2500.00, version: 0 },
  { vpa: 'dave@demo', holderName: 'Dave', balance: 150.00, version: 0 },
];
let transactions = [];
let txSeq = 0;

class MockQuery {
  constructor(data) {
    this.data = data;
  }
  sort() { return this; }
  limit(n) {
    this.data = this.data.slice(0, n);
    return this;
  }
  lean() { return this.data; }
}

export const AccountMock = {
  find: () => new MockQuery(accounts),
  countDocuments: async () => accounts.length,
  insertMany: async (arr) => {
    accounts = arr.map(a => ({
      ...a,
      balance: parseFloat(a.balance.toString()),
      version: a.version || 0
    }));
    return accounts;
  },
  findOne: ({ vpa }) => {
    const acc = accounts.find(a => a.vpa === vpa);
    const result = acc || null;
    return {
      session: () => result,
      then: (resolve) => resolve(result)
    };
  },
  findOneAndUpdate: ({ vpa, version }, update, options) => {
    const idx = accounts.findIndex(a => a.vpa === vpa);
    if (idx === -1) return null;
    const acc = accounts[idx];
    if (version !== undefined && acc.version !== version) {
      return null; // Optimistic locking failed
    }
    if (update.$set) {
      acc.balance = parseFloat(update.$set.balance.toString());
    }
    if (update.$inc && update.$inc.version) {
      acc.version += update.$inc.version;
    }
    return acc;
  }
};

export const TransactionMock = {
  find: () => new MockQuery([...transactions].reverse()),
  create: (arr, options) => {
    const created = arr.map(t => ({
      ...t,
      amount: parseFloat(t.amount.toString()),
      signedAt: new Date(t.signedAt),
      settledAt: new Date(t.settledAt)
    }));
    transactions.push(...created);
    return created;
  }
};

export async function nextTransactionIdMock() {
  txSeq += 1;
  return txSeq;
}

export function resetMockDb() {
  accounts = [
    { vpa: 'alice@demo', holderName: 'Alice', balance: 5000.00, version: 0 },
    { vpa: 'bob@demo', holderName: 'Bob', balance: 1000.00, version: 0 },
    { vpa: 'carol@demo', holderName: 'Carol', balance: 2500.00, version: 0 },
    { vpa: 'dave@demo', holderName: 'Dave', balance: 150.00, version: 0 },
  ];
  transactions = [];
  txSeq = 0;
}
