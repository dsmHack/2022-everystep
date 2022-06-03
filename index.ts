import * as uuid from 'short-uuid';
import { jsPDF } from 'jspdf';
import * as qrcode from 'qr.js';
import { read } from 'xlsx';

window.onload = main;
function main() {
    const labelExportFileInput = document.getElementById('labelExportFile') as HTMLInputElement;
    const googleFormURLInput = document.getElementById('googleFormURL') as HTMLInputElement;
    const createContainersButton = document.getElementById('createContainers') as HTMLInputElement;

    const googleFormURLKey = 'google-form-url';
    googleFormURLInput.value = localStorage.getItem(googleFormURLKey);
    googleFormURLInput.oninput = () => {
        localStorage.setItem(googleFormURLKey, googleFormURLInput.value);
    }

    createContainersButton.onclick = async () => {
        labelExportFileInput.disabled = true;
        createContainersButton.disabled = true;
        googleFormURLInput.disabled = true;

        await createContainers(
            googleFormURLInput.value,
            labelExportFileInput.files[0],
        );

        labelExportFileInput.disabled = false;
        createContainersButton.disabled = false;
        googleFormURLInput.disabled = false;
    }
}

interface BoxInfo {
    code: string,
    name: string,
    address: string,
    phase: string,
}

async function createContainers(googleFormURL: string, exportFile: File): Promise<void> {
    const contents = await exportFile.arrayBuffer();
    const workbook = read(contents);
    const worksheet = workbook.Sheets['export_format'];

    const boxInfos = new Map<string, BoxInfo>();
    for (const cell in worksheet) {
        const col = cell.substring(0, 1);
        const row = cell.substring(1);

        if (row === 'ref' || row == '1' || row == 'margins') {
            continue;
        }

        if (!boxInfos.has(row)) {
            boxInfos.set(row, {
                code: 'N/A',
                name: 'N/A',
                address: 'N/A',
                phase: 'N/A',
            });
        }

        const boxInfo = boxInfos.get(row);
        const cellValue = worksheet[cell].v.toString();

        switch (col) {
            case 'A':
                boxInfo.code = cellValue;
                break;
            case 'B':
                boxInfo.name = cellValue;
                break;
            case 'C':
                boxInfo.address = cellValue;
                break;
            case 'D':
                boxInfo.phase = cellValue;
                break;
        }
    }

    const boxInfosFlattened = Array.from(boxInfos.values());

    await createShippingPDF(6, 4, googleFormURL, boxInfosFlattened);
    downloadCSV(boxInfosFlattened);
}

function downloadCSV(boxInfos: BoxInfo[]): void {
    const csvData = ['id', ...boxInfos.map(b => b.code)].join('\n');
    const blob = new Blob([csvData], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'containers.csv';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
}

async function createA4PDF(googleFormURL: string, boxInfos: BoxInfo[]) {
    const doc = new jsPDF();
    doc.setFontSize(9);

    const pageWidth = 210;
    const pageHeight = 297;

    const codePadding = 10;
    const textOffset = 5;

    const columns = 3;
    const cellWidth = pageWidth / columns;
    const cellHeight = cellWidth + textOffset;
    const rows = Math.floor(pageHeight / cellHeight);
    const codesPerPage = rows * columns;

    for (let i = 0; i < boxInfos.length; i++) {
        let pageIndex = i % codesPerPage;

        const shouldPaginate = i !== 0 && pageIndex % codesPerPage === 0;
        if (shouldPaginate) {
            doc.addPage();
        }

        const x = pageIndex % 3;
        const y = Math.floor(pageIndex / 3);

        const posX = x * cellWidth;
        const posY = y * cellHeight;

        const uuid = boxInfos[i].code;
        const qrCode = await createQRCode(googleFormURL + uuid);

        doc.addImage({
            imageData: qrCode,
            x: posX + codePadding,
            y: posY + codePadding,
            width: cellWidth - (codePadding * 2),
            height: cellHeight - (codePadding * 2),
        });

        doc.text(`${boxInfos[i].name} - ${boxInfos[i].phase}`, posX + (cellWidth / 2), posY + cellHeight - textOffset, { align: 'center' });
        doc.text(boxInfos[i].address, posX + (cellWidth / 2), posY + cellHeight - textOffset + 4, { align: 'center' });
        doc.text(boxInfos[i].code, posX + (cellWidth / 2), posY + cellHeight - textOffset + 8, { align: 'center' });
    }

    doc.save("qrcodes.pdf");
}

// length should be >= width; the longer dimension
async function createShippingPDF(lengthInches: number, widthInches: number, googleFormURL: string, boxInfos: BoxInfo[]) {
    const format = [widthInches, lengthInches];
    const doc = new jsPDF({ unit: 'in', format });

    const useLongFormat = lengthInches / widthInches > 1.2;
    doc.setFontSize(useLongFormat ? 15 : 11);

    for (const boxInfo of boxInfos) {
        doc.addPage(format);

        const uuid = boxInfo.code;
        const qrCode = await createQRCode(googleFormURL + uuid);

        doc.addImage({
            imageData: qrCode,
            x: widthInches * 0.15,
            y: widthInches * 0.15,
            width: widthInches * 0.7,
            height: widthInches * 0.7,
        });

        if (useLongFormat) {
            doc.text(boxInfo.code, widthInches / 2, widthInches, { align: 'center' });
            doc.text(`${boxInfo.name} - ${boxInfo.phase}`, widthInches / 2, widthInches * 1.1, { align: 'center' });
            doc.text(boxInfo.address, widthInches / 2, widthInches * 1.2, { align: 'center' });
        } else {
            doc.text(boxInfo.code, widthInches / 2, widthInches * 0.12, { align: 'center' });
            doc.text(`${boxInfo.name} - ${boxInfo.phase}`, widthInches / 2, widthInches * 0.9, { align: 'center' });
            doc.text(boxInfo.address, widthInches / 2, widthInches * 0.95, { align: 'center' });
        }

    }

    doc.save("qrcodes.pdf");
}

async function createQRCode(data: string): Promise<Uint8Array> {
    const canvasContainer = document.getElementById('renderOutputContainer');
    const canvas = document.createElement('canvas') as HTMLCanvasElement;
    canvasContainer.appendChild(canvas);

    const qrCode = qrcode.default(data);
    const cells: boolean[][] = qrCode.modules;

    const rows = cells.length;
    const cols = cells[0].length;

    const squareSize = 10;
    canvas.width = squareSize * cols;
    canvas.height = squareSize * rows;

    const g = canvas.getContext('2d');
    g.fillStyle = 'black';
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (cells[row][col]) {
                g.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
            }
        }
    }

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            canvasContainer.removeChild(canvas);
            blob.arrayBuffer().then((data) => {
                resolve(new Uint8Array(data));
            });
        }, 'image/png');
    });
}
