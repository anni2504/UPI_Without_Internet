import mongoose from 'mongoose';

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

export const Account = mongoose.model('Account', accountSchema);
