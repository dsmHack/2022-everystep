import * as uuid from 'short-uuid';
import { jsPDF } from 'jspdf';
import * as qrcode from 'qr.js';
// import { read } from 'xlsx';

window.onload = main;
function main() {
    const labelExportFileInput = document.getElementById('labelExportFile') as HTMLInputElement;
    const googleFormURLInput = document.getElementById('googleFormURL') as HTMLInputElement;
    const createContainersButton = document.getElementById('createContainers') as HTMLInputElement;

    labelExportFileInput.onchange = (event) => {
        console.log('Upload: ', event);
    }

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
        );

        labelExportFileInput.disabled = false;
        createContainersButton.disabled = false;
        googleFormURLInput.disabled = false;
    }
}

async function createContainers(googleFormURL: string): Promise<void> {
    const numContainers = 5; // TODO: replace with file import

    const containers: string[] = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push(uuid.generate().toUpperCase());
    }

    await renderAndDownload(googleFormURL, containers);
    downloadCSV(containers);
}

function downloadCSV(containers: string[]): void {
    const csvData = ['id', ...containers].join('\n');
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

async function renderAndDownload(googleFormURL: string, codeUuids: string[]): Promise<void> {
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

    for (let i = 0; i < codeUuids.length; i++) {
        let pageIndex = i % codesPerPage;

        const shouldPaginate = i !== 0 && pageIndex % codesPerPage === 0;
        if (shouldPaginate) {
            doc.addPage();
        }

        const x = pageIndex % 3;
        const y = Math.floor(pageIndex / 3);

        const posX = x * cellWidth;
        const posY = y * cellHeight;

        const uuid = codeUuids[i];
        const qrCode = await createQRCode(googleFormURL + uuid);

        doc.addImage({
            imageData: qrCode,
            x: posX + codePadding,
            y: posY + codePadding,
            width: cellWidth - (codePadding * 2),
            height: cellHeight - (codePadding * 2),
        });

        doc.text(uuid, posX + (cellWidth / 2), posY + cellHeight - textOffset, { align: 'center' });
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
