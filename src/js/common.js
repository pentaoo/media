// Общий код для всех страниц
for (const node of document.querySelectorAll('.site-footer__year')) {
  node.textContent = String(new Date().getFullYear());
}
