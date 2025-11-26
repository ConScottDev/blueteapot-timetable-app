import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/** Find the capture node once */
export function getCalendarNode() {
  return document.getElementById("calendar-capture");
}

export async function exportAsPNG(filename = "schedule.png") {
  const node = getCalendarNode();
  if (!node) return;
  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: window.devicePixelRatio || 2,
    useCORS: true,
    logging: false,
  });
  const dataURL = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = filename;
  link.click();
}

export async function exportAsPDF(filename = "schedule.pdf", orientation = "landscape") {
  const node = getCalendarNode();
  if (!node) return;
  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: window.devicePixelRatio || 2,
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");

  // Fit image into A4 keeping aspect ratio
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const imgW = canvas.width;
  const imgH = canvas.height;
  const ratio = Math.min(pageW / imgW, pageH / imgH);
  const w = imgW * ratio;
  const h = imgH * ratio;
  const x = (pageW - w) / 2;
  const y = (pageH - h) / 2;

  pdf.addImage(imgData, "PNG", x, y, w, h, undefined, "FAST");
  pdf.save(filename);
}

export function triggerPrint() {
  // Use the browser print dialog; your existing Print view is fine
  window.print();
}
