// Run installLedger once after setting RCAP_LEDGER_KEY in Script Properties.
// The trigger then refreshes both tabs and copies private records into the
// restricted Drive folder. The reimbursement database remains authoritative.
const LEDGER_ENDPOINT = 'https://kcsrtwwpnekqdrfgcfys.supabase.co/functions/v1/check-request-ledger';
const LEDGER_SHEET_ID = '1M5XRQp56NytaV8bYh6-f4aotsg6J7v3raSfiiKmnRuI';
const LEDGER_FOLDER_ID = '1NOfAhq2gBLmR761EKUgWjsXkMtI8HRqE';
const LEDGER_READERS = ['lemeri@abc-seniors.com', 'rcaparents@ronclarkacademy.com'];

function installLedger() {
  if (!PropertiesService.getScriptProperties().getProperty('RCAP_LEDGER_KEY')) {
    throw new Error('Set RCAP_LEDGER_KEY in Script Properties first.');
  }
  const folder = DriveApp.getFolderById(LEDGER_FOLDER_ID);
  LEDGER_READERS.forEach((email) => folder.addViewer(email));
  const book = SpreadsheetApp.openById(LEDGER_SHEET_ID);
  book.setSpreadsheetTimeZone('America/New_York');
  [['Requests', 16], ['History', 5]].forEach(([name, columns]) => {
    const sheet = book.getSheetByName(name);
    if (!sheet) throw new Error('Missing ledger tab: ' + name);
    sheet.setFrozenRows(1);
    if (!sheet.getFilter()) sheet.getRange(1, 1, sheet.getMaxRows(), columns).createFilter();
  });
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
    if (!Array.isArray(data.requests) || !Array.isArray(data.history)) {
      throw new Error('Ledger source returned an incomplete record set.');
    }
    const staff = new Map((data.staff || []).map((person) => [person.email, person.name]));
    const testIds = new Set(data.test_ids || []);
    const requestsById = new Map(data.requests.map((request) => [request.id, request]));
    const root = DriveApp.getFolderById(LEDGER_FOLDER_ID);
    const requestRows = data.requests.map((request) => {
      const actions = data.history.filter((action) => action.request_id === request.id);
      const decision = actions.filter((action) => ['approved', 'declined', 'duplicate'].includes(action.action)).pop();
      const documents = request.documents || [];
      const folderUrl = copyDocuments(root, request.reference, documents);
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
        safe(staff.get(request.approver_email) || request.approver_email || 'Treasurer'),
        eastern(decision && decision.created_at),
        safe(request.status),
        request.payment_date || '',
        safe(request.payment_reference || ''),
        folderUrl || (testIds.has(request.id) ? 'TEST: no documents' : 'No documents on file'),
        'https://wearercap.org/check-requests/#request/' + request.id,
        flags,
      ];
    });
    const historyRows = data.history.map((action) => [
      requestsById.get(action.request_id)?.reference || '',
      eastern(action.created_at),
      safe(action.action),
      safe(staff.get(action.actor_email) || action.actor_email),
      safe(action.note || ''),
    ]);
    const book = SpreadsheetApp.openById(LEDGER_SHEET_ID);
    replaceRows(book.getSheetByName('Requests'), requestRows, 16);
    replaceRows(book.getSheetByName('History'), historyRows, 5);
    book.getSheetByName('Requests').getRange(2, 7, Math.max(requestRows.length, 1), 2)
      .setNumberFormat('$#,##0.00');
  } finally {
    lock.releaseLock();
  }
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
