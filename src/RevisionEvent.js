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

export class RevisionEvent extends Event {
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