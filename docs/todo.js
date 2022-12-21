// published
import { Collection, View, Model } from "./skelethon.js";

// for local testing
// import { Collection, View, Model } from "../index.js";

// Our basic model for an item.
class Todo extends Model {

  // template defines the default data for an item
  static template = {
    label: "Task name",
    done: false
  }

  // This will create a <todo-view> when the model is constructed
  static viewTag = "todo-view";

  // our collection will see this event and remove the model
  destroy() {
    this.dispatchEvent(new Event("destroyed"));
  }

}

// our view is a custom element associated with a model type
var guid = 0;
class TodoView extends View {

  // the template will be instantiated on render
  static template = `
<li class="todo" ref="container">
  <input type="checkbox" ref="checkbox">
  <label ref="label"></label>
  <input class="edit-label" ref="editLabel">
  <button class="cancel" ref="cancel">Cancel</button>
  <button class="edit" ref="editToggle"></button>
  <button class="destroy" ref="destroy">&times;</button>
  `;

  // register for delegated events
  static events = {
    "change input[type=checkbox]": "updateState",
    "click button.edit": "toggleEditing",
    "click button.cancel": "cancelEditing",
    "click button.destroy": "destroy"
  }

  // init flag
  #associated = false;

  connectedCallback() {
    if (this.#associated) return;
    // associate the label and checkbox using the incremental ID
    var { label, checkbox } = this.illuminate();
    var forID = `todo-item-${guid++}`;
    label.htmlFor = forID;
    checkbox.id = forID;
    this.#associated = true;
  }

  // called when the user clicks "edit" or "done"
  // they're the same button
  toggleEditing() {
    var { container, editLabel } = this.illuminate();
    var editing = container.classList.toggle("editing");
    if (editing) {
      editLabel.value = this.model.data.label;
      editLabel.focus();
    } else {
      this.model.data.label = editLabel.value.trim();
    }
  }

  // the cancel button will ignore changes made
  cancelEditing() {
    var { container } = this.illuminate();
    container.classList.remove("editing");
  }

  // called when the checkbox is changed
  updateState() {
    var { checkbox, editLabel } = this.illuminate();
    this.model.data.done = checkbox.checked;
  }

  // called automatically by the model when it's changed
  render() {
    var data = this.model.serialize();
    var { editLabel, label, checkbox } = this.illuminate();
    editLabel.value = data.label;
    label.innerHTML = data.label;
    checkbox.checked = data.done;
  }

  // called when the "x" button is clicked
  destroy() {
    this.remove();
    this.model.destroy();
  }
}
TodoView.registerAs("todo-view");

class TodoCollection extends Collection {

  // add() and remove() will use this automatically
  static model = Todo;

  // the collection will automatically subscribe to these
  static events = {
    "revised": "sortByCompletion",
    "destroyed": "destroyItem"
  };

  // removes items from the event subscription
  destroyItem(e) {
    this.remove(e.target);
  }

  // default unchecked then checked, with alpha sort in each
  // this collection is effectively self-sorting, since any
  // model revision event triggers a re-sort
  sortByCompletion() {
    this.sort(function(a, b) {
      if (a.data.done != b.data.done) {
        return a.data.done ? 1 : -1;
      }
      if (a.data.label < b.data.label) return -1;
      if (a.data.label > b.data.label) return 1;
      return 0;
    });
  }
}

// the default view instantiates the app and manages storage
// I guess it's a controller? Kind of?
class App extends View {
  static template = `
<ul class="todo-list" ref="list"></ul>
<hr>
<div class="add-panel">
  <input placeholder="What needs to be done?" ref="taskLabel">
  <button class="add-todo" ref="add">Add Todo</button>
</div>
<div class="counter">
  Items remaining: <span ref="count"></span>
</div>
  `;

  static events = {
    "click .add-todo": "addItem"
  }

  static boundMethods = ["whenRevised"];

  constructor() {
    super();
    // we'll persist this collection to localStorage as a demo
    var saved = localStorage.getItem("todo-storage");
    var data = saved ? JSON.parse(saved) : [
      { label: "Walk dog" },
      { label: "Buy milk" },
      { label: "Purchase feeble cable access show and exploit it", done: true }
    ];
    // .from() is a nice convenience here.
    this.items = TodoCollection.from(data);
    // if items change or are altered, notify the view
    this.items.addEventListener("revised", this.whenRevised);
    // item views re-render themselves, we don't worry about it here
  }

  // render on startup
  connectedCallback() {
    this.render();
  }

  render() {
    var elements = this.illuminate();
    var views = this.items.map(m => m.view);
    // reorderChildren() will also add nodes that aren't appended yet
    View.reorderChildren(elements.list, views);
    // count the items
    elements.count.innerHTML = this.items.filter(d => !d.data.done).length;
  }

  // when the user fills out the form and clicks "add todo"
  addItem() {
    var { taskLabel } = this.illuminate();
    this.items.add({ label: taskLabel.value.trim() || "New task" });
    taskLabel.value = "";
  }

  // this is called when the collection mutates
  whenRevised() {
    this.render();
    // save to localhost
    var json = JSON.stringify(this.items.map(d => d.serialize()));
    localStorage.setItem("todo-storage", json);
  }
}

App.registerAs("todo-app");