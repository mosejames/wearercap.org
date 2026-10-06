// Run installLedger once after setting RCAP_LEDGER_KEY in Script Properties.
// The trigger refreshes all four tabs and copies private records into the
// restricted Drive folder. The reimbursement database remains authoritative.
const LEDGER_ENDPOINT = 'https://kcsrtwwpnekqdrfgcfys.supabase.co/functions/v1/check-request-ledger';
const LEDGER_SHEET_ID = '1M5XRQp56NytaV8bYh6-f4aotsg6J7v3raSfiiKmnRuI';
const LEDGER_FOLDER_ID = '1NOfAhq2gBLmR761EKUgWjsXkMtI8HRqE';
const LEDGER_READERS = ['lemeri@abc-seniors.com', 'rcaparents@ronclarkacademy.com'];
const LEDGER_HEADERS = {
  Requests: ['Request #', 'Submitted (ET)', 'Requester', 'Committee', 'Type', 'Payee',
    'Requested', 'Approved', 'Approver', 'Decision recorded (ET)', 'Status',
    'Payment date', 'Payment reference', 'Documents', 'Record link', 'Archived / test',
    'Payment method', 'Zelle destination'],
  Expenses: ['Request #', 'Item #', 'Expense date', 'Vendor', 'Expense',
    'Receipt / invoice total', 'Requested from RCAP', 'Other coverage', 'Notes after approval',
    'Source receipts', 'Documents', 'Record link'],
  History: ['Request #', 'When (ET)', 'Action', 'By', 'Note'],
  Notifications: ['Request #', 'Queued (ET)', 'Channel', 'To', 'Subject',
    'Send status', 'Sent (ET)', 'Delivery status', 'Error', 'Record link'],
};
const LEDGER_COLUMN_WIDTHS = {
  Expenses: [105, 75, 115, 190, 320, 155, 165, 280, 320, 220, 235, 235],
  Notifications: [105, 175, 120, 330, 250, 120, 175, 135, 250, 235],
};

function installLedger() {
  if (!PropertiesService.getScriptProperties().getProperty('RCAP_LEDGER_KEY')) {
    throw new Error('Set RCAP_LEDGER_KEY in Script Properties first.');
  }
  const folder = DriveApp.getFolderById(LEDGER_FOLDER_ID);
  LEDGER_READERS.forEach((email) => folder.addViewer(email));
  const book = SpreadsheetApp.openById(LEDGER_SHEET_ID);
  book.setSpreadsheetTimeZone('America/New_York');
  Object.entries(LEDGER_HEADERS).forEach(([name, headers]) =>
    ensureLedgerSheet(book, name, headers));
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'syncLedger')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('syncLedger').timeBased().everyMinutes(5).create();
  syncLedger();
}

function syncLedger() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const key = PropertiesService.getScriptProperties().getProperty('RCAP_LEDGER_KEY');
    if (!key) throw new Error('RCAP_LEDGER_KEY is missing.');
    const response = UrlFetchApp.fetch(LEDGER_ENDPOINT, {
      method: 'post',
      headers: { 'x-rcap-ledger-key': key },
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Ledger source returned HTTP ' + response.getResponseCode());
    }
    const data = JSON.parse(response.getContentText());
    if (!Array.isArray(data.requests) || !Array.isArray(data.expenses) ||
        !Array.isArray(data.history) || !Array.isArray(data.notifications)) {
      throw new Error('Ledger source returned an incomplete record set.');
    }
    const staff = new Map((data.staff || []).map((person) => [person.email, person.name]));
    const testIds = new Set(data.test_ids || []);
    const requestsById = new Map(data.requests.map((request) => [request.id, request]));
    const documentFolders = new Map();
    const root = DriveApp.getFolderById(LEDGER_FOLDER_ID);
    const requestRows = data.requests.map((request) => {
      const actions = data.history.filter((action) => action.request_id === request.id);
      const decision = actions.filter((action) => ['approved', 'declined', 'duplicate'].includes(action.action)).pop();
      const documents = request.documents || [];
      const folderUrl = copyDocuments(root, request.reference, documents);
      documentFolders.set(request.id, folderUrl);
      const originalMissing = !documents.some((document) => document.bucket === 'check-receipts');
      const flags = [
        request.archived_at ? 'Archived' : '',
        testIds.has(request.id) ? 'TEST' : '',
        originalMissing ? 'Original receipt or invoice missing' : '',
      ].filter(Boolean).join(' / ');
      return [
        request.reference,
        eastern(request.created_at),
        safe(request.requester_name),
        safe(request.committee),
        request.request_type === 'vendor' ? 'Vendor payment' : 'Reimbursement',
        safe(request.payee),
        Number(request.total_cents) / 100,
        ['approved', 'paid'].includes(request.status) ? Number(request.total_cents) / 100 : '',
        safe(staff.get(request.approver_email) || request.approver_email ||
          (request.status === 'submitted' ? 'Needs reviewer assignment' : 'Treasurer (earlier request)')),
        eastern(decision && decision.created_at),
        safe(request.status),
        request.payment_date || '',
        safe(request.payment_reference || ''),
        folderUrl || (testIds.has(request.id) ? 'TEST: no documents' : 'No documents on file'),
        'https://wearercap.org/check-requests/#request/' + request.id,
        flags,
        { zelle: 'Zelle', debit_card: 'Debit card', check: 'Check', other: 'Other', pickup: 'Pickup', mail: 'Mail' }[request.payment_method || request.delivery] || safe(request.payment_method || request.delivery),
        request.delivery === 'zelle' ? safe(request.zelle_contact || '') : '',
      ];
    });
    const expenseRows = data.expenses.map((item) => {
      const request = requestsById.get(item.request_id);
      if (!request) throw new Error('An expense has no matching request.');
      const notes = data.history
        .filter((action) => action.request_id === item.request_id &&
          action.action === 'item_note' && action.item_index === item.item_number - 1)
        .map((action) => eastern(action.created_at) + ' | ' +
          (staff.get(action.actor_email) || action.actor_email) + ': ' +
          String(action.note || '').replace(/^Expense \d+: /, ''));
      return [
        request.reference,
        item.item_number,
        safe(item.date || ''),
        safe(item.vendor || request.payee),
        safe(item.description || ''),
        item.document_total_cents == null ? '' : Number(item.document_total_cents) / 100,
        Number(item.amount_cents) / 100,
        safe(item.coverage_note || ''),
        safe(notes.join('\n')),
        safe((item.receipt_names || []).join('; ') || 'No original receipt'),
        documentFolders.get(request.id) || '',
        'https://wearercap.org/check-requests/#request/' + request.id,
      ];
    });
    const historyRows = data.history.map((action) => [
      requestsById.get(action.request_id)?.reference || '',
      eastern(action.created_at),
      safe(action.action),
      safe(staff.get(action.actor_email) || action.actor_email),
      safe(action.note || ''),
    ]);
    const notificationRows = data.notifications.map((notice) => {
      const request = requestsById.get(notice.request_id);
      if (!request) throw new Error('A notification has no matching request.');
      const recipients = Array.isArray(notice.recipients) && notice.recipients.length
        ? notice.recipients.join(', ') : notice.recipient;
      return [
        request.reference,
        eastern(notice.created_at),
        notice.channel === 'sms' ? 'Text message' : 'Email',
        safe(recipients || ''),
        safe(notice.subject || ''),
        safe(notice.state || ''),
        eastern(notice.sent_at),
        safe(notice.delivery_status || ''),
        safe(notice.last_error || ''),
        'https://wearercap.org/check-requests/#request/' + request.id,
      ];
    });
    const book = SpreadsheetApp.openById(LEDGER_SHEET_ID);
    Object.entries(LEDGER_HEADERS).forEach(([name, headers]) =>
      ensureLedgerSheet(book, name, headers));
    replaceRows(book.getSheetByName('Requests'), requestRows, LEDGER_HEADERS.Requests.length);
    replaceRows(book.getSheetByName('Expenses'), expenseRows, LEDGER_HEADERS.Expenses.length);
    replaceRows(book.getSheetByName('History'), historyRows, LEDGER_HEADERS.History.length);
    replaceRows(book.getSheetByName('Notifications'), notificationRows, LEDGER_HEADERS.Notifications.length);
    book.getSheetByName('Requests').getRange(2, 7, Math.max(requestRows.length, 1), 2)
      .setNumberFormat('$#,##0.00');
    book.getSheetByName('Expenses').getRange(2, 6, Math.max(expenseRows.length, 1), 2)
      .setNumberFormat('$#,##0.00');
  } finally {
    lock.releaseLock();
  }
}

function ensureLedgerSheet(book, name, headers) {
  let sheet = book.getSheetByName(name);
  const isNew = !sheet;
  if (isNew) sheet = book.insertSheet(name);
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  const header = sheet.getRange(1, 1, 1, headers.length);
  header.setValues([headers]);
  header.setBackground('#e9ecf0').setFontColor('#202124')
    .setFontFamily('Arial').setFontSize(10).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (isNew && LEDGER_COLUMN_WIDTHS[name]) {
    LEDGER_COLUMN_WIDTHS[name].forEach((width, index) => sheet.setColumnWidth(index + 1, width));
    sheet.setFrozenColumns(name === 'Expenses' ? 2 : 1);
  }
  const filter = sheet.getFilter();
  if (filter && filter.getRange().getNumColumns() !== headers.length) filter.remove();
  if (!sheet.getFilter()) sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).createFilter();
  return sheet;
}

function copyDocuments(root, reference, documents) {
  if (!documents.length) return '';
  const folderName = 'Request #' + reference;
  const existing = root.getFoldersByName(folderName);
  const folder = existing.hasNext() ? existing.next() : root.createFolder(folderName);
  for (const document of documents) {
    const id = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      document.bucket + ':' + document.path)
      .slice(0, 10).map((byte) => ('0' + (byte & 255).toString(16)).slice(-2)).join('');
    const name = id + '-' + String(document.name || 'document')
      .replace(/[\\/:\u0000-\u001f]/g, '_').slice(0, 120);
    if (folder.getFilesByName(name).hasNext()) continue;
    const download = UrlFetchApp.fetch(document.url, { muteHttpExceptions: true });
    if (download.getResponseCode() !== 200) {
      throw new Error('Could not copy a document for request #' + reference);
    }
    folder.createFile(download.getBlob().setName(name));
  }
  return folder.getUrl();
}

function replaceRows(sheet, rows, columns) {
  if (!sheet) throw new Error('A ledger tab is missing.');
  const oldRows = sheet.getLastRow() - 1;
  if (oldRows > 0) sheet.getRange(2, 1, oldRows, columns).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, columns).setValues(rows);
}

function eastern(value) {
  return value ? Utilities.formatDate(new Date(value), 'America/New_York',
    'MM/dd/yyyy, h:mm a') + ' ET' : '';
}

function safe(value) {
  const text = String(value == null ? '' : value);
  return /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
}
