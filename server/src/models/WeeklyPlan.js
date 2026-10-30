import mongoose from 'mongoose';

const weeklyPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: String,
      required: true,
      trim: true,
    },
    endDate: {
      type: String,
      required: true,
      trim: true,
    },
    weeklyWork: {
      type: String,
      default: '',
      trim: true,
    },
    targetStatus: {
      type: String,
      default: '',
      trim: true,
    },
    targetStatusReason: {
      type: String,
      default: '',
      trim: true,
    },
    updatedAtStr: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  {
    timestamps: true,
  }
);

weeklyPlanSchema.index({ userId: 1, startDate: 1 }, { unique: true });

export const WeeklyPlan = mongoose.model('WeeklyPlan', weeklyPlanSchema);
export default WeeklyPlan;

