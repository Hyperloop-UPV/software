// Branding assets + page geometry shared by every page builder in this module.
import fullLogo from "@hyperloop-upv/frontend-kit/outreach/main/full_logo_black.png?inline";
import swLogo from "@hyperloop-upv/frontend-kit/outreach/main/software_black.png?inline";
import checkLogo from "@hyperloop-upv/frontend-kit/outreach/main/check_black.png?inline";

export const PDF_ASSETS = {
  fullLogo,
  swLogo,
  checkLogo,
};

// Natural pixel aspect ratios (width / height) of the assets above — fixed,
// known values (measured from the source PNGs), so page layout can size each
// image proportionally without an async image-load round trip.
export const ASSET_ASPECT = {
  fullLogo: 1997 / 430,
  swLogo: 867 / 834,
  checkLogo: 900 / 508,
};

// Page geometry, A4 landscape, in mm.
export const PAGE = { width: 297, height: 210 };
export const MARGIN = { top: 22, bottom: 18, left: 14, right: 14 };

export const HEADER_LOGO_HEIGHT = 14;
// "sw" corner mark (bottom-left, next to the "Logging View" label) —
// smaller than the header logo, it's a secondary mark. Sits closer to the
// page's bottom edge than MARGIN.bottom (which bounds table/chart content),
// so it reads as a footer element rather than crowding the content band.
export const CORNER_LOGO_SIZE = 8;
export const BADGE_BOTTOM_OFFSET = 6;

// Brand stack layout, shared by the closing check page and the optional
// cover page: a top-down stack — full team logo (the hero element, larger
// since these pages skip the usual header logo), then, cover page only, a
// large title — then the smaller sw sub-brand mark, then the smaller check
// mark — each centered horizontally with a fixed gap between blocks (see
// addBrandStack in pages.ts).
export const BRAND_STACK_FULL_LOGO_WIDTH = 180;
export const BRAND_STACK_TOP = 34;
export const BRAND_STACK_GAP = 18;
export const BRAND_STACK_SW_LOGO_WIDTH = 28;
export const BRAND_STACK_CHECK_LOGO_SIZE = 30;

// Cover-page title block (Roboto, between the full logo and the sw mark).
// Font size in pt; block height approximates jsPDF's own text height
// (fontSize_pt * 0.3528 mm/pt, verified against getTextDimensions) plus a
// little breathing room so the text doesn't hug the logos above/below it.
export const COVER_TITLE_FONT_SIZE = 32;
export const COVER_TITLE_BLOCK_HEIGHT = COVER_TITLE_FONT_SIZE * 0.3528 + 2;

// Reserved band every page-drawing function must stay within — the
// header/footer pass (drawHeaderFooter) owns everything outside it.
export const CONTENT_TOP = MARGIN.top + 6;
export const CONTENT_BOTTOM = PAGE.height - MARGIN.bottom;

// Size/quality of each chart's rasterized image. Smaller than the
// single-plot PNG export (2400x1600 @ scale 4) since a report embeds many of
// these sequentially — this keeps generation time and PDF file size sane.
export const PDF_CHART_IMAGE_OPTS = { format: "png" as const, width: 1600, height: 1000, scale: 2 };
