## [0.27.1](https://github.com/sovrium/sovrium/compare/v0.27.0...v0.27.1) (2026-09-23)

### Bug Fixes

- **build**: write generated import paths with forward slashes on every platform

## [0.27.0](https://github.com/sovrium/sovrium/compare/v0.26.0...v0.27.0) (2026-09-23)

### Features

- **cli**: add sovrium docs --export for documentation sites

### Bug Fixes

- **config**: report excess properties without a regular expression that backtracks on long keys
- **pages**: keep what is typed into a form inside a tab panel
- **build**: build the binary from the committed manual payload when the story corpus is absent

## [0.26.0](https://github.com/sovrium/sovrium/compare/v0.25.0...v0.26.0) (2026-09-23)

### Features

- **cli**: resolve an operator-console page name to the route it serves
- **desktop**: ship Sovrium as a desktop app for macOS, Windows and Linux
- **mcp**: let a local AI edit the config file over stdio
- **cli**: ship the platform manual inside the binary as `sovrium docs`
- **cli**: add `sovrium mcp`, serving the configuration tools over stdio
- **mcp**: expose the configuration to an AI client as four read-only tools
- **cli**: keep a history of every config the server accepted
- **cli**: fork a published config into a new project
- **cli**: let init put the new project under version control
- **cli**: point out field ids that are really just positions
- **cli**: stop the server when its stdin closes, on request
- **cli**: let a managed install decline to update itself
- **cli**: let a supervising process say where the project lives
- **cli**: show a refused save on the page it was made from
- **cli**: add sovrium validate --json
- **cli**: publish a machine-readable status file beside the lock file

### Bug Fixes

- **pages**: a session-bound avatar picture accepts only an http(s) or same-origin address
- **cli**: render the manual from the standalone binary, not only from the source tree
- **admin**: serve the option list for every component type
- **automations**: keep redacting a secret the operator supplied
- **cli**: refuse a reload whose pre-flight cannot reach the database
- **config**: decide every redirect hop, not just the address you gave
- **config**: report the shape of a rejected config value, not the value
- **pages**: serve llms.txt and llms-full.txt per locale instead of every locale at once
- **mcp**: stop hiding a table whose name merely starts with "config"
- **cli**: let `--project` name the project for the `$ref` jail as well
- **config**: stop masking an environment variable name as if it were a secret
- **cli**: stop a failed reload from leaving the server down and saying otherwise
- **cli**: keep watching a config file that is replaced rather than rewritten
- **migrations**: report the refusal a dry-run plan was discarding
- **pages**: keep internal data-source markers off rendered elements

## [0.25.0](https://github.com/sovrium/sovrium/compare/v0.24.0...v0.25.0) (2026-09-22)

### BREAKING CHANGES

- **pages**: refuse a KPI threshold colour the card cannot draw
- **admin-api**: list design-system share links in the standard { items, total } envelope
- **telemetry**: arm metric export only from its own endpoint variable
- **types**: resolve the bare sovrium specifier to src/index.ts; delete packages/

### Features

- **pages**: a form submit can name its visual weight
- **pages**: a form submit can name its weight, and a success can reload the page
- **auth**: remember a person's interface language on their account
- **pages**: an endpoint form can arrive prefilled
- **admin**: name both ends of an access relationship, count what a principal reaches, and narrow the graph to one subject
- **admin**: serve Sovrium's brand mark from the engine
- **admin**: record every boot that changed the configuration, and serve the ledger
- **pages**: draw a toggle menu item with its switch on the right
- **pages**: let a menu item be a toggle
- **design-system**: render a component at a chosen viewport width inside its own frame
- **assets**: serve the embedded design-system sample media
- **admin**: add the organisation access-graph read
- **admin**: resolve every team membership in a single query
- **pages**: a drawer child can render once per element of a record's array
- **admin**: an app can declare the decisions behind its configuration
- **sidebar**: a navigation group can carry no category label
- **pages**: render a component only where a declared capability can actually run
- **ai-chat**: prompt suggestions under the composer
- **admin**: serve the attention aggregate for the console's landing page
- **pages**: let a sidebar parent entry be a toggle rather than a link
- **pages**: expose the running engine version to page templates
- **design**: let a code block declare a dark theme beside its light one
- **tables**: let a row action declare its button variant
- **pages**: let a tab set fill its container so a grid inside it owns the scroll
- **pages**: let a sidebar collapse to an icon rail below a breakpoint
- **tables**: let a data grid fill its container and scroll inside it
- **pages**: a kanban board groups its cards into swimlanes
- **design-system**: let a specimen document its open state
- **pages**: let a kanban board group its cards into swimlanes
- **design-system**: draw breadcrumb, command palette, form and AI chat in the UI kit
- **design-system**: give each component type its own state strip
- **design-system**: describe component states per type, and say what each applies to
- **pages**: show a value from an action's own response in its status message
- **admin-api**: say what is in each design layer, not only how much
- **admin-api**: publish a sample value and a read-only flag per field type
- **admin**: count the two design-system catalogues in the navigation
- **pages**: rule a timeline's time axis at its declared zoom
- **admin**: document the console's own reusable templates
- **tables**: publish a sample value and a read-only flag per field type
- **pages**: honour the item cap declared on a data-bound list
- **admin-api**: give the design catalogue's fixture rows real types and an empty state
- **admin-api**: let a component-type read cap how many routes it returns
- **pages**: search another table and link the row you find
- **pages**: let an app chrome name the caller it is serving
- **admin-api**: let a caller cap a component type's route list and learn the remainder
- **pages**: lay a gallery on one walkable track
- **pages**: declare a step rail over content that is not a form
- **pages**: add a verification-code input type
- **admin-api**: publish a component type's purpose on its detail record too
- **admin-api**: publish the per-category component-type counts keyed by category
- **admin-api**: say what each design-system layer holds, not only how much
- **admin-api**: say what each design layer holds, and count restyled types
- **pages**: add a record picker, a step rail, a carousel and a one-time-code input
- **cli**: open the startup banner with the app's name, version and description
- **pages**: page a data-bound list and offer a Load More control
- **timeline**: draw the today marker and the dependency connectors
- **tables**: searchable record picker on forms, with inline create and a link cap
- **pages**: add filter-bar, rich-text-editor, code-editor and date-range-picker
- **pages**: add avatar, description-list, kbd, input-group and preview component types
- **design-system**: say what each component type is for, and group its options
- **pages**: a third sidebar level, shown only inside its own section
- **tables**: add records from a trailing row at the bottom of the grid
- **tables**: fill a span of cells from the cursor, and announce an editable grid as one
- **tables**: move a cell cursor around the data grid with the keyboard
- **tables**: page through a record picker's candidates
- **design**: let component styling reach a select's inner parts, and keep its focus ring
- **design-system**: serve a type's full option surface, category counts and a coverage tri-state
- **design-system**: read every option a component type accepts, at any depth
- **email**: write undeliverable messages to the development journal
- **cli**: print the admin console address and warn only about features the config uses
- **admin**: per-mount label overrides for the embedded admin console
- **admin**: publish which matrix row exhibits a component type's states
- **admin**: publish a component type's variant matrix as flat cells
- **pages**: resolve a field specimen's subject from the row it sits in
- **admin**: narrow the declared guidance to one subject
- **pages**: resolve $app.basePath to the base a page is served at
- **admin**: lift a type-scale step's size and leading onto the token row
- **pages**: expand a system row template nested inside another
- **pages**: draw an app's own components[] template as a specimen
- **pages**: paint a token swatch from the live custom property
- **pages**: tell an unusable query value apart from an omitted one
- **admin**: document a catalogued type the catalogue will not draw
- **pages**: page.params, a route segment constrained to a supplied set
- **pages**: visibility.query, the URL-state gate
- **admin**: publish the four reads the Developers console pages compose from
- **pages**: compose a code block from a system endpoint's rows
- **pages**: draw a specimen in the axis its row names
- **pages**: resolve a page-level system record on the render path
- **pages**: a tracked sidebar keeps telling the reader where they are
- **pages**: sidebar rows carry attributes display copy cannot move
- **pages**: a sidebar entry expands into authored or fetched sub-entries
- **pages**: render the browser's own control for select.native
- **pages**: sidebar groups subdivide one landmark into headed sections
- **admin**: report whether a declared env default is withheld or released
- **pages**: a $record reference reaches every string leaf, and resolves per row
- **pages**: resolve a form field's select options from a source
- **pages**: let a mounted page gate on the caller's powers
- **pages**: let a config select publish on a shared-filter channel
- **pages**: clone an arbitrary row template over a system read endpoint
- **pages**: mark which item of a set is the current one
- **pages**: alternate a page body on what the host app declares
- **pages**: reserve a data-table action column to a caller capability
- **pages**: resolve a choice control's options from a system endpoint
- **pages**: bind a grid to the table the URL names, and derive its columns
- **pages**: substitute a route segment wherever a page names one
- **pages**: gate a component on the caller's powers, excluding it when unmet
- **pages**: resolve a page's relative window into its five references
- **components**: render easing curves and catalogue-subject specimens
- **admin-console**: read the running design system over five admin endpoints
- **pages**: withhold a page whose host lacks the capability it requires
- **pages**: name, mark and badge a sidebar's navigation groups
- **pages**: give a derived breadcrumb a root crumb and a mount base
- **pages**: let a page print the facts of the app serving it
- **pages**: let a page author its own command palette
- **components**: render design-scope, token-swatch, contrast-badge and specimen
- **pages**: let a page require capabilities of the app serving it
- **pages**: mark the current sidebar entry and badge it
- **pages**: give a derived breadcrumb a root crumb
- **pages**: let a page author place the command palette
- **admin-console**: component-type, provenance and flat-token endpoints
- **admin-console**: component-type, provenance and flat-token use-cases
- **pages**: declarative navigation groups inside a sidebar
- **pages**: answer a bare collection path with its first object
- **components**: design-scope, token-swatch, contrast-badge and specimen
- **pages**: open URL query parameters as declared page inputs
- **pages**: derive a breadcrumb trail from the request path
- **admin-console**: component-type and provenance API schemas
- **pages**: bind a route segment into a component's data source
- **pages**: route-param binding, sidebar groups, first-object redirect, query props and derived breadcrumbs
- **design**: resolve design.components through parts, variants and states
- **design**: apply the non-overridable floor after operator classes
- **design**: accept oklch() colour values
- **design**: design.components styles engine types
- **design**: emit density tokens from design.density
- **design**: density schema
- **design**: validate className lists at decode time
- **api**: hoist named Effect schemas into the OpenAPI components map
- **database**: record applied migrations by name instead of timestamp
- **telemetry**: name transactions by their route template
- **telemetry**: report per-request spans and an honest status with each transaction
- **telemetry**: warn at startup when a telemetry endpoint is not accepting data

### Bug Fixes

- **pages**: stop a kanban board discarding a keyboard move confirmed quickly
- **database**: wait for a briefly-locked SQLite database at startup
- **tables**: stop a slow cell write from closing the next cell's editor
- **pages**: send a reader with a remembered language to its own address
- **tables**: open the code editor in a grid's new-row line
- **pages**: give charts an aspect ratio instead of a fixed height
- **pages**: translate the captions a graph or matrix draws
- **i18n**: recompose the page when a language is chosen without a URL prefix
- **pages**: read an authored per-language title map in either spelling
- **i18n**: declare one spelling of the page language on every path
- **tables**: honour every code-field editor setting in the grid, not just the language
- **pages**: a file-upload trigger speaks the page's language
- **pages**: a successful action can ask the server to recompose the page
- **pages**: a dropdown no longer goes blank when its prefill finds nothing
- **pages**: let an element that hides itself when empty stay hidden
- **pages**: draw every chart's plot area at one height
- **tables**: open a code editor when a code cell is edited in the grid
- **api**: keep the session envelope's language key optional
- **cli**: stop a static build from crawling and emitting the HTTP API
- **pages**: a form lays out as the column it declares
- **pages**: give inline-runtime toasts the dismissal policy every other toast has
- **account**: a profile picture works on an app that declares no storage
- **pages**: show platform chrome in the page's language for regional locales
- **admin**: keep the operator named and the tab titled across console navigation
- **pages**: let a page region wait while a confirmation is open
- **pages**: keep a destructive confirmation open when the list refreshes
- **pages**: let a toast that never expires be closed, and announce a failure urgently
- **pages**: let a chosen language reach the server, so the next page is composed in it
- **pages**: dismiss a toast that declares no duration instead of leaving it on screen
- **pages**: band a matrix column axis by the field it declares
- **pages**: draw an empty-state's declared title and description
- **comments**: name a comment thread and its counter once, on the element the page rendered
- **tables**: draw a grid column at the width its configuration declares
- **pages**: stop a capped list offering Load more once it has drawn its cap
- **tables**: total a grid summary over the whole read endpoint, not one page
- **theme**: paint the focus ring's offset in the page colour
- **server**: a server that pre-renders its pages runs its database startup once, not once per render pass
- **comments**: stop the mounted thread repeating the id of the element it fills
- **comments**: bind a thread to the record a detail page resolves
- **design-system**: keep the excluded-type reason in the exported catalogue
- **admin**: keep the console where it is when you click the entry you are on
- **server**: a server that pre-renders its pages boots its render passes one at a time, and stopping one no longer switches off telemetry
- **admin-dashboard**: stop the search palette input from painting a clipped focus ring
- **overlays**: lay a dropdown menu trigger out as a single row
- **forms**: show field validation errors in the error tone at caption size
- **pages**: keep a tab caption's translation token until the tab id is derived
- **pages**: render the addressed tab panel server-side, and ship it once
- **pages**: resolve translation tokens in component fields no lift reaches
- **admin**: the boot ledger no longer records the internal servers a search-indexed app renders on
- **pages**: resolve translation tokens in typed component fields
- **tables**: let a sortable column be sorted from the keyboard
- **tables**: place the pager where pagination.position asks
- **tables**: keep a filling grid readable when its column runs out of room
- **design-system**: name the component on its own detail page
- **design-system**: stop three drawings claiming what they do not draw
- **design-system**: rule every drawing frame to the console's own type step
- **design-system**: paint the brand page's warnings in the error tone
- **admin**: speak one run-status vocabulary in the grid and the drawer it opens
- **pages**: let a record field carry its class and rule its values
- **design-system**: print a specimen's configuration at the code step
- **forms**: rule a number input's label at the field's step
- **pages**: resolve a record token in a repeated row's data attribute
- **ai-chat**: keep the composer inside the chat's declared height
- **tables**: keep the sort control out of the accessibility tree
- **tables**: give the sort control its own glyph instead of wrapping the column label
- **design-system**: draw each components viewport at its real width
- **tables**: name a column header from its own label, not from what is inside it
- **tables**: keep a sorted column header named after its column
- **pages**: drag a reorderable item with the pointer as well as the keyboard
- **tables**: sort a grid column from its header when the rows are in the browser
- **kanban**: let a card be dragged on a board that cannot save its order
- **design-system**: name each drawing by what it shows, not by its own heading
- **design-system**: give the accordion panels the example text they never rendered
- **design-system**: drop the States strip where no state can be drawn, and hold a specimen at one width
- **pages**: fetch older comments as the reader scrolls instead of behind a button
- **design-system**: show a real picture, clip and sound on the console's media pages
- **design-system**: publish how many states a type can actually draw
- **pages**: centre a comment's first line on its avatar
- **ai**: print a failed reply as plain text above the composer
- **pages**: give a KPI sparkline its full box and an even stroke
- **pages**: keep the gallery's carousel controls off the cards
- **design-system**: let a status badge lay out as a row with a gap
- **design-system**: draw the spinner's mark and announce it as a status
- **pages**: refuse a select that declares both multiple and searchable
- **rich-text**: insert the block a reader picks out of the slash menu
- **rich-text**: print the editor's placeholder in the editing area, not over its toolbar
- **design-system**: draw the mark leading an input at the size an icon is drawn
- **forms**: dismiss a date control by clicking away, and let it fill its column
- **forms**: hold a checkbox still while it is ticked
- **pages**: let a multiple select keep every choice it is given
- **pages**: open a select's menu below its field, at the width of the field
- **design-system**: answer a hover on a link with colour rather than a rule
- **design-system**: lay a colour swatch out as a row with a gap
- **design-system**: stop an empty element overruling the display its own type draws
- **pages**: let a tab set run flush to its container edges
- **tables**: export the selected rows of a grid that has no table behind it
- **pages**: turn the accordion chevron when a panel opens
- **pages**: render the children an author places inside a record drawer
- **pages**: style an endpoint form's submit like every other button
- **tables**: let a row action run when the row itself is clickable
- **admin**: keep the operator menu's account link inside the embedded console
- **design-system**: link only the app's own components from the admin console's Components page
- **pages**: a numbered gallery pager reaches every record
- **pages**: reject a bound table name that no app.tables[] entry declares
- **charts**: honour the value axis on charts bound through series[]
- **charts**: show the hover tooltip on charts bound without an explicit series
- **pages**: draw the line-number gutter a code block asks for
- **tables**: keep one unreadable saved view from breaking the whole list
- **automations**: bound the remote-file download in file actions
- **api**: tell a broken upstream apart from an unavailable one
- **api**: name the real refusal in two error codes
- **schema**: report a missing Better Auth users table as a configuration error
- **automations**: stop reporting a database outage as a missing run
- **admin**: tell the operator when a dashboard tile is a fallback, not a count
- **tables**: refuse an attachment write that storage could not verify
- **automations**: run record-triggered automations with the same services as scheduled ones
- **pages**: keep controls working after a list refreshes itself
- **pages**: re-read a server-rendered list when an action refetches it
- **admin**: disclose what publishing a design system exposes, before it is published
- **tables**: stop a blank or non-numeric cell totalling as a zero in a read-endpoint summary
- **admin-api**: name the zones a zone map declares when it sets no accent budget
- **pages**: leave a KPI metric uncoloured until it meets a threshold
- **charts**: draw a line chart as a line when it is bound to a pair of axes
- **tables**: total a grid's summary footer when its rows come from a read endpoint
- **pages**: signal the rich text character limit, and stop the duplicate extension warning
- **pages**: draw an existing tab at the code editor's declared indent width
- **pages**: honour a sidebar entry's own query when it fetches its children
- **pages**: refuse a KPI trend line that its data binding cannot draw
- **pages**: name a toggle, checkbox or switch by its label
- **pages**: stop the calendar week and day views throwing on an undeclared slot interval
- **pages**: draw pie, donut and scatter charts as the shapes they declare
- **pages**: apply the query declared on a sidebar group's data source
- **pages**: keep a sidebar badge on entries nested inside a disclosure
- **admin**: give the record picker a way into the design system
- **tables**: refuse single-record verbs on a table with no id column
- **tables**: list records of a table whose primary key is composite
- **tables**: tone the empty points of an editable rating column
- **tables**: stop drawing an empty toolbar band above a grid
- **tables**: stop indenting a top-level group header
- **auth**: make social sign-in actually sign the user in
- **pages**: draw a data-bound list placed inside a specimen
- **pages**: render no row when a record's whole template is hidden
- **auth**: make the OAuth sign-in control one element, and paint it
- **pages**: mount a data-bound list nested inside a container
- **design-system**: render relationship fields in the component kit
- **pages**: keep a paged list working when its page size exceeds the server limit
- **pages**: require whole numbers for counts on the new component options
- **pages**: refuse a preview option that would replace the drawn component
- **tables**: enforce a relationship field's maxLinked cap on batch writes
- **charts**: honour every value of a chart legend's position
- **pages**: refuse a preview option the component type does not publish
- **pages**: publish a filter bar's opening conditions in the served page
- **pages**: keep a description list's row action inside its own markup
- **pages**: fit the date-range panel on a phone
- **pages**: keep rich-text emphasis on the same ink as the prose it emphasises
- **pages**: paint the code editor from the colour scheme
- **pages**: keep the two editors legible when the colour scheme flips
- **pages**: preview the badge option that actually paints it
- **tables**: keep a saved filter working after the view is reloaded
- **tables**: order an unsorted record list by id instead of by storage order
- **pages**: agree on a repeated query parameter, server and client
- **pages**: refuse a sidebar showWhen.section that carries a query
- **pages**: key the page cache on the query a visitor sent, not the one it resolved to
- **pages**: mark only the sidebar entry whose query the request carries
- **tables**: keep a navigable grid's cells reporting their native roles
- **design**: make a declared corner radius and elevation reach the components
- **forms**: restore the painted submit button on auth, CRUD and wizard forms
- **admin**: show the type-scale disclosure to the app that needs it most
- **realtime**: stop dropping live updates and show a stalled connection
- **design-system**: a layer the platform supplies no longer reports itself undeclared
- **design-system**: describe a multi-form option with the field's own sentence
- **design-system**: publish a nested option's own row beside its children
- **design-system**: stop labelling a multi-type option with one type's prose
- **pages**: keep the colour-scheme preference under the key it was stored at
- **forms**: keep submitter IP hashes stable across restarts without an extra variable
- **server**: stop cutting server-sent event streams after ten seconds
- **rendering**: keep internal data-source markers out of the rendered HTML
- **rendering**: key the sidebar navigation groups so React stops warning
- **pages**: a route parameter binds $record in an automation button's inputData
- **admin**: merge the operator's templates on the CONFIG branch of the mount
- **admin-console**: print the mount a type page is served at
- **admin**: restore the type-ladder guard pair so the endpoint answers an admin
- **pages**: resolve a record reference in a nested prop, and guard the style it lands in
- **pages**: omit a detail page section its record does not satisfy
- **admin**: an IPv6 loopback origin reports the native application type
- **pages**: a null record field renders as empty text, not the literal "null"
- **pages**: a code block's contentFrom template binds its own $record refs
- **pages**: an explicitly disabled analytics block no longer satisfies its gate
- **pages**: render no rows when a system row template gets an empty list
- **admin**: project a mounted table to the fields its reader may see
- **design-system**: print a colour or dimension token as CSS spells it
- **pages**: scope the route-param binding rule to rows sources
- **cli**: write stderr journal lines without terminal colour escapes
- **cli**: split multi-line --watch failures into stamped journal entries
- **cli**: render one flush-left journal for --watch and development logs
- **components**: inject the specimen's component field instead of importing it
- **design**: keep the card surface flat with a valid suppression
- **design**: restore the keyboard focus ring on buttons and cards
- **cli**: swap most watch-mode reloads into the live server
- **server**: stop leaking signal listeners on every watch reload
- **cli**: make --watch reloads instant, single and quiet
- **islands**: refresh a grid whose first read is still loading
- **build**: generate static HTML from pinned formatting options
- **islands**: keep a file chosen before the page finishes loading
- **database**: keep Postgres int8 aggregates arriving as strings
- **api**: carry the required message field on storage error responses
- **api**: answer 400 instead of 500 when a request body is not JSON
- **api**: accept an explicit undefined on optional and defaulted API fields
- **cli**: make --watch follow every file a split config is made of
- **rendering**: key the timeline body so the rail and its events render without a React list warning
- **rendering**: key the structured-data script when it joins a component's children
- **storage**: make clearing the transform cache from the admin API actually empty it
- **islands**: stop the sidebar's operator and version reads rejecting on their absent value
- **cli**: print a startup failure as a readable sentence, not escaped JSON
- **telemetry**: stop the boot probe filing a junk envelope and polluting collectors
- **admin-dashboard**: honour the requested colour scheme in design-system previews
- **records-api**: probe the deleted_at column once per request, not per transaction
- **records-api**: answer 400 for an out-of-range pagination window
- **automations**: close CodeContext.actions so the documented call compiles
- **telemetry**: stop reporting 4xx responses raised at the HTTP boundary as server errors
- **types**: ship AgentConfig and ActionTemplate in the sovrium declaration
- **api**: stop three listing paths from taking the whole connection pool
- **tables**: bound the record-purge reference sweep
- **cli**: register the inventory template so --template inventory scaffolds

### Performance Improvements

- **pages**: never re-ask the server for a tab panel the page already carries
- **pages**: fetch a tabbed page's unopened panels when the reader opens them
- **ai**: probe Ollama on first use instead of while building the AI service
- **email**: bound the whole SMTP send, and the remote-schema fetch at boot
- **storage**: bound every S3 request and retry the idempotent ones
- **ai**: bound every AI provider request and retry the transient ones
- **ai**: stop paying a 2-second Ollama probe on every AI request
- **storage**: stop re-checking the S3 bucket on every signed-URL request
- **types**: name ComponentStyle in the emitted declaration
- **islands**: keep tailwind-merge out of the kpi mount closure
- **islands**: stop shipping the whole icon set to pages with a KPI or a menu
- **islands**: load the form islands on demand and preload their chunks
- **islands**: stop every page that mounts one island from downloading twelve

## [0.24.0](https://github.com/sovrium/sovrium/compare/v0.23.0...v0.24.0) (2026-09-01)

### BREAKING CHANGES

- **automations**: split record read and list

### Features

- **agents**: let an agent read a filtered set of records
- **cli**: add `sovrium types` for authoring a TypeScript config with no npm
- **automations**: order, paginate and trim the record list operator
- **cli**: add dry-run and check modes to the migrate command
- **cli**: add a migrate command that brings the schema forward without booting
- **automations**: mint, re-point and retire tracked short links from a workflow
- **auth**: let a role invite people into its own tenant without full admin rights
- **account**: let a signed-in user upload and remove their profile picture
- **pages**: render a scannable QR code inline on a page
- **tables**: continue a cursor-paginated data grid with load more
- **admin**: invite people and take invitations back from the console
- **auth**: show a consent screen that names where an app will send you
- **automations**: expose mentioned users' email addresses on comment triggers

### Bug Fixes

- **automations**: refuse a record list that selects a column the table lacks
- **tables**: return the columns a record listing was actually asked for
- **automations**: keep a record's timestamps through a list field trim
- **migrations**: refuse a field type change SQLite would silently mis-store
- **database**: stop printing the DATABASE_URL password in connection errors
- **automations**: accept a code action whose execute() parameter is unannotated
- **cli**: silence an Effect diagnostic the dry-run plan cannot honour
- **cli**: drop a banned separator and record that all three modes ship
- **buckets**: confine every write to the bucket that owns the key
- **storage**: confine a stored file to the bucket it was uploaded to
- **auth**: reject client-supplied profile image URLs
- **tables**: stop losing inline edits to a blip or to a concurrent change
- **kanban**: persist a card drop to the bound table without extra configuration
- **forms**: keep every step's answers when a multi-step form is submitted
- **forms**: let a dropdown express "no answer" instead of preselecting one
- **automations**: honour an app's top custom role in the comment read gate
- **cli**: report a database as unreachable by driver code, not by message text
- **config**: refuse a config carrying a `__proto__` key instead of dropping it
- **auth**: end existing sessions when an admin sets a user's password
- **admin**: show a declared default the config author marked as non-secret
- **records-api**: honor the timezone parameter when reading a single record
- **auth**: keep database errors readable so an auth-enabled app can upgrade
- **pages**: offer grid write affordances to group-granted callers
- **tables**: honour group grants when exporting a table
- **permissions**: honour group grants on the comment and row-level gates

## [0.23.0](https://github.com/sovrium/sovrium/compare/v0.22.2...v0.23.0) (2026-08-28)

### BREAKING CHANGES

- **mcp**: authenticate the MCP server with API keys instead of static tokens
- **migrations**: type relationship columns from the referenced primary key on every migrate path
- **tables**: remove the unread views-level write permission key
- **storage**: hardcode AVIF as the image transform default
- **buckets**: remove the deprecated /api/admin/buckets/quota route
- **automations**: remove the data validate-config action

### Features

- **design**: add the design.zones config key
- **design-system**: preview field types in the design-system console
- **rendering**: add a render-time seam for field specimens
- **auth**: let clients request access tokens bound to the MCP endpoint
- **admin**: publish the design system behind a revocable share link
- **admin**: add the component catalog to the design-system console
- **schema**: add design.typeScale, design.logo and design.imagery
- **agents**: fire scheduled agents on their cron, in-process
- **auth**: scope account identity by issuer and add OAuth resource tables
- **admin**: an API-keys page in the operator console
- **auth**: self-service API keys behind an explicit opt-in
- **analytics**: record clicks on the outbound links a page already has
- **links**: send different visitors to different destinations from one short link
- **links**: admin console for short links
- **links**: persist a target list on a console-minted link
- **analytics**: add the per-target split reader
- **links**: add the operator console for short links
- **links**: serve app.links at /l/{slug} with click tracking and QR codes
- **admin**: add the design-system console with app-themed previews
- **admin**: export the app design system as DTCG JSON and an agent brief
- **links**: add the app.links[] config surface for tracked short links
- **automations**: read and write .xlsx workbooks from an automation
- **connections**: share one OAuth credential across unattended automations
- **admin-dashboard**: browse conversations per agent under Application
- **automations**: run date actions for formatting, parsing and calendar math
- **automations**: complete the add/subtract date helper grid
- **automations**: deliver the 54 missing template helpers and fix date formatting
- **automations**: accept real-world CSV in the parseCsv and generateCsv actions
- **automations**: add timezone- and locale-aware date formatting and parsing
- **auth**: list, resend and revoke pending invitations
- **admin-console**: view the running config and env from the operator console
- **admin**: search automation runs and form submissions server-side
- **admin**: surface saved views, analytics breakdowns, and file delete
- **automations**: pause and resume an automation from the operator console
- **cli**: auto-discover the config file in the working directory
- **cli**: type-check code action bodies in validate and build
- **admin**: add the Footprint console page
- **automations**: add a sovrium action type with a validateConfig operator

### Bug Fixes

- **comments**: scope the comment-author lookup to its table
- **data-table**: honour table update permissions as the inline-edit default
- **data-table**: a failed load explains itself instead of printing a response body
- **data-table**: a refused sort no longer takes the whole grid with it
- **buckets**: the file browser sorts every column it offers, on both engines
- **forms**: apply a page form component's label override to the submit button
- **design-system**: surface per-zone voice overrides in the design system
- **tables**: resolve group grants on the comment and AI-chat read gates
- **data-table**: a grid shows the toolbar controls it declared, and no others
- **design-system**: revoking a share link is confirmed, and a refused revoke says so
- **admin**: the user directory pages, sorts and exports for real
- **tables**: honour group: permission grants on every record write gate
- **admin**: the profile and privacy pages start their outline at a page heading
- **admin**: the records grid says when it is showing only part of a table
- **forms**: a submissions export is a named file with a header row
- **config**: honour `secret: false` when reflecting an environment default
- **buckets**: the file browser accepts the sort spelling its own grid emits
- **admin**: give each console page a top-level heading, and the search dialog one name
- **design-system**: render declared imagery rules in the design-system console
- **permissions**: apply inherited and group grants to chat and record-update writes
- **data-table**: the filter panel can be dismissed, and the confirm prompt speaks English
- **admin-dashboard**: the console search button opens the palette again
- **sitemap**: keep non-public pages out of sitemap.xml
- **mcp**: record and read the tool-call audit trail on SQLite
- **auth**: stop capping every API key at 10 requests per day
- **buckets**: stop the implicit default bucket bypassing declared permissions
- **pages**: keep the redirect `to` description on the node, not on its check
- **ai**: session-gate RAG search and filter hits to readable tables
- **tables**: omit unreadable column names from the CSV export header
- **auth**: gate anonymous OAuth client registration behind an operator opt-in
- **tables**: strip unreadable fields from the PATCH fallback and restore echoes
- **cli**: make stop and restart wait for the server to exit
- **auth**: shed the erased user's id from other people's impersonated sessions
- **server**: exit the process on SIGTERM/SIGINT and bound the shutdown
- **crypto**: stop treating an unreadable encryption key as an absent one
- **pages**: reject a redirect target that resolves to another origin
- **pages**: bind values in the dataSource list and count builders
- **tables**: enforce multi-select options on the MCP and automation writes
- **mcp**: bind the internal-read record id and drop the raw SQL splice
- **schema**: reject a non-finite type-scale lineHeight
- **account**: export the records a custom-named authorship field owns
- **auth**: reference OAuth client and resource by the ids the provider writes
- **pages**: scope command-palette record search by permission and soft-delete
- **activity**: actually delete activity-log rows past their retention window
- **tables**: enforce declared options and the AI baseline on bulk writes
- **automations**: gate the run history on a session, and scrub its captured headers
- **account**: erase the personal data account deletion was leaving behind
- **tables**: compute volatile and chained formula fields on SQLite
- **webhooks**: gate the delivery log on table permissions and redact its secrets
- **ai**: let an agent actually read its knowledge base on SQLite
- **forms**: accept submissions on a capped form when running on SQLite
- **records**: close the ?deleted=true trash bypass, and scope trash by row
- **pages**: run SSR data binding through the composed read plan
- **ai**: scope the chat table tool by the canonical field-read predicate
- **tables**: scope realtime change events by the server column whitelist
- **auth**: stop accepting API keys from a banned account
- **admin**: make the MCP client-registration command the console prints actually work
- **pages**: decide markup-vs-text from the author's template, not the record
- **tables**: resolve group grants and hide the table on the batch create gate
- **pages**: escape the two script-body hazards a JSON escape of `<` leaves open
- **tables**: restrict the row-level access grants table to admin callers
- **tables**: apply inherited create permission on the batch and AI write paths
- **migrations**: create a view declared materialized as a plain view on SQLite
- **pages**: escape JSON emitted into a script block so a value cannot close it
- **pages**: stop a stored record value being rendered as markup
- **audit-log**: keep the audit trail across a restart
- **auth**: stop a caller-supplied header choosing its own rate-limit bucket
- **auth**: treat a wildcard bind as public, not as loopback
- **agents**: enforce the declared trigger permission on every agent surface
- **auth**: set the account issuer when linking an invited user's password
- **admin**: make the design-system foundations tell the truth about itself
- **server**: give each server process its own island bundle directory
- **admin**: correct copy and label defects on the design-system console
- **config**: reject non-finite numbers in configuration values
- **cli**: report the schema error instead of crashing on a page without components
- **links**: let a console-minted link carry a target list, and correct two specs
- **analytics**: stop the reader handlers dropping the event-population filter
- **css**: stop the app theme repainting the admin console
- **storage**: make image transforms work in the compiled binary
- **links**: reconcile schema annotation placement with both published-docs gates
- **ai**: correct a stale route comment on the agent-bound chat turn
- **ai**: record why the agent chat path cannot use a raw provider fetch
- **ai**: route agent chat through the AiService port
- **automations**: let code actions use WebCrypto, and stop accepting browser globals
- **automations**: refuse a record read whose filter names an unknown column
- **automations**: reject a record trigger whose condition names an unknown field
- **records**: demand update permission when an upsert merge field cannot be resolved
- **auth**: admit an app's custom top role on the Better Auth admin plane
- **tables**: check field-read permissions on every filter shape and entry point
- **database**: resolve auth and system tables by dialect in runtime queries
- **automations**: refuse a record filter naming a column that does not exist
- **auth**: let an app's own top admin role reach the admin plane
- **automations**: stop a batch record deletion reporting a success it did not earn
- **automations**: let a loop continue past a failing item when the config says so
- **automations**: honour the timeout and content type declared on an http action
- **admin**: remove the run and submission pagers that reported wrong totals
- **automations**: stop record batchCreate at the first failed item by default
- **automations**: fail an automation step whose action type has no handler
- **automations**: implement the path/branch conditional branching action
- **automations**: implement the record batchUpdate, batchDelete and batchUpsert actions
- **pages**: stop canonicalizing redirects from disclosing non-public pages
- **eco**: reconcile the lever surface with the DEC-077 typo refusal
- **redirects**: compare both the verbatim and canonicalized redirect target
- **cli**: stop auto-discovering app.json as a config candidate
- **pages**: drop the trailing slash from non-root hreflang alternates
- **pages**: resolve trailing-slash and unprefixed URLs to their canonical page
- **redirects**: reject the three redirect shapes that loop the browser
- **cli**: anchor an auto-discovered config the same way a named one is
- **api**: advertise this instance's origin in the served OpenAPI document
- **admin**: print this instance's real address in the API and MCP developer docs
- **server**: grade responses on their real size in the eco-index header
- **search**: stop a record grid from hiding rows the server already matched
- **records**: name the field a rejected record write was about
- **buckets**: report real upload history and declared buckets in the storage overview
- **telemetry**: stop reporting declined writes as server errors
- **forms**: keep an untouched optional barcode from failing the create
- **footprint**: drop the fabricated panels and report the levers in force
- **schema**: refuse a config whose parsed document is not a tree
- **admin**: honour ?q= on three admin list endpoints and stop double-filtering
- **footprint**: measure per-table storage instead of reporting zero
- **eco**: give ECO_MODE the one effect it can actually have
- **automations**: declare Buffer to the code-action startup validator
- **storage**: name the offending variable when the public-access env refuses boot
- **auth**: let a config-declared role outrank the built-in operator alias
- **tables**: recognize custom top roles in realtime subscribe
- **env**: refuse a typo'd ECO_* value instead of silently running the default
- **pages**: honor permission literals and the admin override in CRUD form gates
- **pages**: render a script declared in both external and externalScripts once

### Performance Improvements

- **admin**: stop embedding the app configuration in every admin page

## [0.22.2](https://github.com/sovrium/sovrium/compare/v0.22.1...v0.22.2) (2026-08-11)

### Bug Fixes

- serve the versioned stylesheet route and finish boot before the ready banner
- stop command-palette searches from scanning every table unindexed
- **redirects**: reject protocol-relative redirect targets

### Performance Improvements

- cache rendered pages backed by markdown collections
- bind the server port before running background maintenance tasks
- serve the stylesheet under a content-hashed URL with immutable caching
- let browsers and CDNs briefly cache anonymous pages that skip the render cache
- bound database fan-outs to the shared pool ceiling
- cache the docs content scan so article pages stop re-reading every file
- stop embedding the full translations dictionary twice in every page
- cap the in-memory page cache to protect small-server deployments
- compute the page-cache checksum once per app instead of on every request

## [0.22.1](https://github.com/sovrium/sovrium/compare/v0.22.0...v0.22.1) (2026-08-11)

### Bug Fixes

- **cli**: exclude dev live-reload route from the static build crawl

## [0.22.0](https://github.com/sovrium/sovrium/compare/v0.21.0...v0.22.0) (2026-08-11)

### BREAKING CHANGES

- **ai**: refuse an agent knowledge table the agent cannot read
- **tables**: honour every rung of a view's read permission
- **automations**: resolve every automation template through one engine
- **automations**: serve run history from persisted rows only
- **pages**: always validate the active-assignment cookie against user access
- **tables**: remove the boolean comment-moderation shape
- **pages**: remove the meta.priority and meta.changefreq sitemap fields
- **eco**: remove the off / on / auto ECO_MODE aliases
- **tables**: drop the batch-delete route alias and the permanent query flag
- **storage**: remove the bare S3_* environment variable aliases
- **config**: remove the legacy config-shorthand rewriting pass
- **cli**: remove the short --template aliases
- **automations**: remove the currentDateTime template helper
- **activity**: require a UUID for the activity-detail lookup
- **admin**: remove the /_admin/connect-ai alias
- **tables**: deny table operations a permissions block leaves out
- **config**: a config that validates and does nothing now fails to start
- **config**: unknown config properties now fail validation instead of being silently ignored

### Features

- **cli**: add `sovrium secret adopt` to persist an existing encryption key
- **crypto**: generate an encryption key on first start instead of refusing to boot
- **pages**: open a grid row into its record with one line
- **pages**: group a data grid by up to three fields at once
- **tables**: show when an AI field still holds its locally computed fallback
- **cli**: load relational sample data with a new seed command
- **tables**: name fields for readers, and summarise every group in a grid
- **pages**: populate a select's choices from a table's rows
- **cli**: report unrecognised config properties by name, path and source
- **data-table**: color grid rows by a select field's declared option colors
- **tables**: render kanban, calendar and gallery from the view switcher
- **pages**: edit every field type in place in a data grid
- **pages**: render a purpose-built cell for the eight field types that had none
- **tables**: paint the colour a select option declares
- **records-api**: honour page and q on the record list endpoint

### Bug Fixes

- **pages**: keep type-specific fields when resolving a component reference
- **admin**: gate every admin API route when no auth is configured
- **css**: stop startup overwriting the pre-compiled stylesheet on search-enabled apps
- **auth**: regenerate unreadable JWT signing keys at boot instead of failing every request
- **forms**: stop blanking restricted columns in an admin CSV export
- **tables**: let an admin filter and group by a restricted field it can read
- **tables**: honor the "all" and "authenticated" permission literals on writes
- **connections**: count pre-fingerprint tokens the current key cannot read
- **connections**: report a changed encryption key instead of losing tokens silently
- **cli**: stop claiming success when nothing was stopped
- **server**: refuse to boot without an encryption key
- **cli**: let commands run without an encryption key configured
- **cli**: stop --help from running the command
- **pages**: serve the language the URL asks for
- **migrations**: stop adding a field mid-list from dropping a declared column
- **migrations**: stop adding a table mid-list from moving rows into the wrong table
- **tables**: show names, dates and prose in grid cells
- **charts**: paint chart series from the app theme
- **pages**: show record field values on collection-bound pages
- **cli**: describe the seed directory default as config-relative
- **build**: stop embedding local runtime data and secrets in the binary
- **migrations**: keep SQLite foreign keys intact when a table is rebuilt
- **tables**: let a declared view work on the default database engine
- **tables**: report a view's filter as declared, whatever shape it takes
- **tables**: apply every declared view filter, including bare and nested ones
- **tables**: stop reporting a hand-written AI value as a failed computation
- **tables**: allow MIN/MAX to roll up text and timestamp columns
- **cli**: name the field and value when the database rejects a seeded row
- **tables**: count non-empty values on any column type, not just text
- **tables**: make the ARRAYUNIQUE rollup work on SQLite
- **config**: stop refusing form field names the form itself resolves
- **tables**: refuse unknown rollup aggregations and filter operators
- **pages**: order grouped table headers and count them across the whole view
- **cli**: decode the new config before stopping the running server
- **search**: match %, _ and \ as text, and search a one-column table
- **records**: return a multiple-attachments field as an array on SQLite
- **cli**: reject field names inside arrays that no table column matches
- **buckets**: show the label on the file-upload control in the data console
- **pages**: don't let the record drawer be edited before its record loads
- **ai**: keep a conversation's turns in the order they happened
- **admin**: stop listing AI agents as people in the users console
- **mcp**: show the author's table description on the MCP docs page
- **tables**: render a formula's amount in the currency it declares
- **pages**: resolve translation tokens in data-table view-switcher labels
- **config**: read one config the same way from validate, start and build
- **records**: delete the right file when purging a storeMetadata attachment
- **records**: return an array field as an array on SQLite, not a JSON string
- **records**: stop upsert rejecting a required field that declares a default
- **tables**: match contains/startsWith/endsWith without regard to case
- **pages**: apply one field-reference rule across kanban, calendar and timeline
- **auth**: validate assignable roles, prevent last-admin lockout, block admin impersonation
- **pages**: cross-check data-table field references at validate time
- **forms**: drop the unpopulated antiSpam block from the form response shape
- **automations**: publish every automation action in the JSON Schema
- **pages**: show byte sizes in English units
- **admin**: render the operator console in English
- **pages**: reject row-click and drop actions the handlers never ran
- **pages**: paint declared option colours on kanban, calendar and timeline
- **tables**: actually pin a frozen column when the grid scrolls sideways
- **i18n**: localize the remaining engine-supplied control labels
- **pages**: derive record-drawer fields from its table when none are declared
- **records**: read a metadata attachment back correctly on SQLite
- **pages**: let a grouped grid edit its cells and answer a row click
- **records**: store list-valued fields correctly when updating on PostgreSQL
- **pages**: make a grid's summary, row numbers and toolbar honour what they declare
- **tables**: read a stored duration as the seconds its schema declares
- **records-api**: answer a batch unique collision with 409, like a single write
- **records-api**: answer batch write rejections with the shared error wording
- **records-api**: answer 400 rather than 500 when a write leaves a required value empty
- **records-api**: treat search text as literal rather than as a pattern
- **records-api**: return a usable record id from a batch create on a table with computed fields
- **records-api**: store array values correctly when an upsert updates a record
- **tables**: resolve an array field's item type before it reaches the database
- **tables**: reject a relationship foreign-key override that is not a valid column name
- **records-api**: store array field values correctly on batch create
- **tables**: make soft delete work on tables with computed fields
- **records-api**: stop batch create from silently discarding flat records
- **tables**: infer the foreign key for count and rollup over one-to-many
- **records-api**: answer 400 instead of 500 for a bad record reference
- **tables**: compute formula fields on the SQLite engine

### Performance Improvements

- **islands**: load the rich-text and code editors only where they are used

## [0.21.0](https://github.com/sovrium/sovrium/compare/v0.20.0...v0.21.0) (2026-08-01)

### BREAKING CHANGES

- **schema**: remove eight page-component types that never rendered

### Features

- **pages**: apply a vertical tab set's layout once, and honour its className
- **automations**: record which user triggered each automation run
- **tables**: render a button field as a real button
- **tables**: record who invoked a record button in the audit log
- **tables**: run a record's button field through its named automation
- **tables**: close the button field's action vocabulary and gate it per record
- **pages**: honour debounceMs and minQueryLength on the search input
- **pages**: show which tab is active, and let a tab trigger carry a subtitle
- **pages**: give every code block a header with an icon copy button
- **theme**: apply darkColors to the compiled stylesheet
- **pages**: add a scrolling marquee band and code-block chrome
- **pages**: add a marquee component and code-block frame options

### Bug Fixes

- **database**: repair user foreign keys that leave an assigned account unerasable
- **account**: remove three lingering traces of an erased account
- **account**: allow an account to be erased when its user is assigned on another author's record
- **admin**: record one consistent role for a user across every audit entry
- **tables**: refresh the listing and report the outcome after a record button runs
- **admin**: apply the resource-type filter on the audit log
- **account**: erase and export a user's form submissions
- **automations**: include submission metadata and the submitting user in form-trigger payloads
- **pages**: show the configured toast after a data-table bulk action
- **pages**: apply the search list's own debounce delay
- **tables**: store dynamic-table timestamps as timestamptz
- **tables**: sanitize rich-text fields on bulk record updates
- **tables**: enforce field-level write permissions on bulk record updates
- **tables**: enforce multi-select option and selection limits on record writes
- **records-api**: sanitize rich-text fields on record update, matching create
- **records**: validate email and URL formats when updating a record
- **pages**: localize tab and accordion captions
- **records**: stop batch write errors revealing database internals
- **tables**: enforce delete and field-read permissions on every query path
- **api**: return validation details in the documented response shape
- **auth**: stop rate limits being bypassed via a forged forwarding header
- **tables**: validate email and URL columns on every write path
- **permissions**: stop hiding row-level permission lookup failures
- **records**: allow sorting on system and authorship columns
- **tables**: stop an infrastructure failure looking like a name conflict
- **tables**: remove indexes reliably when a table name contains spaces
- **tables**: store SQLite soft-delete timestamps in ISO-8601 format

## [0.20.0](https://github.com/sovrium/sovrium/compare/v0.19.0...v0.20.0) (2026-07-27)

### BREAKING CHANGES

- **buckets**: bind attachment URLs to the field's declared bucket

### Features

- **pages**: let a redirect target opt out of locale inheritance

### Bug Fixes

- **pages**: read page and collection data through the configured database
- **tables**: translate GREATEST and LEAST formulas for SQLite
- **api**: check every invalid field in a request, not just the first
- **comments**: honour autoApprove.previouslyApproved
- **tables**: store attachment URLs against the field's declared bucket
- **api**: tell the caller why an upload was rejected as too large
- **records-api**: stop discarding a field named user_id
- **buckets**: enforce the declared upload, download and delete permissions
- **database**: repoint the fan-out test and comment after the error-taxonomy rename
- **api**: accept one-character values and show field errors on the form
- **forms**: enforce access and availability on custom form paths
- **tables**: accept deleted-by in the config validator
- **comments**: stop answering a rejected comment with 201 Created
- **tables**: answer database failures with the right status code
- **pages**: create records when constrained fields are left untouched
- **telemetry**: report the full error cause chain to stderr and the error backend
- **admin**: bound tables-overview query fan-out to one query per table

## [0.19.0](https://github.com/sovrium/sovrium/compare/v0.18.1...v0.19.0) (2026-07-25)

### BREAKING CHANGES

- **css**: delete the retired ramps, the humane role and the serif token
- **design**: rewrite the default token layer to the restrained language

### Features

- **admin**: add password recovery to the operator console sign-in
- **pages**: serve configured redirects as live HTTP redirects
- **automations**: reclaim aged temporary files from file actions
- **pages**: add redirects to app configuration

### Bug Fixes

- **auth**: point password-reset emails at a path the app actually serves
- **automations**: redact secrets from step output in run history
- **islands**: use role tokens, not frozen ramp steps, in the admin islands
- **css**: stop click animations colliding with Tailwind's pulse and bounce
- **command-palette**: render from theme tokens instead of inline hex
- **pages**: detokenize the shipped default pages
- **quality**: compare role-token values too, and fix the AA regression it found

## [0.18.1](https://github.com/sovrium/sovrium/compare/v0.18.0...v0.18.1) (2026-07-25)

### Bug Fixes

- **ai**: restore chat record queries and mutations on SQLite
- **admin**: correct record, submission and storage counts on the overview
- **observability**: preserve error status codes and keep secrets out of reports
- **observability**: export debug logs to OTLP when LOG_LEVEL=debug

## [0.18.0](https://github.com/sovrium/sovrium/compare/v0.17.0...v0.18.0) (2026-07-24)

### Features

- **cli**: document the observability-export env vars in .env.example
- **telemetry**: ship a dormant OTLP trace-export layer
- **telemetry**: sampled HTTP performance transactions
- **telemetry**: OTLP-HTTP structured log export (dual-write)
- **telemetry**: Sentry-protocol error reporting and startup banner
- **telemetry**: env-gated, default-off observability configuration

## [0.17.0](https://github.com/sovrium/sovrium/compare/v0.16.0...v0.17.0) (2026-07-21)

### Features

- **pages**: tab-root docs breadcrumb + contribution footer
- **pages**: syntax-highlight the code component via Shiki

### Bug Fixes

- **cli**: debounce watch-mode config reload to avoid partial-file reads
- **pages**: preserve author attributes on syntax-highlighted code blocks
- **db**: boot against existing Postgres data when a CHECK constraint tightens
- **db**: boot against an existing SQLite database on schema changes

## [0.16.0](https://github.com/sovrium/sovrium/compare/v0.15.2...v0.16.0) (2026-07-20)

### BREAKING CHANGES

- remove the cloud feature domain
- remove the agent-templates feature

### Features

- **pages**: name the demo notice and add one-click sign-in prefill
- **pages**: add an opt-in demo notice for instances published as demos
- **forms**: resolve $t: redirect urls, $record.<column> redirect vars, and embedded/hidden $query prefill

### Bug Fixes

- **tables**: build multi-select member CHECK on the option VALUE for object options
- bound admin overview roll-up latency and query cost to stop 504

## [0.15.2](https://github.com/sovrium/sovrium/compare/v0.15.1...v0.15.2) (2026-07-19)

### Bug Fixes

- **css**: emit arbitrary-var popup surfaces in the binary + cache-control policy

## [0.15.1](https://github.com/sovrium/sovrium/compare/v0.15.0...v0.15.1) (2026-07-18)

### Bug Fixes

- **migrations**: make dynamic-table schema re-init idempotent across upgrades (DEC-063)

## [0.15.0](https://github.com/sovrium/sovrium/compare/v0.14.0...v0.15.0) (2026-07-18)

### Bug Fixes

- **theming**: mint shadcn-convention alias utilities on the default theme (DEC-060)
- **tables**: admit anonymous read of read:all tables (DEC-059)
- **i18n**: localize the data-table create-record affordance (DEC-061)
- **server**: drop Hono context param from the empty-chunk stub helper
- **pages**: normalize colored status options for kanban group-by
- **build**: pad zero-byte island split chunks that broke production hydration

## [0.14.0](https://github.com/sovrium/sovrium/compare/v0.13.0...v0.14.0) (2026-07-17)

### Features

- navbar hover-to-open, authored trigger override, and child target/rel
- **cli**: scaffold init from remote GitHub template repositories
- **templates**: ship deploy + mirror files with every template
- **ai**: boot AI agents inert when no provider is configured (DEC-057)
- navbar badges, dropdown chevron, and inverted popup (DEC-056)
- **examples**: add automation-recipes and knowledge-base templates
- **examples**: add the company-os flagship template
- **website**: re-slice docs sub-nav into 8 product tabs + chrome polish
- **examples**: add people, events, assets, and expenses business apps
- **examples**: add projects, helpdesk, and content-calendar business apps
- serve contentDir.index at the collection base path (DEC-054)
- **pages**: shared component templates host interactive islands
- **website**: fuse a docs zone sub-nav under the top navbar
- add the "Built with Sovrium" badge with free one-line removal

### Bug Fixes

- navbar chevron inherits currentColor and rotates when the menu is open

## [0.13.0](https://github.com/sovrium/sovrium/compare/v0.12.1...v0.13.0) (2026-07-14)

### Features

- **server**: env-gated legacy-host → canonical-path 301 redirect

### Bug Fixes

- bound the automation email SMTP send so a slow gateway can't stall the request
- dedupe @codemirror/state so schema-editor islands hydrate
- add Better Auth 1.6.23 twoFactor columns (failedVerificationCount, lockedUntil)
- preserve per-route Content-Security-Policy for signed downloads
- **server**: serve public assets with correct Content-Type; enforce structural CSP
- **admin-login**: surface auth errors, fix cramped card padding, restore pointer cursor
- **tables**: split many-to-many fields on record update (CALENDAR-010/011/012)
- **tables**: admin-equivalent roles bypass field-level write permissions (CALENDAR-004/005)
- **database**: support a view-backed table that is also a rollup source
- **forms**: localize embedded forms per host locale + opt-in title heading level
- **pages**: localize the docs last-updated date value per active locale
- **pages**: drive the RSS feed channel identity from the rss page meta
- **automations**: provide PackageResolver to record-event code actions
- attribute record actions to the triggering user via runAs (DEC-049)
- **lookup**: preserve an explicit id on view-backed INSTEAD OF INSERT

## [0.12.1](https://github.com/sovrium/sovrium/compare/v0.12.0...v0.12.1) (2026-07-12)

### Bug Fixes

- **db**: restore released 0000 migration identity, undo illegal squash

## [0.12.0](https://github.com/sovrium/sovrium/compare/v0.11.0...v0.12.0) (2026-07-12)

### Features

- **pages**: add contentDir.editUrl + localize docs-article chrome (P13)
- per-page markdown export, copy/view-as-markdown, last-updated stamp
- **pages**: source RSS feed items from a markdown-file page
- render named empty-state region for system-bound charts
- honor chart props[aria-label] as the SVG accessible name
- **data-table**: render query-echoing no-match status distinct from empty state
- **pages**: wire inline-select-edit column action + custom-endpoint form submit
- **pages**: inline-select-edit column action + custom-endpoint form submit
- **file-upload**: wire upload-submission runtime + onSuccess/onError effects
- **pages**: file-upload submission + onSuccess effects (foundation, RED)
- **account**: pending-erasure returns the caller's email
- **gdpr**: pending-erasure read, relative-time column, download onSuccess effects
- **pages**: wire object-form confirm, session-bound text, onSuccess effects
- **pages**: add confirm-object, session-bound text, and action onSuccess status/refetch vocabularies
- **record-drawer**: compose the actions/role/renderAs trio with system bindings
- **record-drawer**: wire actions footer, configurable role/name, structured fields
- **record-drawer**: add actions slot, configurable role/name, structured field renderer
- **button**: wire standalone button fetch-action runtime (download + confirm gate)
- **button**: accept fetch actions + confirm-gate destructive fetches
- **admin**: convert connections directory to config data-table
- **action**: wire mode:oauth runtime in shared action-executor
- **data-table**: wire visibleWhen action gating + valueLabels render runtime
- **data-table**: add visibleWhen action gating and valueLabels column display map
- **admin**: rewire admin chrome to config-native command-palette + dropdown-menu (CAP-5 C3)
- **islands**: convert runs filter bar onto the config shared-filter binding — CAP-5 C2 admin
- **islands**: cross-component shared-filter binding (config sharedFilter/bindTo) — CAP-5 C2 generic
- **pages**: system-source catalog resolution via SSR desugar (CAP-4)
- **admin**: automation-run retry endpoint + config action (CAP-3)
- **islands**: data-users system actions via Better-Auth config fetch actions (CAP-3)
- **islands**: thread row record into data-table fetch-action dispatch
- **islands**: buckets file-row download via config mode:download action
- **islands**: action-executor download + navigate modes + GDPR export download
- **islands**: system operate action — core-mutate executor + GDPR erase/cancel conversion
- **islands**: wire page-level system single-record binding (CAP-2)
- **islands**: wire record-drawer system detail-endpoint binding (CAP-2)
- **islands**: wire CAP-2 system detail/single binding for record-field
- **islands**: wire CAP-1 system-source rows binding for list
- **islands**: wire CAP-1 system-source rows binding for data-timeline
- **islands**: wire CAP-1 system-source rows binding for calendar
- **islands**: wire CAP-1 system-source rows binding for kanban
- **islands**: wire CAP-1 system-source rows binding for gallery
- **chart**: add a system read-endpoint series data source binding
- **kpi**: add a system read-endpoint value-path data source binding
- **admin**: connect / reconnect / disconnect row actions on the connections directory
- **admin**: OAuth2 connect/callback/disconnect admin action endpoints
- **data-table**: add a permission-gated "Nouvel enregistrement" create flow to the data-table toolbar
- **admin**: sidebar global search UI grouped by type + record deep-link drawer
- **admin**: GET /api/admin/search global indexed search endpoint (dual-dialect FTS)
- **admin**: _admin_search_index dual-dialect migrations + SQLite FTS5 DDL
- **admin**: add dashboard overview at /_admin root
- **admin**: account page — identity card + "Mon compte" naming (Wave 3 F)
- **admin**: start a new agent conversation from the Conversations page (Wave 3 M)
- **admin**: admin bucket file-upload endpoint + wire the upload modal (Wave 3 N)
- **admin**: sidebar object toggles + automation/agent run filters (Wave 2 C+D)
- **admin**: Wave 1 dashboard IA + affordance polish (sidebar, profile menu, modals)
- **admin**: surface per-form analytics panel on the Soumissions selected-form page
- **admin**: add the App Connections data page to the operational console
- **admin**: add the Agents Conversations data page to the operational console
- **admin**: add the Buckets Files data page to the operational console
- **admin-dashboard**: Data-tab Statistiques page (page analytics)
- **admin-dashboard**: Data-tab Utilisateurs page (account directory)
- **admin**: rich config-list table — metadata columns, row actions, create/rename modals, per-item unpublished state
- **admin**: per-element config metadata, diff, rename-cascade + duplicate
- **admin-dashboard**: Data-tab Soumissions page (form submissions inbox)
- **admin-dashboard**: Data-tab Exécutions page (automation run history)
- **admin-dashboard**: Data-tab Enregistrements page (table records grid)
- **admin-dashboard**: top-level Config/Données sidebar tab + Data routing
- **admin-dashboard**: content-only (SPA) shell navigation
- **admin-dashboard**: cross-cutting a11y + responsive + parity (completes Tier 2)
- **admin-dashboard**: cross-cutting — search palette, operators, MCP connect, GDPR
- **admin-dashboard**: Tier 2f per-domain metrics backends + page edit history
- **admin-dashboard**: Tier 2b Tier-B CRUD + Tier 2d drift watcher/banner
- **admin-dashboard**: Tier 2e sandbox preview TTL + Aperçu lifecycle
- **admin-dashboard**: Tier 2c transport taxonomy + activity feed + versioning
- **admin-dashboard**: Tier 2a Agents dashboard + in-product chat (completes 2a)
- **admin-dashboard**: Tier 2a Theme + Languages + Env + Notifications
- **admin-dashboard**: Tier 2a Connections + Components + Actions + Scripts
- **admin-dashboard**: Tier 2a Forms + Auth + Buckets dashboards
- **admin-dashboard**: Tier 2a Pages + Automations dashboards
- **admin-dashboard**: Tier 2a Tables domain dashboard (tables + tables-data)
- **admin-dashboard**: Tier 2 fidelity foundation + spec reconciliation + fixes
- **admin-dashboard**: Tier 1 editing surfaces — shell, editor, publish, login (MVP)
- **admin-dashboard**: Tier 0 foundations + /_admin/login spec
- **pages**: config-driven docs nav-section icons (contentDir.nav.groupIcons)
- **docs**: redesign docs navigation, Welcome page, and install guide

### Bug Fixes

- **tables**: don't run view-backed id resolution on composite-key tables
- **tables**: correct DEC-048 many-to-many types and clear batch-3 quality drift
- complete m2m-on-create for view-backed tables and the form path (DEC-048)
- split many-to-many fields on record create and resolve them on read (DEC-048)
- view-backed insert applies base DEFAULTs and returns the real id (DEC-047)
- **comments**: opt-in per-user comment read/unread state (DEC-045)
- **theme**: raise --sv-fg-subtle to WCAG AA contrast in light and dark
- **pages**: render the default 404/500 pages with theme tokens
- exclude soft-deleted child rows from rollup and count aggregates
- apply admin-equivalent override to field-level read filtering
- enforce permissions.comment server-side (DEC-046)
- **pages**: emit absolute hreflang alternates sharing the canonical origin
- hide role-gated embedded form references
- **tables**: resolved top custom role bypasses row-level scoping (GAP #1)
- clamp cron setTimeout delay to avoid 32-bit overflow busy-loop
- **auth**: route every admin-tier guard through one isAdminTier predicate
- **connections**: resolve $env.VAR in oauth2 props before the provider flow
- admit custom top-role operators to OpenAPI docs endpoints
- **tables**: make user-preferences + saved-views repos dialect-aware (SQLite 500)
- **admin**: render typed create-form controls in the record grid
- **ai**: make Ollama agent chat work out of the box (no API key)
- **account**: make GDPR self-service export work on the SQLite default
- **build**: stop license script from double-stamping generated CSS assets
- **auth**: exclude agent service users from admin-bootstrap preconditions
- **admin**: diff against effective baseline (published-else-booted)
- **security**: tolerate attribute/junk HTML end tags in search-index regexes

## [0.11.0](https://github.com/sovrium/sovrium/compare/v0.10.0...v0.11.0) (2026-06-17)

### Features

- RAG Phase 2 — opt-in sqlite-vec ANN + FTS5 hybrid retrieval (DEC-029)
- **pages**: alert-dialog confirm dispatches its configured automation action (DEC-037)
- **automations**: approval action pauses run, resolves via run-scoped approve/reject (DEC-037)
- record-context submit fields for schema-config editors
- hydrate reverse one-to-many collections in record-trigger envelope (GAP-J2)
- docs-article breadcrumb + "View as Markdown" header
- implement tail-logs host effect for host log drain
- icon variant for theme-toggle component
- TOC scroll-spy + prose spacing fixes for docs markdown
- collapsible docs sidebar via contentDir.nav.collapsed
- content-body search with highlighted excerpts in command palette
- add commandPalette opt-out to AppSchema
- **pages,forms,automations**: KPI SSR label, $record prefill, relationship hydration, validate-config (Clusters I+J)
- **apps/docs**: adopt groupLabels, JSON-LD synthesis, generated llms.txt, theme toggle with light mode
- **theming**: theme-toggle component, theme.colorScheme, no-FOUC color-scheme head script
- **seo**: auto-generate /llms.txt and /llms-full.txt from contentDir pages
- **seo**: auto-synthesize TechArticle + BreadcrumbList JSON-LD for contentDir pages
- **pages**: contentDir nav groupLabels + humanize, skip link, code-copy button
- **automations,tables**: comment-thread email recipients + composite row-level predicates (Cluster E)
- **pages**: read-only record-field display + dialog mounts closed (platform gap Cluster D)
- **islands**: structured-form & AI-agent schema-config editors (platform gap B10)
- **automations**: host env-var injection with secret resolution (platform gap B9)
- **automations**: per-app resource-quota registry (platform gap B5)
- **automations**: reverse-proxy ingress + custom-domain TLS (platform gap B4)
- **automations**: multi-version process supervisor registry (platform gap B2)
- **automations**: per-tenant database provisioning registry (platform gap B3)
- **automations**: cloud orchestration action handler (platform gap B1)
- **islands**: JSON & YAML schema-config editors (platform gap B10)
- **auth**: role-aware login landing (onSuccess role-landing)
- **forms**: configurable/localizable CRUD labels + dialog formRef

### Bug Fixes

- resolve ESLint issues from the docs UX-fix campaign
- do not force inline display:inline-block on image elements
- **css**: apply precompiled-file gate in production CSS branch
- **forms,partner**: visibility-gated formRefs don't 404 the page — resolve FORMS-017
- **automations**: hydrated record fields stringify as their FK id
- **pages,forms**: automation/logout buttons + embedded-form runtime (Cluster H)
- **auth**: respect display:none hide-gate on full-width auth-form wrapper
- **seo**: recognize hardcoded-language page paths in sitemap and hreflang alternates
- **automations**: hydrate USER fields in record-event trigger envelope (Cluster G2 / GAP-20)
- **seo**: synthesize canonical, hreflang alternates, and Open Graph meta for contentDir pages
- **seo**: expand contentDir pages in sitemap + index them in command-search
- **automations**: http JSON response body + comment owner-fallback custom created-by (Cluster G1)
- **pages**: 301-redirect bare /:lang and return real 404 for unknown contentDir slugs
- **records,forms**: records-API custom created-by + form-create fires record automations (Cluster F)
- **records**: narrow readonly write-reject to truly-computed types (Cluster B follow-up)
- **automations,tables**: filter OR logic + cron run-now + formula int-division CAST (Cluster C)
- **automations,records**: connection $env. resolution + overridable field defaults (Cluster B)
- **records**: authorship for automation + form record writes (platform gap Cluster A)
- **security**: SSRF-guard file:upload action source resolution (Finding #8)
- **tables**: single-record GET row-level read 404'd users on their own id-scoped record
- remediate 7 security findings (AI-SQL, SVG XSS, NODE_ENV coupling, fail-closed, committed secrets)
- restore Partner app boot + branded accept-invitation page
- **db**: emit ISO-8601 timestamps for SQLite auto-timestamp defaults
- resolve raw $t: tokens in Twitter card meta tags
- **ui**: correct docs markdown layout and polish the docs site
- **auth**: render auth form full-width to match design-system auth layout
- **docs**: correct markdown locale, empty article body, and frontmatter meta
- **auth**: treat the highest-level role as admin-equivalent
- **css**: honor string-valued flex/grid layout props
- exclude non-FK relationship edges from table-creation dependency sort
- compute view-only-referencing formulas in the VIEW (rollup/lookup/count)
- resolve relationship FK column type from referenced table's primary key

## [0.10.0](https://github.com/sovrium/sovrium/compare/v0.9.0...v0.10.0) (2026-06-02)

### Features

- AI-compute async refinement via real provider on both engines
- AI-compute deterministic baseline on both engines + two-phase scaffolding
- RAG works on SQLite via BLOB embeddings + app-side cosine
- **comments**: filter non-admin comment list to approved-only (APP-PAGES-PUBLIC-COMMENTS-019)
- **comments**: persist resolved moderation status on create (APP-PAGES-PUBLIC-COMMENTS-027)
- **comments**: surface guest name in comment thread (APP-PAGES-PUBLIC-COMMENTS-006)
- **comments**: persist guest identity on comment create (APP-PAGES-PUBLIC-COMMENTS-005)

### Bug Fixes

- map numeric precision to SQL scale, not total digits (#15)
- defer FK enforcement during SQLite schema-migration transaction
- align SQLite field-value serialization with Postgres (DEC-027)
- emit ISO-8601 timestamps from SQLite updated_at trigger
- **types**: export DeleteViewTarget so @sovrium/types .d.ts emit succeeds
- harden email validation and HTML-tag regexes flagged by CodeQL
- **css**: compile per-app CSS under ECO_DESIGN_LAYER=off (light parity)
- **css**: serve per-app CSS when app adds candidates beyond builtin
- **comments**: persist pending/rejected comments so admin queue lists them (APP-PAGES-PUBLIC-COMMENTS-020)

## [0.9.0](https://github.com/sovrium/sovrium/compare/v0.8.1...v0.9.0) (2026-05-31)

### Features

- **infrastructure**: implement user-view + user-table-preferences repository live layers
- **application**: define UserViewRepository + UserTablePreferencesRepository ports
- **api**: add sliding-window rate-limiter for /api/shared-views/*
- **auth**: hydrate SessionInfo.effectiveRoles in session-context resolution
- **domain**: add Zod response schemas for user-views + user-table-preferences
- **application**: extract user-table-preferences use-cases as Effect programs
- **application**: extract user-views use-cases as Effect programs
- **account**: emit account.deletion.scheduled + purged audit events
- **infrastructure**: add Drizzle-backed audit-log store with dual-dialect helpers
- **api**: add audit-log action-catalog entries for account.deletion.scheduled + purged
- **db**: drizzle migrations restoring audit_log for PG + SQLite
- **domain**: add audit-log Drizzle schema for PG + SQLite (Phase 8 Cycle 1a — design)
- **api**: validate PATCH bodies for user-table-preferences + user-views
- **domain**: add Zod PATCH schemas for user-prefs + user-views
- **design-system**: Phase 5 contract proof — drift gate + smoke tests + ECO_DESIGN_LAYER env var
- **design-system**: add + prestyle read-only cell renderers (user/relational/status/formula/geolocation/count/json/array/code)
- **runtime-views**: APP-RUNTIME-VIEWS-026 + regression — 404 for cross-table share
- **design-system**: prestyle field-type affordances (rating/currency/percentage/color/attachments) with var-fallback recipe
- **runtime-views**: APP-RUNTIME-VIEWS-024..025 — URL contract + shared-view lookup
- **design-system**: prestyle specialty + ai surfaces (comments/lang-switcher/reorderable-list/time-picker/ai-chat) with var-fallback recipe
- **runtime-views**: APP-RUNTIME-VIEWS-023 — Share button generates view link
- **design-system**: prestyle interactive + content surfaces (link/button-group/icon/image/iframe/audio/video/search) with var-fallback recipe
- **design-system**: prestyle display surfaces (carousel/empty-state/list-item/scroll-area/speech-bubble/static-table/timeline) with var-fallback recipe
- **runtime-views**: drain remaining save-personal-views + cycle-4 deferred fixmes
- **runtime-views**: wire saved-views surface for APP-RUNTIME-VIEWS-016
- **data-table**: runtime group-by picker + collapsible groups (APP-RUNTIME-VIEWS-032/033/034)
- **design-system**: prestyle typography (heading/paragraph/code/blockquote/list) with var-fallback recipe
- **design-system**: prestyle data surfaces (data-table chrome + kanban + chart shells) with var-fallback recipe
- **pages**: PG-03 APP-RUNTIME-VIEWS-009/011/SORT-REGRESSION — runtime multi-sort + view switcher
- **design-system**: prestyle form surfaces (form-card + file-upload dropzone) with var-fallback recipe
- **design-system**: prestyle layout surfaces (card + divider) with var-fallback recipe
- **pages**: PG-03 APP-RUNTIME-VIEWS-001..007 — runtime filter builder
- **design-system**: prestyle navigation surfaces (breadcrumb/pagination) with var-fallback recipe
- **design-system**: prestyle feedback surfaces (badge/alert/skeleton/progress) with var-fallback recipe
- **pages**: PG-03 APP-RUNTIME-VIEWS-028..031 — user table preferences runtime
- **design-system**: prestyle tabs + accordion islands with var-fallback recipe
- **design-system**: prestyle overlay islands (dialog/popover/tooltip/drawer/menu) with var-fallback recipe
- **design-system**: prestyle date-picker islands with var-fallback recipe
- **design-system**: prestyle numeric islands (number-input, slider) with var-fallback recipe
- **design-system**: prestyle toggle/switch/toggle-group islands with var-fallback recipe
- **design-system**: prestyle select island with var-fallback recipe
- **design-system**: prestyle input renderer with state defaults
- **design-system**: prestyle button-renderer with variant/size/state defaults
- **pages**: PG-04 PATTERN-REGRESSION — tabs renders React children + nested forms get collection record
- **design-system**: land DEC-026 prestyled-default contract + css-var helper
- **pages**: PG-04 APP-PAGES-RECORD-DETAIL-011 + DRAWER-REGRESSION — drawer save closes + sibling table refreshes
- **pages**: PG-02 guest-comment storage + inline form runtime
- **pages**: PG-02 single-level threading — reply UI + collection auto-bind + API depth check
- **pages**: PG-04 APP-PAGES-RECORD-DETAIL-005 — synthesized CRUD update obeys table-update perms
- **data-components**: PG-03 sort-direction indicator (APP-RUNTIME-VIEWS-010)
- **pages**: CA-01 APP-PAGES-CONTENT-013 — alert dismissibility via event-delegated toggle
- **data-components**: PG-03 column-visibility drag-reorder (drain 2)
- **pages**: PG-04 record-detail composition — tabs / openDrawer dispatch / data-form alias / CRUD synthesis (drain 5)
- **pages**: PG-02 moderation pipeline — manual queue + autoApprove + PATCH-status + auth-required (drain 11)
- **css**: ship Source Serif 4 italic via inline @font-face
- **pages**: PG-02 spam guards — rate-limit + link-threshold + blocked-words + guest-comment auth-exemption (drain 9)
- **automations**: wire comment trigger to fire on approved comments (drain 4)
- **pages**: thread session into comment-thread island props (drain 14)
- **pages**: page-search client island — interactive results UX (US-PAGES-PUBLIC-SEARCH-009)
- **pages**: PG-01 — comment thread + count hydration islands (drain 7)
- **pages**: PG-01/PG-02 — SSR comment form skeleton + honeypot + schema foundation (drain 12)
- **pages**: pageSearch SSR placeholder + renderer dispatch (US-PAGES-PUBLIC-SEARCH-001)
- **pages**: pre-boot search-index generation for sovrium start (US-PAGES-PUBLIC-SEARCH-004)
- **pages**: data-sovrium-search-body marker + indexer narrowing (US-PAGES-PUBLIC-SEARCH-007)
- **pages**: Sovrium-native search indexer (US-PAGES-PUBLIC-SEARCH-002)
- **pages**: PG-03 schema+routes foundation — user_saved_views + user_table_preferences (DEC-017)
- **pages**: activation gate predicate + build-path stub (US-PAGES-PUBLIC-SEARCH-003)
- **forms**: F-04 — admin analytics & responses dashboard + drain 11 specs
- **sovrium**: fix 5-bug cluster from sovrium-partner consumer-app
- **pages**: close static-build access leak (US-PAGES-PUBLIC-SEARCH-008)
- **pages**: pageSearch component schema stub + spec corpus (US-PAGES-PUBLIC-SEARCH-001..008)
- **pages**: PG-04 schema prep — OpenDrawerActionSchema + 10 narrowing fixes
- **forms**: F-03 — anti-spam rate-limit + IP hash-on-write + drain 6 specs
- **buckets**: B-01 — attachment field signed-URL enrichment + drain 6 specs
- **schema**: API-1 — schema_prune retention resolver + REST handler + MCP tool + drain 2 specs
- **automations**: AU-03 — auth-event dispatch bridge + drain 3 specs
- **automations**: AU-02 — concurrency scheduler + cancel-mid-flight + drain 2 specs
- **cli**: CLI-LOG-OUTPUT-010/011/012 — quiet better-auth verifier + admin display in banner
- **cli**: C-01 — reload versioning + drift detection (DEC-023) + drain 6 specs
- **admin**: ADM-1 — GET /api/admin/users/overview endpoint + drain 6 specs
- **pages**: P-05 — text component markdown rendering + drain 6 specs
- **pages**: P-06 — TOC renderer (auto-anchor headings, sticky nav) + drain 5 specs
- **pages**: P-07 — add FetchActionSchema + drain 6 toast specs
- **cli**: scaffold public/ in init for web-facing templates
- **infra**: harden setupPublicDirRoute with realpath + secret-blocklist
- **cli**: default --publicDir to <app.yaml dir>/public with opt-out flag
- **pages**: APP-PAGES-TWITTER-APP-REGRESSION — add appUrl deep-link metadata to TwitterCardSchema
- **automations**: RUNS-004 filter halts surface as run.status='skipped' (+ remove fossilized RUNS-011)

### Bug Fixes

- **comments**: return genuine 404 for missing records instead of synthesized envelopes
- **comments**: strip commenter email from comment + record-history APIs
- **islands**: make data-table skeleton rows inert during loading
- **cli**: init scaffolding is additive — never clobbers existing public/ files
- **islands**: restore canonical primary/overlay tokens on form-control + scroll-area islands
- **theme**: destructive button/badge use destructive token, not primary
- **design-system**: F7 hover-card locator + F12 comment-thread Q1/Q2a chrome
- **specs**: APP_SCHEMA_FILE env var for schemas exceeding ARG_MAX
- **css**: safelist runtime-template-literal arbitrary classes (bg-[var(--sv-*,…)])
- **database**: reset getDb() memo to isolate DATABASE_URL-pinning tests
- **audit-log**: silence expected missing-table warning on boot reset
- **auth**: guard set-role update hook against null user for non-existent target
- **cli**: stop sovrium build aborting on a missing publicDir + restore CSS-path log
- **rendering**: guard TOC resolver walkers against string children
- **design-system**: break --sv-bg* cycle so light-mode primary buttons render readable text
- **design-system**: wire V1_ALIAS_BRIDGE for prestyled override channel + document layer-off outlier
- **islands**: generalise operator-vocabulary bridge in evaluatePredicate
- **islands**: bridge UI/API/domain operator vocabularies for is-any-of/is-none-of
- **css**: boost dark cascade specificity to defeat trailing :root rules
- **css**: safelist font-serif so the v1 grace-note utility survives
- **css**: switch Source Serif @font-face to format('woff2')
- **css**: use :is() instead of :where() for dark-mode root cascade
- **css,design-system**: safelist dynamic Tailwind patterns + theme-aware section backgrounds
- **automations**: AU-01 — single-encode jsonb state writes + drain 4 specs
- **cli**: admin create works bare; bootstrap token in startup banner

## [0.8.1](https://github.com/sovrium/sovrium/compare/v0.8.0...v0.8.1) (2026-05-25)

### Bug Fixes

- **database**: MIGRATION-CHECKSUM-VIEW-DRIFT-001 — preserve auto-generated lookup views across boots

## [0.8.0](https://github.com/sovrium/sovrium/compare/v0.7.2...v0.8.0) (2026-05-25)

### Features

- **database**: emit SQLite INSTEAD OF triggers for view-backed tables
- **database**: align SQLite dynamic-table default id to INTEGER (ADR-016)
- **pages-social**: add comments + commentCount page components (SSR scaffolding tier)
- **admin-automations**: drain overview.spec.ts (8 fixmes → GREEN)
- **data-components**: drain runtime-sort-configuration — APP-RUNTIME-VIEWS-008 + a11y polish
- **data-components**: drain runtime-column-visibility — APP-RUNTIME-VIEWS-012/014/015
- **data-components**: drain related-records-display — APP-PAGES-RECORD-DETAIL-013..016
- **data-components**: drain record-header-breadcrumb — APP-PAGES-RECORD-DETAIL-006..008
- **data-components**: drain form-reset-after-success — APP-PAGES-FORM-062
- **pages-layout**: drain divider-spacer specs — divider + spacer renderer bodies
- **pages-layout**: drain divider-spacer — add divider + spacer renderers (HR with style/label, sized div spacer); rename structural-components.ts to .tsx for JSX
- **pages-layout**: drain basic-app-shell + app-shell-sidebar — honor navigation-menu className for vertical layout
- **pages-layout**: drain sidebar-navigation-items + blockquote — add renderBlockquote + use aside-element for sidebar
- **admin-forms**: drain admin/forms — list/detail + submissions list/detail/bulk
- **ecoconception**: drain low-data-mode — operator-controlled render variant
- **ecoconception**: drain dashboard-overview — GET /api/admin/eco/overview
- **admin-buckets**: drain ADMIN-BUCKETS-LIST + OVERVIEW (16 of 17 GREEN)
- **form-controls**: drain field-composed-form-field specs
- **form-controls**: drain date-picker specs
- **form-controls**: drain slider + switch + checkbox + radio-group specs
- **form-controls**: drain combobox specs
- **form-controls**: drain time-picker + number-input specs
- **form-controls**: drain dropzone-file-upload + label specs
- **cli**: drain CLI-COMMANDS-AGENTS-001..006 + REGRESSION
- **cli**: drain CLI-COMMANDS-HELP-001..005 + REGRESSION
- **admin**: drain ADMIN-CONFIG-VERSION + ADMIN-TABLES-OVERVIEW
- **forms**: drain APP-FORMS-088/090/091/093 — partner role, defaultValue, formRef gates
- **forms**: drain APP-FORMS-109 — availability.closedPage schema
- **pages-overlays**: add hover-card island + drain OVERLAY-029..034 + REGRESSION
- **pages-overlays**: wire drawer island hydration + drain DRAWER-001..004 + REGRESSION
- **pages-navigation**: drain dropdown-menu — render icons + fix top-level schema field pickup
- **pages-navigation**: drain split-button — register dropdown-menu/context-menu as island types
- **bootstrap**: drain APP-SCHEMA-BOOTSTRAP-001..011 + REGRESSION

### Bug Fixes

- **realtime**: dedup presence-sync by user.id, make leave connection-aware
- **cli**: honor --help on update command (CLI-COMMANDS-UPDATE-001)
- **forms**: coerce scalar values to arrays for multi-select column inserts (APP-FORMS-INLINE-CREATE-001)
- **cli**: short-circuit start --help to prevent watch-mode hang (CLI-COMMANDS-START-005)
- **server**: make SIGUSR1 reload atomic with readFileSync (CLI-SERVER-015)
- **tables**: resolve FK column via reciprocalField in rollup and count generators
- **admin**: consolidate audit-log store — route bucket emits through emitAuditEvent
- **admin**: tighten audit-log schema + emit nextCursor: null (Wave 3 merge)
- **admin**: reconcile Lane A + Lane B audit-log keystone merge (Wave 3)
- **pages-overlays**: import pickCompField — Wave 2 Lane B/C merge interaction bug

## [0.7.2](https://github.com/sovrium/sovrium/compare/v0.7.1...v0.7.2) (2026-05-24)

### Features

- **i18n**: drain US-I18N-MULTI-LANGUAGE-APPS-REGRESSION
- **ai**: drain APP-AI-CHAT-STREAM-010 via truncate-mode mock seed
- **api**: drain mcp-schema-tools.spec — wire 7 MCP parity tools + family catalog (partial)
- **api**: drain fileenv-launch-seeds-the-version-ledger.spec — DEC-023 boot-time auto-seed

### Bug Fixes

- **islands**: set data-island-ready after Suspense resolves so spec gates see hydrated DOM

## [0.7.1](https://github.com/sovrium/sovrium/compare/v0.7.0...v0.7.1) (2026-05-24)

### Bug Fixes

- **database**: close schema-persistence + lookup-VIEW + webhook-log + ILIKE + JSONB-increment + user_access + CSS-resolver dialect leaks on SQLite
- **database**: close CHECK-constraint + DROP-CASCADE dialect leaks on SQLite
- **database**: make user-field FK constraint dialect-aware (auth.user vs auth_user)

## [0.7.0](https://github.com/sovrium/sovrium/compare/v0.6.2...v0.7.0) (2026-05-24)

### BREAKING CHANGES

- **admin**: remove audit-log feature

### Features

- **pages/navigation**: add triggerLabel to dropdown-menu schema + island
- **pages/overlays**: dialog component-type + alert-dialog branch — APP-PAGES-DIALOG-001..005 + ALERTDIALOG-001..004 + REGRESSIONs
- **pages/display**: badge status-indicator variant — APP-PAGES-STATUSINDICATOR-001/002/REGRESSION
- **pages**: code-block component + landmine rest of layout (CONTENT-006..009)
- **pages**: activate skeleton + progress specs (OVERLAY-035..042, OVERLAY-043..049)
- **pages**: button-group + pagination components (NAVCOMP-BUTTON-GROUP-001..003, PAGINATION-001..003)
- **pages**: implement breadcrumb component (APP-PAGES-NAVCOMP-BREADCRUMB-001..003)
- **pages**: wire tooltip island hydration (APP-PAGES-TOOLTIP-001,003)
- link global stylesheet from form-page <head> + landmine markers for embedding specs
- schema diff + export admin endpoints (APP-SCHEMA-DRIFT-008..012 + REGRESSION)
- implement APP-FORMS-094,095,098 — SSR honeypot rendering + spam isolation
- X-Sovrium-Config header surfaces driftStatus (APP-SCHEMA-DRIFT-005 + REGRESSION)
- **automations**: protect standard OAuth2 params from extraAuthParams/extraTokenParams override
- implement APP-FORMS-087,089,092 — form access control gate + submitter id capture
- **automations**: implement record/upsert action operator
- surface driftStatus + source in schema status (APP-SCHEMA-DRIFT-001..004,006,007)
- **pages**: wire popover island hydration + trigger/content (APP-PAGES-POPOVER-001..003)
- draft rebase endpoint (REST + MCP) — APP-DRAFT-STALENESS-008..014
- **automations**: implement record/delete action operator
- implement APP-FORMS-110,113 — embed route gating + frame-ancestors CSP
- **pages**: video embed auto-conversion, track subtitles, autoplay mapping (APP-PAGES-MEDIA-009..015)
- **automations**: HMAC-sign outgoing webhook payloads with props.secret
- implement APP-FORMS-103..108 — form availability windows, atomic submission cap, honeypot anti-spam
- expose draftStale in schema status envelope (APP-DRAFT-STALENESS-001..007)
- **automations**: expose step outputs under .result alias for chaining
- **pages**: implement list search-first display (APP-SEARCH-LIST-001..005)
- implement APP-FORMS-134,135,136,138,139 — single-page form field groups
- implement APP-FORMS-128..133 — per-form display overrides
- implement calendar + kanban component search bars
- implement APP-FORMS-146,148,149,150 — standalone form prefill resolution
- implement progress + skeleton feedback components
- implement APP-PAGES-SITEMAP-001..010 — runtime /sitemap.xml + /robots.txt
- implement APP-FORMS-140..143 — form $t: resolution against app catalog
- implement APP-BUCKETS-SIGNED-URLS-024..029 — signed URL API endpoint auth + Content-Disposition

### Bug Fixes

- **account**: complete audit_log writer + protection removal (post a76f3608c)
- **observability**: emit namespaced [<domain>] console.error on 500 paths across 12 api/routes files
- **database**: add 7 Better-Auth dialect-schema selectors + 3 aggregate-cast helpers; sweep 18+4 PG-only call sites
- **theming**: finish bg/fg → background/foreground token rename in 3 missed files
- **analytics**: wrap event properties in jsonbLiteral to restore JSONB object storage
- **observability**: namespace-log 500 paths in webhook + analytics + activity routes
- **database**: close analytics + activity-log PG-isms via dialect-aware SQL helpers
- **automations**: embed TypeScript lib.d.ts in compiled binary for runTypescript validator
- **database**: route 21 repositories through dialect-aware schema resolver
- **pages**: tooltip island registry reads tooltipContent from rawProps fallback

## [0.6.2](https://github.com/sovrium/sovrium/compare/v0.6.1...v0.6.2) (2026-05-23)

_No user-facing changes in this release._

## [0.6.1](https://github.com/sovrium/sovrium/compare/v0.6.0...v0.6.1) (2026-05-23)

_No user-facing changes in this release._

## [0.6.0](https://github.com/sovrium/sovrium/compare/v0.5.3...v0.6.0) (2026-05-22)

### Features

- **cli**: add 3 starter templates + auto-install paired agent on init
- **cli**: array-element $ref resolves full-object-per-file (CLI-MULTIFILE-017..024)
- **markdown-pages**: emit code-block theme name in compiled CSS (cluster 6)
- **markdown-pages**: collection nav + docs prev/next + 'none' layout (cluster 5)
- **markdown-pages**: $t: i18n interpolation in body (cluster 4)
- **markdown-pages**: :::container::: directives -> SSR components (cluster 3)
- **markdown-pages**: Shiki SSR code highlighting (cluster 2)
- **markdown-pages**: GFM rendering via markdown-it (cluster 1)
- **markdown-pages**: scaffold schema + RED specs for rich markdown website
- **cli**: add 'admin create' + 'secret generate', document env in --help, scaffold .env.example
- **cli**: support TypeScript config files in build/schema loading
- **cli**: scaffold .gitignore + Sovrium-guide CLAUDE.md in `sovrium init`
- **server**: consolidate runtime artifacts under ./.sovrium/ data dir
- **cli**: serve static-asset directory + live SEO routes from `sovrium start`
- **dev**: inject dev live-reload script, absent in production
- **dev**: GET /__sovrium_dev/reload SSE endpoint
- **dev**: rebuild client + island bundles in dev (skip memo)
- **dev**: SOVRIUM_DEV_NO_CACHE bypass for CSS + page caches

### Bug Fixes

- **palette**: close the navigate-then-reopen race in the command palette
- **theme**: de-cycle --sv-fg fallback chain so zero-config tooltip renders
- **database**: make Better Auth validators dialect-aware (SQLite + Postgres)
- **markdown-pages**: preserve javascript:/data: links as href="#" sentinel
- **server**: warn about disabled email only when the config needs it
- **server**: stop NODE_ENV=development leaking dev behavior into test servers
- **cli**: gate dev-mode security warnings + quiet migration logs + add Mode banner phase
- **server**: keep the same port on watch reload, never silent port-0
- **cli**: clear CSS + page caches on watch reload
- **css**: include className candidate set in CSS cache key
- **cli**: qualify Homebrew formula as sovrium/tap/sovrium in update command
- **cli**: qualify Homebrew formula as sovrium/tap/sovrium in update command

### Performance Improvements

- **markdown**: extract content-dir filter helper + skip render probe in filter path

## [0.5.3](https://github.com/sovrium/sovrium/compare/v0.5.2...v0.5.3) (2026-05-22)

### Bug Fixes

- **assets**: exclude .ts examples from the embedded manifest
- **types**: fix declaration-emit errors blocking the release build
- **cli**: serve agents + init examples from embedded manifest
- **assets**: embed client/island/script bundles in the compiled binary
- **migrations**: embed drizzle migrations in the compiled binary
- **openapi**: resolve Sovrium version from build-time define in binaries

## [0.5.2](https://github.com/sovrium/sovrium/compare/v0.5.1...v0.5.2) (2026-05-21)

_No user-facing changes in this release._

## [0.5.1](https://github.com/sovrium/sovrium/compare/v0.5.0...v0.5.1) (2026-05-21)

### BREAKING CHANGES

- configure SQLite path via DATABASE_URL file: scheme, remove SQLITE_PATH

### Features

- **cli**: make `sovrium update` work regardless of install source

### Bug Fixes

- **cli**: repair Linux Homebrew/curl install + Scoop checksum

## [0.5.0](https://github.com/sovrium/sovrium/compare/v0.4.10...v0.5.0) (2026-05-21)

### Features

- **eslint**: ban literal palette colors in islands (design-system token guardrail)
- **css**: add mode-invariant scrim token for modal backdrops
- **api**: apply additive schema migrations live on publish (no restart)
- **islands**: add cn() class-merge primitive with canonical token groups
- **css**: inject design-system v1 as default token layer
- **eco**: wire ECO_IMAGE_FORMAT env var per standing rule R1
- **presentation**: add Effect.Stream → SSE bridge utility
- **pages,ai**: activate toast actions, agent tool-calling, agent RAG memory
- **automations**: activate file-action handlers (compress/extract-text/transform-image/generatePdf)
- add static page-output cache (ECO_PAGE_CACHE)
- **records-api**: real-time connection-status indicator
- **records-api**: real-time presence awareness
- **records-api**: real-time conflict detection + reconciliation
- **database**: close sqlite records-api + form + version + bootstrap gaps
- **records-api**: WebSocket transport for real-time subscriptions
- **records-api**: live SSE change-event delivery + subscription filtering
- **records-api**: data-table poll-mode auto-refresh
- **server**: boot with sqlite as default database
- **auth**: support sqlite provider in better-auth
- **database**: graceful degradation for sqlite mode
- **database**: sqlite dynamic-table ddl executor
- **database**: dialect-aware records crud callsite migration
- **records-api**: extend realtime API schemas for change/conflict/presence/transport
- **database**: dialect-aware ddl type mapping and literals
- **database**: dialect-aware raw-sql executor and introspection
- **database**: dual-dialect drizzle client
- **database**: dialect-aware drizzle-kit config
- **database**: add sqlite-core schema mirror
- **database**: add database dialect resolver

### Bug Fixes

- enforce S1 anti-enumeration + close RAG/validation/form gaps
- **css**: resolve zero-config island theming rendering unstyled surfaces
- **css**: emit hardcoded red palette via @theme static for dev/binary parity
- **css**: stop CSS compiler OOM from self-amplifying candidate scan
- **islands**: hydrate dialog/alert-dialog on standalone pages
- **css**: satisfy lint on default-theme-layer size + cn() test
- **autosave**: preserve pre-hydration form values + relax debounce wait
- **s1**: refine Better Auth 403→404 rewrite + align legacy specs
- **schema**: include source + fileChecksum in get-version projection
- **s1**: collapse remaining 403 sites in delete/read/comment handlers
- **auth**: collapse Better Auth admin/org 403 to 404 (S1)
- **s1**: return 404 for all unauthorized access — anti-enumeration
- **merge**: resolve post-merge ESLint nits
- **database**: close residual sqlite boot-path + schema-checksum gaps
- **pages**: repair post-merge regressions from drain branch merges

## [0.4.10](https://github.com/sovrium/sovrium/compare/v0.4.9...v0.4.10) (2026-05-18)

### Bug Fixes

- **server**: use a tagged error in validateStoragePublicAccessEnv

## [0.4.9](https://github.com/sovrium/sovrium/compare/v0.4.8...v0.4.9) (2026-05-18)

### Features

- **pages**: data-timeline component basic view
- **pages**: command palette quick actions
- **buckets**: public/private file access toggle
- **pages**: global command palette activation
- **buckets**: signed upload URLs with PUT serve path
- **records-api**: subscription handshake route alias
- **pages**: KPI grid layout with sparklines and thresholds
- **records-api**: real-time connection management specs
- **pages**: KPI card data component
- **pages**: cross-table search in command palette
- **records-api**: poll-mode interval validation
- **pages**: paste spreadsheet rows with type-mismatch flagging + undo
- **buckets**: single signed-URL endpoint with bucket RBAC
- **records-api**: data-source refreshMode configuration
- **pages**: form successPage onSuccess response
- **pages**: clipboard paste preview with column mapping
- **buckets**: batch signed-URL generation
- **pages**: copy data-table rows/cells to clipboard
- **buckets**: image transform LRU cache with ETag/304 support
- **tables**: real-time subscription SSE endpoint
- **pages**: auto-save status indicator (inline/toast/toolbar positions)
- **buckets**: named thumbnail preset transforms
- **buckets**: image quality (compression) transform parameter
- **tables**: webhook payload customization
- **pages**: file-upload form fields with thumbnails, limits, storage refs
- **pages**: auto-save saveMode configuration (auto/onBlur/manual)
- **tables**: webhook test endpoint with sample payload
- **pages**: form validation feedback — inline errors, summary banner, toasts
- **pages**: favorites + recent items in command palette
- **buckets**: original image preservation guarantees
- **tables**: webhook automatic retry policy with backoff
- **pages**: inline multi-step wizard layout with per-step validation
- **pages**: per-user favorite records with auto-injected star toggle
- **buckets**: on-the-fly image resize with dimension range validation
- **tables**: webhook delivery logs with history, filter, retry
- **pages**: form reset-after-success with preserveFields + wizard reset
- **pages**: reorderable-list component with keyboard reorder
- **buckets**: image format conversion + Accept-header negotiation
- **buckets**: image-transform crop modes (APP-BUCKETS-TRANSFORMS-023..028 + REGRESSION)
- **tables**: webhook authentication (APP-TABLES-WEBHOOKS-011..018 + REGRESSION)
- **buckets**: advanced bucket features + storage env validation (APP-BUCKETS-ADVANCED-001..004 + REGRESSION)
- **tables**: per-table outgoing webhooks (APP-TABLES-WEBHOOKS-001..010 + REGRESSION)
- **pages**: data-chart series styling (APP-PAGES-CHART-012..016 + REGRESSION)
- **pages**: form auto-save (APP-AUTOSAVE-023..028 + REGRESSION)
- **tables**: advanced table features (APP-TABLES-ADVANCED-001..007 + REGRESSION)
- **pages**: data-chart legend + tooltip (APP-PAGES-CHART-017..020 + REGRESSION)
- **pages**: data-chart axis labels (APP-PAGES-CHART-007..011 + REGRESSION)
- **pages**: data-table auto-save debounce timing (APP-AUTOSAVE-006..010 + REGRESSION)
- **records-api**: optimistic-lock conflict detection on record update (APP-REALTIME-042/046/047)
- **pages**: implement data-chart aggregate functions (APP-PAGES-CHART-021..024 + REGRESSION)
- **pages**: implement data-table inline auto-save (APP-AUTOSAVE-017..022 + REGRESSION)

### Bug Fixes

- **buckets**: evict transform cache on file delete

## [0.4.8](https://github.com/sovrium/sovrium/compare/v0.4.7...v0.4.8) (2026-05-18)

_No user-facing changes in this release._

## [0.4.7](https://github.com/sovrium/sovrium/compare/v0.4.6...v0.4.7) (2026-05-18)

_No user-facing changes in this release._

## [0.4.6](https://github.com/sovrium/sovrium/compare/v0.4.5...v0.4.6) (2026-05-18)

### Bug Fixes

- compile theme-aware CSS in the standalone binary without native addons

## [0.4.5](https://github.com/sovrium/sovrium/compare/v0.4.4...v0.4.5) (2026-05-18)

_No user-facing changes in this release._

## [0.4.4](https://github.com/sovrium/sovrium/compare/v0.4.3...v0.4.4) (2026-05-18)

_No user-facing changes in this release._

## [0.4.3](https://github.com/sovrium/sovrium/compare/v0.4.2...v0.4.3) (2026-05-18)

_No user-facing changes in this release._

## [0.4.2](https://github.com/sovrium/sovrium/compare/v0.4.1...v0.4.2) (2026-05-18)

_No user-facing changes in this release._

## [0.4.1](https://github.com/sovrium/sovrium/compare/v0.4.0...v0.4.1) (2026-05-18)

### Features

- **automations**: implement digest/release automation action (APP-AUTOMATION-ACTION-DIGEST-RELEASE-001..002 + REGRESSION)
- **automations**: implement digest/collect automation action (APP-AUTOMATION-ACTION-DIGEST-COLLECT-001..002 + REGRESSION)
- **automations**: implement crypto/hash and crypto/hmac automation actions (APP-AUTOMATION-ACTION-CRYPTO-HASH-001, HMAC-001 + REGRESSION)
- **automations**: implement auth/unbanUser automation action (APP-AUTO-AUTH-UNBANUSER-001..003 + REGRESSION)
- **automations**: implement auth/createUser automation action (APP-AUTO-AUTH-CREATEUSER-001..003 + REGRESSION)
- **automations**: implement auth/banUser automation action (APP-AUTO-AUTH-BANUSER-001..003 + REGRESSION)
- **automations**: implement auth/assignRole automation action (APP-AUTO-AUTH-ASSIGNROLE-001..003 + REGRESSION)
- **automations**: implement approval/request automation action (APP-AUTOMATION-ACTION-APPROVAL-REQUEST-001..002 + REGRESSION)
- **automations**: implement analytics/track automation action (APP-AUTOMATION-ACTION-ANALYTICS-TRACK-001..003 + REGRESSION)
- **automations**: tool-call validation for ai/agent action (APP-AUTOMATION-ACTION-AI-ERROR-006)
- **automations**: implement ai/agent automation action (6/9 APP-AUTOMATION-ACTION-AI-AGENT + REGRESSION)
- **auth**: enforce group maxMembers capacity (APP-AUTH-GROUPS-026..030 + REGRESSION)
- **auth**: implement group-based table permissions (APP-AUTH-GROUPS-014..020 + REGRESSION)
- **auth**: implement group-based page access control (APP-AUTH-GROUPS-021..025 + REGRESSION)
- **auth**: implement group-aware permission evaluation (APP-AUTH-GROUPS-008..013 + REGRESSION)
- **auth**: implement admin API for group management (API-AUTH-GROUPS-001..014 + REGRESSION)
- **api**: implement schema-management version restore (APP-SCHEMA-VERSIONS-001..008 + REGRESSION)
- **api**: implement schema-management draft publish (APP-SCHEMA-PUBLISH-001..008 + REGRESSION)
- **security**: GDPR account export & deletion endpoints
- **api**: implement schema-management draft preview (APP-SCHEMA-PREVIEW-001..012 + REGRESSION)
- **api**: implement schema-management status endpoint + enablement gate (APP-SCHEMA-ENABLEMENT-001..004 + REGRESSION)
- **api**: implement schema-management draft lifecycle (APP-SCHEMA-DRAFT-001..011 + REGRESSION)
- **api**: implement schema-management draft REST resources (APP-SCHEMA-DRAFT-RESOURCES-001..015 + REGRESSION)
- **api**: implement MCP schema-management tools (APP-AI-MCP-SCHEMA-TOOLS-001..013 + REGRESSION)
- **ai**: implement ai-tag compute trigger + model override (APP-AI-CONFIG-048..050 + REGRESSION)
- **ai**: require AI_MODEL for openai-compatible provider (APP-AI-CONFIG-022..025 + REGRESSION)
- **ai**: implement base-URL config for Ollama / local AI providers (APP-AI-CONFIG-017..021 + REGRESSION)
- **ai**: propagate field-level maxTokens to AI compute calls (APP-AI-CONFIG-038)
- **ai-chat**: implement automation triggering from chat (APP-AI-CHAT-TRIGGER-001..012 + REGRESSION)
- **ai-chat**: implement AI chat tool calling (12/13 APP-AI-CHAT-TOOL specs + REGRESSION)
- **ai-chat**: implement AI chat record queries (APP-AI-CHAT-QUERY-001..015 + REGRESSION)
- **ai**: enforce RBAC on knowledge-table embedding
- **ai**: document knowledge ingestion
- **ai**: learned-facts memory and agent-bound chat persistence
- **ai**: interactive ai-chat island
- **ai**: retrieval-augmented generation (RAG)
- **ai**: persist chat conversations to PostgreSQL
- **ai-chat**: field-level write enforcement for chat mutations (APP-AI-CHAT-MUTATE-008)
- **ai-chat**: implement AI chat record mutations (13/16 APP-AI-CHAT-MUTATE specs + REGRESSION)
- **ai-chat**: implement AI chat rate limiting (APP-AI-CHAT-RATE-001..008 + REGRESSION)
- **ai-chat**: implement AI chat error handling (APP-AI-CHAT-ERROR-001..012 + REGRESSION)
- **ai-chat**: implement AI chat cross-cutting concerns (APP-AI-CHAT-CROSS-001..013 + REGRESSION)
- **ai-chat**: implement AI chat context block (APP-AI-CHAT-CONTEXT-001..010 + REGRESSION)
- **ai-agents**: implement agent tools (APP-AI-AGENT-TOOLS-001..012 + REGRESSION)
- **ai-agents**: implement agent system prompts (APP-AI-AGENT-PROMPT-001..010 + REGRESSION)
- **ai-agents**: implement agent scheduling (APP-AI-AGENT-SCHEDULE-001..008 + REGRESSION)
- **ai-agents**: implement agent permissions (APP-AI-AGENT-PERMS-001..010 + REGRESSION)
- **ai-agents**: implement agent limits (APP-AI-AGENT-LIMITS-001..008 + REGRESSION)
- **ai-agents**: implement agent definition (APP-AI-AGENT-DEF-001..015 + REGRESSION)
- **ai-agents**: implement agent cross-cutting rules (APP-AI-AGENT-CROSS-001..005 + REGRESSION)
- **ai-agents**: implement human-in-the-loop agent approval (AGENT-APPROVAL-001..015 + REGRESSION)

### Bug Fixes

- **forms**: bypass rich-text sanitizer for synthesized formRef markup
- replace regex HTML sanitizer with parser-based sanitize-html
- **security**: gate purge-due endpoint and wire the erasure scheduler
- **ai-chat**: correct escapeRegExp back-reference in shared NL parser

## [0.4.0](https://github.com/sovrium/sovrium/compare/v0.3.0...v0.4.0) (2026-05-14)

### Features

- **automations**: replay a run from the runs API, and count attempts per run
- **automations**: email the platform admin when an automation fails
- **automations**: deduplicate webhook deliveries, expose the attempt number to steps, and mark steps skipped on retry
- **automations**: report skipped steps, replay a run, and mark runs completed-with-errors
- **automations**: report exhausted runs, keep per-attempt history, and surface failure-handler details
- **automations**: enforce per-action and per-run timeouts, with a new 'timed-out' run status
- **automations**: detect infinite loops, limit concurrency, and rate-limit runs
- **automations**: automation-level retry with exponential backoff
- **automations**: file actions — list, get metadata, move, copy, delete, and sign a URL
- **automations**: file actions — parse CSV, download, and upload
- **automations**: a flow:stop action, plus HTTP PUT, PATCH and DELETE verbs
- **automations**: call another automation as a sub-automation, and trigger on its call or failure
- **automations**: delay and loop actions — wait, webhook, queue, and for-each
- **automations**: data actions — set, aggregate, sort, limit, deduplicate, merge, split, compare and lookup
- **tables**: ai-generate computed field type
- **tables**: ai-sentiment computed field type
- **tables**: ai-categorize computed field type
- **tables**: ai-summary computed field type
- **tables**: ai-extract computed field type
- **tables**: ai-translate computed field type
- **ai**: route AI requests by provider precedence via ECO_AI_PROVIDER_PRECEDENCE
- **automations**: a runtime-error contract for AI actions
- **automations**: ai:extract action
- **automations**: ai:classify action
- **automations**: ai:generate action
- **ai**: fail startup clearly when AI_PROVIDER is set but its API key is missing
- **ai**: honor temperature and maxTokens uniformly, and validate their range at startup
- **ai**: configure Anthropic Claude through environment variables
- **ai**: validate AI_MODEL at startup and warn on cross-provider mismatches
- **ai**: disable AI cleanly when AI_PROVIDER is unset
- **automations**: per-action retry and continueOnError, plus cross-step template resolution
- **automations**: reusable action templates in a top-level actions[] via $ref
- **tables**: ai-summary compute trigger + per-kind dispatch
- **ai**: add streaming completion to AiService port
- **ai**: add AiService port + Live layer + POST /api/ai/chat
- **pages**: D-4 basic-chart — visx bar chart island [FINAL DRAIN SPEC]
- **notifications**: N-3 email-digests — record-created → email channel
- **pages**: D-3 content-directory-collection — directory-of-md-files generator
- **pages**: D-2 file-based-markdown-content — page.source.file shortcut
- **pages**: D-1 markdown-page-mode — pages[].mode markdown primitive
- **pages**: G-2 gallery-options — masonry/grid + pagination + hover-overlay
- **pages**: G-1 gallery-card-grid — responsive card-grid island
- **pages**: L-3 calendar-interaction — eventClick / dateClick / drag-resize
- **pages**: L-2 event-display — colorField + maxEventsPerDay
- **pages**: L-1 basic-calendar — FullCalendar via React island
- **pages**: E-4 rss-feed-generation — RSS 2.0 feed at /feed.xml
- **pages**: E-3 category-tag-patterns — \$record.* substitution into dataSource.filter
- **pages**: E-2 slug-management — table.unique sugar + auto-slug derivation
- **pages**: E-1 draft-published-status — preview mode + auto-published_at
- **pages**: B-4 dynamic-seo-for-collections — generic deep $record substitution
- **pages**: B-3 collection-pagination-prevnext — adjacency tokens
- **pages**: B-1 collection-page-definition — pages[].mode collection resolver
- **forms**: F-14 one-question-at-a-time — Typeform-style sequential rendering
- **forms**: F-13 multi-step — server-mediated step navigation + draft store
- **forms**: F-12 conditional-logic — visibleWhen/requiredWhen/disabledWhen evaluator
- **forms**: F-11 file-uploads — bucket-backed multipart submit
- **forms**: F-10 onsuccess-and-onerror — runtime IIFE for SSR-only forms
- **forms**: F-9 submission-storage — dual-write transactional ledger lifecycle
- **mcp**: row #38 X-2 client — Sovrium agents as MCP consumers
- **mcp**: row #37 X-1 cross-cutting — independence guarantees
- **mcp**: row #36 M-14 server-internals — full admin metadata surface
- **mcp**: row #35 M-13 server-audit — system.ai_tool_calls audit log
- **mcp**: row #34 M-12 server-rate-limit — sliding-window per-token enforcement
- **mcp**: row #31 M-9 server-actions — action templates as MCP tools
- **mcp**: row #30 M-8 server-automations — manual triggers as MCP tools
- **mcp**: row #29 M-7 server-tables — fieldExposure modes + per-field JSON Schema
- **mcp**: row #28 M-6 server-rbac — RBAC + Z-3 row-level enforcement
- **mcp**: row #27 M-5 server-auth-oauth — Better Auth OAuth bearer
- **mcp**: row #25 M-3 server-transport — stdio + streamable-http
- **mcp**: row #24 M-2 server-discovery — tool annotations + role filtering
- **mcp**: row #23 M-1 keystone — mount /mcp from MCP_ENABLED env var
- **automations**: row #21 record/read action — id-shorthand + filter
- **auth**: add no-config bootstrap-token flow for first-admin claim

### Bug Fixes

- implement APP-PAGES-FORM-031 file type validation for attachment fields
- **forms**: use immutable conditional spread for formAttributes

## [0.3.0](https://github.com/sovrium/sovrium/compare/v0.2.11...v0.3.0) (2026-05-09)

_No user-facing changes in this release._

## [0.2.11](https://github.com/sovrium/sovrium/compare/v0.2.10...v0.2.11) (2026-03-17)

### Bug Fixes

- preserve runtime NODE_ENV detection in production bundle

## [0.2.10](https://github.com/sovrium/sovrium/compare/v0.2.9...v0.2.10) (2026-03-17)

_No user-facing changes in this release._

## [0.2.9](https://github.com/sovrium/sovrium/compare/v0.2.8...v0.2.9) (2026-03-17)

### Features

- add pagination with numbered nav and load-more styles
- add single-record 404 handling and filter/sort query engine
- add session visibility, OAuth social login, and password reset

### Bug Fixes

- resolve CSS compilation deadlock from bundler NODE_ENV inlining

## [0.2.8](https://github.com/sovrium/sovrium/compare/v0.2.7...v0.2.8) (2026-03-17)

### Features

- add production CSS pre-compilation via build command

### Bug Fixes

- suppress CodeQL XSS false positive and fix nodemailer ESLint errors
- defer email config resolution to prevent SMTP error on CLI startup

## [0.2.7](https://github.com/sovrium/sovrium/compare/v0.2.6...v0.2.7) (2026-03-16)

### Features

- wire allowSignUp to Better Auth disableSignUp option
- restrict OpenAPI documentation endpoints to admin users only
- implement page access control for 14 E2E specs (public, auth, role-based)
- implement auth form rendering for login and signup E2E specs (10 tests)
- implement data-table island features for 5 E2E spec files (27 tests)

### Bug Fixes

- resolve 30 broken E2E tests with static build layer and session-aware access control
- resolve sovrium --help failing with "No configuration provided"
- prevent CSS compilation hang on Linux from missing native binaries
- resolve 3 CodeQL security alerts (XSS, open redirect, URL sanitization)

## [0.2.6](https://github.com/sovrium/sovrium/compare/v0.2.5...v0.2.6) (2026-03-16)

_No user-facing changes in this release._

## [0.2.5](https://github.com/sovrium/sovrium/compare/v0.2.4...v0.2.5) (2026-03-16)

### Features

- implement actual DB querying for table data source binding
- implement table data source binding for page sections (APP-PAGES-DATA-001..005)

### Bug Fixes

- resolve package paths correctly when running as npm dependency

## [0.2.4](https://github.com/sovrium/sovrium/compare/v0.2.3...v0.2.4) (2026-03-13)

### Bug Fixes

- resolve drizzle migrations folder relative to package root

## [0.2.3](https://github.com/sovrium/sovrium/compare/v0.2.2...v0.2.3) (2026-03-13)

_No user-facing changes in this release._

## [0.2.2](https://github.com/sovrium/sovrium/compare/v0.2.1...v0.2.2) (2026-03-04)

### Bug Fixes

- resolve Sovrium package version from package root instead of CWD

## [0.2.1](https://github.com/sovrium/sovrium/compare/v0.2.0...v0.2.1) (2026-03-04)

### Bug Fixes

- support shorthand auth strategy format for CLI-LOG-ERROR-003
- import z from @hono/zod-openapi for .openapi() method support
- resolve internal asset paths relative to package root

## [0.2.0](https://github.com/sovrium/sovrium/compare/v0.1.1...v0.2.0) (2026-03-04)

### Bug Fixes

- resolve quality pipeline failures (unit test, knip)

## [0.1.1](https://github.com/sovrium/sovrium/compare/v0.1.0...v0.1.1) (2026-03-04)

### Features

- **api**: expand OpenAPI schema with full REST API routes

### Bug Fixes

- preserve CSS custom properties in style parser
- **website**: strip Prettier whitespace from code blocks in static build

## [0.1.0](https://github.com/sovrium/sovrium/compare/v0.0.2...v0.1.0) (2026-03-03)

_No user-facing changes in this release._

## [0.0.2](https://github.com/sovrium/sovrium/compare/v0.0.1...v0.0.2) (2026-03-03)

_No user-facing changes in this release._
