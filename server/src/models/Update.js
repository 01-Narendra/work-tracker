import mongoose from 'mongoose';

const updateSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: [true, 'Date is required (YYYY-MM-DD)'],
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId reference is required'],
      index: true,
    },
    employeeName: {
      type: String,
      required: [true, 'employeeName copy is required'],
      trim: true,
    },
    checkIn: {
      type: String,
      default: '',
      trim: true,
    },
    checkOut: {
      type: String,
      default: '',
      trim: true,
    },
    hoursWorked: {
      type: Number,
      default: 0,
    },
    morningUpdate: {
      type: String,
      default: '',
      maxlength: 2000,
      trim: true,
    },
    eveningUpdate: {
      type: String,
      default: '',
      maxlength: 2000,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Present', 'Partial', 'Absent'],
      default: 'Absent',
      index: true,
    },
    weeklyWork: {
      type: String,
      default: '',
      trim: true,
    },
    weeklyTargetStatus: {
      type: String,
      default: '',
      trim: true,
    },
    weeklyTargetReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index on { date, userId }
updateSchema.index({ date: 1, userId: 1 }, { unique: true });

// Index on { date: -1 } for the admin filters
updateSchema.index({ date: -1 });

export const Update = mongoose.model('Update', updateSchema);
export default Update;

