// Apps Script: stateless previews via =IMAGE(API_URL)
// Prompts for sheet name, finds ImgN columns, creates PrevN columns, writes formulas.
const API_BASE = 'https://hello-1085550623432.africa-south1.run.app';
const START_ROW = 2;
const MAX_FORMULAS_PER_RUN = 500;
const PREVIEW_SIZE = 120;
const CROP = true;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('RMBG')
    .addItem('Run (ask sheet name)', 'runAskSheetName')
    .addItem('Set 15-min trigger (ask & remember)', 'setup15MinTriggerAsk')
    .addItem('Clear triggers', 'clearTriggers')
    .addItem('Clear previews in selection', 'clearPreviewsInSelection')
    .addToUi();
}

function runAskSheetName() {
  const name = promptSheetName_();
  if (!name) return;
  writePreviewFormulas_(name);
}

function setup15MinTriggerAsk() {
  const name = promptSheetName_();
  if (!name) return;
  PropertiesService.getScriptProperties().setProperty('RMBG_SHEET_NAME', name);
  clearTriggers();
  ScriptApp.newTrigger('processRememberedSheet_').timeBased().everyMinutes(15).create();
  SpreadsheetApp.getActive().toast('Trigger set for sheet: ' + name);
}

function processRememberedSheet_() {
  const name = PropertiesService.getScriptProperties().getProperty('RMBG_SHEET_NAME');
  if (!name) return;
  writePreviewFormulas_(name);
}

function clearTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
}

function writePreviewFormulas_(sheetName) {
  const ss = SpreadsheetApp.getActive();
  const ws = ss.getSheetByName(sheetName);
  if (!ws) throw new Error(`Sheet '${sheetName}' not found`);

  const lastCol = ws.getLastColumn();
  const lastRow = ws.getLastRow();
  if (lastCol < 1 || lastRow < START_ROW) return;

  const headers = ws.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(v => (v || '').toString().trim());

  const imgCols = [];
  for (let c = 0; c < headers.length; c++) {
    const m = /^Img(\d+)$/.exec(headers[c]);
    if (m) imgCols.push({ idx: c + 1, n: parseInt(m[1], 10) });
  }
  if (imgCols.length === 0) {
    SpreadsheetApp.getActive().toast('No ImgN columns found.');
    return;
  }

  imgCols.sort((a, b) => b.idx - a.idx);
  const colMap = [];
  for (const { idx, n } of imgCols) {
    const prevName = `Prev${n}`;
    const hc = ws.getLastColumn();
    const hdrs = ws.getRange(1, 1, 1, hc).getValues()[0].map(x => (x || '').toString());
    let prevCol = hdrs.findIndex(h => h === prevName) + 1;

    if (!prevCol) {
      ws.insertColumnsAfter(idx, 1);
      prevCol = idx + 1;
      ws.getRange(1, prevCol).setValue(prevName);
    }
    ws.setColumnWidth(prevCol, PREVIEW_SIZE);
    colMap.push({ imgCol: idx, prevCol, n });
  }

  let updates = 0;
  for (let r = START_ROW; r <= lastRow; r++) {
    if (ws.getRowHeight(r) < PREVIEW_SIZE) ws.setRowHeight(r, PREVIEW_SIZE);

    for (const m of colMap) {
      if (updates >= MAX_FORMULAS_PER_RUN) break;

      const url = String(ws.getRange(r, m.imgCol).getValue() || '').trim();
      if (!url) continue;

      const cell = ws.getRange(r, m.prevCol);
      const hasSomething = cell.getFormula() || cell.getDisplayValue();
      if (hasSomething) continue;

      const api = API_BASE.replace(/\/+$/,'');
      const apiUrl = `${api}/rmbg_url?url=${encodeURIComponent(url)}&crop=${CROP ? 'true' : 'false'}`;
      cell.setFormula(`=IFERROR(IMAGE("${apiUrl}"), "ERR")`);
      updates++;
    }
    if (updates >= MAX_FORMULAS_PER_RUN) break;
  }

  SpreadsheetApp.getActive().toast(`Preview formulas written: ${updates}`);
}

function clearPreviewsInSelection() {
  const ws = SpreadsheetApp.getActiveSheet();
  const range = ws.getActiveRange();
  range.clearContent();
}

function promptSheetName_() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Enter Sheet (tab) name', 'Example: Sheet1', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return null;
  const name = (resp.getResponseText() || '').trim();
  if (!name) {
    ui.alert('Sheet name cannot be empty.');
    return null;
  }
  return name;
}
