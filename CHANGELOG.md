## [0.32.0](https://github.com/sovrium/sovrium/compare/v0.31.0...v0.32.0) (2026-10-08)

### Features

- **cli**: add sovrium licenses to print the third-party license texts the binary carries

### Bug Fixes

- **cli**: end quietly with exit 0 when stdout's reader closes the pipe
- **automations**: place action template arguments by position over MCP
- **automations**: encode values from run data where an action places them

## [0.31.0](https://github.com/sovrium/sovrium/compare/v0.30.0...v0.31.0) (2026-10-07)

### BREAKING CHANGES

- **forms**: stop creating records from the page form; add a record through forms and formRef
- **forms**: the page form works on data in the app; adding a record goes through forms and formRef
- **pages**: read data components through a table view
- **pages**: views are declared on the table; data components bind a view or the table

### Features

- **pages**: a component template can hold the page's own components in a slot
- **pages**: a kanban drop can open a drawer or fill a field
- **pages**: a button or a list row can fill a form field
- **library**: the sidebar shell block takes the page as its slot
- **pages**: a KPI can show the ratio of two counts
- **pages**: lists, boards, KPIs and charts follow refreshMode
- **automations**: a connection operation sends a file as a field
- **pages**: a list can render nothing when its binding is empty
- **forms**: endpoint form fields declare required and length rules
- **automations**: a webhook signature layout can be spelled out
- **pages**: drag a timeline bar's ends to resize it
- **pages**: add the edit-operations caller capability
- **forms**: lay out a hosted form with side labels and a sticky submit bar
- **forms**: draw a hosted form field group's description under its label
- **languages**: translate the two-step enrolment screens and the passkey controls
- **pages**: draw a data table declared readOnly as a reading
- **design**: notice a prose part spaced with the my-\* shorthand on validate
- **library**: a recipe filing new Google Calendar events into a table
- **pages**: draw the stepper rail's done, current and upcoming steps apart
- **mcp**: expose roles, form analytics and design-system share and specimen reads as MCP tools
- **library**: redesign the record drawer block with previous, next and the full-page link
- **library**: add the dashboard, settings and record page blocks
- **library**: add the auth page blocks
- **pages**: style a list's shell through its list part
- **forms**: show the submitted values on a form's success page
- **pages**: style a docs page's row, sidebar sections, menu button, last-updated line and page actions by name, and measure its whole column
- **pages**: style a calendar's events, days, day numbers, weekday headers and toolbar by name
- **pages**: style a gallery's grid, cards, covers and card bodies by name, and lay the featured card out as a 1.25 / 1 grid
- **pages**: a list's metadata entry takes classes of its own
- **pages**: style a rich-text field's prose, and any prose's lists and tables, by name
- **pages**: style a form's title, fields, button and errors, and a language switcher's link, by name
- **pages**: style a code block's frame and file bar by name
- **pages**: style a written table's header, rows and cells by name, and draw each column through tableColumns
- **pages**: run two-step, invitation, API key and session methods from an auth form
- **auth**: let an invitee decline an invitation from its link
- **pages**: run account methods from a grid row
- **pages**: name an account list by its label and mark the reader's current session in it
- **pages**: draw a table's records as pins on a map
- **pages**: nest a table's records in a tree by their parent
- **pages**: step through a table's rows from a record drawer
- **pages**: sign a record once with a signature pad
- **pages**: put form labels beside their controls and pin a save bar
- **pages**: preview a stored file in place through an address signed for the reader
- **pages**: read a table as two-line items on a phone
- **pages**: draw a record's rating as stars named by its value
- **pages**: fold a chart's smallest categories into one named category
- **pages**: draw a description list entry from a record field by its type
- **pages**: draw a stepper that walks a task step by step
- **pages**: end a derived breadcrumb with the record's own name
- **pages**: ask for a typed confirmation before an alert dialog confirms
- **pages**: bind tables and lists to account lists, and print an invitation from its link
- **auth**: serve the reader's account lists and refuse revoking another person's session
- **auth**: strip the signer from her signatures when her account is erased
- **mcp**: accept ISO instants for time filters on SQLite
- **pages**: measure the docs frame and restyle its parts by name
- **pages**: style one component's parts by name with classes
- **mcp**: expose people and access admin reads as MCP tools
- **server**: refuse to start with a malformed MAP_TILES_URL
- **pages**: read graphs and matrices from the app's own tables
- **tables**: store signature fields once and refuse a record filed under itself
- **mcp**: expose configuration, console and design-system admin reads as MCP tools
- **mcp**: validate internal list filters by column type and page the tool-call log
- **mcp**: expose form and submission admin reads as MCP tools
- **pages**: lay an edit form out as a main column and an aside, and drop a form's header
- **mcp**: expose agent conversation admin reads as MCP tools
- **pages**: truncate a table column, tone a cell rule and pick a column's chip form
- **mcp**: expose bucket admin reads as MCP tools
- **pages**: give a calendar month view's day cells a minimum height
- **pages**: colour an aggregate chart's series and drop slice labels
- **mcp**: order, filter and page the internal table list tools
- **mcp**: expose link and connection admin reads as MCP tools
- **pages**: size a KPI's value per breakpoint and give it a tone
- **pages**: lead a gallery grid with a featured first card
- **cli**: warn about deprecated config keys before they are removed
- **pages**: stack a list row's title above its details with itemLayout
- **pages**: let kanban columns fill the board and give named columns a fixed width
- **mcp**: expose admin automation reads as MCP tools
- **pages**: allow AI answer crawlers and refuse AI training crawlers in robots.txt
- **forms**: save a form for later and edit a submission after sending it
- **forms**: compute calculation fields in the browser and on the server
- **automations**: verify timestamped HMAC webhook signatures under any header
- **connections**: send an operation body as written, raw or multipart-related
- **pages**: group an edit form's fields into titled sections
- **library**: let a block ship the form it embeds
- **auth**: provision users and groups over SCIM
- **library**: add a Google Drive upload and a Calendly booking recipe
- **auth**: register and sign in with a passkey
- **email**: send through Brevo, Resend or Amazon SES instead of SMTP
- **auth**: sign in through an OpenID Connect or SAML identity provider declared in the config
- **library**: add messaging and developer connections and recipes
- **library**: add sales and support connections and recipes
- **library**: add Yousign, PayFit, Odoo and Swan connections
- **library**: add Google Docs and Drive sharing operations and a document recipe
- **tables**: accept the search query on the aggregate read
- **cli**: add sovrium backup and sovrium restore
- **cli**: write one JSON Schema file per top-level key beside the full schema
- **cli**: report every configuration mistake in one run
- **tables**: add an aggregate read so KPI and chart components ask one question instead of loading records

### Bug Fixes

- **cli**: accept the app-starter and marketing-site templates in sovrium init
- **ai**: the unconfigured assistant notice names the variables to set
- **automations**: keep upload request headers out of the run record
- **automations**: a file parameter only reads files the automation already holds
- **automations**: refuse an hmac-timestamp layout that reads the timestamp and the signature from one entry
- **automations**: a connection file that cannot be fetched fails the call instead of sending an empty part
- **mcp**: run the create and delete tools through the same write as the records API
- **pages**: a search list renders wherever it is placed
- **api**: retire the unimplemented user update route
- **tables**: option chips and table-bound forms show option labels
- **auth**: a custom role's bare landing URL lands its holders
- **tables**: a data table honours its data source limit
- **tables**: refuse a batch update that would make a record its own ancestor
- **forms**: make the file picker refuse what the upload would refuse
- **pages**: show an edit form's success toast after its document POST
- **automations**: the run detail shows the steps run inside a path or a loop
- **pages**: a form carries the className it declares
- **pages**: a dialog whose trigger a record rule hides starts closed
- **mcp**: fire webhooks and automations on an MCP record update
- **pages**: rows of a table-bound container draw no list marker
- **automations**: records written inside a path, a loop or a script start record automations
- **pages**: a page-level single binding without param binds the first readable record
- **automations**: actions inside a path or a loop read each other's outputs and can stop the run
- **i18n**: a translation key followed by more text resolves and keeps the rest
- **automations**: a trigger relationship or user field reads as its id in code input and nested steps
- **automations**: a record update names its row by id or filter and reports what it changed
- **pages**: a sidebar entry whose href is a translation key is marked current
- **pages**: a sidebar drawer stays folded after a client-side page swap
- **pages**: honour a public view's grant on every component bound to it
- **mcp**: require a passkey session for admin MCP tools when administrators must use passkeys
- **admin**: count users per declared role in the users overview
- **mcp**: keep tool answers and personal values out of the MCP call log for admin tools
- **account**: erase a person's own MCP call log entries
- **auth**: answer an invitation from the query key its page declares
- **pages**: draw no more gallery cards than the binding's limit
- **pages**: format a record's createdAt and updatedAt in a record-field
- **automations**: honour an automation's trigger permission on every road that starts it by name
- **pages**: expose a page record's createdAt and updatedAt
- **tables**: draw a badgeForm chip on formula columns and keep its tone on the chip
- **pages**: format a record field by its type when no format is declared
- **pages**: draw aggregated area charts as areas and fit a chart to the height it is given
- **forms**: draw form section titles as headings
- **pages**: keep a named list a list when empty, and style it through its list part
- **auth**: ask the reader to confirm they copied a new API key before closing it
- **forms**: refresh the page's grids and close the dialog after an embedded form writes a record
- **pages**: bind account lists wherever they sit on a page
- **pages**: sanitize every record-sourced HTML render
- **admin**: count the latest writes in the tables overview regardless of database clock skew
- **mcp**: answer internal table times as ISO instants and match them to the millisecond
- **pages**: let a visibility condition read the page's invitation
- **auth**: give sign-in forms the right autofill hints and a success page
- **cli**: let library add wire into an empty inline list
- **auth**: document the decline-invitation endpoint
- **auth**: honour the configured magic-link lifetime
- **pages**: send an invitation page as private and never from a shared cache
- **automations**: ignore buttons hidden from the caller when a page press names an automation
- **ai**: let the chat start an automation only for a caller the trigger admits
- **pages**: a coloured aggregate bar chart keeps its month axis and value format
- **tables**: a column's tone reaches a formula's text, a truncated file keeps its icon on the line, and a text column draws as a chip
- **admin**: hold the viewer tier out of the transform cache purge and apply bucket limits to console uploads
- **automations**: redact webhook verification secrets in the automations list
- **buckets**: keep the first uploader when a stored file is replaced
- **automations**: refuse every .localhost name as loopback in outbound requests
- **pages**: never serve an invitation page from the page cache
- **tables**: name a grid's rating cell by its value out of the maximum, as the stars elsewhere are
- **pages**: print nothing for an empty list metadata value
- **pages**: a responsive value outside its class table yields no class instead of throwing
- **server**: name the cause when the authentication module fails to load
- **cli**: print the installer's status glyphs correctly under dash
- **automations**: mint upload links that write catalogued files into the private system bucket and never overwrite a stored key
- **account**: delete the bytes of every file the erasure removed from the catalogue, including one stored during the purge
- **forms**: check a form's upload type and size on the server, attribute a signed-in upload to its submitter, and keep the redirect on this site
- **admin**: answer the read-only console tier on every operational write the way a stranger is answered
- **tables**: neutralise spreadsheet formulas in the CSV import error report
- **pages**: keep an action button disabled until the page's script can handle it
- **mcp**: refuse internals tools at call time when they are not exposed
- **auth**: limit every sign-in, verification and change-email route that sends mail per client address
- **auth**: compiled binaries start apps that declare authentication
- **tables**: write a leading quote before text cells that a spreadsheet would run as a formula, on every CSV export
- **pages**: turn the select chevron while its list is open
- **buckets**: stop serving resized copies of a replaced attachment
- **theming**: paint a code block's dark theme in its own colours
- **cli**: look up a config key whose name contains a colon in sovrium docs
- **pages**: refuse a preview value outside its option's closed set
- **admin**: find records of every table in the console global search
- **ai**: show and decide an agent's approvals only to the roles that may trigger it
- **automations**: refuse a page press of a paused or disabled automation and record who pressed it
- **buckets**: record who uploaded each file, let only the uploader or an admin delete or replace it, and erase a user's files with the account
- **auth**: run the SCIM audit entries on the audit repository they need
- **automations**: check every redirect hop and IPv6 spelling of an outbound address, and stop reading unbounded response bodies
- **server**: read the insecure-posture flags by value, warn when BASE_URL hides a public bind, and cap request bodies, analytics fields and image decodes
- **cli**: refuse to install or update when the published checksum cannot be verified
- **automations**: run page-bound automations only under the page's access rule and refuse every other trigger through the page endpoint
- **cli**: name the refused translation or prop key in the validation report
- **auth**: bind single sign-on accounts to a verified email and keep sign-in returns inside the app
- **auth**: honour allowSignUp false on social providers and email one-time codes
- **build**: retire the SOVRIUM_HYDRATION placeholder that overwrote client.js
- **api**: answer 404 on the analytics endpoints of an app without analytics
- **pages**: keep a dialog visible when it is reopened while closing
- **pages**: keep a view-bound KPI or chart on the view's records
- **api**: answer 415 with its own error code
- **tables**: delete a replaced attachment on every update path
- **docs**: strip internal test and story references from the manual's behaviour sections
- **desktop**: open sovrium:// links in the desktop app on every platform
- **tables**: store a record and its links in one transaction, and check the edit token inside the write
- **automations**: hand update runs the row before the change as previousRecord
- **api**: refuse requests from a caller whose role grants nothing, and close six other authorization gaps
- **search**: serve and build page search from an installed binary
- **pages**: serve pages that read table data with a revalidating cache header
- **assets**: keep returning visitors working after an upgrade

### Performance Improvements

- **tables**: build the batch upsert plan in one pass
- **tables**: update a batch of records in one statement
- **tables**: group listings in the database instead of loading the whole table

## [0.30.0](https://github.com/sovrium/sovrium/compare/v0.29.1...v0.30.0) (2026-10-05)

### BREAKING CHANGES

- **automations**: automation read and list steps hand over the record as the records API returns it
- **records**: record ids and relationship values are strings on every wire

### Features

- **pages**: keep the document alive across sidebar navigation
- **auth**: let a signed-in user delete their account at once through a mailed confirmation link
- **server**: pin a development server's clock with SOVRIUM_DEV_CLOCK
- **auth**: bans, lifted bans and admin-set passwords are recorded in the audit log
- **account**: the personal data export lists the audit entries the person made
- **pages**: gallery covers load lazily, or eagerly with galleryCard.loading
- **auth**: record role changes and impersonations in the audit log
- **i18n**: engine interface text is overridden under a reserved sovrium. prefix
- **tables**: order dates with min and max aggregates
- **comments**: the mention picker speaks the page language
- **comments**: mention someone who can read the record from the comment composer
- **i18n**: the rate-limited read notice follows the page language
- **i18n**: the engine's own interface text follows the page language, and field labels accept translation keys
- **pages**: choose the currency of a list metadata amount
- **pages**: a board card can open a record drawer
- **pages**: hide or show on whether a field has a value
- **automations**: resolve an approval request that reaches its timeout
- **pages**: clear an optional field on purpose from an edit form
- **pages**: add a two-language `toggle` variant to the language switcher
- **pages**: give each language its own sharing image from a `$t:` key
- **pages**: print the address a visitor asked for with `$app.path`
- **pages**: name a feed with `rss.title` and `rss.description`
- **tables**: a date can print its weekday
- **pages**: a filter can ask whether a field is empty
- **auth**: a built-in role can carry its own landing page
- **cli**: seed files may list several attachments and give a relative date a time of day
- **pages**: a list row can open a record like a grid row
- **pages**: a filter can name today, a day offset or the start of a month
- **automations**: an approval can continue when rejected, recording the decision
- **design**: option badges can be drawn outlined with a dot, everywhere they appear

### Bug Fixes

- **tables**: make multi-record writes all-or-nothing on SQLite
- **automations**: keep a run waiting for an approval whole through the upgrade scrub
- **account**: scrub the automation runs that read an erased person's records
- **automations**: judge what an approver reads of a run by what fed it — relayed runs, step errors, request messages, calls and scripts
- **tables**: compare a narrowed lookup list in the order and form its reader is shown
- **tables**: filtering on a lookup that copies a list sees the names its reader may read
- **automations**: an approver never sees a run's trigger data she may not read
- **automations**: an approver sees a run step whose related records she may all read
- **tables**: a lookup copying a list shows only the linked records its reader may read
- **tables**: filtering on a lookup of a lookup sees the rows its reader may read
- **automations**: an approver never sees a run step's related values she may not read
- **ai**: chat tools never read a related value their user may not read
- **tables**: a lookup of a lookup follows every hop's row rule
- **buckets**: a file reference by a signed-in user is never judged as a visitor's because of her role's name
- **tables**: a write's response leaves out what its writer may not read
- **pages**: a page's chosen fields never reveal a lookup its reader may not read
- **tables**: a formula over a hidden lookup is left out as the lookup is
- **tables**: a lookup of a related formula follows what that formula reads
- **tables**: related values judge a signed-out visitor by her session, not a role name
- **pages**: the sitemap follows a table's resolved read
- **pages**: a page over a signed-in-only table names none of its fields to a signed-out visitor
- **tables**: a signed-in user is never taken for a signed-out visitor because of her role's name
- **tables**: a rollup or count shows its aggregate only to a reader who may read what it adds up
- **tables**: a lookup shows a related value only to a reader who may read it
- **tables**: a signed-out visitor reads only tables open to everyone, on every door
- **auth**: an API key works again once its owner's ban has expired
- **views**: a shared-view link opens for a reader whose assignment covers its table
- **tables**: validate refuses a row rule naming the active scope
- **tables**: a single read judges the row rule on the stored record
- **tables**: a signed-out visitor never satisfies a rule naming the signed-in person
- **tables**: one record gate for pages, hosted forms and the records API
- **tables**: a row rule on the reader's email matches her own rows and never empty ones
- **buckets**: a batch entry without a path is refused like a single request
- **buckets**: a signed URL's fields can no longer be read as another operation's
- **buckets**: batch signing checks each entry's permission and batch uploads work
- **tables**: access-assignment errors no longer echo database text
- **views**: a shared view opens for a reader whose role comes from an assignment
- **forms**: a hosted form refuses a parent row the submitter cannot read
- **auth**: the app's top role opens every admin door
- **webhooks**: a secret whose variable is empty refuses every caller
- **cli**: refuse a library install that reads an undeclared variable
- **env**: refuse a configuration that references an undeclared variable
- **automations**: an environment reference inside an expression is read as a value
- **automations**: a regex pattern must be written in the config
- **ai**: the MCP action tool fills a template once
- **automations**: a template variable inside a helper expression is never parsed
- **tables**: an empty field never satisfies a row rule
- **webhooks**: outgoing webhooks read only variables the app declares
- **automations**: never render a value a step received as a template
- **tables**: validate refuses row rules that cannot match the field's stored type
- **tables**: row rules judge stored values by the field's type on every read and write
- **pages**: the command palette hides rows the reader's row rule hides
- **automations**: stop resolving environment references inside data a caller sent
- **automations**: let a webhook response return a step's value with its type
- **automations**: answer a webhook call with its run id and status only
- **pages**: a search list names no hidden field when another table shares its name
- **activity**: the app's top role reads the activity feed as an admin does
- **ai**: answer a signed-out visitor of a public agent within the anonymous reach
- **pages**: offer edit-form controls only for fields the reader may write
- **automations**: an agent step of a run started by hand shows its starter only what she may read
- **automations**: a run's non-admin reader sees step output only within her reach
- **automations**: an agent step retrieves only from its own knowledge base
- **ai**: a knowledge search returns only the fields its searcher may read
- **ai**: a declared agent answers a signed-in caller only within her own reach
- **pages**: a record drawer on a record it cannot show offers nothing to edit
- **pages**: a collection page answers a row hidden by its read rule as a missing one
- **pages**: a grid offers no alternate view built on a field its reader may not read
- **pages**: no page names a field its reader may not read
- **ai**: apply the records write rules to chat updates and deletes
- **tables**: refuse an update to a record the read rule hides
- **ai**: return only readable, live records from a knowledge search
- **ai**: count only readable records in the chat confirmation prompt
- **ai**: leave trashed records out of chat queries and tool calls
- **ai**: chat answers only the tables and rows the records API would show the same user
- **tables**: judge a SQLite checkbox as the records API reads it wherever one row meets a row-level rule
- **realtime**: judge a SQLite checkbox as the records API reads it for presence and subscriptions
- **tables**: judge a SQLite checkbox as the records API reads it in the update and delete gates
- **pages**: offer an inline editor and a drawer save only to a reader who may update
- **pages**: name no field its reader may not read on a board, calendar, timeline or chart
- **pages**: read every server-rendered record through the one records gate
- **forms**: refuse a submitted link to a row the related table's read rule hides
- **activity**: judge a boolean row-level rule on SQLite as the records API does
- **realtime**: cap presence streams at ten per user
- **pages**: show a signed-out visitor only the tables the records API opens to her
- **ai**: admit assignment roles on AI chat record changes as the records API does
- **pages**: draw no record from the trash on a server-rendered page
- **auth**: keep the built-in admin admin-equivalent when a custom role outranks it
- **pages**: publish in /feed.xml only what a signed-out reader may read
- **tables**: let a viewer a table names write by batch as she writes one record
- **tables**: reserve permanent delete and purge to admin-equivalent roles
- **pages**: offer a viewer no create or edit that a group grant alone would give her
- **pages**: the first-object redirect lands only on a row its visitor may read
- **pages**: field lists a page builds name only readable fields and offer inputs only on writable ones
- **pages**: record components over a table their visitor may not read carry nothing of it
- **realtime**: end a presence stream when the access it was opened on ends
- **realtime**: give a missing and a hidden record the same presence check
- **pages**: a data-bound sidebar section lists only what its visitor may read
- **forms**: choices read from a table offer each visitor only the rows its row-level rule shows them
- **tables**: judge signed-out access on a table's inherited and overridden rules
- **pages**: server-drawn lists and searches show only the rows and fields their visitor may read
- **pages**: give a data-table grid only the views, fields and permissions its reader may see
- **mcp**: refuse an update or delete on a table its caller may not read
- **tables**: answer a delete on a table its caller may not read as a missing record
- **tables**: refuse every write to a viewer admitted only by a group or an assignment
- **tables**: admit on every table door exactly the callers the records admit
- **tables**: list a table that declares no read permission to every caller its records serve
- **tables**: check table access before validating requests
- **realtime**: presence on a record page follows the record a component shows
- **tables**: refuse writes to stored records on a table the caller may not read
- **tables**: refuse writes to a field the caller may not read
- **activity**: show a non-admin only her own agent decisions and the actions she may read
- **tables**: answer a refused export with the missing table's 404
- **tables**: refuse an anonymous listing that includes deleted records
- **tables**: list the tables a viewer may read instead of refusing her
- **realtime**: presence on a record page follows the record
- **activity**: keep another user's email out of the activity entries a non-admin reads
- **activity**: let a viewer list the activity she may read
- **activity**: describe the activity API as it answers
- **tables**: answer a table's view list exactly as the table's records do
- **tables**: make a view without a grant inherit its table's read
- **realtime**: presence is served only on a page the caller may open
- **tables**: honour a view's grant when records are listed through ?view=
- **activity**: the activity feed shows a reader only what the records API would
- **tables**: admit a group's members to a view whose grant names the group
- **tables**: answer the table list and definition exactly as the table's records do
- **tables**: let a caller sort by every field they may read
- **tables**: guest comments no longer open a thread the table keeps to signed-in readers
- **tables**: reading one comment by id follows the thread's moderation rule
- **tables**: reserve a permanent batch delete to admins
- **tables**: check row-level rules on the trashed row when restoring
- **tables**: keep webhook configuration, delivery logs, retries and tests to admins
- **tables**: keep operations a table does not grant refused under a row-level rule
- **tables**: never report a write the records API would refuse in a table's permission map
- **tables**: answer 404 for the permissions of a table the caller may not read
- **tables**: honour a group's field read grant on every record read
- **tables**: name no field in the permissions map of a table its caller may not read
- **tables**: keep a shared view's malformed filters from naming hidden fields
- **tables**: leave unreadable fields out of the table permissions map
- **migrations**: apply a new single-select option on SQLite when the same edit adds or renames a field
- **tables**: boot tables whose field names are SQL keywords
- **tables**: leave unreadable fields out of a table definition
- **tables**: mask hidden fields out of a shared saved view
- **tables**: refuse a view id that clashes with a table or another table's view
- **tables**: mask the views a table read returns as the views list does
- **pages**: keep calendar days and daylight-saving hours in place on the calendar
- **pages**: place calendar date-times in the operator time zone
- **pages**: list only readable tables in the command palette
- **tables**: name only readable fields in a view definition
- **records**: refuse sum and avg over a field that is not a number
- **migrations**: accept SQL keywords such as all or order as view ids
- **theming**: draw a github-dark carriage-return token in the block's text tone
- **pages**: read a date-time in its field's own zone in drawers, and keep declared file names
- **records**: answer a field the table does not have as a field the caller may not read
- **automations**: refuse to cancel any run that already ended
- **pages**: name only readable fields in the command palette
- **pages**: label chart months by name and currency ticks in compact amounts
- **pages**: paint calendar chips, breadcrumbs, sort glyphs and tab labels in legible theme roles
- **theming**: draw every code-block token at 4.5:1 on its block
- **pages**: read date-times in the operator zone and files by name in grids and drawers
- **records**: answer a hidden or missing filter field alike and refuse a sort on a hidden field
- **automations**: a replay never gets past a filter or an approval, and only an admin replays with new data
- **pages**: a record drawer respects field permissions and refuses only required blanks
- **tables**: stamp a custom-named updated-by field on batch update
- **records**: refuse a filter that is not an and list, and isTrue on a non-boolean field
- **automations**: only an admin, the starter or a named approver can read, replay or cancel an automation run
- **tables**: show the API's message when a grid file upload is refused
- **pages**: save a record drawer whose multiple-attachments field holds files
- **records**: stamp a custom-named author field on every record a batch creates
- **automations**: answer 404 for the runs of an automation the config does not declare
- **pages**: draw a record drawer's values as the grid does, and edit each with its own control
- **server**: warn that email is disabled when an agent is granted email.send
- **ai**: answer 404 when deleting a conversation that is not there
- **api**: answer every 404 with one body
- **records**: create a record that carries only many-to-many links
- **records**: apply every live filter operator to the trash, and refuse a top-level or
- **forms**: draw a telephone, date-time or file picker for standalone phone, datetime and attachment fields
- **automations**: an approval declared as an action template also needs sign-in configured
- **pages**: the development clock decides the year a server-written short date leaves out
- **automations**: a refused digest sort key is reported on the sort key alone
- **config**: a rule broken inside the clearly intended shape is reported on its own
- **automations**: an approval nested in a loop or branch also needs sign-in configured
- **tables**: a notIn filter with a single value or a null in its list no longer inverts or empties
- **pages**: drawers, dialogs, forms and row actions name the parts they draw
- **pages**: a table written row by row draws its rows on whole pixels
- **pages**: the docs navigation folds into a bar across the column on a phone
- **auth**: refuse an account-deletion email template that carries no confirmation link
- **pages**: a short date of this year is written without its year
- **tables**: notIn filters views, the records API and the chat query tool
- **auth**: a caller demoted mid-request gets the admin plane's 404, not a 403
- **account**: erasure never removes the last admin; a scheduled erasure is deferred instead
- **tables**: recompute stored formulas once after an upgrade that computes them differently
- **forms**: refuse a form address that is neither a web page nor a path on this site
- **records**: link many-to-many values in a batch create
- **api**: answer every missing record or table with one 404 body
- **account**: refuse the last admin's scheduled deletion and sweep outstanding deletion links
- **tables**: join many-to-many lookup values with a comma and a space on SQLite
- **realtime**: a session that ends closes only its own connections
- **realtime**: close live subscriptions at once when a group or organisation membership changes
- **realtime**: end a live subscription with the session it was opened with
- **database**: retire idle pooled PostgreSQL connections before a server cuts them
- **tables**: backfill a formula on the development clock's day on SQLite
- **pages**: draw a sidebar entry badge on a whole pixel
- **pages**: name a drawer's close button in the page language
- **server**: let the development clock reach every server-side now
- **storage**: infer no MIME type from an extension that names an object member
- **pages**: draw no card image from an attached file that is not an image
- **forms**: honour the record-token escape in a form's success text and addresses
- **pages**: honour the record-token escape in event paths, row actions and confirm phrases
- **realtime**: close live subscriptions when an admin resets a password or updates an account
- **realtime**: judge a subscription filter on readable columns and withhold row-gated lookups
- **realtime**: announce every committed row change, and a large write as one resync
- **realtime**: close a live subscription when the subscriber's access changes
- **migrations**: a table renamed in place keeps one set of triggers, constraints and indexes
- **realtime**: refuse a subscription exactly as a missing table
- **pages**: give dialogs a named close button and form dialogs a Cancel
- **forms**: draw form controls at the input component's height
- **pages**: draw badges and table header rows on whole pixels
- **theming**: paint every page in the theme background colour
- **tables**: datetimes and times stored as typed on SQLite are rewritten once at startup
- **migrations**: repair formula columns an earlier version converted to text on PostgreSQL
- **pages**: an escaped record token no longer hides a component from a restricted role
- **admin**: hide the pairing sentence for a colour role that names no pair
- **admin**: print the record tokens in the gallery, kanban and list examples as written
- **account**: order same-instant export entries by id
- **config**: refuse a component: placement naming no template at boot
- **pages**: a backslash before a record token prints the token as written
- **realtime**: never show a row's hidden previous values when an update brings it into view
- **automations**: refuse a digest sort key written as a JSON path at config decode
- **forms**: hold a hidden link or account to the value the server fills in
- **comments**: count per-record assigned roles in a record's mention audience
- **realtime**: deliver each change only to subscribers whose row-level rule shows the row
- **tables**: formulas reach the rows already in a table, and writes return computed values
- **tables**: datetimes store their UTC instant and times read HH:MM:SS on SQLite
- **tables**: a table can link to itself many-to-many, and derived table names are checked
- **migrations**: a table renamed under its id is renamed, not rebuilt
- **records**: an id that cannot be a record key answers 404 on PostgreSQL
- **account**: erasure removes the person's email address from the audit log
- **auth**: a refused admin password reset no longer signs the user out
- **records**: empty values sort last in both directions on both engines
- **tables**: the table list answers in an app with no auth
- **ai**: MCP migration and schema-checksum tools read their stored tables
- **automations**: a ban-user step cannot ban the last admin
- **auth**: the admin role route answers like set-role, including 404 for an unknown account
- **config**: refuse a $ref that names no template, showing how to include a file instead
- **config**: a bare $ref places a component template instead of looking for a file
- **auth**: two simultaneous demotions cannot remove the last admin
- **tables**: enforce a number field's range and precision as a decimal's
- **auth**: a role write names exactly one role, spelled exactly
- **automations**: an assign-role step cannot demote the last admin
- **auth**: a default role must be one the app declares
- **auth**: a role update names a declared role and keeps the last admin
- **migrations**: keep a many-to-many link table's keys when a linked table is rebuilt
- **ai**: ground an agent on a table named with capitals, spaces or hyphens
- **tables**: judge the reserved auth\_ and system\_ prefixes on the stored name
- **ai**: name the tools of a table with a space so AI clients accept them
- **tables**: refuse two table names that are stored as the same table
- **tables**: store a blank date as no date, including one an automation writes
- **tables**: keep a formula's text literals as written, and start every formula PostgreSQL computes through the session
- **pages**: a board card shows the file of an attachment field as its cover or image
- **auth**: changing a user's role no longer hands the admin that user's session
- **ai**: answer chat record questions about tables named with a hyphen or a space
- **cli**: refuse an unknown field type in sovrium validate, naming the known types
- **tables**: give the number field the grid and min/max handling of a decimal
- **tables**: catalogue number as an alias of decimal
- **i18n**: built-in view labels, the clear control, the palette create dialog and automation forms follow the page language
- **tables**: sum number, rating and progress rollups, and read a date rollup as its day
- **tables**: compute formulas that read a date as text with the row trigger on PostgreSQL
- **automations**: log a failed bucket lookup before falling back
- **pages**: a card image draws only a safe address
- **pages**: an AI chat or search box placed in a breakpoint counts at boot
- **pages**: an editable drawer unlocks only once it shows the record
- **forms**: a create form's id names the form itself
- **pages**: a script in the first tab panel binds after load
- **migrations**: carry many-to-many link tables when a table is renamed under its id
- **tables**: refuse a unique constraint naming a field the table does not declare
- **tables**: refuse table names holding whitespace other than a plain space
- **migrations**: rebuild a table with a lookup without colliding on its constraint names
- **tables**: serve records of tables named with capitals, spaces or hyphens
- **automations**: an object with keys is a value, not empty
- **pages**: one rule decides what is empty in visibility and collection pages
- **tables**: a view filter judges an empty value as the records API does, on both databases
- **migrations**: quote table names in lookup views
- **database**: start behind a connection pooler that refuses the JIT setting
- **tables**: a composite foreign key must name a table and fields that exist
- **migrations**: `migrate --dry-run`, `--check` and `--watch` recognise a table renamed under its id
- **pages**: a card click on a board, calendar or gallery only opens a page on this site, and a gallery card can open a record drawer
- **migrations**: refuse a table rebuild that would copy none of a populated table's columns
- **tables**: read a date as its day wherever a raw row is handed on, on PostgreSQL
- **database**: compare view trigger functions, and preview view rebuilds an upgrade performs
- **database**: recreate a volatile formula trigger on a table that already has it
- **server**: refuse to start on an invalid rate-limit window
- **security**: count an IPv6 client by its /64 in every rate limit
- **security**: count MCP and credentialed page requests against the per-address ceiling
- **migrations**: making a field required with a default fills existing empty rows on SQLite
- **migrations**: quote table names in every migration statement, and rename a table only under an id its author wrote
- **tables**: a group grant opens a table with a row-level rule as a role grant does
- **tables**: refuse two tables that look each other up, naming the lookups
- **auth**: draw the social sign-in skeleton as a waiting POST form
- **ai**: draw the chat composer as a POST form
- **auth**: never send an invitation's token and password in the address
- **pages**: never send a guest comment in the page address
- **database**: rebuild lookup views an upgrade writes differently
- **security**: let every in-memory rate limiter forget idle keys
- **security**: cap API requests per address ahead of every session lookup
- **tables**: copy nothing from a trashed record through a link to one record
- **tables**: answer null for an aggregate over no values
- **tables**: read a date field as its day on PostgreSQL
- **pages**: a button that submits a form by selector waits for the form's script like its own submit
- **mcp**: judge a link target with the caller's groups on an MCP write
- **forms**: a hidden relationship field is held to the rows it would offer
- **forms**: a form submission can only link a row the form offers
- **tables**: an upsert keeps the link its matched row already holds
- **pages**: never send a form's values in the address when it is submitted before the page's script runs
- **automations**: refuse an undecided approval timeout inside a branch or a loop
- **tables**: refuse an aggregate naming a field the table does not have
- **tables**: skip trashed records in a lookup through many, and never group or filter on a hidden one
- **tables**: a link to a row the writer cannot read is answered as a link to a missing row
- **pages**: a component template keeps the test id its author gives it
- **pages**: a page keeps out of the page cache when a template or breakpoint makes it depend on the request
- **comments**: the mention picker finds readers however many others sort first
- **comments**: a single comment and an edited comment carry their resolved mentions
- **comments**: a comment thread answers to its record's row-level read rule
- **tables**: hide unreadable rows behind reverse lookups and in the trash
- **api**: cap a comment at 50 mentions
- **automations**: refuse an approval timeout that decides nothing
- **pages**: name a sidebar with groups on its navigation
- **automations**: the depth limit still stops a loop through a field a write changes without naming it
- **automations**: the depth limit refuses only a write that would start a run
- **pages**: a phone's calendar switch offers the agenda in the month's place
- **admin**: every run status reads in the operator's language as a badge
- **automations**: a run a filter stopped reads Skipped, and its filter step Filtered out
- **tables**: a hidden lookup value no longer steers a filter, a sort or an aggregate
- **tables**: a CSV export keeps a column whose first row leaves it out
- **tables**: a many-to-many lookup carries only the linked records its reader may read
- **automations**: only an admin with write authority resolves an approval request
- **automations**: a record automation no longer re-fires on a number its own write did not change
- **tables**: judge a lookup before a field selection or permission drops its key
- **i18n**: an interface-text override written for one language no longer replaces the engine's words in another
- **pages**: name the phone calendar's agenda in its view switch
- **forms**: draw an attachment field's label at the size of every other label
- **tables**: signed-in callers keep their own records budget, and rate-limited widgets offer a retry
- **tables**: leave out a lookup through a link the reader may not read
- **automations**: stop a resumed run before any step when its starter was banned
- **automations**: a copied or moved file keeps its bucket, and a refused speech upload is not retried
- **automations**: a record list output reads as its value in branches, filters and code steps
- **pages**: a board card binds its drawer record only to its own table
- **pages**: an editable record drawer picks a linked record by name instead of showing its id
- **pages**: a sign-out form shows only its button, and a dialog with an opener elsewhere starts closed
- **pages**: a form inside a tab panel keeps its validation, background submit and recorder
- **forms**: an embedded form keeps its field defaults and resolves now and user tokens in its prefill
- **forms**: an in-place create form honours its inline prefill and stores an empty link as empty
- **pages**: translate list empty messages and overlay titles
- **tables**: an upsert answers to the table's row-level rules
- **forms**: style the recorder buttons and size an embedded form title by its heading level
- **forms**: a recorded, dropped or picked file satisfies a required attachment
- **ai**: name a recording after its audio type when sending it to a speech engine
- **automations**: a batch update or upsert writes a many-to-many field
- **automations**: an older approval request can no longer be claimed through a new account
- **tables**: anonymous creates and comments no longer share a form's rate limit
- **tables**: a signed-out visitor's record is authored by the system
- **tables**: a record never names a linked record its reader may not read
- **automations**: an automation can write a many-to-many field
- **automations**: a run whose starter is banned stops acting as them
- **automations**: a hand-started run reads records as the person who started it
- **tables**: check a record write against the row it will actually leave
- **automations**: rows a hand-started run writes carry the person who started it
- **automations**: a run started by hand resumes as that person after an approval
- **automations**: a run stopped by a rejected approval can be read again
- **server**: serve a request that sends no Host header
- **ai**: leave paused automations out of the MCP tool list
- **automations**: an approver named by email is the account that held it when the request was made
- **tables**: let create: all accept records from visitors who are not signed in
- **tables**: hide linked records a reader may not read
- **automations**: a run someone starts by hand writes as that person
- **tables**: check a row-level write rule against the row as it would be written
- **cli**: fail cleanly when sovrium update cannot replace the binary
- **docker**: mark the official image so sovrium update recognises it
- **cli**: detect Homebrew installs from the binary path, not HOMEBREW_PREFIX
- **mcp**: do not list a manual automation switched off in config
- **server**: confine the retired-host redirect's host before printing it
- **server**: refuse a Host that lists several hosts with 400
- **pages**: open an edit form with the record's many-to-many links
- **pages**: name the language switcher once, and give it the attributes in its props
- **pages**: name a form embedded by reference as a form
- **mcp**: list a manual automation to a role exactly when that role may run it
- **mcp**: a caller with no identity is denied by every row-level rule
- **server**: trust X-Forwarded-Host for the retired-host redirect only behind a declared proxy
- **auth**: build the emailed invitation link from this instance's address
- **server**: refuse a request whose Host is not a host name with 400
- **docs**: say which requests trust a forwarding header, and what an unset BASE_URL advertises behind a proxy
- **server**: never print a Host header that is not a host name
- **mcp**: write tools apply every value rule and lock the records API applies
- **api**: a record's history answers to the record's read rules
- **pages**: an $app value never turns text content into markup
- **server**: believe forwarded host and scheme only behind a declared proxy
- **mcp**: write tools answer failures and malformed values as the records API does
- **mcp**: write tools apply the table's row-level rules
- **forms**: save a record's edit form through the same checks and effects as the API
- **pages**: print `$app` values as text inside an HTML template
- **pages**: keep a cached page's sharing image on the host each visitor asked for
- **tables**: fill a `$currentUser` default on the rows an upsert creates
- **pages**: print a date's weekday in list metadata and on gallery cards
- **pages**: a card qr-code's size and error-correction level are validated as a page qr-code's are
- **automations**: a missing key stays missing when it shares a name with a built-in or inherited member
- **forms**: mark a refused field invalid and name it by its label
- **pages**: read a `./` favicon from the root of public/ on nested pages
- **automations**: templates inside a path branch resolve as they do at the top level
- **pages**: a card qr-code honours its size, error-correction level and class
- **cli**: a bare init writes the same public/README.md a template ships
- **pages**: make a navigating gallery card a link and show attachment covers
- **design**: keep a page styled when one class list holds a stray quote
- **api**: answer a record history addressed by its table name
- **api**: read `true` and `false` as booleans in a checkbox filter shorthand
- **tables**: stamp a datetime whose default is `now` with the write time
- **cli**: seed attachment files into the bucket their field declares
- **mcp**: keep a whitelisted record's fields to the fields the whitelist names
- **forms**: keep untouched fields when an edit form is saved with its button
- **pages**: apply a public row rule to anonymous readers of a collection page
- **auth**: a custom role below level 80 is no longer treated as admin
- **pages**: the collections manual says who reads a gated article's Markdown
- **pages**: the data-binding manual states what emptiness and a section's limit mean
- **pages**: a section's pager counts no more rows than its limit
- **tables**: an empty list is empty to every filter, and emptiness reads any column type
- **tables**: a signed-in default fills a field left empty, in a batch create too
- **server**: the page-search index is replaced whole, and a shadowed public copy is reported
- **pages**: an article's own access fails closed, and its Markdown answers the readers its page answers
- **auth**: a built-in role listed for its landing never becomes the app's top role
- **tables**: a lookup can read another lookup
- **pages**: an empty list shows its empty state and a user field can default to the signed-in account
- **pages**: an article can be gated from its front matter, the docs layout names its parts, and a title match comes first
- **automations**: a chained run is finished before the server stops, and a cycle between two automations is refused at boot
- **pages**: a section bound to a table honours its limit anywhere on the page
- **pages**: a calendar opens a drawer on click, reads on a phone and refuses a colour field that is a multi-select
- **automations**: a form submission starts its automations with the stored row
- **tables**: a summary row works on a grid bound to a view
- **pages**: a drawer shows files, edits with the form's controls, opens other drawers and names itself in the address
- **api**: a filter with a malformed relative date is refused instead of forwarded
- **automations**: a status change that leaves its own trigger condition is accepted at boot
- **server**: the page-search index is written beside the database, not into the app folder
- **pages**: dragging an all-day event keeps its start day east of UTC
- **pages**: a form in an overlay the viewer cannot open reads no choices
- **pages**: cards draw the QR code of their record
- **pages**: an aggregated chart takes one series to name and colour it
- **tables**: a lookup through a link to the same table works
- **automations**: a record written by an automation starts the automations of its table, and create returns its id
- **pages**: a drawer title can name the record it opens
- **pages**: a calendar range that ends on a date shows its last day
- **pages**: related lists and list items show names and money as the grid does
- **pages**: cards draw badges, avatars and images of their record
- **pages**: every component names its type, including code blocks, QR codes and static widgets
- **pages**: an overlay opened by a hidden button stays hidden with it
- **forms**: an empty email, link or phone answer is stored as no value

### Performance Improvements

- **automations**: a hand-started batch checks its caller once
- **comments**: the mention picker loads readers' grants one page at a time
- **tables**: look up the reader's email only when a rule names it
- **activity**: judge the activity feed's read rules in the database
- **activity**: judge the activity feed's records a few at a time
- **tables**: keep the SQLite search index by key on every write
- **tables**: partition a grouped record list in one pass
- **auth**: skip the session lookup for a request that carries no credential
- **database**: turn PostgreSQL JIT compilation off on every connection

## [0.29.1](https://github.com/sovrium/sovrium/compare/v0.29.0...v0.29.1) (2026-09-27)

### Bug Fixes

- **cli**: detect the compiled binary on Windows so migrations and assets resolve from the embedded payload

## [0.29.0](https://github.com/sovrium/sovrium/compare/v0.28.0...v0.29.0) (2026-09-27)

### BREAKING CHANGES

- **env**: require env variables declared without `required`
- **buckets**: rename the default bucket to system and list record-linked files there
- **agents**: add the built-in System Agent and rename the default agent to system

### Features

- **cli**: read this binary's release notes with sovrium changelog
- **pages**: search can cover the pages a signed-in reader may open
- **automations**: list pending approvals so a page can resolve them
- **pages**: the sidebar can fold into a drawer behind a menu button on narrow screens
- **pages**: charts keep a select field's option order and colours, and a donut legend names its slices
- **pages**: bind a table component to one of the table's views
- **tables**: let a public view serve its named columns to visitors without an account
- **design**: choose the app's density step, per zone, and apply it to every page
- **pages**: load a grid page by page under one scroll
- **pages**: let a grid column name the field shown for a linked record
- **server**: warn at boot when open sign-up gives new accounts access to tables
- **automations**: default run timeout, kept steps on timeout, a finaliser for crashed runs, and a stuck-run sweep
- **pages**: open a navigate action or a url cell in a new tab
- **admin**: translate the automations page
- **email**: name the app in every subject, sender and greeting; list items and one-decimal sizes
- **app**: the Built with Sovrium badge can sit in a footer line instead of floating over content
- **cli**: seed accounts, user fields, same-table links, authorship and a pinned today
- **forms**: allow links and emphasis in help text and descriptions
- **admin**: weekly operational summary email
- **pages**: a record drawer lists the records related to the one it opened
- **forms**: read a field's choices from a table without a read permission
- **pages**: kanban cards print related records by name, relative dates in the reader's language, a currency footer format, and columns can start folded
- **pages**: let a breadcrumb keep a segment as text when it has no page
- **admin**: open a run on its own page with each step's logs
- **admin**: mark automatic pauses in the automations table
- **automations**: recover interrupted runs, roll up repeated failures, and pause after consecutive failures
- **pages**: let a list repeat inside a list
- **cli**: write each listed record's page and list it in the static sitemap
- **admin**: include each step's logs in the run detail read
- **cli**: refuse to drop a populated table unless migrate runs with --allow-destructive
- **forms**: show and require fields live as the visitor answers
- **admin**: notification preferences on the profile page
- **automations**: make failure alerts actionable and configurable
- **pages**: add a switch control to endpoint-bound forms
- **pages**: list a page's other languages as og:locale:alternate
- **cli**: serve Sovrium's agent skills as MCP prompts
- **cli**: write each article's Markdown twin in sovrium build
- **cli**: add sovrium skills to write agent skills into a project
- **pages**: validate the content-directory structured-data toggle
- **server**: add an operator timezone for every scheduled and displayed time
- **pages**: announce the RSS feed and Markdown twins in the page head
- **pages**: list public collection records in the sitemap
- **library**: add the settings form, guide-with-contents and side-panel form blocks
- **automations**: page through APIs that continue after the last item
- **library**: add the confirmation toast block
- **cli**: install individual API operations from the library
- **library**: add twelve automation recipes
- **library**: add data-bound blocks that read the operator's own tables
- **library**: add application interface blocks
- **library**: add marketing section and page element blocks
- **library**: give the Qonto connection its API root and transaction operations
- **library**: add eighteen ready-made connections
- **library**: add the Slack connection and a new-record-to-Slack recipe
- **library**: add a shared block kit and rebuild the centered hero on it
- **library**: let an entry declare the tables it reads
- **connections**: exchange a stored credential for a short-lived token
- **connections**: exchange and renew Meta long-lived tokens
- **connections**: report reconnect-needed before a non-renewable token lapses
- **ai**: add push-to-talk voice input to the chat component
- **forms**: record audio in the browser on attachment fields
- **automations**: verify Stripe, Slack, Svix and base64 webhook signatures
- **automations**: encode an http action's query object value by value
- **automations**: keep only new items between polling runs with state filterNew
- **automations**: answer the Meta webhook subscription handshake
- **connections**: default the OAuth2 redirect URI and resolve known provider endpoints
- **connections**: keep OAuth2 token response fields and read them as the API root
- **connections**: obtain OAuth2 tokens with the client credentials grant
- **automations**: call a declared connection operation from an automation step
- **cli**: add sovrium library to browse and install ready-made blocks, connections and recipes

### Bug Fixes

- **cli**: print the whole document when changelog, docs or design-system output is piped
- **pages**: keep a navigation menu's authored content after the page loads
- **pages**: render a navigation menu's test id once after hydration
- **pages**: a closing record drawer is named once, not twice, while it animates out
- **pages**: a filter bar narrows a table's own filter instead of replacing it
- **forms**: a user picker masks the address of an account with no name
- **forms**: an empty optional barcode with a format is stored empty
- **tables**: name the refused column of a single-column unique violation on SQLite
- **cli**: stop sovrium update from hanging on a stalled download
- **pages**: every data component on a page follows its filter bar
- **pages**: charts and timelines grouped by a person or a linked record show the name
- **pages**: toggles, scroll areas, navigation menus and menubars become interactive on their own
- **pages**: the record drawer names its type
- **pages**: a read-only drawer shows chips and currency as the grid does
- **pages**: a dialog wrapping a form shows one title
- **forms**: a status column is a select and a user column offers accounts by name
- **forms**: an empty optional answer is stored empty and a refused submission says which field
- **pages**: a page whose children include plain text renders again
- **tables**: formula columns are listed by the SQLite catalog read as on PostgreSQL
- **tables**: bound the account ids one user-label read binds
- **pages**: a dialog embedding a form the visitor may not use hides the page like a bare form
- **ai**: chat failure and not-configured notices follow the page language
- **buckets**: audit entries for browsing and uploading name the bucket touched
- **pages**: user fields show the account's name wherever a value is shown as text
- **pages**: props.className reaches every data component's own element
- **pages**: every component names its type on the element it renders, including islands
- **pages**: a $currentUser filter is resolved for every data component wherever it sits on the page
- **pages**: a referenced form renders its fields inside any dialog or container
- **tables**: adding a column after a formula column no longer fails the migration
- **pages**: the session page search drops any result that is not a same-origin path
- **pages**: search answers vary on the session cookie
- **pages**: page search leaves out a page whose embedded form the reader may not use
- **pages**: the command palette no longer returns pages the caller may not open
- **forms**: show a keyboard focus ring on hosted-form rating ranks
- **automations**: resolve an approval once and bound the approvals list
- **automations**: only a named approver can resolve an approval request
- **forms**: render currency, percentage and rating columns as typed inputs and draw section headings on hosted forms
- **pages**: a search-mode list no longer serialises columns the visitor may not read
- **pages**: collection pages and their prev/next links print only what the visitor may read
- **pages**: a table whose read is "authenticated" is shown only to signed-in visitors
- **pages**: a folded sidebar stays reachable without JavaScript
- **pages**: a page bound to one record answers 404 and prints nothing the visitor may not read
- **pages**: a single-record form carries only the fields its visitor may read
- **pages**: a form that inherits its page's record shows only what the visitor may read
- **pages**: an edit form on a page bound to one record opens with that record's values
- **pages**: the language switcher opens a styled menu and no longer prints its fallback language
- **pages**: previous and next links walk the sidebar's order across sections
- **pages**: the prose markdown layout is styled like the docs layout, and callouts carry their declared type
- **pages**: a series chart's currency axis prints the currency its series share
- **pages**: charts sort category names as displayed, and pies rank slices largest first by default
- **pages**: the timeline's Today marker no longer covers the first bar's label
- **pages**: calendar controls read Today, Month, Week, Day in the page's language
- **pages**: KPI currency and compact values follow the page's language and the field's precision
- **tables**: sort group headers in the page's language and read each group's first row in one pass
- **pages**: keep a nested grid bound to a view readable through the view's own grant
- **tables**: name relationship groups by the related record's display field, not its id
- **design**: a declared dark palette follows the visitor's system scheme by default
- **pages**: keep a load-more grid's rows apart from a numbered grid's in the shared cache
- **tables**: keep the page-language currency symbol in place when a negative format is declared
- **pages**: hide data grids over tables the visitor cannot read, wherever the grid sits
- **api**: the health endpoint tells anonymous callers only that the server is up
- **pages**: key system-bound reads on the whole binding now that islands share a cache
- **api**: the API reference is titled and versioned after the app and drops the vendor's outbound controls
- **api**: records no longer carry an empty deleted_at field
- **pages**: share one query cache between the islands on a page
- **tables**: revalidate record and admin reads with ETag instead of resending them
- **tables**: hide create, import and add-row from visitors who cannot create records, wherever the grid sits
- **tables**: group thousands in whole-number currency amounts and follow the page language
- **pages**: refuse a grid page size above what the records API serves
- **mcp**: tool calls check table and field permissions against the account's real role
- **tables**: resolve relationship labels only from fields the reader may see
- **pages**: filter a hand-written command palette page list by page access
- **server**: the boot banner finds the admin account the environment just created when custom roles are declared
- **mcp**: read tools stay marked read-only whatever the table's annotation override
- **pages**: the command palette offers only the pages the visitor may open
- **pages**: the RSS feed is built only from a page anyone may open
- **mcp**: a tool call cannot create, change or delete a record its caller's role may not touch over the API
- **admin**: answer unknown pages in the account's language, and let any host save the console's languages
- **pages**: format every date in the page's language
- **pages**: visibility gates also reach responsive children and keep tabs aligned
- **design**: give every unchecked control a visible outline
- **auth**: escape names and links in every email, and sanitise names on every write path
- **admin**: keep the weekly summary running past an unreadable snapshot, and summarise error lines
- **pages**: check every navigation address before following it
- **forms**: keep a public choice list away from sensitive or hidden columns reached through computed fields
- **pages**: the llms.txt exports leave out pages that require signing in
- **pages**: a magic-link sign-in form asks for an email only
- **pages**: content limited to a role or to signed-in visitors is left out of the page instead of hidden by style
- **cli**: describe in the migration plan how a table becomes or stops being view-backed
- **cli**: refuse a seed account role the app does not define before creating any account
- **design**: a plain border uses the theme's border colour instead of the text colour
- **pages**: keep two kanban boards on one page from pointing their fold toggles at each other
- **pages**: re-read a drawer's related records on every open
- **pages**: hide a drawer's related sections from signed-out visitors who may not read them
- **api**: refuse a malformed signed-URL token cleanly
- **cli**: seed upsert keeps created_at on update and fills created-by fields
- **pages**: keep typing in a form field while its interactive version loads
- **admin**: keep the run breadcrumb's middle segment as text
- **migrations**: never refuse or report a drop of the SQLite search index
- **cli**: ship the scripts a built site loads and leave dev reload out
- **pages**: render a form field's description as help text
- **email**: head every email with the app's own name
- **pages**: render number, date, currency, percentage, rating and user fields of a table-bound form as their own controls
- **ai**: complete Mistral calls — name the extraction schema and accept a null tool-call list
- **migrations**: never drop the base or junction tables behind config tables
- **pages**: keep auto-saving forms and system grids working with drawer record binding
- **pages**: make drawer forms wait for, bind to and protect the right record
- keep pager summary and comment sort text whole on small screens and short controls
- **forms**: translate the closed form page and honour the chosen language
- **tables**: build the command palette index on the table behind a lookup view
- **forms**: let visitors without an account submit into tables that record who created a row
- **pages**: run forms and islands placed in drawers, popovers and scroll areas
- **forms**: serve hosted form pages in the app's language and text direction
- **tables**: give compact selects a proportionate chevron and keep the pager label on one line
- **pages**: keep restricted Markdown twins out of shared caches
- **pages**: answer 404 for a soft-deleted record page
- **pages**: list only readable, live records in the sitemap and cache it
- **automations**: declare every run-detail field the API returns
- **cli**: refuse to write agent skills through a symlink
- **forms**: keep a select's options readable while its placeholder is chosen
- **forms**: keep the select chevron clear of the value on right-to-left pages
- **pages**: submit forms rendered inside a dialog through their action
- **forms**: draw native selects with the same chrome as text inputs
- **cli**: explain when the data directory cannot hold the encryption key
- **automations**: keep what a code action logs in its run history
- **pages**: read the chat component's options from where the docs say to write them
- **automations**: retry only transient failures and honour Retry-After
- **cli**: locate every validate --json finding by its path
- **pages**: send Vary: Accept on content-negotiated article URLs
- **pages**: mark the Markdown of a noindex page with X-Robots-Tag
- **cli**: drop the SOVRIUM_GENERATE_MANIFEST build variable
- **pages**: write a sitemap lastmod only when the date is known
- **pages**: omit hreflang alternates when no absolute origin is known
- **pages**: stop disallowing noindex pages in robots.txt
- **pages**: lazy-load images by default and fetch the hero first
- **pages**: refuse AVIF sharing images in openGraph and twitter
- **tables**: record the audit trail for writes made by the system actor
- **ai**: refuse a speech timeout too long for a timer, and log speech engine failures
- **ai**: rate-limit anonymous AI requests on apps without authentication
- **ai**: bound transcription requests by the speech timeout and answer 504 or 502 on engine failure
- **auth**: refuse a session presented from another client on pages too
- **buckets**: refuse attachment references to files outside the field's bucket or the writer's reach
- **pages**: read page records over loopback and 404 a declared home page that cannot render
- **pages**: settle a gallery whose records the visitor may not read
- **pages**: keep calendar event text legible in the light palette
- **pages**: draw a dropdown label trigger as tall as the buttons beside it
- **pages**: align data table columns as declared
- **pages**: format list item metadata as each entry declares
- **pages**: format KPI numbers with their declared digits and the page's language
- **pages**: keep drawers closed until opened
- **pages**: pre-fill record forms and derive breadcrumbs wherever they are placed
- **pages**: build the table of contents from headings inside reusable components
- **pages**: show a toast when a toast button is clicked
- **pages**: format data table cells and toolbar captions in the page's language
- **pages**: mount data-bound lists placed through a reusable component
- **automations**: refuse automations that name a table the app does not declare
- **admin**: translate the connections directory and let its status chips hug their label
- **admin**: label and flag connections whose token needs a new authorization
- **cli**: list the speech-to-text variables in the generated .env.example
- **ai**: refuse a cloud speech provider configured without an API key
- **connections**: send Basic credentials with an empty username when a password is set

### Performance Improvements

- **automations**: refuse oversized recordings before downloading them

## [0.28.0](https://github.com/sovrium/sovrium/compare/v0.27.1...v0.28.0) (2026-09-23)

### Features

- **ai**: add speech-to-text transcription action and provider

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
- **eco**: reconcile the lever surface with the refusal of unrecognised eco lever values
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

- **migrations**: make dynamic-table schema re-init idempotent across upgrades

## [0.15.0](https://github.com/sovrium/sovrium/compare/v0.14.0...v0.15.0) (2026-07-18)

### Bug Fixes

- **theming**: mint shadcn-convention alias utilities on the default theme
- **tables**: admit anonymous read of read:all tables
- **i18n**: localize the data-table create-record affordance
- **server**: drop Hono context param from the empty-chunk stub helper
- **pages**: normalize colored status options for kanban group-by
- **build**: pad zero-byte island split chunks that broke production hydration

## [0.14.0](https://github.com/sovrium/sovrium/compare/v0.13.0...v0.14.0) (2026-07-17)

### Features

- navbar hover-to-open, authored trigger override, and child target/rel
- **cli**: scaffold init from remote GitHub template repositories
- **templates**: ship deploy + mirror files with every template
- **ai**: boot AI agents inert when no provider is configured
- navbar badges, dropdown chevron, and inverted popup
- **examples**: add automation-recipes and knowledge-base templates
- **examples**: add the company-os flagship template
- **website**: re-slice docs sub-nav into 8 product tabs + chrome polish
- **examples**: add people, events, assets, and expenses business apps
- **examples**: add projects, helpdesk, and content-calendar business apps
- serve contentDir.index at the collection base path
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
- attribute record actions to the triggering user via runAs
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
- **tables**: correct the many-to-many record field types
- complete m2m-on-create for view-backed tables and the form path
- split many-to-many fields on record create and resolve them on read
- view-backed insert applies base DEFAULTs and returns the real id
- **comments**: opt-in per-user comment read/unread state
- **theme**: raise --sv-fg-subtle to WCAG AA contrast in light and dark
- **pages**: render the default 404/500 pages with theme tokens
- exclude soft-deleted child rows from rollup and count aggregates
- apply admin-equivalent override to field-level read filtering
- enforce permissions.comment server-side
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

- RAG Phase 2 — opt-in sqlite-vec ANN + FTS5 hybrid retrieval
- **pages**: alert-dialog confirm dispatches its configured automation action
- **automations**: approval action pauses run, resolves via run-scoped approve/reject
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
- **comments**: filter non-admin comment list to approved-only
- **comments**: persist resolved moderation status on create
- **comments**: surface guest name in comment thread
- **comments**: persist guest identity on comment create

### Bug Fixes

- map numeric precision to SQL scale, not total digits (#15)
- defer FK enforcement during SQLite schema-migration transaction
- align SQLite field-value serialization with Postgres
- emit ISO-8601 timestamps from SQLite updated_at trigger
- **types**: export DeleteViewTarget so @sovrium/types .d.ts emit succeeds
- harden email validation and HTML-tag regexes flagged by CodeQL
- **css**: compile per-app CSS under ECO_DESIGN_LAYER=off (light parity)
- **css**: serve per-app CSS when app adds candidates beyond builtin
- **comments**: persist pending/rejected comments so admin queue lists them

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
- **runtime-views**: 404 for cross-table share
- **design-system**: prestyle field-type affordances (rating/currency/percentage/color/attachments) with var-fallback recipe
- **runtime-views**: URL contract + shared-view lookup
- **design-system**: prestyle specialty + ai surfaces (comments/lang-switcher/reorderable-list/time-picker/ai-chat) with var-fallback recipe
- **runtime-views**: Share button generates view link
- **design-system**: prestyle interactive + content surfaces (link/button-group/icon/image/iframe/audio/video/search) with var-fallback recipe
- **design-system**: prestyle display surfaces (carousel/empty-state/list-item/scroll-area/speech-bubble/static-table/timeline) with var-fallback recipe
- **runtime-views**: drain remaining save-personal-views + cycle-4 deferred fixmes
- **runtime-views**: wire the saved-views surface — save, apply and delete personal views
- **data-table**: runtime group-by picker + collapsible groups
- **design-system**: prestyle typography (heading/paragraph/code/blockquote/list) with var-fallback recipe
- **design-system**: prestyle data surfaces (data-table chrome + kanban + chart shells) with var-fallback recipe
- **pages**: runtime multi-sort + view switcher
- **design-system**: prestyle form surfaces (form-card + file-upload dropzone) with var-fallback recipe
- **design-system**: prestyle layout surfaces (card + divider) with var-fallback recipe
- **pages**: runtime filter builder
- **design-system**: prestyle navigation surfaces (breadcrumb/pagination) with var-fallback recipe
- **design-system**: prestyle feedback surfaces (badge/alert/skeleton/progress) with var-fallback recipe
- **pages**: user table preferences runtime
- **design-system**: prestyle tabs + accordion islands with var-fallback recipe
- **design-system**: prestyle overlay islands (dialog/popover/tooltip/drawer/menu) with var-fallback recipe
- **design-system**: prestyle date-picker islands with var-fallback recipe
- **design-system**: prestyle numeric islands (number-input, slider) with var-fallback recipe
- **design-system**: prestyle toggle/switch/toggle-group islands with var-fallback recipe
- **design-system**: prestyle select island with var-fallback recipe
- **design-system**: prestyle input renderer with state defaults
- **design-system**: prestyle button-renderer with variant/size/state defaults
- **pages**: tabs renders React children + nested forms get collection record
- **design-system**: prestyled-by-default islands contract + css-var helper
- **pages**: drawer save closes + sibling table refreshes
- **pages**: guest-comment storage + inline form runtime
- **pages**: single-level threading — reply UI + collection auto-bind + API depth check
- **pages**: synthesized CRUD update obeys table-update perms
- **data-components**: sort-direction indicator
- **pages**: alert dismissibility via event-delegated toggle
- **data-components**: column-visibility drag-reorder
- **pages**: record-detail composition — tabs / openDrawer dispatch / data-form alias / CRUD synthesis
- **pages**: moderation pipeline — manual queue + autoApprove + PATCH-status + auth-required
- **css**: ship Source Serif 4 italic via inline @font-face
- **pages**: spam guards — rate-limit + link-threshold + blocked-words + guest-comment auth-exemption
- **automations**: wire comment trigger to fire on approved comments
- **pages**: thread session into comment-thread island props
- **pages**: page-search client island — interactive results UX
- **pages**: comment thread + count hydration islands
- **pages**: SSR comment form skeleton + honeypot + schema foundation
- **pages**: pageSearch SSR placeholder + renderer dispatch
- **pages**: pre-boot search-index generation for sovrium start
- **pages**: data-sovrium-search-body marker + indexer narrowing
- **pages**: Sovrium-native search indexer
- **pages**: schema+routes foundation — user_saved_views + user_table_preferences
- **pages**: activation gate predicate + build-path stub
- **forms**: F-04 — admin analytics & responses dashboard + drain 11 specs
- **sovrium**: fix 5-bug cluster from sovrium-partner consumer-app
- **pages**: close static-build access leak
- **pages**: pageSearch component schema stub + spec corpus
- **pages**: schema prep — OpenDrawerActionSchema + 10 narrowing fixes
- **forms**: F-03 — anti-spam rate-limit + IP hash-on-write + drain 6 specs
- **buckets**: B-01 — attachment field signed-URL enrichment + drain 6 specs
- **schema**: schema_prune retention resolver + REST handler + MCP tool
- **automations**: AU-03 — auth-event dispatch bridge + drain 3 specs
- **automations**: AU-02 — concurrency scheduler + cancel-mid-flight + drain 2 specs
- **cli**: quiet better-auth verifier + admin display in banner
- **cli**: record a config version on reload, with drift detection
- **admin**: ADM-1 — GET /api/admin/users/overview endpoint + drain 6 specs
- **pages**: P-05 — text component markdown rendering + drain 6 specs
- **pages**: P-06 — TOC renderer (auto-anchor headings, sticky nav) + drain 5 specs
- **pages**: P-07 — add FetchActionSchema + drain 6 toast specs
- **cli**: scaffold public/ in init for web-facing templates
- **infra**: harden setupPublicDirRoute with realpath + secret-blocklist
- **cli**: default --publicDir to <app.yaml dir>/public with opt-out flag
- **pages**: add appUrl deep-link metadata to TwitterCardSchema
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

- **database**: preserve auto-generated lookup views across boots

## [0.8.0](https://github.com/sovrium/sovrium/compare/v0.7.2...v0.8.0) (2026-05-25)

### Features

- **database**: emit SQLite INSTEAD OF triggers for view-backed tables
- **database**: align SQLite dynamic-table default id to INTEGER (ADR-016)
- **pages-social**: add comments + commentCount page components (SSR scaffolding tier)
- **admin-automations**: drain overview.spec.ts (8 fixmes → GREEN)
- **data-components**: accessible labels on the runtime sort-direction indicator
- **data-components**: accessible toggles in the runtime column-visibility menu
- **data-components**: navigate on a data-table row click, with row-field tokens in the path
- **data-components**: top-level label and confirm on the button component
- **data-components**: render select columns as a select in standalone forms
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
- **cli**: an add alias and dedicated help for the agents command
- **cli**: reject an unknown flag by name instead of falling through to start
- **admin**: drain ADMIN-CONFIG-VERSION + ADMIN-TABLES-OVERVIEW
- **forms**: partner role, defaultValue, formRef gates
- **forms**: availability.closedPage schema
- **pages-overlays**: add hover-card island + drain OVERLAY-029..034 + REGRESSION
- **pages-overlays**: wire drawer island hydration + drain DRAWER-001..004 + REGRESSION
- **pages-navigation**: drain dropdown-menu — render icons + fix top-level schema field pickup
- **pages-navigation**: drain split-button — register dropdown-menu/context-menu as island types
- **bootstrap**: skip the environment admin bootstrap once a user exists, and purge stale bootstrap tokens

### Bug Fixes

- **realtime**: dedup presence-sync by user.id, make leave connection-aware
- **cli**: honor --help on update command
- **forms**: coerce scalar values to arrays for multi-select column inserts
- **cli**: short-circuit start --help to prevent watch-mode hang
- **server**: make SIGUSR1 reload atomic with readFileSync
- **tables**: resolve FK column via reciprocalField in rollup and count generators
- **admin**: consolidate audit-log store — route bucket emits through emitAuditEvent
- **admin**: tighten audit-log schema + emit nextCursor: null (Wave 3 merge)
- **admin**: reconcile Lane A + Lane B audit-log keystone merge (Wave 3)
- **pages-overlays**: import pickCompField — Wave 2 Lane B/C merge interaction bug

## [0.7.2](https://github.com/sovrium/sovrium/compare/v0.7.1...v0.7.2) (2026-05-24)

### Features

- **i18n**: resolve translated page titles before they reach the command palette
- **ai**: do not persist a chat turn whose stream closed before its end marker
- **api**: drain mcp-schema-tools.spec — wire 7 MCP parity tools + family catalog (partial)
- **api**: opt-in boot-time seeding of the config version history (SOVRIUM_BOOT_SEED_VERSION)

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
- **pages/overlays**: dialog component-type + alert-dialog branch
- **pages/display**: badge status-indicator variant
- **pages**: code-block component + landmine rest of layout (CONTENT-006..009)
- **pages**: activate skeleton + progress specs (OVERLAY-035..042, OVERLAY-043..049)
- **pages**: button-group + pagination components
- **pages**: implement breadcrumb component
- **pages**: wire tooltip island hydration
- link global stylesheet from form-page <head> + landmine markers for embedding specs
- schema diff + export admin endpoints
- SSR honeypot rendering + spam isolation
- X-Sovrium-Config header surfaces driftStatus
- **automations**: protect standard OAuth2 params from extraAuthParams/extraTokenParams override
- form access control gate + submitter id capture
- **automations**: implement record/upsert action operator
- surface driftStatus + source in schema status
- **pages**: wire popover island hydration + trigger/content
- draft rebase endpoint (REST + MCP)
- **automations**: implement record/delete action operator
- embed route gating + frame-ancestors CSP
- **pages**: video embed auto-conversion, track subtitles, autoplay mapping
- **automations**: HMAC-sign outgoing webhook payloads with props.secret
- form availability windows, atomic submission cap, honeypot anti-spam
- expose draftStale in schema status envelope
- **automations**: expose step outputs under .result alias for chaining
- **pages**: implement list search-first display
- single-page form field groups
- per-form display overrides
- implement calendar + kanban component search bars
- standalone form prefill resolution
- implement progress + skeleton feedback components
- runtime /sitemap.xml + /robots.txt
- form $t: resolution against app catalog
- signed URL API endpoint auth + Content-Disposition

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
- **cli**: array-element $ref resolves full-object-per-file
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
- **buckets**: image-transform crop modes
- **tables**: webhook authentication
- **buckets**: advanced bucket features + storage env validation
- **tables**: per-table outgoing webhooks
- **pages**: data-chart series styling
- **pages**: form auto-save
- **tables**: advanced table features
- **pages**: data-chart legend + tooltip
- **pages**: data-chart axis labels
- **pages**: data-table auto-save debounce timing
- **records-api**: optimistic-lock conflict detection on record update
- **pages**: implement data-chart aggregate functions
- **pages**: implement data-table inline auto-save

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

- **automations**: implement digest/release automation action
- **automations**: implement digest/collect automation action
- **automations**: implement crypto/hash and crypto/hmac automation actions
- **automations**: implement auth/unbanUser automation action
- **automations**: implement auth/createUser automation action
- **automations**: implement auth/banUser automation action
- **automations**: implement auth/assignRole automation action
- **automations**: implement approval/request automation action
- **automations**: implement analytics/track automation action
- **automations**: tool-call validation for ai/agent action
- **automations**: implement ai/agent automation action
- **auth**: enforce group maxMembers capacity
- **auth**: implement group-based table permissions
- **auth**: implement group-based page access control
- **auth**: implement group-aware permission evaluation
- **auth**: implement admin API for group management
- **api**: implement schema-management version restore
- **api**: implement schema-management draft publish
- **security**: GDPR account export & deletion endpoints
- **api**: implement schema-management draft preview
- **api**: implement schema-management status endpoint + enablement gate
- **api**: implement schema-management draft lifecycle
- **api**: implement schema-management draft REST resources
- **api**: implement MCP schema-management tools
- **ai**: implement ai-tag compute trigger + model override
- **ai**: require AI_MODEL for openai-compatible provider
- **ai**: implement base-URL config for Ollama / local AI providers
- **ai**: propagate field-level maxTokens to AI compute calls
- **ai-chat**: implement automation triggering from chat
- **ai-chat**: implement AI chat tool calling
- **ai-chat**: implement AI chat record queries
- **ai**: enforce RBAC on knowledge-table embedding
- **ai**: document knowledge ingestion
- **ai**: learned-facts memory and agent-bound chat persistence
- **ai**: interactive ai-chat island
- **ai**: retrieval-augmented generation (RAG)
- **ai**: persist chat conversations to PostgreSQL
- **ai-chat**: field-level write enforcement for chat mutations
- **ai-chat**: implement AI chat record mutations
- **ai-chat**: implement AI chat rate limiting
- **ai-chat**: implement AI chat error handling
- **ai-chat**: implement AI chat cross-cutting concerns
- **ai-chat**: implement AI chat context block
- **ai-agents**: implement agent tools
- **ai-agents**: implement agent system prompts
- **ai-agents**: implement agent scheduling
- **ai-agents**: implement agent permissions
- **ai-agents**: implement agent limits
- **ai-agents**: implement agent definition
- **ai-agents**: implement agent cross-cutting rules
- **ai-agents**: implement human-in-the-loop agent approval

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

- implement file type validation for attachment fields
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
- implement table data source binding for page sections

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

- support the shorthand auth strategy format
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
