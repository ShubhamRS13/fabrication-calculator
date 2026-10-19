// pdfmake's bundled Roboto: file paths for setFonts() (not covered by @types/pdfmake).
declare module "pdfmake/fonts/Roboto" {
  import type { TFontDictionary } from "pdfmake/interfaces";
  const fonts: TFontDictionary;
  export default fonts;
}
