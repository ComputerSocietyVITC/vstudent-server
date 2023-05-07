import { JSDOM } from "jsdom";

interface Semesters {
  name: string;
  value: string;
}

export default function HandleSemesterValues(body: string): Semesters[] {
  const parser = new JSDOM(body);
  const document = parser.window.document;
  const result: Semesters[] = [];
  const values: HTMLCollectionOf<HTMLOptionElement> =
    document.getElementsByTagName("option");

  for (let i = 0; i < values.length; i++) {
    let item: Semesters = { name: values[i].innerHTML, value: values[i].value };
    result.push(item);
  }
  return result.slice(1, result.length - 1);
}
