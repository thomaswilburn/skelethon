import { RevisionEvent } from "./RevisionEvent.js";

/*

Collection is basically just an evented array. It dispatches "revised" events when it changes.

*/

export class Collection extends Array {

  static events = {};
  
  constructor() {
    super(0);
    if (new.target.boundMethods) {
      for (var b of new.target.boundMethods) {
        this[b] = this[b].bind(this);
      }
    }
    // also bind for subscriptions
    if (new.target.events) {
      for (var method of Object.values(new.target.events)) {
        this[method] = this[method].bind(this);
      }
    }
    this.addEventListener("revised", this.#autoSubscription.bind(this));
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

  #autoSubscription(e) {
    var events = Object.entries(this.constructor.events);
    for (var added of e.added) {
      for (var [event, method] of events) {
        if (!added.item.addEventListener) continue;
        added.item.addEventListener(event, this[method]);
      }
    }
    for (var removed of e.removed) {
      for (var [event, method] of events) {
        if (!removed.item.removeEventListener) continue;
        removed.item.removeEventListener(event, this[method]);
      }
    }
  }

  // Skelethon-specific functions

  add(item) {
    var Model = this.constructor.model;
    if (Model && !(item instanceof Model)) {
      item = new Model(item);
    }
    this.push(item);
    return item;
  }

  remove(item) {
    var index = this.indexOf(item);
    this.splice(index, 1);
    return item;
  }
  
  reset(values) {
    var removed = this.slice();
    this.length = 0;
    var Model = this.constructor.model;
    if (Model) {
      values = values.map(v => v instanceof Model ? v : new Model(v));
    }
    super.push(...values);
    var revision = new RevisionEvent().markAdded(values, this).markRemoved(removed, this);
    this.dispatchEvent(revision);
  }

  // array wrappers

  static from(iterable) {
    var collection = new this();
    collection.reset(iterable);
    return collection;
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
    var value = super.push(...items);
    var revision = new RevisionEvent();
    revision.markAdded(items, this);
    this.dispatchEvent(revision);
    return value;
  }

  pop() {
    var item = super.pop();
    var revision = new RevisionEvent();
    revision.markItemRemoved(item, this);
    this.dispatchEvent(revision);
    return item;
  }

  shift() {
    var item = super.shift();
    var revision = new RevisionEvent();
    revision.markItemRemoved(item, this);
    this.dispatchEvent(revision);
    return item;
  }

  unshift(...items) {
    var value = super.unshift(...items);
    var revision = new RevisionEvent();
    revision.markAdded(items, this);
    this.dispatchEvent(revision);
    return value;
  }

}