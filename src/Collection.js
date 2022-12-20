import { RevisionEvent } from "./RevisionEvent.js";

/*

Collection is basically just an evented array. It dispatches "revised" events when it changes.

*/

export class Collection extends Array {
  
  constructor() {
    super(0);
    if (new.target.boundMethods) {
      for (var b of new.target.boundMethods) {
        this[b] = this[b].bind(this);
      }
    }
  }

  // since we don't have multiple inheritance, we have to write our own event setup
  #listeners = {};

  addEventListener(event, listener, options = {}) {
    if (!this.#listeners[event]) this.#listeners[event] = [];
    var { once, signal } = options;
    this.#listeners[event].push({ listener, once });
    if (signal) {
      signal.addEventListener("abort", () => this.removeEventListener(event, listener));
    }
  }

  removeEventListener(event, listener) {
    if (!this.#listeners[event]) return;
    this.#listeners[event] = this.#listeners[event].filter(l => l.listener != listener);
  }

  dispatchEvent(event) {
    var { type } = event;
    if (!this.#listeners[type]) return;
    for (var registration of this.#listeners[type]) {
      registration.listener(event);
      if (registration.once) this.removeEventListener(type, registration.listener);
    }
  }

  fill(value, start, end) {
    var revision = new RevisionEvent();
    var removed = this.slice(start, end);
    super.fill(value, start, end);
    var added = this.slice(start, end);
    revision.markAdded(added);
    if (removed.length) {
      revision.markRemoved(removed);
    }
    this.dispatchEvent(revision);
  }

  reset(values) {
    var removed = this.slice();
    var added = values.slice();
    this.length = 0;
    super.push(...values);
    var revision = new RevisionEvent().markAdded(added, this).markRemoved(removed, this);
    this.dispatchEvent(revision);
  }

  sort(fn) {
    super.sort(fn);
    this.dispatchEvent(new RevisionEvent().markReordered());
  }

  splice(at, count, ...items) {
    if (count) {
      var removed = this.slice(at, at + count);
    }
    super.splice(at, count, ...items);
    var revision = new RevisionEvent().markAdded(items, this).markRemoved(removed, this);
    this.dispatchEvent(revision);
  }

  push(...items) {
    super.push(...items);
    var revision = new RevisionEvent();
    revision.markAdded(items, this);
    this.dispatchEvent(revision);
  }

  pop() {
    var item = super.pop();
    var revision = new RevisionEvent();
    revision.markItemRemoved(item, this);
    this.dispatchEvent(revision);
  }

  shift() {
    var item = super.shift();
    var revision = new RevisionEvent();
    revision.markItemRemoved(item, this);
    this.dispatchEvent(revision);
  }

  unshift(...items) {
    super.unshift(...items);
    var revision = new RevisionEvent();
    revision.markAdded(items, this);
    this.dispatchEvent(revision);
  }

}