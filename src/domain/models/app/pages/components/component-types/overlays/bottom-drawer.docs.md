# Drawer

> The `drawer` component — a drawer: a panel that rises from the bottom edge and is dragged down to dismiss.

On a phone, filters, a short form or the details of a row belong in a panel that comes up from the bottom of the screen, where the thumb already is. A `drawer` is that panel: opened by a trigger, dragged by its handle, resting at the heights you declare, and swiped away toward its edge. Reference: shadcn/ui Drawer.

```yaml
components:
  - type: button
    props:
      label: Filters
      interactions:
        click:
          modal: filters-drawer
  - type: drawer
    props:
      id: filters-drawer
    title: Filter listings
    description: Narrow the listings by district and price.
    snapPoints: [0.4, 1]
    children:
      - type: text
        element: p
        content: District and price filters go here.
```

<!-- sovrium:options type:drawer -->

The drawer is opened as a `dialog` is: give it a `props.id` and point a trigger at it (`interactions.click.modal`). `title` and `description` name and describe it to assistive technology. `snapPoints` lists the heights it rests at, as ascending fractions of the screen between 0 and 1: it opens at the first and a drag moves it to the next. `side: top` brings it down from the top edge instead. `handle` draws the grip it is dragged by. `modal: false` leaves the page behind usable. `swipeToDismiss: false` keeps it open after a drag; Escape and the overlay still close it.

`type: drawer` used to name the panel that slides in from a side edge, which is now `sheet`. The side panel's keys (`drawerSide`, `drawerSize`, `dataSource`, `recordFields` and the rest) are refused on a `drawer` with a message naming `sheet`: rename the `type` and keep every key.
