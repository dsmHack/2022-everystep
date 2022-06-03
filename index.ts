import { jsPDF } from "jspdf";

console.log('test');

// @ts-ignore
const renderAndDownload = async (containers: string[]) => {
    const doc = new jsPDF();

    // TODO: these are random; the fit could be much better. determine the unit, and convert A4 to it. add padding.
    const width = 210;
    const height = 200;

    const columns = 3;
    const textHeight = 5;
    const cellWidth = width / columns;
    const cellHeight = cellWidth + textHeight;

    // TODO: this should paginate somehow
    const rows = height / cellHeight;

    doc.setFontSize(8);

    for (let i = 0; i < containers.length; i++) {
        const x = i % 3;
        const y = Math.floor(i / 3);

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
};

renderAndDownload([
    'f7b8d034-cc5b-4cd7-8447-c82df012677a',
    'f7b8d034-cc5b-4cd7-8447-c82df012677a',
    'f7b8d034-cc5b-4cd7-8447-c82df012677a',
    'f7b8d034-cc5b-4cd7-8447-c82df012677a',
    'f7b8d034-cc5b-4cd7-8447-c82df012677a',
    'f7b8d034-cc5b-4cd7-8447-c82df012677a',
]).then();