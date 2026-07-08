import mongoose from 'mongoose';
import { Account } from '../models/Account.js';
import { Transaction, nextTransactionId } from '../models/Transaction.js';

function toDecimal128(value) {
  return mongoose.Types.Decimal128.fromString(Number(value).toFixed(2));
}

function decimalToNumber(value) {
  return parseFloat(value.toString());
}

export async function settle(instruction, packetHash, bridgeNodeId, hopCount) {
  const amount = Number(instruction.amount);
  if (!(amount > 0)) {
    throw new Error('Amount must be positive');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sender = await Account.findOne({ vpa: instruction.senderVpa }).session(session);
    if (!sender) {
      throw new Error(`Unknown sender VPA: ${instruction.senderVpa}`);
    }

    const receiver = await Account.findOne({ vpa: instruction.receiverVpa }).session(session);
    if (!receiver) {
      throw new Error(`Unknown receiver VPA: ${instruction.receiverVpa}`);
    }

    const senderBalance = decimalToNumber(sender.balance);
    if (senderBalance < amount) {
      console.warn(
        `Insufficient balance: ${sender.vpa} has ₹${senderBalance}, tried to send ₹${amount}`
      );
      const tx = await recordRejected(instruction, packetHash, bridgeNodeId, hopCount, session);
      await session.commitTransaction();
      return tx;
    }

    const senderUpdated = await Account.findOneAndUpdate(
      { vpa: instruction.senderVpa, version: sender.version },
      {
        $set: { balance: toDecimal128(senderBalance - amount) },
        $inc: { version: 1 },
      },
      { new: true, session }
    );

    if (!senderUpdated) {
      throw new Error('Optimistic lock failed on sender account');
    }

    const receiverBalance = decimalToNumber(receiver.balance);
    const receiverUpdated = await Account.findOneAndUpdate(
      { vpa: instruction.receiverVpa, version: receiver.version },
      {
        $set: { balance: toDecimal128(receiverBalance + amount) },
        $inc: { version: 1 },
      },
      { new: true, session }
    );

    if (!receiverUpdated) {
      throw new Error('Optimistic lock failed on receiver account');
    }

    const txId = await nextTransactionId();
    const tx = await Transaction.create(
      [
        {
          id: txId,
          packetHash,
          senderVpa: instruction.senderVpa,
          receiverVpa: instruction.receiverVpa,
          amount: toDecimal128(amount),
          signedAt: new Date(instruction.signedAt),
          settledAt: new Date(),
          bridgeNodeId,
          hopCount,
          status: 'SETTLED',
        },
      ],
      { session }
    );

    await session.commitTransaction();

    console.log(
      `SETTLED ₹${amount} from ${sender.vpa} to ${receiver.vpa} (packetHash=${packetHash.substring(0, 12)}..., bridge=${bridgeNodeId}, hops=${hopCount})`
    );

    return tx[0];
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function recordRejected(instruction, packetHash, bridgeNodeId, hopCount, session) {
  const txId = await nextTransactionId();
  const [tx] = await Transaction.create(
    [
      {
        id: txId,
        packetHash,
        senderVpa: instruction.senderVpa,
        receiverVpa: instruction.receiverVpa,
        amount: toDecimal128(instruction.amount),
        signedAt: new Date(instruction.signedAt),
        settledAt: new Date(),
        bridgeNodeId,
        hopCount,
        status: 'REJECTED',
      },
    ],
    { session }
  );
  return tx;
}
