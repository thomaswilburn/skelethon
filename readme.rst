Skelethon
=========

An homage to Backbone.js written for ES2022.

Model
-----

A basic class for creating reactive data objects. Each model has an observed ``data`` property, and any changes to this object will trigger a revision event (and, if there's a view, will queue up a re-render).

View
----

A base class for custom elements that can be used with Models easily. Does not use Shadow DOM--instead, it lazily sets its ``innerHTML`` with the contents of the static ``template`` class property. Use the ``illuminate`` method to populate the element and get a list of elements tagged with ``ref`` attributes for updates. You should override ``illuminate`` to add event listeners only on first render.

Collection
----------

A subclass of Array that dispatches revision events when its mutation methods are used. It's not currently closely coupled with Model, but that would be the next upgrade--like the original Backbone, it should automatically create Models from data fed to the constructor, and it should subscribe to their events.

Example
-------

There's a classic single-file Todo app in the ``docs`` folder, or at https://thomaswilburn.github.io/skelethon