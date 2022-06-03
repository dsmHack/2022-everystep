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
        uuids.push(uuid());
    }

    console.log(uuids);
}
