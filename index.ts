import { v4 as uuid } from 'uuid';

window.onload = main;
function main() {
    const numberOfContainerInput = document.getElementById('numberOfContainers') as HTMLInputElement;
    const createContainersButton = document.getElementById('createContainers') as HTMLInputElement;

    numberOfContainerInput.oninput = () => {
        createContainersButton.disabled = !numberOfContainerInput.value
    }

    createContainersButton.onclick = () => {
        createContainers(parseFloat(numberOfContainerInput.value));
    }
}

function createContainers(numContainers: number): void {
    const uuids: string[] = [];
    for (let i = 0; i < numContainers; i++) {
        uuids.push(uuid().toUpperCase());
    }

    downloadCSV(uuids);
}

function downloadCSV(uuids: string[]): void {
    const csvData = uuids.join('\n');
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
