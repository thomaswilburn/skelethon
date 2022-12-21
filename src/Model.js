/*

Model is a base class for creating reactive chunks of data and being notified
when they change. Uses proxies for data access.

*/

import { observe } from "./observation.js";
import { RevisionEvent } from "./RevisionEvent.js";

var proxyRegistry = new WeakMap();

export class Model extends EventTarget {

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