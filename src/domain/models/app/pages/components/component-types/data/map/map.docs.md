# Maps

> The `map` component — the records of a table drawn as pins at their location, with a list twin that a keyboard and a screen reader can use.

A `map` places one pin per record at the value of a `geolocation` field. It binds the way every data component does: to one of the table's views with `dataSource: { table, view }`, or to the table itself with its own `filter` and `sort`.

<!-- sovrium:options type:map -->

`locationField` names the `geolocation` field and `labelField` the field that names each pin — on its card, in its accessible name and in the list twin. `colorField` fills each pin with the colour of a select or status option; without it every pin is drawn in the foreground ink. Nearby pins are grouped into one marker carrying their count unless `cluster: false`. The map opens fitted to its pins, or on a fixed view when `center: { lat, lng }` and `zoom` are given, at `height` pixels (400 by default).

Clicking a pin opens its card. With `onPinClick` set, the card carries an Open button that runs it — `openDrawer` to show the record in a drawer on the page, or `navigate` to its own page; without it, the card names the record and offers no Open. The `+` and `−` controls in the corner change the scale, for a keyboard as for a pointer.

## Tiles are the operator's choice

The basemap comes from the tile server the operator names in `MAP_TILES_URL`. Nothing in the app config can name one, and with the variable unset a map draws a neutral grid under its pins and requests no tiles at all, so an app never sends its readers' map views to a provider nobody chose.

## A list twin, always

Every map renders a list of its pins beside it, in the same order, each one a button that opens the same card. It cannot be turned off: a map only a pointer can read is a map a keyboard or a screen reader cannot read at all. A record whose location is empty appears in the list and draws no pin.
