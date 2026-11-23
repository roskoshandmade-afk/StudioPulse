import { jsPDF } from 'jspdf';
import liberationRegularUrl from '../assets/fonts/LiberationSans-Regular.ttf';
import liberationBoldUrl from '../assets/fonts/LiberationSans-Bold.ttf';
import monoRegularUrl from '../assets/fonts/JetBrainsMono-Regular.ttf';
import monoBoldUrl from '../assets/fonts/JetBrainsMono-Bold.ttf';
import { Project } from '../types';
import { ClientSnapshot } from './storage';
import { formatCurrency, formatDate, formatShortDate, getTodayIso } from './calculations';

type ExportableProject = Project | ClientSnapshot;

interface LoadedFonts {
  sansRegular: string;
  sansBold: string;
  monoRegular: string;
  monoBold: string;
}

let cachedFonts: LoadedFonts | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Не удалось загрузить локальный шрифт (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  return arrayBufferToBase64(buf);
}

async function loadFonts(): Promise<LoadedFonts> {
  if (cachedFonts) return cachedFonts;
  const [sansRegular, sansBold, monoRegular, monoBold] = await Promise.all([
    fetchFontBase64(liberationRegularUrl),
    fetchFontBase64(liberationBoldUrl),
    fetchFontBase64(monoRegularUrl),
    fetchFontBase64(monoBoldUrl),
  ]);
  cachedFonts = { sansRegular, sansBold, monoRegular, monoBold };
  return cachedFonts;
}

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/\[ДЕМО\]/gi, 'DEMO')
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '_')
    .trim();
  return cleaned.slice(0, 60) || 'project';
}

export async function exportProjectFinancialPdf(project: ExportableProject): Promise<void> {
  const fonts = await loadFonts();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // Register embedded local Cyrillic fonts (100% offline, zero external CDN)
  doc.addFileToVFS('ArchSans-Regular.ttf', fonts.sansRegular);
  doc.addFont('ArchSans-Regular.ttf', 'ArchSans', 'normal');
  doc.addFileToVFS('ArchSans-Bold.ttf', fonts.sansBold);
  doc.addFont('ArchSans-Bold.ttf', 'ArchSans', 'bold');
  doc.addFileToVFS('ArchMono-Regular.ttf', fonts.monoRegular);
  doc.addFont('ArchMono-Regular.ttf', 'ArchMono', 'normal');
  doc.addFileToVFS('ArchMono-Bold.ttf', fonts.monoBold);
  doc.addFont('ArchMono-Bold.ttf', 'ArchMono', 'bold');

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 16;
  const contentW = pageWidth - marginX * 2; // 178mm
  const bottomLimit = pageHeight - 20;

  const todayIso = getTodayIso();
  const todayFormatted = formatDate(todayIso);

  const contractTotal = project.paymentStages.reduce(
    (acc, s) => acc + (Number(s.amount) || 0),
    0
  );
  const paidTotal = project.paymentStages
    .filter((s) => s.isPaid)
    .reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const remainingTotal = Math.max(0, contractTotal - paidTotal);
  const paidPct = contractTotal > 0 ? Math.round((paidTotal / contractTotal) * 100) : 0;

  const overallProgress = project.workStages.length
    ? Math.round(
        project.workStages.reduce((acc, ws) => acc + (ws.progress || 0), 0) /
          project.workStages.length
      )
    : 0;

  let y = 16;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      y = 18;
      // Subtle continuation top rule
      doc.setDrawColor(229, 229, 229);
      doc.setLineWidth(0.25);
      doc.line(marginX, 12, marginX + contentW, 12);
    }
  };

  // =========================================================================
  // 1. ARCHITECTURAL MASTHEAD
  // =========================================================================
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.9);
  doc.line(marginX, y, marginX + contentW, y);
  y += 6;

  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 41, 54);
  doc.text('СТУДИЯ ПУЛЬС', marginX, y);

  doc.setFont('ArchMono', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(76, 109, 124);
  doc.text(`ФИНАНСОВАЯ СВОДКА  ·  ${todayFormatted}`, marginX + contentW, y, {
    align: 'right',
  });

  y += 4;
  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.25);
  doc.line(marginX, y, marginX + contentW, y);
  y += 9;

  // =========================================================================
  // 2. PROJECT PASSPORT
  // =========================================================================
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 15, 15);
  const titleLines = doc.splitTextToSize(project.name, contentW) as string[];
  doc.text(titleLines, marginX, y);
  y += titleLines.length * 6.8 + 1.5;

  const metaParts: string[] = [
    `Статус: ${project.status}`,
    `Площадь: ${project.areaSqm} м²`,
  ];
  if (project.address) {
    metaParts.push(project.address);
  }
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(82, 82, 82);
  const metaLines = doc.splitTextToSize(metaParts.join('   ·   '), contentW) as string[];
  doc.text(metaLines, marginX, y);
  y += metaLines.length * 4.5 + 4;

  // Overall readiness bar
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(115, 115, 115);
  doc.text('ОБЩАЯ ГОТОВНОСТЬ ДИЗАЙН-ПРОЕКТА', marginX, y);

  doc.setFont('ArchMono', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 15, 15);
  doc.text(`${overallProgress}%`, marginX + contentW, y, { align: 'right' });

  y += 2.2;
  doc.setFillColor(236, 236, 233);
  doc.rect(marginX, y, contentW, 2, 'F');
  if (overallProgress > 0) {
    doc.setFillColor(15, 15, 15);
    doc.rect(marginX, y, (contentW * overallProgress) / 100, 2, 'F');
  }
  y += 9;

  // =========================================================================
  // 3. THREE-COLUMN FINANCIAL KPI GRID
  // =========================================================================
  const kpiH = 22;
  const colW = contentW / 3;

  doc.setFillColor(247, 247, 246);
  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.25);
  doc.rect(marginX, y, contentW, kpiH, 'FD');

  // Vertical column hairlines
  doc.line(marginX + colW, y, marginX + colW, y + kpiH);
  doc.line(marginX + colW * 2, y, marginX + colW * 2, y + kpiH);

  // Top accent hairline
  doc.setDrawColor(15, 15, 15);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, marginX + contentW, y);

  // Col 1: Total KP
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(82, 82, 82);
  doc.text('СТОИМОСТЬ ПО КП', marginX + 4.5, y + 6.5);
  doc.setFont('ArchMono', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(15, 15, 15);
  doc.text(formatCurrency(contractTotal), marginX + 4.5, y + 14.5);
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(115, 115, 115);
  doc.text(`Этапов оплаты: ${project.paymentStages.length}`, marginX + 4.5, y + 19);

  // Col 2: Paid
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(82, 82, 82);
  doc.text(`ОПЛАЧЕНО (${paidPct}%)`, marginX + colW + 4.5, y + 6.5);
  doc.setFont('ArchMono', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(21, 128, 61); // #15803D
  doc.text(formatCurrency(paidTotal), marginX + colW + 4.5, y + 14.5);
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(115, 115, 115);
  const paidCount = project.paymentStages.filter((s) => s.isPaid).length;
  doc.text(`Закрыто этапов: ${paidCount} из ${project.paymentStages.length}`, marginX + colW + 4.5, y + 19);

  // Col 3: Remaining
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(82, 82, 82);
  doc.text('ОСТАТОК К ОПЛАТЕ', marginX + colW * 2 + 4.5, y + 6.5);
  doc.setFont('ArchMono', 'bold');
  doc.setFontSize(12.5);
  if (remainingTotal > 0) {
    doc.setTextColor(185, 28, 28); // #B91C1C
  } else {
    doc.setTextColor(21, 128, 61);
  }
  doc.text(formatCurrency(remainingTotal), marginX + colW * 2 + 4.5, y + 14.5);
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(115, 115, 115);
  doc.text(
    remainingTotal > 0 ? 'По графику платежей КП' : 'Договор полностью оплачен',
    marginX + colW * 2 + 4.5,
    y + 19
  );

  y += kpiH + 2;

  // Payment progress ratio hairline strip
  doc.setFillColor(229, 229, 229);
  doc.rect(marginX, y, contentW, 1.4, 'F');
  if (paidPct > 0) {
    doc.setFillColor(21, 128, 61);
    doc.rect(marginX, y, (contentW * paidPct) / 100, 1.4, 'F');
  }
  y += 10;

  // =========================================================================
  // 4. SECTION 01: PAYMENT SCHEDULE BY KP
  // =========================================================================
  ensureSpace(26);
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 15, 15);
  doc.text('01. ГРАФИК ПЛАТЕЖЕЙ ПО КП', marginX, y);
  y += 2.5;
  doc.setDrawColor(15, 15, 15);
  doc.setLineWidth(0.45);
  doc.line(marginX, y, marginX + contentW, y);
  y += 5;

  // Table header
  const colX = {
    num: marginX + 2,
    title: marginX + 11,
    date: marginX + 106,
    status: marginX + 134,
    amountRight: marginX + contentW - 2,
  };

  doc.setFillColor(247, 247, 246);
  doc.rect(marginX, y - 3.5, contentW, 6.5, 'F');
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(82, 82, 82);
  doc.text('№', colX.num, y + 0.8);
  doc.text('Наименование этапа', colX.title, y + 0.8);
  doc.text('Срок / Оплата', colX.date, y + 0.8);
  doc.text('Статус', colX.status, y + 0.8);
  doc.text('Сумма', colX.amountRight, y + 0.8, { align: 'right' });

  y += 4;
  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.25);
  doc.line(marginX, y, marginX + contentW, y);

  if (project.paymentStages.length === 0) {
    y += 7;
    doc.setFont('ArchSans', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(115, 115, 115);
    doc.text('Этапы оплаты не заданы.', marginX + 2, y);
    y += 5;
  } else {
    project.paymentStages.forEach((ps, idx) => {
      const wrappedTitle = doc.splitTextToSize(ps.title, 90) as string[];
      const rowH = Math.max(8.5, wrappedTitle.length * 4.2 + 4);
      ensureSpace(rowH + 4);

      const textY = y + 5;

      doc.setFont('ArchMono', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(115, 115, 115);
      doc.text(String(idx + 1).padStart(2, '0'), colX.num, textY);

      doc.setFont('ArchSans', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 15, 15);
      doc.text(wrappedTitle, colX.title, textY);

      doc.setFont('ArchMono', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(82, 82, 82);
      const dateStr = ps.isPaid
        ? formatDate(ps.paidDate || ps.dueDate)
        : formatDate(ps.dueDate);
      doc.text(dateStr, colX.date, textY);

      doc.setFont('ArchSans', 'bold');
      doc.setFontSize(8);
      if (ps.isPaid) {
        doc.setTextColor(21, 128, 61);
        doc.text('Оплачено', colX.status, textY);
      } else {
        doc.setTextColor(185, 28, 28);
        doc.text('Ожидается', colX.status, textY);
      }

      doc.setFont('ArchMono', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 15, 15);
      doc.text(formatCurrency(ps.amount), colX.amountRight, textY, { align: 'right' });

      y += rowH;
      doc.setDrawColor(235, 235, 232);
      doc.setLineWidth(0.2);
      doc.line(marginX, y, marginX + contentW, y);
    });

    // Total Row
    ensureSpace(10);
    doc.setDrawColor(15, 15, 15);
    doc.setLineWidth(0.35);
    doc.line(marginX, y, marginX + contentW, y);
    y += 5.5;

    doc.setFont('ArchSans', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 15, 15);
    doc.text('Итого по договору КП', colX.title, y);

    doc.setFont('ArchMono', 'bold');
    doc.setFontSize(9.5);
    doc.text(formatCurrency(contractTotal), colX.amountRight, y, { align: 'right' });
    y += 4;
  }

  y += 9;

  // =========================================================================
  // 5. SECTION 02: WORK STAGES PROGRESS (CLIENT-SAFE, NO INTERNAL NOTES)
  // =========================================================================
  if (project.workStages.length > 0) {
    ensureSpace(26);
    doc.setFont('ArchSans', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 15, 15);
    doc.text('02. ТЕКУЩИЙ ПРОГРЕСС ПО ЭТАПАМ РАБОТ', marginX, y);
    y += 2.5;
    doc.setDrawColor(15, 15, 15);
    doc.setLineWidth(0.45);
    doc.line(marginX, y, marginX + contentW, y);
    y += 5;

    const groups = project.paymentStages.map((ps) => {
      const tasks = project.workStages.filter((ws) => ws.paymentStageId === ps.id);
      const avg = tasks.length
        ? Math.round(tasks.reduce((a, t) => a + (t.progress || 0), 0) / tasks.length)
        : 0;
      return { title: ps.title, tasks, avg };
    });

    const knownStageIds = new Set(project.paymentStages.map((p) => p.id));
    const extraTasks = project.workStages.filter((ws) => !knownStageIds.has(ws.paymentStageId));
    if (extraTasks.length > 0) {
      groups.push({
        title: 'Дополнительные этапы',
        tasks: extraTasks,
        avg: Math.round(
          extraTasks.reduce((a, t) => a + (t.progress || 0), 0) / extraTasks.length
        ),
      });
    }

    for (const grp of groups) {
      if (grp.tasks.length === 0) continue;
      ensureSpace(15);

      // Group header bar
      doc.setFillColor(247, 247, 246);
      doc.rect(marginX, y - 1, contentW, 6.8, 'F');
      doc.setFont('ArchSans', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 15, 15);
      const grpTitle = doc.splitTextToSize(grp.title, contentW - 30) as string[];
      doc.text(grpTitle[0], marginX + 2.5, y + 3.6);

      doc.setFont('ArchMono', 'bold');
      doc.setFontSize(8);
      doc.text(`${grp.avg}%`, marginX + contentW - 2.5, y + 3.6, { align: 'right' });

      y += 7.5;

      for (const task of grp.tasks) {
        const taskTitleLines = doc.splitTextToSize(task.title, 88) as string[];
        const rowH = Math.max(7.5, taskTitleLines.length * 4 + 3.5);
        ensureSpace(rowH + 2);

        const textY = y + 4.2;

        doc.setFont('ArchSans', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 15, 15);
        doc.text(taskTitleLines, marginX + 4, textY);

        // Plan dates
        doc.setFont('ArchMono', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(115, 115, 115);
        doc.text(
          `${formatShortDate(task.planStart)}–${formatShortDate(task.planEnd)}`,
          marginX + 96,
          textY
        );

        // Client-facing status (never exposes studio-internal notes or staff)
        const statusLabel =
          task.progress === 100
            ? 'Выполнено'
            : task.delayReason === 'client'
            ? 'Ждём ОС'
            : task.progress > 0
            ? 'В работе'
            : 'По графику';

        doc.setFont('ArchSans', 'normal');
        doc.setFontSize(7.5);
        if (task.progress === 100) {
          doc.setTextColor(21, 128, 61);
        } else if (task.delayReason === 'client') {
          doc.setTextColor(180, 83, 9); // #B45309
        } else {
          doc.setTextColor(82, 82, 82);
        }
        doc.text(statusLabel, marginX + 123, textY);

        // Mini progress bar
        const barX = marginX + 148;
        const barW = 17;
        doc.setFillColor(236, 236, 233);
        doc.rect(barX, textY - 2.2, barW, 1.8, 'F');
        if (task.progress > 0) {
          if (task.progress === 100) {
            doc.setFillColor(21, 128, 61);
          } else if (task.delayReason === 'client') {
            doc.setFillColor(180, 83, 9);
          } else {
            doc.setFillColor(15, 15, 15);
          }
          doc.rect(barX, textY - 2.2, (barW * task.progress) / 100, 1.8, 'F');
        }

        doc.setFont('ArchMono', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 15, 15);
        doc.text(`${task.progress}%`, marginX + contentW - 2, textY, { align: 'right' });

        y += rowH;
        doc.setDrawColor(238, 238, 235);
        doc.setLineWidth(0.18);
        doc.line(marginX + 2, y, marginX + contentW, y);
      }

      y += 3;
    }
  }

  // =========================================================================
  // 6. SECTION 03: PROJECT LINKS (CLICKABLE IN PDF)
  // =========================================================================
  const linksList = [
    { label: 'Коммерческое предложение (КП)', url: project.links.proposalUrl },
    { label: 'Обмерный план', url: project.links.measurementUrl },
    { label: 'Папка с материалами проекта', url: project.links.folderUrl },
  ].filter((item) => item.url && item.url.trim().length > 0);

  if (linksList.length > 0) {
    y += 5;
    ensureSpace(14 + linksList.length * 6.5);

    doc.setFont('ArchSans', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 15, 15);
    doc.text('03. ДОКУМЕНТЫ И МАТЕРИАЛЫ ПРОЕКТА', marginX, y);
    y += 2.5;
    doc.setDrawColor(15, 15, 15);
    doc.setLineWidth(0.45);
    doc.line(marginX, y, marginX + contentW, y);
    y += 5.5;

    for (const item of linksList) {
      const href = normalizeUrl(item.url.trim());
      doc.setFont('ArchSans', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 15, 15);
      doc.text(item.label, marginX + 2, y);

      doc.setFont('ArchMono', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(82, 82, 82);
      const displayUrl = href.length > 62 ? `${href.slice(0, 59)}...` : href;
      doc.textWithLink(displayUrl, marginX + 68, y, { url: href });

      y += 6;
    }
  }

  // =========================================================================
  // 7. EDITORIAL FOOTER ON EVERY PAGE
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 11;
    doc.setDrawColor(229, 229, 229);
    doc.setLineWidth(0.25);
    doc.line(marginX, footerY - 4, marginX + contentW, footerY - 4);

    doc.setFont('ArchSans', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(76, 109, 124);
    doc.text(`Студия Пульс  ·  Отчёт для заказчика от ${todayFormatted}`, marginX, footerY);

    doc.setFont('ArchMono', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Стр. ${p} / ${totalPages}`, marginX + contentW, footerY, { align: 'right' });
  }

  const fileName = `СтудияПульс_Отчет_${sanitizeFileName(project.name)}_${todayIso}.pdf`;
  doc.save(fileName);
}
