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
    lastName: string,
    firstName: string,
    address: string,
    city: string,
    state: string,
    zipcode: string,
    phase: string,
}

async function createContainers(googleFormURL: string, exportFile: File): Promise<void> {
    const contents = await exportFile.arrayBuffer();
    const workbook = read(contents);
    const worksheet = workbook.Sheets['qr_export'];

    let updateMap = new Map<string, (BoxInfo, string) => void>;

    const boxInfos = new Map<string, BoxInfo>();
    for (const cell in worksheet) {
        const col = cell.substring(0, 1);
        const row = cell.substring(1);

        if (row === 'ref' || row == 'margins') {
            continue;
        }

        const cellValue = worksheet[cell].v.toString();

        if (row === '1') {
            switch (cellValue.toLowerCase().trim()) {
                case 'cheerboxid':
                    updateMap[col] = (info, val) => info.code = val;
                    break;
                case 'recipient first name':
                    updateMap[col] = (info, val) => info.firstName = val;
                    break;
                case 'recipient last name':
                    updateMap[col] = (info, val) => info.lastName = val;
                    break;
                case 'recipient street address':
                    updateMap[col] = (info, val) => info.address = val;
                    break;
                case 'recipient city':
                    updateMap[col] = (info, val) => info.city = val;
                    break;
                case 'recipient state':
                    updateMap[col] = (info, val) => info.state = val;
                    break;
                case 'recipient zip code':
                    updateMap[col] = (info, val) => info.zipcode = val;
                    break;
                // TODO: phase?
            }
            continue;
        }

        if (!boxInfos.has(row)) {
            boxInfos.set(row, {
                code: 'N/A',
                firstName: 'N/A',
                lastName: 'N/A',
                address: 'N/A',
                city: 'N/A',
                state: 'N/A',
                zipcode: 'N/A',
                phase: 'N/A',
            });
        }

        const boxInfo = boxInfos.get(row);
        updateMap[col](boxInfo, cellValue);
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

// The length should be >= the width * 1.5;
async function createShippingPDF(lengthInches: number, widthInches: number, googleFormURL: string, boxInfos: BoxInfo[]) {
    const format = [widthInches, lengthInches];
    const doc = new jsPDF({ unit: 'in', format });

    for (let i = 0; i < boxInfos.length; i++) {
        const boxInfo = boxInfos[i];

        if (i > 0) {
            doc.addPage(format);
        }

        const uuid = boxInfo.code;
        const qrCode = await createQRCode(googleFormURL + uuid);

        doc.addImage({
            imageData: qrCode,
            x: widthInches * 0.15,
            y: widthInches * 0.2,
            width: widthInches * 0.7,
            height: widthInches * 0.7,
        });

        doc.setFontSize(26);
        doc.text(boxInfo.code, widthInches / 2, widthInches * 0.15, { align: 'center' });

        doc.setFontSize(18);
        doc.text(`${boxInfo.lastName}, ${boxInfo.firstName} - ${boxInfo.phase}`, widthInches / 2, widthInches, { align: 'center' });

        doc.setFontSize(16);
        doc.text(boxInfo.address, widthInches / 2, widthInches * 1.1, { align: 'center' });
        doc.text(`${boxInfo.city}, ${boxInfo.state} ${boxInfo.zipcode}`, widthInches / 2, widthInches * 1.15, { align: 'center' });
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
