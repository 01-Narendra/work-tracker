import ExcelJS from 'exceljs';
import { formatHoursWorked } from '../utils/time.js';

export const COLS = [
  { header: 'Date', key: 'date', width: 14 },
  { header: 'Employee Name', key: 'employeeName', width: 24 },
  { header: 'Check-In', key: 'checkIn', width: 14 },
  { header: 'Check-Out', key: 'checkOut', width: 16 },
  { header: 'Hours Worked', key: 'hoursWorked', width: 16 },
  { header: 'Morning Update', key: 'morningUpdate', width: 45 },
  { header: 'Evening Update', key: 'eveningUpdate', width: 45 },
  { header: 'Weekly Work', key: 'weeklyWork', width: 45 },
  { header: 'Weekly Target Status', key: 'weeklyTargetStatus', width: 22 },
  { header: 'Weekly Target Reason', key: 'weeklyTargetReason', width: 35 },
  { header: 'Status', key: 'status', width: 14 },
];

function valOrHyphen(val) {
  if (val === null || val === undefined) return '-';
  const str = String(val).trim();
  return str.length > 0 ? str : '-';
}

/**
 * Streams an Excel (.xlsx) file on-demand directly to the Express response
 * without buffering the entire file in RAM or storing it on disk.
 */
export async function streamExcelExport({ res, filename = 'work_updates.xlsx', cursor }) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
  });

  const worksheet = workbook.addWorksheet('Updates', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = COLS;
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).commit();

  for await (const doc of cursor) {
    const hoursText =
      doc.hoursWorked != null && doc.hoursWorked !== 0
        ? typeof doc.hoursWorked === 'number'
          ? formatHoursWorked(doc.hoursWorked)
          : String(doc.hoursWorked)
        : '';

    const row = worksheet.addRow({
      date: valOrHyphen(doc.date),
      employeeName: valOrHyphen(doc.employeeName),
      checkIn: valOrHyphen(doc.checkIn),
      checkOut: valOrHyphen(doc.checkOut),
      hoursWorked: valOrHyphen(hoursText),
      morningUpdate: valOrHyphen(doc.morningUpdate),
      eveningUpdate: valOrHyphen(doc.eveningUpdate),
      weeklyWork: valOrHyphen(doc.weeklyWork),
      weeklyTargetStatus: valOrHyphen(doc.weeklyTargetStatus),
      weeklyTargetReason: valOrHyphen(doc.weeklyTargetReason),
      status: valOrHyphen(doc.status),
    });

    row.alignment = { vertical: 'top', wrapText: true };
    row.commit();
  }

  worksheet.commit();
  await workbook.commit();
}
