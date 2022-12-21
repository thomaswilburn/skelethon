/*

Revision events are modeled on Mutation records--each contains an array of
items that are added/removed (for use with collections), as well as an array
of properties that were altered (for use with Models). These are unified so
that you can have a model that's also a collection, if you want. By default,
they're meant to be batched, as opposed to the original Backbone events,
which would be individual for some operations (add/remove) and batched for
others(reset, add/remove after individual events had fired).

Methods should all return this so that they can be chained.

*/

class RevisionEvent extends Event {
  added = [];
  removed = [];
  altered = [];
  reordered = false;

  constructor() {
    super("revised");
  }

  markItemAdded(item, collection) {
    this.added.push({ item, collection });
    return this;
  }

  markAdded(items, collection) {
    for (var item of items) {
      this.markItemAdded(item, collection);
    }
    return this;
  }

  markItemRemoved(item, collection) {
    this.removed.push({ item, collection });
    return this;
  }

  markRemoved(items, collection) {
    for (var item of items) {
      this.markItemRemoved(item, collection);
    }
    return this;
  }

  markAltered(change) {
    this.altered.push(change);
    return this;
  }

  markReordered(reordered = true) {
    this.reordered = reordered;
    return this;
  }
}

/*

Collection is basically just an evented array. It dispatches "revised" events when it changes.

*/

class Collection extends Array {

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

/*

A simple observable wrapper for data objects. Used by Model for data
reactivity. Create it with a target, and a callback function that will be
notified on any changes.

*/

function observe(root, callback) {
  var handler = {
    get(target, property, rec) {
      var value = target[property];
      if (value instanceof Object) {
        return new Proxy(value, handler);
      }
      return value;
    },

    set(target, property, value) {
      var previous = target[property];
      target[property] = value;
      callback({ root, target, property, value, previous });
      return true;
    }
  };
  var proxy = new Proxy(root, handler);
  return proxy;
}

/*

Model is a base class for creating reactive chunks of data and being notified
when they change. Uses proxies for data access.

*/

var proxyRegistry = new WeakMap();

class Model extends EventTarget {

  #data = {};
  #rendering = false;

  constructor(data = {}) {
    super();
    this.whenUpdated = this.whenUpdated.bind(this);
    var { template, viewTag } = new.target;
    if (template) {
      this.#data = structuredClone(template);
    }
    Object.assign(this.#data, data);
    if (viewTag) {
      this.view = document.createElement(viewTag);
      this.view.model = this;
      this.enqueueRender();
    }
  }

  get data() {
    var cached = proxyRegistry.get(this.#data);
    if (!cached) {
      var proxy = observe(this.#data, this.whenUpdated);
      proxyRegistry.set(this.#data, proxy);
      return proxy;
    }
    return cached;
  }

  set data(value) {
    this.#data = value;
  }

  serialize() {
    return this.#data;
  }

  whenUpdated(change) {
    // you can override me!
    var revision = new RevisionEvent();
    revision.markAltered(change);
    this.dispatchEvent(revision);
    this.enqueueRender();
  }

  enqueueRender() {
    if (this.#rendering) return;
    if (this.view && this.view.render) {
      this.#rendering = true;
      requestAnimationFrame(() => {
        this.view.render(this.#data);
        this.#rendering = false;
      });
    }
  }

}

/*

View is a thin base class for custom elements. It primarily provides DOM
utilities and some basic templating, and serves as a rendering unit for a
model. 

*/

class View extends HTMLElement {

  constructor() {
    super();
    if (new.target.boundMethods) {
      for (var m of new.target.boundMethods) {
        this[m] = this[m].bind(this);
      }
    }
    if (new.target.events) {
      for (var key in new.target.events) {
        var space = key.indexOf(" ");
        var type = key.slice(0, space);
        var selector = key.slice(space + 1);
        var method = new.target.events[key];
        this.addEventListener(type, this.#delegateEvent.bind(this, selector, method));
      }
    }
  }

  illuminate() {
    this.innerHTML = this.constructor.template;
    var elements = Array.from(this.querySelectorAll("[ref]"));
    var entries = elements.map(e => [e.getAttribute("ref"), e]);
    var manuscript = Object.fromEntries(entries);
    this.illuminate = () => manuscript;
    return manuscript;
  }

  render(data) {
    // override this!
    this.illuminate();
  }

  #delegateEvent(selector, method, e) {
    var closest = e.target.closest(selector);
    if (this.contains(closest)) {
      this[method](e);
    }
  }

  static reorderChildren(container, ordered) {
    ordered.forEach(function(desired, i) {
      var child = container.children[i];
      if (desired != child) {
        container.insertBefore(desired, child);
      }
    });
  }

  static registerAs(tag) {
    window.customElements.define(tag, this);
  }

}

export { Collection, Model, View, observe };
