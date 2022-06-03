import { v4 as uuid } from 'uuid';
import { jsPDF } from 'jspdf';
import * as qrcode from 'qr.js';

window.onload = main;
function main() {
    const numberOfContainerInput = document.getElementById('numberOfContainers') as HTMLInputElement;
    const createContainersButton = document.getElementById('createContainers') as HTMLInputElement;
    const googleFormURLInput = document.getElementById('googleFormURL') as HTMLInputElement;

    numberOfContainerInput.oninput = () => {
        createContainersButton.disabled = !numberOfContainerInput.value
    }

    const googleFormURLKey = 'google-form-url';
    googleFormURLInput.value = localStorage.getItem(googleFormURLKey);
    googleFormURLInput.oninput = () => {
        localStorage.setItem(googleFormURLKey, googleFormURLInput.value);
    }

    createContainersButton.onclick = async () => {
        await createContainers(
            googleFormURLInput.value,
            parseFloat(numberOfContainerInput.value),
        );
    }
}

async function createContainers(googleFormURL: string, numContainers: number): Promise<void> {
    const containers: string[] = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push(uuid().toUpperCase());
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
    doc.setFontSize(7);

    const pageWidth = 210;
    const pageHeight = 297;

    const codePadding = 10;
    const textOffset = 5;

    const columns = 3;
    const cellWidth = pageWidth / columns;
    const cellHeight = cellWidth + textOffset;
    const rows = Math.floor(pageHeight / cellHeight);
    const codesPerPage = rows * columns;

    for (let codeIndex = 0; codeIndex < codeUuids.length; codeIndex++) {
        let pageIndex = codeIndex % codesPerPage;

        const shouldPaginate = codeIndex !== 0 && pageIndex % codesPerPage === 0;
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
