'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../public/tv/showcase.js'), 'utf8'
);

class Element {
  constructor(id) {
    this.id = id;
    this.hidden = false;
    this.textContent = '';
    this.src = '';
    this.attributes = {};
    this.listeners = {};
    this.children = [];
    this.classList = {values: new Set(), add: name => this.classList.values.add(name)};
  }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  click(event = {}) { this.listeners.click?.({target: this, ...event}); }
  focus() { this.focused = true; }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key] || null; }
  append(child) { this.children.push(child); }
  replaceChildren(fragment) { this.children = [...fragment.children]; }
}

function setup(options = {}) {
  const ids = [
    'welcomeScreen', 'welcomeStart', 'welcomeJoin', 'welcomeHowTo',
    'welcomeRulesDialog', 'welcomeRulesClose', 'welcomeRulesPlay',
    'welcomeCast', 'lobbyCast', 'target', 'roomCode', 'qrImage',
    'welcomeQR', 'welcomeRoomCode', 'joinUrl', 'welcomePhoneUrl'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const observers = [];
  const documentListeners = {};
  const tasks = [];
  const context = {
    document: {
      getElementById: id => elements[id],
      createElement: tag => new Element(tag),
      createDocumentFragment: () => ({children: [], append(child) { this.children.push(child); }}),
      addEventListener: (event, callback) => { documentListeners[event] = callback; }
    },
    window: {setTimeout: callback => tasks.push(callback)},
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
    },
    fetch: async () => ({
      ok: options.fetchFails !== true,
      json: async () => [{name: 'Captain', think: '/fallback.png', images: {
        think: '/think.png', win: '/win.png', lose: '/lose.png'
      }}]
    }),
    Math: Object.create(Math)
  };
  context.Math.random = () => 0;
  vm.runInNewContext(source, context);
  return {
    elements,
    documentListeners,
    tasks,
    mutation() { observers.forEach(observer => observer.callback()); },
    flushTimers() { tasks.splice(0).forEach(callback => callback()); }
  };
}

test('Welcome actions reveal lobby and put keyboard focus on the requested control', () => {
  for (const [button, focusId] of [['welcomeStart', 'target'], ['welcomeJoin', 'roomCode']]) {
    const {elements, flushTimers} = setup();
    elements[button].click();
    assert.equal(elements.welcomeScreen.attributes['aria-hidden'], 'true');
    assert.ok(elements.welcomeScreen.classList.values.has('welcome-dismissed'));
    flushTimers();
    assert.equal(elements.welcomeScreen.hidden, true);
    assert.equal(elements[focusId].focused, true);
  }
});

test('Rules dialogue opens and closes using buttons, backdrop and Escape', () => {
  const {elements, documentListeners} = setup();
  const dialog = elements.welcomeRulesDialog;
  dialog.hidden = true;
  elements.welcomeHowTo.click();
  assert.equal(dialog.hidden, false);
  assert.equal(elements.welcomeRulesClose.focused, true);
  documentListeners.keydown({key: 'Escape'});
  assert.equal(dialog.hidden, true);
  assert.equal(elements.welcomeHowTo.focused, true);
  elements.welcomeHowTo.click();
  dialog.click();
  assert.equal(dialog.hidden, true);
});

test('Live room updates replace join placeholder and toggle QR visibility', () => {
  const {elements, mutation} = setup();
  assert.equal(elements.welcomeQR.hidden, true);
  assert.equal(elements.welcomeRoomCode.textContent, '····');
  assert.equal(elements.welcomePhoneUrl.textContent, 'Preparing room…');
  elements.qrImage.setAttribute('src', 'data:image/png;base64,abc');
  elements.roomCode.textContent = ' A B C D ';
  elements.joinUrl.textContent = 'https://example.org/play/';
  mutation();
  assert.equal(elements.welcomeQR.hidden, false);
  assert.equal(elements.welcomeQR.src, 'data:image/png;base64,abc');
  assert.equal(elements.welcomeRoomCode.textContent, 'ABCD');
  assert.equal(elements.welcomePhoneUrl.textContent, 'https://example.org/play/');
});

test('Rules Play button closes dialogue and starts lobby transition', () => {
  const {elements, flushTimers} = setup();
  elements.welcomeRulesDialog.hidden = false;
  elements.welcomeRulesPlay.click();
  assert.equal(elements.welcomeRulesDialog.hidden, true);
  flushTimers();
  assert.equal(elements.target.focused, true);
});
