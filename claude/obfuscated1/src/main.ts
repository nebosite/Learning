function highlightDiv(targetText: string): void {
  const divs = document.querySelectorAll<HTMLDivElement>('div.item');
  for (const div of divs) {
    if (div.textContent?.trim() === targetText) {
      div.style.backgroundColor = 'yellow';
      break;
    }
  }
}

highlightDiv('Foo5');
