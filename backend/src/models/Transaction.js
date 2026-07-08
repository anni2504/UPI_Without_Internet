import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    packetHash: { type: String, required: true, unique: true, maxlength: 64 },
    senderVpa: { type: String, required: true },
    receiverVpa: { type: String, required: true },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    signedAt: { type: Date, required: true },
    settledAt: { type: Date, required: true },
    bridgeNodeId: { type: String, required: true },
    hopCount: { type: Number, required: true },
    status: { type: String, enum: ['SETTLED', 'REJECTED'], required: true },
  },
  {
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.amount = parseFloat(ret.amount.toString());
        ret.signedAt = ret.signedAt.toISOString();
        ret.settledAt = ret.settledAt.toISOString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

export async function nextTransactionId() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'transaction' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}
