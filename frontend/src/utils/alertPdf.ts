import type { Alert } from "../types";
import { buildAlertDetailFields, getDestinationLabel, getRequesterLabel } from "../components/AlertRequestDetailsGrid";
import { formatDateTime } from "./format";

type PdfBlock = {
  height: number;
  draw: (topY: number) => string[];
};

type PdfAsset = {
  name: string;
  bytes: Uint8Array;
  width: number;
  height: number;
};

type PdfField = {
  label: string;
  value: string;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 28;
const PAGE_MARGIN_TOP = 28;
const PAGE_MARGIN_BOTTOM = 28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2;
const GRID_GAP = 12;
const GRID_COLUMNS = 3;
const GRID_CELL_WIDTH = (CONTENT_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
const ONCF_NAVY: [number, number, number] = [0.118, 0.161, 0.275];
const ONCF_NAVY_DARK: [number, number, number] = [0.067, 0.094, 0.169];
const ONCF_ORANGE: [number, number, number] = [0.949, 0.525, 0.0];
const ONCF_PAGE: [number, number, number] = [0.968, 0.976, 0.988];
const ONCF_PANEL: [number, number, number] = [1, 1, 1];
const ONCF_BORDER: [number, number, number] = [0.843, 0.878, 0.933];
const ONCF_LABEL: [number, number, number] = [0.396, 0.463, 0.565];

function normalizePdfText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/→/g, "->")
    .replace(/[•·]/g, "-")
    .replace(/[‐‑–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/’/g, "'")
    .replace(/\uFFFD/g, "")
    .replace(/\t/g, " ");
}

function escapePdfText(value: string) {
  return normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function toPdfBytes(value: string) {
  const normalized = normalizePdfText(value);
  const bytes = new Uint8Array(normalized.length);
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    bytes[index] = code <= 255 ? code : 63;
  }
  return bytes;
}

function wrapText(value: string, maxChars: number) {
  const normalized = normalizePdfText(value).trim();
  if (!normalized) {
    return [];
  }

  return normalized.split("\n").flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return [""];
    }

    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (nextLine.length <= maxChars) {
        currentLine = nextLine;
        return;
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  });
}

function cleanFieldLabel(label: string) {
  const normalized = normalizePdfText(label).toLowerCase();

  if (normalized.includes("date de confirmation")) return "Date de confirmation reception";
  if (normalized.includes("confirmation de")) return "Confirmation de reception";
  if (normalized.includes("remarques")) return "Remarques reception";
  if (normalized.includes("decision")) return "Decision du permanent";
  if (normalized.includes("site")) return "Site de depart";
  if (normalized.includes("destinataire demande")) return "Destinataire demande";
  if (normalized.includes("destinataire retenu")) return "Destinataire retenu";
  if (normalized.includes("materiel")) return "Materiel concerne";
  if (normalized.includes("serie")) return "Serie";
  if (normalized.includes("date de creation")) return "Date de creation";
  if (normalized.includes("date de la demande")) return "Date de la demande";
  if (normalized.includes("demandeur")) return "Demandeur";
  if (normalized.includes("mode d")) return "Mode d'acheminement";
  if (normalized.includes("type d")) return "Type d'acheminement";
  if (normalized.includes("accompagnement")) return "Accompagnement";
  if (normalized.includes("vitesse")) return "Vitesse (km/h)";
  if (normalized.includes("autres")) return "Autres conditions";
  if (normalized.includes("retard actuel")) return "Retard actuel";
  if (normalized.includes("retard")) return "Retard";
  if (normalized.includes("motif")) return "Motif";
  if (normalized.includes("exp")) return "EXP";

  return normalizePdfText(label);
}

function cleanFieldValue(value: string) {
  return normalizePdfText(value)
    .replace(/Confirmae|Confirmee|Confirmée/gi, "Confirmee")
    .replace(/Non accompagnee|Non accompagnae|Non accompagnée/gi, "Sans")
    .replace(/Accompagnee|Accompagnae|Accompagnée/gi, "Avec")
    .replace(/Normale voyageur/gi, "Normal voyageur")
    .replace(/Normale fret/gi, "Normal fret")
    .replace(/Reception confirmee|Réception confirmée/gi, "Reception confirmee")
    .replace(/recu/gi, "recu");
}

function formatRgb(r: number, g: number, b: number) {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function rectCommand(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: [number, number, number],
  stroke: [number, number, number],
  lineWidth = 1
) {
  return `${formatRgb(...fill)} rg ${formatRgb(...stroke)} RG ${lineWidth} w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re B`;
}

function textCommand(
  x: number,
  y: number,
  text: string,
  font: "F1" | "F2" | "F3",
  size: number,
  color: [number, number, number]
) {
  return `BT /${font} ${size} Tf ${formatRgb(...color)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`;
}

function imageCommand(name: string, x: number, y: number, width: number, height: number) {
  return `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${name} Do Q`;
}

function buildTone(
  fill: [number, number, number],
  stroke: [number, number, number],
  label: [number, number, number],
  value: [number, number, number]
) {
  return { fill, stroke, label, value };
}

function getFieldTone(label: string) {
  const cleanLabel = cleanFieldLabel(label);

  if (cleanLabel === "Decision du permanent" || cleanLabel === "Destinataire retenu") {
    return buildTone([0.953, 0.941, 1.0], [0.773, 0.690, 0.980], [0.420, 0.247, 0.729], [0.227, 0.149, 0.447]);
  }

  if (
    cleanLabel === "Confirmation de reception" ||
    cleanLabel === "Date de confirmation reception" ||
    cleanLabel === "Remarques reception"
  ) {
    return buildTone([0.922, 0.969, 1.0], [0.424, 0.741, 0.992], [0.110, 0.345, 0.639], [0.114, 0.161, 0.275]);
  }

  if (cleanLabel === "Retard" || cleanLabel === "Retard actuel") {
    return buildTone([1.0, 0.933, 0.937], [1.0, 0.592, 0.647], [0.729, 0.110, 0.227], [0.420, 0.133, 0.196]);
  }

  return buildTone([0.973, 0.980, 0.992], ONCF_BORDER, ONCF_LABEL, ONCF_NAVY);
}

function buildHeaderBlock(alert: Alert, assets: { logo?: PdfAsset; hero?: PdfAsset }): PdfBlock {
  const route = [getRequesterLabel(alert), getDestinationLabel(alert)].filter(Boolean).join(" -> ");
  const dossierRef = alert.dossier_label ?? String(alert.id);
  const title = `Dossier #${dossierRef}${route ? ` - ${route}` : ""}`;
  const generatedAt = `Genere le ${formatDateTime(new Date().toISOString())}`;

  return {
    height: 164,
    draw(topY) {
      const panelHeight = 148;
      const panelY = topY - panelHeight;
      const commands = [
        rectCommand(PAGE_MARGIN_X, panelY, CONTENT_WIDTH, panelHeight, ONCF_PANEL, ONCF_BORDER, 1),
        rectCommand(PAGE_MARGIN_X, topY - 18, CONTENT_WIDTH, 18, ONCF_NAVY, ONCF_NAVY, 0.1),
      ];

      if (assets.hero) {
        commands.push(imageCommand(assets.hero.name, PAGE_MARGIN_X, topY - 18, CONTENT_WIDTH, 18));
      }

      if (assets.logo) {
        const logoHeight = 42;
        const logoWidth = (assets.logo.width / assets.logo.height) * logoHeight;
        commands.push(
          rectCommand(
            PAGE_MARGIN_X + CONTENT_WIDTH - logoWidth - 30,
            topY - 66,
            logoWidth + 16,
            logoHeight + 12,
            [1, 1, 1],
            ONCF_BORDER,
            0.6
          )
        );
        commands.push(imageCommand(assets.logo.name, PAGE_MARGIN_X + CONTENT_WIDTH - logoWidth - 22, topY - 58, logoWidth, logoHeight));
      }

      commands.push(
        textCommand(PAGE_MARGIN_X + 20, topY - 35, "OFFICE NATIONAL DES CHEMINS DE FER", "F1", 8.5, ONCF_LABEL),
        textCommand(PAGE_MARGIN_X + 20, topY - 80, "Gestion d'acheminement du materiel roulant", "F2", 18, ONCF_ORANGE),
        textCommand(PAGE_MARGIN_X + 20, topY - 123, title, "F2", 17, ONCF_NAVY_DARK),
        textCommand(PAGE_MARGIN_X + 20, topY - 142, generatedAt, "F1", 9, ONCF_LABEL),
        rectCommand(PAGE_MARGIN_X + 27, topY - 148, 96, 2, ONCF_ORANGE, ONCF_ORANGE, 0.1),
      );

      return commands;
    },
  };
}

function buildFieldsTitleBlock(): PdfBlock {
  return {
    height: 44,
    draw(topY) {
      return [
        rectCommand(PAGE_MARGIN_X, topY - 30, CONTENT_WIDTH, 26, [0.992, 0.995, 0.999], ONCF_BORDER, 0.8),
        rectCommand(PAGE_MARGIN_X, topY - 30, 6, 26, ONCF_ORANGE, ONCF_ORANGE, 0.1),
        textCommand(PAGE_MARGIN_X + 16, topY - 21, "Details du dossier", "F2", 12.5, ONCF_NAVY_DARK),
      ];
    },
  };
}

function buildFieldGridBlock(fields: PdfField[]): PdfBlock {
  const groupedRows: PdfField[][] = [];
  for (let index = 0; index < fields.length; index += GRID_COLUMNS) {
    groupedRows.push(fields.slice(index, index + GRID_COLUMNS));
  }

  const rowHeights = groupedRows.map((row) =>
    Math.max(
      ...row.map((field) => {
        const valueLines = wrapText(cleanFieldValue(field.value), 24);
        return Math.max(72, 40 + Math.max(1, valueLines.length) * 15);
      })
    )
  );
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + GRID_GAP * Math.max(groupedRows.length - 1, 0);

  return {
    height: totalHeight,
    draw(topY) {
      const commands: string[] = [];
      let currentY = topY;

      groupedRows.forEach((row, rowIndex) => {
        const rowHeight = rowHeights[rowIndex];
        row.forEach((field, columnIndex) => {
          const x = PAGE_MARGIN_X + columnIndex * (GRID_CELL_WIDTH + GRID_GAP);
          const boxY = currentY - rowHeight;
          const tone = getFieldTone(field.label);
          const label = cleanFieldLabel(field.label);
          const valueLines = wrapText(cleanFieldValue(field.value), 24);

          commands.push(
            rectCommand(x, boxY, GRID_CELL_WIDTH, rowHeight, tone.fill, tone.stroke, 0.9),
            rectCommand(x, boxY + rowHeight - 2, GRID_CELL_WIDTH, 2, tone.stroke, tone.stroke, 0.1),
            textCommand(x + 14, currentY - 18, label.toUpperCase(), "F1", 7.8, tone.label),
          );

          (valueLines.length ? valueLines : [""]).forEach((line, lineIndex) => {
            commands.push(textCommand(x + 14, currentY - 42 - lineIndex * 15, line, "F2", 10.4, tone.value));
          });
        });
        currentY -= rowHeight + GRID_GAP;
      });

      return commands;
    },
  };
}

function buildSimpleSectionTitleBlock(title: string): PdfBlock {
  return {
    height: 32,
    draw(topY) {
      const y = topY - 22;
      return [
        rectCommand(PAGE_MARGIN_X, y, CONTENT_WIDTH, 22, [1, 1, 1], ONCF_BORDER, 0.8),
        rectCommand(PAGE_MARGIN_X, y, 5, 22, ONCF_ORANGE, ONCF_ORANGE, 0.1),
        textCommand(PAGE_MARGIN_X + 12, topY - 15, title, "F2", 11, ONCF_NAVY),
      ];
    },
  };
}

function buildLineListRowBlock(lines: string[], accent: [number, number, number]): PdfBlock {
  const wrapped = lines.flatMap((line) => wrapText(cleanFieldValue(line), 95));
  const rowHeight = Math.max(32, 18 + wrapped.length * 12);

  return {
    height: rowHeight + 8,
    draw(topY) {
      const y = topY - rowHeight;
      const commands = [
        rectCommand(PAGE_MARGIN_X, y, CONTENT_WIDTH, rowHeight, [1, 1, 1], ONCF_BORDER, 0.8),
        rectCommand(PAGE_MARGIN_X, y, 5, rowHeight, accent, accent, 0.1),
      ];

      wrapped.forEach((line, index) => {
        commands.push(textCommand(PAGE_MARGIN_X + 14, topY - 16 - index * 12, line, "F1", 9.5, [0.196, 0.255, 0.361]));
      });

      return commands;
    },
  };
}

function buildPdfBlocks(alert: Alert, assets: { logo?: PdfAsset; hero?: PdfAsset }) {
  const fields = buildAlertDetailFields(alert)
    .filter((field) => field.value?.trim())
    .map((field) => ({ label: field.label, value: field.value.trim() }));

  const blocks: PdfBlock[] = [buildHeaderBlock(alert, assets), buildFieldsTitleBlock(), buildFieldGridBlock(fields)];

  if (alert.attachments.length > 0) {
    blocks.push(buildSimpleSectionTitleBlock("Pieces jointes"));
    alert.attachments.forEach((attachment) => {
      blocks.push(buildLineListRowBlock([attachment.filename], [0.424, 0.741, 0.992]));
    });
  }

  return blocks;
}

function paginateBlocks(blocks: PdfBlock[]) {
  const pages: PdfBlock[][] = [];
  const maxContentHeight = PAGE_HEIGHT - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM;
  let currentPage: PdfBlock[] = [];
  let usedHeight = 0;

  blocks.forEach((block) => {
    if (usedHeight + block.height > maxContentHeight && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      usedHeight = 0;
    }

    currentPage.push(block);
    usedHeight += block.height;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function buildPageCommands(blocks: PdfBlock[]) {
  let currentTop = PAGE_HEIGHT - PAGE_MARGIN_TOP;
  const commands = [rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, ONCF_PAGE, ONCF_PAGE, 0.1)];
  blocks.forEach((block) => {
    commands.push(...block.draw(currentTop));
    currentTop -= block.height;
  });
  return commands.join("\n");
}

function jpegSize(bytes: Uint8Array) {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return { width, height };
    }
    offset += 2 + length;
  }
  throw new Error("Impossible de lire la taille du JPEG.");
}

async function loadJpegAsset(path: string, name: string): Promise<PdfAsset | undefined> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return undefined;
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const { width, height } = jpegSize(bytes);
    return { name, bytes, width, height };
  } catch {
    return undefined;
  }
}

function buildPdfDocument(pageCommands: string[], assets: PdfAsset[]) {
  const objects: Uint8Array[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const fontStartId = 3;
  const imageStartId = 6;
  let nextObjectId = imageStartId + assets.length;

  pageCommands.forEach(() => {
    pageObjectIds.push(nextObjectId);
    contentObjectIds.push(nextObjectId + 1);
    nextObjectId += 2;
  });

  const pageKids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects[1] = toPdfBytes("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects[2] = toPdfBytes(`2 0 obj\n<< /Type /Pages /Kids [${pageKids}] /Count ${pageObjectIds.length} >>\nendobj\n`);
  objects[3] = toPdfBytes("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  objects[4] = toPdfBytes("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");
  objects[5] = toPdfBytes("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique >>\nendobj\n");

  assets.forEach((asset, index) => {
    const objectId = imageStartId + index;
    objects[objectId] = new Uint8Array([
      ...toPdfBytes(
        `${objectId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${asset.width} /Height ${asset.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${asset.bytes.length} >>\nstream\n`
      ),
      ...asset.bytes,
      ...toPdfBytes("\nendstream\nendobj\n"),
    ]);
  });

  pageCommands.forEach((content, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = contentObjectIds[index];
    const contentBytes = toPdfBytes(content);
    const xObjects = assets.length
      ? `/XObject << ${assets.map((asset, assetIndex) => `/${asset.name} ${imageStartId + assetIndex} 0 R`).join(" ")} >>`
      : "";

    objects[pageObjectId] = toPdfBytes(
      `${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontStartId} 0 R /F2 ${fontStartId + 1} 0 R /F3 ${fontStartId + 2} 0 R >> ${xObjects} >> /Contents ${contentObjectId} 0 R >>\nendobj\n`
    );
    objects[contentObjectId] = new Uint8Array([
      ...toPdfBytes(`${contentObjectId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
      ...contentBytes,
      ...toPdfBytes("\nendstream\nendobj\n"),
    ]);
  });

  const chunks: Uint8Array[] = [toPdfBytes("%PDF-1.4\n")];
  const offsets: number[] = [0];
  let currentOffset = chunks[0].length;

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    const chunk = objects[objectId];
    if (!chunk) {
      continue;
    }
    offsets[objectId] = currentOffset;
    chunks.push(chunk);
    currentOffset += chunk.length;
  }

  const xrefOffset = currentOffset;
  const totalObjects = objects.length;
  const xrefLines = [`xref\n0 ${totalObjects}\n`, "0000000000 65535 f \n"];

  for (let objectId = 1; objectId < totalObjects; objectId += 1) {
    xrefLines.push(`${String(offsets[objectId] ?? 0).padStart(10, "0")} 00000 n \n`);
  }

  chunks.push(toPdfBytes(xrefLines.join("")));
  chunks.push(toPdfBytes(`trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));

  return new Blob(
    chunks.map((chunk) => {
      const buffer = new ArrayBuffer(chunk.byteLength);
      new Uint8Array(buffer).set(chunk);
      return buffer;
    }),
    { type: "application/pdf" }
  );
}

function buildPdfFileName(alert: Alert) {
  const requester = getRequesterLabel(alert).replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
  const destination = getDestinationLabel(alert).replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
  const route = requester && destination ? `-${requester}-vers-${destination}` : "";
  const dossierRef = (alert.dossier_label ?? String(alert.id)).replace(/[^\w-]+/g, "_");
  return `dossier-${dossierRef}${route}.pdf`;
}

export async function downloadAlertPdf(alert: Alert) {
  const [logo, hero] = await Promise.all([
    loadJpegAsset("/logo-ONCF.jpg", "ImLogo"),
    loadJpegAsset("/dashboard-admin.jpg", "ImHero"),
  ]);

  const assets = { logo, hero };
  const blocks = buildPdfBlocks(alert, assets);
  const pages = paginateBlocks(blocks);
  const pdfBlob = buildPdfDocument(
    pages.map(buildPageCommands),
    [hero, logo].filter((asset): asset is PdfAsset => Boolean(asset))
  );

  const url = URL.createObjectURL(pdfBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildPdfFileName(alert);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

