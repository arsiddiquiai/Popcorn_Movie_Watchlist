import { fetchExportRows, triggerDownload, type ExportRow } from './exportData'

/**
 * PDF export — CLAUDE.md's Coming Soon item, "download your watchlist as a
 * formatted document." Built entirely client-side on top of the same
 * fetchExportRows() the CSV export already uses, via jsPDF (a pure client
 * library — no server endpoint, no new secret, no schema change).
 *
 * jsPDF is dynamically imported inside buildWatchlistPdf, not statically at
 * the top of this file — its bundled ES build pulls in html2canvas,
 * DOMPurify, and canvg (~380KB gzipped combined) for an .html() rendering
 * feature this file never calls, and jsPDF ships no lighter "core only"
 * entry point to opt out of that at the package level. A static import
 * would have put that weight into the MAIN app bundle, loaded by every
 * visitor on every page — including the vast majority who never touch
 * Settings' Export PDF button. A dynamic import turns it into its own
 * chunk, fetched only when someone actually clicks the button.
 *
 * Typography is jsPDF's built-in Helvetica, not the app's own Space
 * Grotesk/Manrope — embedding a custom font in jsPDF means shipping a
 * base64-encoded copy of the TTF file, which is a real size/complexity
 * cost for a document meant to be read once and filed away, not a brand
 * surface. A plain, readable formatted document beats a broken/oversized
 * one — same "working plain beats broken beautiful" principle CLAUDE.md
 * states for the rating slider.
 */

const PAGE_WIDTH = 595.28 // A4 in points (jsPDF default unit is pt for 'a4')
const PAGE_HEIGHT = 841.89
const MARGIN_X = 48
const MARGIN_TOP = 56
const MARGIN_BOTTOM = 56
const LINE_HEIGHT = 16

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** One row's second line — status-specific, since a "want" item and a
 *  rated "watched" item have genuinely different information worth
 *  showing (when it was added vs. the score and why). */
function detailLine(row: ExportRow): string {
  if (row.status === 'watched' && row.score !== null) {
    const tags = row.reason_tags?.length ? ` — ${row.reason_tags.join(', ')}` : ''
    return `Watched ${formatDate(row.watched_at)} · Rated ${row.score}/10${tags}`
  }
  if (row.status === 'watched') return `Watched ${formatDate(row.watched_at)}`
  return `Added ${formatDate(row.added_at)}`
}

interface Section {
  heading: string
  rows: ExportRow[]
}

function buildSections(rows: ExportRow[]): Section[] {
  const want = rows.filter((r) => r.status === 'want')
  const watched = rows.filter((r) => r.status === 'watched')
  return [
    { heading: `Want to Watch (${want.length})`, rows: want },
    { heading: `Watched (${watched.length})`, rows: watched },
  ].filter((section) => section.rows.length > 0)
}

/** Builds the PDF and returns it as a Blob — split out from the download
 *  trigger so this half can be driven directly in a test/verification
 *  harness without needing a real DOM `<a download>` click. */
export async function buildWatchlistPdf(userId: string, ownerName: string | null): Promise<Blob> {
  const [rows, { default: jsPDF }] = await Promise.all([fetchExportRows(userId), import('jspdf')])
  const sections = buildSections(rows)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = MARGIN_TOP

  function ensureRoom(nextLineHeight: number) {
    if (y + nextLineHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage()
      y = MARGIN_TOP
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(ownerName ? `${ownerName}'s Watchlist` : 'My Watchlist', MARGIN_X, y)
  y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Exported from Popcorn on ${formatDate(new Date().toISOString())}`, MARGIN_X, y)
  doc.setTextColor(0)
  y += 30

  if (sections.length === 0) {
    doc.setFontSize(12)
    doc.text('Nothing on this watchlist yet.', MARGIN_X, y)
  }

  for (const section of sections) {
    ensureRoom(LINE_HEIGHT * 2)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(section.heading, MARGIN_X, y)
    y += 22

    const contentWidth = PAGE_WIDTH - MARGIN_X * 2
    for (const row of section.rows) {
      // Both lines are wrapped — and their line counts measured — BEFORE
      // either is drawn or ensureRoom is called. A long title left
      // unwrapped ran straight past the page's right edge in a real
      // rendered test PDF (found by actually opening the output, not just
      // type-checking); the fix has to know the true height this row will
      // need, on both lines, before deciding whether it fits on the
      // current page.
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      const titleText = row.year ? `${row.title} (${row.year})` : row.title
      const titleLines: string[] = doc.splitTextToSize(titleText, contentWidth)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      const detailLines: string[] = doc.splitTextToSize(detailLine(row), contentWidth)

      const rowHeight = LINE_HEIGHT * titleLines.length + LINE_HEIGHT * detailLines.length + 6
      ensureRoom(rowHeight)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(titleLines, MARGIN_X, y)
      y += LINE_HEIGHT * titleLines.length

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(110)
      doc.text(detailLines, MARGIN_X, y)
      doc.setTextColor(0)
      y += LINE_HEIGHT * detailLines.length + 6
    }
    y += 10
  }

  // Page numbers, added last since only now is the final page count known.
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 28, { align: 'center' })
    doc.setTextColor(0)
  }

  return doc.output('blob')
}

/** Builds the PDF and triggers a browser download. */
export async function downloadWatchlistPdf(userId: string, ownerName: string | null): Promise<void> {
  const blob = await buildWatchlistPdf(userId, ownerName)
  triggerDownload(blob, `popcorn-watchlist-${new Date().toISOString().slice(0, 10)}.pdf`)
}
