Skelethon
=========

An homage to Backbone.js written for ES2022.

Model
-----

A basic class for creating reactive data objects.

Configure a model by declaring it as a subclass of ``Model``, like so::

    class Todo extends Model {

      // set the default View to instantiate on model creation
      static viewTag = "todo-view";

      // set the default state for this model
      static template = {
        label: "New to-do item",
        done: false
      }

    }

    // create a new, customized Todo
    var task = new Todo({ label: "Build an MVC framework "});

    // change the model state and trigger a re-render
    task.data.done = true;

The ``data`` property on a model returns a Proxy wrapper for the actual state object. Changing this object will trigger a ``revised`` event on the model, and if it has an associated View, it will enqueue a batched render. You can get access to the actual state object by calling ``serialize()`` on your model instance.

View
----

Skelethon Views are custom elements that provide some basic templating and event delegation. Like models, they are configured by extending the base class and setting some static properties::

    class TodoView extends View {

      // template HTML for rendering
      static template = `
        <li ref="container">
          <label>
            <input type="checkbox" ref="completed">
            <span ref="label"></span>
          </label>`;

      // provide method names to automatically bind
      static boundMethods = [];

      // register delegated events for your view
      static events = {
        "change input[type=checkbox]": "handleChange"
      }

      handleChange(e) {
        this.model.data.checked = e.target.checked;
      }

      // render will be called with the model's state if they're linked
      render(data) {
        // illuminate lazily inserts the HTML template and returns
        // any element marked with ref="name"
        var { label } = this.illuminate();
        label.innerHTML = data.label;
      }

    }

Views can use whatever rendering solution you want when you override the ``render()`` method. By default, however, they use a memoized, lazy templating method that inserts the class's static ``template`` HTML when the ``illuminate()`` method is called. This function returns a lookup object containing all elements marked with a ``ref`` attribute. It's not much, but it works.

The static ``events`` property on your view will be used to set up delegated event listeners on the element, basically the same way that Backbone did. These listeners will be called with the correct ``this`` value, but if you want to make sure, you can list the names of methods in the static ``boundMethods`` array and they'll be set up for you.

The View class also provides two static methods: ``registerAs(tagName)`` will add your element to the ``customElements`` registry, and ``reorderChildren(container, desiredChildren)`` is a convenience function that takes a sorted list of DOM elements and ensures that they're placed in ``container`` in the right order. It's mostly meant to be used with Collections when rendering lists--see the Todo sample code for an example.

Collection
----------

Collections are a subclass of Array that adds notification events when the list is mutated, or for selected events dispatched by models in the collection. The code patterns here should look fairly familiar by now, but there's usually less method declaration for Collection subclasses::

    class TodoCollection extends Collection {

      // provide a class that this Collection contains/generates
      static model = Todo;

      // specify events that you'd like to monitor on models here
      static events = {
        "revised": "todosChanged"
      };

      // methods that are bound automatically
      static boundMethods = ["listChanged"];

      constructor() {
        super();
        // listen for events from the list itself
        this.addEventListener("revised", this.listChanged);
      }

      // will be called when models dispatch a revised event
      todosChanged(e) {
        console.log(e);
      }

      // will be called when items are added or removed
      listChanged(e) {
        console.log(e);
      }
    }

As an Array, a Collection has the full complement of methods, including ``map()``, ``forEach()``, and ``reduce()``. Each of them should return a corresponding Collection. When calling methods that mutate the array, such as ``splice()`` or ``pop()``, the Collection will fire a revision event, which will look something like this::

    {
      type: "revised",
      added: [ /* any items added will be here */ ],
      removed: [ /* deleted items will be here */ ],
      altered: [ /* altered models are here */ ]
    }

Revision events are modeled on MutationObserver records, and are batched per-operation (e.g., calling ``push()`` with five items will result in one event with five ``added`` records, not five events).

In addition to the regular array methods, there are three methods unique to Collection objects.

* ``add(item)`` - pushes an item into the array. If you specified the model on the class definition, raw JS objects will be converted by passing them to the model constructor.
* ``remove(item)`` - finds a model in the array and deletes it.
* ``reset(items)`` - clears the collection and repopulates it with new data.

Example
-------

There's a classic single-file Todo app in the ``docs`` folder, or at https://thomaswilburn.github.io/skelethon