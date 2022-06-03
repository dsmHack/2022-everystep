import { v4 as uuid } from 'uuid';
import { jsPDF } from 'jspdf';

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
    const uuids: string[] = [];
    for (let i = 0; i < numContainers; i++) {
        uuids.push(uuid().toUpperCase());
    }

    downloadCSV(uuids);
    await renderAndDownload(uuids);
}

function downloadCSV(uuids: string[]): void {
    const csvData = ['id', ...uuids].join('\n');
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
    const height = 280;

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

        const response = await fetch('https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=' + uuid);
        const buffer = await response.arrayBuffer();

        doc.addImage({
            imageData: new Uint8Array(buffer),
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