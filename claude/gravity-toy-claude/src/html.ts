export function html(strings: TemplateStringsArray, ...values: unknown[]): HTMLElement {
  const markup = strings.reduce((result, str, i) => result + String(values[i - 1] ?? '') + str);
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as HTMLElement;
}
