import mongoose from 'mongoose';
import { AccountMock } from './dbMock.js';

const accountSchema = new mongoose.Schema(
  {
    vpa: { type: String, required: true, unique: true },
    holderName: { type: String, required: true },
    balance: { type: mongoose.Schema.Types.Decimal128, required: true },
    version: { type: Number, default: 0 },
  },
  {
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.balance = parseFloat(ret.balance.toString());
        return ret;
      },
    },
  }
);

const RealAccount = mongoose.model('Account', accountSchema);

export const Account = new Proxy(RealAccount, {
  get(target, prop) {
    if (global.useMockDb) {
      return AccountMock[prop];
    }
    return target[prop];
  }
});
