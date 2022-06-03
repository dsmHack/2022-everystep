import { v4 as uuid } from 'uuid';
import { jsPDF } from 'jspdf';
import * as qrcode from 'qr.js';

window.onload = main;
function main() {
    const numberOfContainerInput = document.getElementById('numberOfContainers') as HTMLInputElement;
    const createContainersButton = document.getElementById('createContainers') as HTMLInputElement;

    numberOfContainerInput.oninput = () => {
        createContainersButton.disabled = !numberOfContainerInput.value
    }

    createContainersButton.onclick = async () => {
        await createContainers(parseFloat(numberOfContainerInput.value));
    }
}

async function createContainers(numContainers: number): Promise<void> {
    const containers: string[] = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push(uuid().toUpperCase());
    }

    await renderAndDownload(containers);
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

async function renderAndDownload(containers: string[]): Promise<void> {
    const doc = new jsPDF();

    // TODO: these are random; the fit could be much better. determine the unit, and convert A4 to it. add padding.
    const width = 210;
    const height = 200;

    const columns = 3;

    const textHeight = 5;
    const cellWidth = width / columns;
    const cellHeight = cellWidth + textHeight;

    const rows = Math.floor(height / cellHeight);

    const containersPerPage = rows * columns;

    doc.setFontSize(8);

    for (let i = 0; i < containers.length; i++) {
        let z = i % containersPerPage;

        const shouldPaginate = i !== 0 && z % containersPerPage === 0;
        if (shouldPaginate) {
            doc.addPage();
        }

        const x = z % 3;
        const y = Math.floor(z / 3);

        const posX = x * cellWidth;
        const posY = y * cellHeight;

        const uuid = containers[i];
        const qrCode = await createQRCode(uuid);

        doc.addImage({
            imageData: qrCode,
            x: posX,
            y: posY,
            width: cellWidth,
            height: cellHeight - textHeight,
        });

        // TODO: magic offset; can we center?
        doc.text(uuid, posX + 10, posY + cellHeight - textHeight);
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