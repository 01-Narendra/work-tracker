import Setting from '../models/Setting.js';

export const SETTING_KEYS = {
  ALLOW_CURRENT_WEEK_UPDATES: 'allowCurrentWeekUpdates',
};

/**
 * Returns true if superadmin has enabled current-week updates outside standard morning/evening windows.
 * Defaults to false (strict mode).
 */
export async function isCurrentWeekUpdatesAllowed() {
  try {
    const doc = await Setting.findOne({ key: SETTING_KEYS.ALLOW_CURRENT_WEEK_UPDATES }).lean();
    return Boolean(doc?.value);
  } catch (err) {
    console.error('[SettingService] Error reading allowCurrentWeekUpdates:', err.message);
    return false;
  }
}

/**
 * Updates the current-week updates setting.
 */
export async function setCurrentWeekUpdatesAllowed(allowed, updatedBy = 'superadmin') {
  const boolVal = Boolean(allowed);
  const doc = await Setting.findOneAndUpdate(
    { key: SETTING_KEYS.ALLOW_CURRENT_WEEK_UPDATES },
    {
      $set: {
        value: boolVal,
        description:
          'When enabled, employees and admins can add or update their check-in, check-out, and updates for any day of the current week outside morning/evening windows.',
        updatedBy: String(updatedBy || 'superadmin').trim(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return Boolean(doc.value);
}

