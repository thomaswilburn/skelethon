/*

View is a thin base class for custom elements. It primarily provides DOM
utilities and some basic templating, and serves as a rendering unit for a
model. 

*/

export class View extends HTMLElement {

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