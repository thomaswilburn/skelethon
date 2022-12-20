/*

A simple observable wrapper for data objects. Used by Model for data
reactivity. Create it with a target, and a callback function that will be
notified on any changes.

*/

export function observe(root, callback) {
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
  }
  var proxy = new Proxy(root, handler);
  return proxy;
}