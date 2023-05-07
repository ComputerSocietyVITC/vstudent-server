import { JSDOM } from "jsdom";

export default function ParseCaptcha(body: string): string {
  let parser: JSDOM = new JSDOM(body);
  let imgElement = parser.window.document.getElementsByTagName("img")[1].src;
  return imgElement;
}
