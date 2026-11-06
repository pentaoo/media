import { encodedMat } from './mat-dictionary.js';
import { createActionButton } from './components/action-button.js';

// Entry popup «тут есть мат». Every served text is masked with asterisks, so the masked
// version is the default until the visitor picks «Я ВЗРОСЛЫЙ»; only then do the words come back from the
// encoded dictionary. The choice is remembered in this browser; ?mat=ask shows the popup again.
const CHOICE_KEY = 'chinatown:mat';
const ASKED_KEY = 'chinatown:mat-asked';
export const MAT_CHANGE_EVENT = 'chinatown:mat-change';
const REVEALED_ATTRIBUTES = ['alt', 'aria-label', 'title', 'placeholder'];

let dictionary = null;
let observer = null;

function read(storage, key) {
  try { return storage.getItem(key); } catch { return null; }
}

function write(storage, key, value) {
  try { storage.setItem(key, value); } catch { /* storage can be unavailable in private browsing */ }
}

export function matAllowed() {
  return read(localStorage, CHOICE_KEY) === 'explicit';
}

function words() {
  if (!dictionary) {
    const bytes = Uint8Array.from(atob(encodedMat), char => char.charCodeAt(0));
    dictionary = JSON.parse(new TextDecoder().decode(bytes));
  }
  return dictionary;
}

/** Puts the original words back into a masked text when the visitor chose «Я ВЗРОСЛЫЙ»; otherwise returns it as is. */
export function withMat(text) {
  if (!matAllowed() || !String(text).includes('*')) return text;
  return String(text).replace(/[а-яё*]+/giu, token => {
    if (!token.includes('*')) return token;
    const original = words()[token.toLocaleLowerCase('ru')];
    if (!original) return token;
    const caps = token === token.toLocaleUpperCase('ru');
    return [...token].map((char, index) => char === '*' ? (caps ? original[index].toLocaleUpperCase('ru') : original[index]) : char).join('');
  });
}

function reveal(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    const text = withMat(root.nodeValue);
    if (text !== root.nodeValue) root.nodeValue = text;
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) reveal(walker.currentNode);
  const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll('*')] : root.querySelectorAll('*');
  for (const element of elements) {
    for (const name of REVEALED_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value?.includes('*')) element.setAttribute(name, withMat(value));
    }
  }
}

// Text rendered later (context pane, search, mobile sheets) goes through the same reveal.
function revealPage() {
  if (!matAllowed()) return;
  reveal(document);
  observer ??= new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') reveal(record.target);
      record.addedNodes.forEach(reveal);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}

function gateMarkup() {
  const gate = document.createElement('div');
  gate.className = 'mat-gate';
  gate.innerHTML = `<div class="mat-gate__backdrop"></div>
    <section class="mat-gate__panel" role="dialog" aria-modal="true" aria-labelledby="mat-gate-title" aria-describedby="mat-gate-text" tabindex="-1">
      <div class="mat-gate__body">
        <h2 id="mat-gate-title">ТУТ ЕСТЬ МАТ</h2>
        <p id="mat-gate-text">в статьях встречается ненормативная лексика. если тебе нет 18, продолжай без неё: мы спрячем буквы под звёздочками.</p>
      </div>
      <div class="mat-gate__actions"></div>
    </section>`;
  return gate;
}

export function mountMatGate({ force = new URLSearchParams(location.search).get('mat') === 'ask' } = {}) {
  revealPage();
  const answered = read(localStorage, CHOICE_KEY) || read(sessionStorage, ASKED_KEY);
  if (answered && !force) return;

  const gate = gateMarkup();
  const clean = createActionButton({ label: 'Продолжить без мата' });
  const explicit = createActionButton({ label: 'Я взрослый', variant: 'secondary' });
  gate.querySelector('.mat-gate__actions').append(clean, explicit);
  const background = [...document.body.children];
  const lastFocus = document.activeElement;
  background.forEach(element => { element.inert = true; });
  document.body.append(gate);
  requestAnimationFrame(() => { gate.dataset.state = 'open'; });
  gate.querySelector('[role="dialog"]').focus({ preventScroll: true });

  function close(choice) {
    if (choice) write(localStorage, CHOICE_KEY, choice);
    write(sessionStorage, ASKED_KEY, 'true');
    background.forEach(element => { element.inert = false; });
    gate.remove();
    document.removeEventListener('keydown', onKeydown);
    if (lastFocus instanceof HTMLElement) lastFocus.focus({ preventScroll: true });
    if (choice === 'explicit') revealPage();
    window.dispatchEvent(new CustomEvent(MAT_CHANGE_EVENT, { detail: { explicit: choice === 'explicit' } }));
  }
  // Escape keeps the masked text for this visit and asks again next time.
  function onKeydown(event) {
    if (event.key === 'Escape') close(null);
  }
  clean.addEventListener('click', () => close('clean'));
  explicit.addEventListener('click', () => close('explicit'));
  document.addEventListener('keydown', onKeydown);
}

// After the page modules have rendered, so everything they put into <body> goes inert behind the popup.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountMatGate(), { once: true });
else setTimeout(() => mountMatGate());
