// Converts store % coordinates to pdf-lib absolute points
// pdf-lib uses bottom-left origin; browser uses top-left - this flips the Y axis

export function toAbsolutePoints(
    coords: { xPercent: number; yPercent: number; widthPercent: number; heightPercent: number },
    pageWidth: number,
    pageHeight: number 
) {
    const x = (coords.xPercent / 100) * pageWidth;
    const w = (coords.widthPercent / 100) * pageWidth;
    const h = (coords.heightPercent / 100) * pageHeight;

    // Y flip: top-left 0% to pdf-lib bottom-left origin
    const y = pageHeight - ((coords.yPercent / 100) * pageHeight) - h;

    return { x, y, width: w, height: h };
}