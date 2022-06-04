import { jsPDF } from 'jspdf';
import * as qrcode from 'qr.js';
import { read } from 'xlsx';

const EXPORT_SHEET_NAME = 'qr_export';
const EXPORT_FILE_NAME = 'qrcodes.pdf';

const DEFAULT_LABEL_WIDTH = '4';
const DEFAULT_LABEL_HEIGHT = '8';

const COL_CHEERBOX_ID = 'cheerboxid';
const COL_LAST_NAME = 'recipient last name';
const COL_FIRST_NAME = 'recipient first name';
const COL_ADDRESS = 'recipient street address';
const COL_CITY = 'recipient city';
const COL_STATE = 'recipient state';
const COL_ZIPCODE = 'recipient zip code';
const COL_PHASE = 'wrapping phase';
const COL_URL = 'qr url';
const COL_VOLUNTEER_LAST_NAME = 'volunteer last name';
const COL_VOLUNTEER_FIRST_NAME = 'volunteer first name';

const createLabelsButton = document.getElementById('createLabels') as HTMLInputElement;
const exportFileInput = document.getElementById('exportFileInput') as HTMLInputElement;
const exportPasteInput = document.getElementById('exportPasteInput') as HTMLInputElement;
const labelWidthInput = document.getElementById('labelWidth') as HTMLInputElement;
const labelHeightInput = document.getElementById('labelHeight') as HTMLInputElement;

let boxInfos: Map<string, string>[] = null;
let performingExport = false;

window.onload = main;
function main() {
    // Helper for [en/dis]abling all inputs during PDF-export
    const setFormEnabled = (enabled: boolean) => {
        exportFileInput.disabled = !enabled;
        exportPasteInput.disabled = !enabled;
        createLabelsButton.disabled = !enabled;
        labelWidthInput.disabled = !enabled;
        labelHeightInput.disabled = !enabled;
    };

    // Helper for binding a text field to `localStorage` to persist values between sessions
    const setupInputLocalStorage = (input: HTMLInputElement, key: string, initial: string = null) => {
        // Default the key value
        if (initial !== null && localStorage[key] === null) {
            localStorage.setItem(key, initial);
        }

        // Grab the key's value
        input.value = localStorage.getItem(key);

        // When the associated field's value changes, update the stored value
        input.oninput = async () => {
            localStorage.setItem(key, input.value);
            await updateUI();
        };
    };

    // Processes XLSX files when selected in the file-picker
    exportFileInput.onchange = async (_) => {
        if (exportFileInput.files.length > 0) {
            await loadExportFile(exportFileInput.files[0]);
        } else {
            boxInfos = null;
        }

        await updateUI();
    };

    // Processes paste actions and attempts to load spreadsheet data
    exportPasteInput.onpaste = async (event) => {
        // Do not process the paste action if we're actively exporting
        if (performingExport) {
            return false;
        }

        const pastedText = event.clipboardData.getData('text/plain');

        // Clear any previous file selection
        exportFileInput.value = '';

        if (pastedText != null && pastedText.length > 0) {
            loadExportPaste(pastedText);
        } else {
            boxInfos = null;
        }

        await updateUI();

        // Stop event propagation and clear the input's value
        return false;
    };

    // Always clear the paste input
    exportPasteInput.onchange = () => exportPasteInput.value = '';

    // Configure text inputs with `localStorage` persistence between sessions
    setupInputLocalStorage(labelWidthInput, 'label-width', DEFAULT_LABEL_WIDTH);
    setupInputLocalStorage(labelHeightInput, 'label-height', DEFAULT_LABEL_HEIGHT);

    // Handle export requests
    createLabelsButton.onclick = async () => {
        performingExport = true;
        setFormEnabled(false);

        try {
            // Create the shipping labels
            const doc = await createShippingPDF(
                parseFloat(labelHeightInput.value),
                parseFloat(labelWidthInput.value),
            );

            // Download the shipping labels
            doc.save(EXPORT_FILE_NAME);

            performingExport = false;
            setFormEnabled(true);
        } catch (e) {
            console.log('Fatal error:', e);
            alert('Something went wrong, please reload the page and try again.');
        }
    }

    updateUI().then();
}

/// Given a user-specified XLSX export file, parse it into our box schema for display and PDF export.
async function loadExportFile(exportFile: File) {
    // Parse the spreadsheet and identify the export worksheet
    const contents = await exportFile.arrayBuffer();
    const workbook = read(contents);
    const worksheet = workbook.Sheets[EXPORT_SHEET_NAME];

    const headers = new Map<string, string>;
    const boxes = new Map<string, Map<string, string>>();

    // Step through cells in the worksheet collecting them into box structures
    for (const cell in worksheet) {
        // Parse the cells from "A1" into column "A" and row "1"
        const col = cell.substring(0, 1);
        const row = cell.substring(1);

        // Skip the metadata
        if (row === 'ref' || row == 'margins' || row == 'autofilter') {
            continue;
        }

        const cellValue = worksheet[cell].v.toString();

        // For the header row, map column IDs to their header text (which form the row value keys)
        if (row === '1') {
            // Try to reduce opportunity for mismatches between of capitalization and spacing
            const cleanedHeaderKey = cellValue.toLowerCase().trim();

            headers.set(col, cleanedHeaderKey);
            continue;
        }

        // Initialize this box's structure if we haven't encountered it yet
        if (!boxes.has(row)) {
            boxes.set(row, new Map<string, string>());
        }

        const headerKey = headers.get(col);
        boxes.get(row)[headerKey] = cellValue;
    }

    boxInfos = Array.from(boxes.values());
}

/// Given plain/text paste content from a spreadsheet, parse it into our box schema for display and PDF export.
function loadExportPaste(tabDelimited: string) {
    const lines = tabDelimited.split('\n');

    // We should have at least a header and data row
    if (lines.length < 2) {
        boxInfos = null;
        return;
    }

    const headerRow = lines[0].split('\t');
    const boxes = new Map<number, Map<string, string>>();

    // Loop through the data rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        const fields = line.split('\t');

        // Populate the box's structure, referencing the header row for property keys
        const box = new Map<string, string>();
        for (let j = 0; j < fields.length; j++) {
            const cellValue = fields[j];

            // Try to reduce opportunity for mismatches between of capitalization and spacing
            const cleanedHeaderKey = headerRow[j].toLowerCase().trim();

            box[cleanedHeaderKey] = cellValue;
        }

        // Skip empty rows
        if (box[COL_CHEERBOX_ID] === null || box[COL_CHEERBOX_ID].trim().length === 0) {
            continue;
        }

        boxes.set(i, box);
    }

    boxInfos = Array.from(boxes.values());
}

/// Updates UI controls based on current form state and whether box data is loaded.
async function updateUI() {
    const table = document.getElementById('previewTable');
    const tableBody = document.getElementById('previewTableBody');
    const text = document.getElementById('previewTableText');

    // Disable the submission button if the form is in an invalid state
    createLabelsButton.disabled = boxInfos === null
        || labelWidthInput.value === null || labelWidthInput.value.length === 0
        || labelHeightInput.value === null || labelHeightInput.value.length === 0;

    // Clear the previous table preview contents
    [...tableBody.children].forEach(child => tableBody.removeChild(child));

    // Show/hide the preview table and help text depending on whether we have box information
    if (boxInfos === null) {
        table.style.display = 'none';
        text.style.display = 'block';

        createLabelsButton.innerText = `Create Cheer Box Labels`;

        return;
    } else {
        table.style.display = 'table';
        text.style.display = 'none';

        createLabelsButton.innerText = `Create ${boxInfos.length} Cheer Box Labels`;
    }

    // Populate the preview table with the loaded boxes
    boxInfos.forEach(boxInfo => {
        const row = document.createElement('tr');

        const addCell = (data) => {
            const cell = document.createElement('td');
            cell.textContent = data;
            row.appendChild(cell);
        }

        addCell(boxInfo[COL_CHEERBOX_ID]);
        addCell(boxInfo[COL_PHASE]);
        addCell((boxInfo[COL_VOLUNTEER_FIRST_NAME] ?? '') + ' ' + (boxInfo[COL_VOLUNTEER_LAST_NAME] ?? ''));
        addCell(boxInfo[COL_FIRST_NAME]);
        addCell(boxInfo[COL_LAST_NAME]);
        addCell(boxInfo[COL_ADDRESS]);
        addCell(boxInfo[COL_CITY]);
        addCell(boxInfo[COL_STATE]);
        addCell(boxInfo[COL_ZIPCODE]);

        tableBody.appendChild(row);
    });
}

/// Given a label's dimensions, renders QR codes and associated metadata into a PDF.
async function createShippingPDF(height: number, width: number): Promise<jsPDF> {
    const format = [width, height];
    const doc = new jsPDF({ unit: 'in', format });

    const textScale = width / 4;

    // Step through the boxes, rendering QR codes for each
    for (let i = 0; i < boxInfos.length; i++) {
        const boxInfo = boxInfos[i];
        const cheerboxId = boxInfo[COL_CHEERBOX_ID];

        if (i > 0) {
            doc.addPage(format);
        }

        // Generate a QR code by concatenating the form URL and cheerbox ID
        const qrCode = await createQRCode(boxInfo[COL_URL]);

        // Locate the image in the PDF
        doc.addImage({
            imageData: qrCode,
            x: width * 0.15,
            y: width * 0.2,
            width: width * 0.7,
            height: width * 0.7,
        });

        // Write the code text above the QR code
        doc.setFontSize(26 * textScale);
        doc.text(
            cheerboxId,
            width / 2,
            width * 0.15,
            { align: 'center' },
        );

        // Render the name and phase below the QR code
        doc.setFontSize(18 * textScale);
        doc.text(
            `${boxInfo[COL_LAST_NAME]}, ${boxInfo[COL_FIRST_NAME]} - ${boxInfo[COL_PHASE]}`,
            width / 2,
            width,
            { align: 'center' },
        );

        const hasVolunteerName = boxInfo[COL_VOLUNTEER_FIRST_NAME] != null && boxInfo[COL_VOLUNTEER_FIRST_NAME].length > 0
            || boxInfo[COL_VOLUNTEER_LAST_NAME] != null && boxInfo[COL_VOLUNTEER_LAST_NAME].length > 0;

        // If available, render the volunteer's name
        if (hasVolunteerName) {
            doc.setFontSize(18 * textScale);
            doc.text(
                `${boxInfo[COL_VOLUNTEER_LAST_NAME]}, ${boxInfo[COL_VOLUNTEER_FIRST_NAME]}`,
                width / 2,
                width * 1.1,
                { align: 'center' },
            );
        }

        // Then render the address information last and smallest
        doc.setFontSize(16 * textScale);
        doc.text(
            boxInfo[COL_ADDRESS],
            width / 2,
            width * 1.2,
            { align: 'center' },
        );
        doc.text(
            `${boxInfo[COL_CITY]}, ${boxInfo[COL_STATE]} ${boxInfo[COL_ZIPCODE]}`,
            width / 2,
            width * 1.25,
            { align: 'center' },
        );

        // Lastly render the contact information
        doc.setFontSize(12 * textScale);
        doc.text(
            `If you do not believe this box belongs to you,`,
            width / 2,
            width * 1.32,
            { align: 'center' },
        );
        doc.text(
            `contact Amanda the Panda at (515) 223-4847.`,
            width / 2,
            width * 1.37,
            { align: 'center' },
        );
    }

    return doc;
}

/// Computes a QR code for the specified data by rendering to a hidden canvas and pulling its contents.
async function createQRCode(data: string): Promise<Uint8Array> {
    // Identify the hidden container and mount a new canvas
    const canvasContainer = document.getElementById('renderOutputContainer');
    const canvas = document.createElement('canvas') as HTMLCanvasElement;
    canvasContainer.appendChild(canvas);

    // Generate a QR code for the specified data
    const qrCode = qrcode.default(data);
    const cells: boolean[][] = qrCode.modules;

    const rows = cells.length;
    const cols = cells[0].length;

    const squareSize = 10;
    canvas.width = squareSize * cols;
    canvas.height = squareSize * rows;

    // Draw the resultant QR code to the hidden canvas
    const g = canvas.getContext('2d');
    g.fillStyle = 'black';
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (cells[row][col]) {
                g.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
            }
        }
    }

    // Pull and return the canvas's image contents
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            canvasContainer.removeChild(canvas);
            blob.arrayBuffer().then((data) => {
                resolve(new Uint8Array(data));
            });
        }, 'image/png');
    });
}
