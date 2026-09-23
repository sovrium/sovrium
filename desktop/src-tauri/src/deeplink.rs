// Copyright (c) 2025-2026 ESSENTIAL SERVICES
//
// This source code is licensed under the Business Source License 1.1
// found in the LICENSE.md file in the root directory of this source tree.

//! `sovrium://` deep links, and the rule that a link never runs anything.
//!
//! # The threat, stated plainly
//!
//! A deep link is a URL any web page can navigate to. Clicking a link in a
//! forum post, an email, or an ad hands this process a string chosen by someone
//! who is not the user, delivered through the OS with the same standing as a
//! link the user typed. On Windows and Linux it arrives as **argv of a second
//! process**, which is the same channel as a command line — so argv and deep
//! links are one attack surface, not two.
//!
//! Three properties follow, and none of them is a preference:
//!
//! * **One verb.** `new` and nothing else. A URL naming any other action is
//!   refused rather than ignored, so a future verb cannot be reached by a link
//!   written before it existed.
//! * **Shape before meaning.** A template slug must match
//!   [`TEMPLATE_PATTERN`]; a URL must be `https`. Both are checked before the
//!   value is shown to anyone, so a hostile string cannot reach the confirmation
//!   dialog and spoof it with newlines or a fake prompt.
//! * **Always a dialog, never an auto-run.** Parsing produces an
//!   [`Intent`] — a value. Acting on it is a separate step that goes through the
//!   user. A link that scaffolds a project without being confirmed is a remote
//!   write primitive, and the confirmation is what it is not.
//!
//! The shell also never **fetches** the `url=` target. `sovrium init --from-url`
//! owns that, behind the engine's SSRF-guarded loader with its timeout, its size
//! cap, its decode-before-write and its refusal of remote `.ts` (ADR-036 D7).
//! Two fetchers would mean two threat models, and the shell's would be the one
//! nobody audited.

use tauri::{AppHandle, Emitter, Runtime, Url};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

/// The maximum length of a deep link the shell will look at.
///
/// A URL is delivered by the OS and may be any length. Two kilobytes is far
/// beyond any legitimate `sovrium://new?template=crm`, and bounding it before
/// parsing means a multi-megabyte argv cannot become a multi-megabyte dialog
/// string or a log line that fills a disk.
pub const MAX_LINK_BYTES: usize = 2048;

/// The scheme the shell answers to.
pub const SCHEME: &str = "sovrium";

/// Allowed shape of a template identifier.
///
/// Either an embedded slug (`crm`) or an `owner/repo`-ish pair, in lowercase
/// kebab with digits. Deliberately narrower than "what `init` might accept": the
/// shell's job is to refuse everything it does not recognise, and `init`'s job is
/// to refuse what is left. Path traversal, absolute paths, shell metacharacters,
/// whitespace and non-ASCII all fail this before anything sees them.
pub const TEMPLATE_PATTERN: &str = "^[a-z0-9-]+(/[a-z0-9._-]+)?$";

/// What a valid `sovrium://` link asks for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Intent {
    /// Scaffold a new project from an embedded template.
    NewFromTemplate { template: String },
    /// Scaffold a new project from a remote config.
    ///
    /// Carried as a parsed [`Url`]'s string so the caller cannot accidentally
    /// hand a non-https value onward: only this module constructs it.
    NewFromUrl { url: String, host: String },
}

/// Why a link was refused. Every variant is a sentence a dialog can show.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Refusal {
    TooLong,
    NotOurScheme,
    UnknownAction(String),
    MissingTarget,
    BothTargets,
    BadTemplate(String),
    NotHttps(String),
    Unparseable,
}

impl Refusal {
    /// A message for the user, in plain language and without echoing a hostile
    /// string longer than a phrase.
    pub fn message(&self) -> String {
        match self {
            Self::TooLong => "That link is too long to be a Sovrium link.".into(),
            Self::NotOurScheme => "That is not a Sovrium link.".into(),
            Self::UnknownAction(a) => format!(
                "Sovrium links can only create a new project. This one asked for “{}”.",
                truncate(a, 40)
            ),
            Self::MissingTarget => {
                "That link does not say which template or address to start from.".into()
            }
            Self::BothTargets => {
                "That link names both a template and an address. It can only name one.".into()
            }
            Self::BadTemplate(t) => format!(
                "“{}” is not a template name Sovrium recognises.",
                truncate(t, 40)
            ),
            Self::NotHttps(s) => format!(
                "Sovrium only opens configurations over https. That link uses “{}”.",
                truncate(s, 16)
            ),
            Self::Unparseable => "That link could not be read.".into(),
        }
    }
}

fn truncate(s: &str, max: usize) -> String {
    let cleaned: String = s
        .chars()
        .filter(|c| !c.is_control())
        .take(max)
        .collect::<String>();
    if s.chars().count() > max {
        format!("{cleaned}…")
    } else {
        cleaned
    }
}

/// Does a template identifier match [`TEMPLATE_PATTERN`]?
///
/// Hand-written rather than pulled from `regex`: one pattern does not justify a
/// dependency, and an explicit character walk is auditable line by line, which
/// a regex on a security boundary is not.
fn is_valid_template(value: &str) -> bool {
    if value.is_empty() || value.len() > 100 {
        return false;
    }
    let mut segments = value.split('/');
    let Some(first) = segments.next() else {
        return false;
    };
    let second = segments.next();
    if segments.next().is_some() {
        return false; // more than one slash
    }
    let first_ok =
        !first.is_empty() && first.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    let second_ok = match second {
        None => true,
        Some(s) => {
            !s.is_empty()
                && s.chars().all(|c| {
                    c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '.' || c == '_'
                })
                // `..` is the traversal spelling `.` and `_` would otherwise
                // permit; refuse it explicitly rather than by luck.
                && !s.contains("..")
        }
    };
    first_ok && second_ok
}

/// Parse one link into an [`Intent`], or say why not.
///
/// Pure: it reads a string and returns a value. It opens nothing, writes
/// nothing, fetches nothing and asks nobody. That separation is what makes the
/// confirmation dialog unskippable — there is no path from a URL to the file
/// system that does not pass through a caller deciding to act.
pub fn parse(raw: &str) -> Result<Intent, Refusal> {
    if raw.len() > MAX_LINK_BYTES {
        return Err(Refusal::TooLong);
    }
    let url = Url::parse(raw).map_err(|_| Refusal::Unparseable)?;
    if url.scheme() != SCHEME {
        return Err(Refusal::NotOurScheme);
    }

    // `sovrium://new?…` parses with "new" as the HOST, while `sovrium:new?…`
    // parses it as the PATH. Both spellings reach an OS handler, so both are
    // read here rather than trusting that a link generator picked one.
    let action = url
        .host_str()
        .map(str::to_string)
        .filter(|h| !h.is_empty())
        .unwrap_or_else(|| url.path().trim_matches('/').to_string());

    if action != "new" {
        return Err(Refusal::UnknownAction(action));
    }

    let mut template: Option<String> = None;
    let mut target_url: Option<String> = None;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "template" => template = Some(value.into_owned()),
            "url" => target_url = Some(value.into_owned()),
            // Unknown parameters are ignored rather than refused: an OS or a
            // link shortener may append tracking keys the user did not write,
            // and refusing the whole link over one would break a good link.
            _ => {}
        }
    }

    match (template, target_url) {
        (Some(_), Some(_)) => Err(Refusal::BothTargets),
        (None, None) => Err(Refusal::MissingTarget),
        (Some(t), None) => {
            if is_valid_template(&t) {
                Ok(Intent::NewFromTemplate { template: t })
            } else {
                Err(Refusal::BadTemplate(t))
            }
        }
        (None, Some(u)) => {
            let (url, host) = parse_config_url(&u)?;
            Ok(Intent::NewFromUrl { url, host })
        }
    }
}

/// Validate an address a configuration may be fetched from, returning it and
/// its host.
///
/// Shared by the deep-link parser and by the "start from an address" form, so
/// that a URL typed into the window and a URL arriving from a web page pass the
/// **same** gate. Two gates would mean two answers to "is https required?", and
/// the weaker one would be the one nobody re-read.
///
/// This is the shell's whole share of the checking. Everything else that makes
/// a remote config safe to fetch — the SSRF guard, the timeout, the size cap,
/// decoding before writing, the refusal of a remote `.ts` and of a remote
/// `$ref` — belongs to `sovrium init --from-url`, which owns the fetch. The
/// shell never retrieves the address itself, so it needs no threat model for
/// what comes back.
pub fn parse_config_url(raw: &str) -> Result<(String, String), Refusal> {
    if raw.len() > MAX_LINK_BYTES {
        return Err(Refusal::TooLong);
    }
    let parsed = Url::parse(raw).map_err(|_| Refusal::Unparseable)?;
    if parsed.scheme() != "https" {
        return Err(Refusal::NotHttps(parsed.scheme().to_string()));
    }
    let host = parsed.host_str().ok_or(Refusal::Unparseable)?.to_string();
    Ok((parsed.to_string(), host))
}

/// The confirmation a user must read before anything happens.
///
/// The **host** is named first for a URL intent, because the host is the only
/// part of a link that says who is being trusted, and it is the part a long
/// path is designed to push off the end of a dialog.
pub fn confirmation_prompt(intent: &Intent) -> String {
    match intent {
        Intent::NewFromTemplate { template } => format!(
            "A link is asking Sovrium to create a new project from the “{template}” template.\n\n\
             Nothing is created until you choose a folder."
        ),
        Intent::NewFromUrl { host, url } => format!(
            "A link is asking Sovrium to create a new project from a configuration hosted at {host}.\n\n\
             Full address:\n{url}\n\n\
             Only continue if you trust {host}. Nothing is downloaded or created until you choose a folder."
        ),
    }
}

/// The event the frontend listens on once a link has been confirmed.
pub const INTENT_EVENT: &str = "sovrium://deep-link";

/// What the frontend receives for a confirmed link. It still has to ask the
/// user for a folder before anything is written — the shell has confirmed the
/// *link*, not the *write*.
/// Exactly one of the two is `Some` — [`parse`] refuses a link naming both.
/// They stay separate rather than collapsing into one string because they take
/// different paths into the engine, and re-deciding which is which in the
/// frontend would repeat a classification already made under review here.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmedIntent {
    pub template: Option<String>,
    pub url: Option<String>,
}

/// Handle one incoming link, start to finish.
///
/// Spawns a thread because `blocking_show` must not run on the main thread, and
/// because everything after the dialog waits on the user.
pub fn handle<R: Runtime>(app: &AppHandle<R>, raw: String) {
    let app = app.clone();
    std::thread::spawn(move || {
        let intent = match parse(&raw) {
            Ok(intent) => intent,
            Err(refusal) => {
                log::info!("deep link refused: {refusal:?}");
                app.dialog()
                    .message(refusal.message())
                    .title("Sovrium cannot open that link")
                    .kind(MessageDialogKind::Warning)
                    .buttons(MessageDialogButtons::Ok)
                    .blocking_show();
                return;
            }
        };

        crate::windows::show_main(&app);
        let confirmed = app
            .dialog()
            .message(confirmation_prompt(&intent))
            .title("Open this link in Sovrium?")
            .kind(MessageDialogKind::Info)
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Continue".into(),
                "Cancel".into(),
            ))
            .blocking_show();
        if !confirmed {
            return;
        }

        // The frontend now asks for a folder and calls `create_project` or
        // `create_project_from_url`. Nothing has been written at this point,
        // and nothing will be until the user has picked where — the dialog
        // above confirmed the LINK, not the write. A URL intent is carried no
        // further than this: the shell never fetches it, and `init --from-url`
        // does the retrieving behind its own SSRF guard.
        let confirmed_intent = match intent {
            Intent::NewFromTemplate { template } => ConfirmedIntent {
                template: Some(template),
                url: None,
            },
            Intent::NewFromUrl { url, .. } => ConfirmedIntent {
                template: None,
                url: Some(url),
            },
        };
        let _ = app.emit(INTENT_EVENT, confirmed_intent);
    });
}

/// Pick the `sovrium://` link out of a process's arguments, if there is one.
///
/// On Windows and Linux a deep link IS an argv entry of a second launch, so this
/// is how `single-instance`'s forwarded arguments become an intent. Everything
/// that is not our scheme is skipped in silence — argv legitimately carries
/// flags, paths and the executable's own name.
pub fn link_in_argv<I: IntoIterator<Item = S>, S: AsRef<str>>(argv: I) -> Option<String> {
    argv.into_iter()
        .map(|a| a.as_ref().to_string())
        .find(|a| a.len() <= MAX_LINK_BYTES && a.starts_with("sovrium:"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_an_embedded_template() {
        assert_eq!(
            parse("sovrium://new?template=crm"),
            Ok(Intent::NewFromTemplate {
                template: "crm".into()
            })
        );
    }

    #[test]
    fn accepts_the_pathful_spelling_too() {
        // `sovrium:new?…` reaches the same OS handler as `sovrium://new?…`.
        assert_eq!(
            parse("sovrium:new?template=blog"),
            Ok(Intent::NewFromTemplate {
                template: "blog".into()
            })
        );
    }

    #[test]
    fn accepts_an_owner_repo_template() {
        assert_eq!(
            parse("sovrium://new?template=acme/starter-kit.v2"),
            Ok(Intent::NewFromTemplate {
                template: "acme/starter-kit.v2".into()
            })
        );
    }

    #[test]
    fn refuses_every_verb_but_new() {
        assert_eq!(
            parse("sovrium://open?template=crm"),
            Err(Refusal::UnknownAction("open".into()))
        );
        assert_eq!(
            parse("sovrium://run?template=crm"),
            Err(Refusal::UnknownAction("run".into()))
        );
    }

    #[test]
    fn refuses_path_traversal_in_a_template() {
        for hostile in [
            "sovrium://new?template=../../etc/passwd",
            "sovrium://new?template=..",
            "sovrium://new?template=/etc/passwd",
            "sovrium://new?template=a/../b",
            "sovrium://new?template=a/b/c",
        ] {
            assert!(
                matches!(parse(hostile), Err(Refusal::BadTemplate(_))),
                "{hostile} must be refused"
            );
        }
    }

    #[test]
    fn refuses_shell_metacharacters_and_spaces_in_a_template() {
        for hostile in [
            "sovrium://new?template=crm;rm%20-rf%20/",
            "sovrium://new?template=crm%20crm",
            "sovrium://new?template=$(whoami)",
            "sovrium://new?template=CRM",
            "sovrium://new?template=crm%0Aevil",
        ] {
            assert!(
                matches!(parse(hostile), Err(Refusal::BadTemplate(_))),
                "{hostile} must be refused"
            );
        }
    }

    #[test]
    fn accepts_an_https_url_and_names_its_host() {
        let intent = parse("sovrium://new?url=https%3A%2F%2Fexample.com%2Fapp.yaml").unwrap();
        assert_eq!(
            intent,
            Intent::NewFromUrl {
                url: "https://example.com/app.yaml".into(),
                host: "example.com".into()
            }
        );
    }

    #[test]
    fn refuses_every_scheme_but_https() {
        for (link, scheme) in [
            ("sovrium://new?url=http%3A%2F%2Fexample.com%2Fa.yaml", "http"),
            ("sovrium://new?url=file%3A%2F%2F%2Fetc%2Fpasswd", "file"),
            ("sovrium://new?url=ftp%3A%2F%2Fx.test%2Fa.yaml", "ftp"),
        ] {
            assert_eq!(parse(link), Err(Refusal::NotHttps(scheme.into())), "{link}");
        }
        // `javascript:` has no host and fails earlier; it must still be refused.
        assert!(parse("sovrium://new?url=javascript%3Aalert(1)").is_err());
    }

    #[test]
    fn refuses_a_link_with_neither_target_or_with_both() {
        assert_eq!(parse("sovrium://new"), Err(Refusal::MissingTarget));
        assert_eq!(
            parse("sovrium://new?template=crm&url=https%3A%2F%2Fx.test%2Fa.yaml"),
            Err(Refusal::BothTargets)
        );
    }

    #[test]
    fn refuses_another_application_scheme() {
        assert_eq!(
            parse("https://example.com/new?template=crm"),
            Err(Refusal::NotOurScheme)
        );
    }

    #[test]
    fn refuses_an_oversized_link_before_parsing_it() {
        let huge = format!("sovrium://new?template={}", "a".repeat(MAX_LINK_BYTES));
        assert_eq!(parse(&huge), Err(Refusal::TooLong));
    }

    #[test]
    fn ignores_unknown_query_parameters() {
        assert_eq!(
            parse("sovrium://new?template=crm&utm_source=newsletter"),
            Ok(Intent::NewFromTemplate {
                template: "crm".into()
            })
        );
    }

    #[test]
    fn the_url_prompt_names_the_host_before_the_path() {
        let intent = parse(
            "sovrium://new?url=https%3A%2F%2Fevil.test%2Fa%2Fvery%2Flong%2Fpath%2Fapp.yaml",
        )
        .unwrap();
        let prompt = confirmation_prompt(&intent);
        let host_at = prompt.find("evil.test").expect("host is shown");
        let path_at = prompt.find("/a/very/long").expect("path is shown");
        assert!(
            host_at < path_at,
            "the host must be readable before the path pushes it off the dialog"
        );
        assert!(prompt.contains("Only continue if you trust"));
    }

    #[test]
    fn the_typed_form_and_the_link_form_share_one_gate() {
        // A URL typed into the window and a URL arriving from a web page must
        // get the same answer. Two gates would mean two answers to "is https
        // required?", and the weaker one would be the one nobody re-read.
        for scheme in ["http", "file", "ftp", "javascript"] {
            let typed = parse_config_url(&format!("{scheme}://example.com/app.yaml"));
            assert!(typed.is_err(), "{scheme} must be refused when typed too");
        }
        let (url, host) = parse_config_url("https://example.com/app.yaml").expect("https passes");
        assert_eq!(url, "https://example.com/app.yaml");
        assert_eq!(host, "example.com");
    }

    #[test]
    fn a_confirmed_url_link_carries_the_url_and_no_template() {
        // The two stay separate all the way to the frontend: re-deciding which
        // is which there would repeat a classification made under review here.
        let intent = parse("sovrium://new?url=https%3A%2F%2Fexample.com%2Fapp.yaml").unwrap();
        let Intent::NewFromUrl { url, .. } = intent else {
            panic!("expected a URL intent")
        };
        let confirmed = ConfirmedIntent {
            template: None,
            url: Some(url),
        };
        let json = serde_json::to_string(&confirmed).unwrap();
        assert!(json.contains(r#""url":"https://example.com/app.yaml""#));
        assert!(json.contains(r#""template":null"#));
    }

    #[test]
    fn refusal_messages_strip_control_characters() {
        let Err(refusal) = parse("sovrium://new?template=a%0A%0DSystem%3A%20trust%20me") else {
            panic!("must be refused")
        };
        let message = refusal.message();
        assert!(!message.contains('\n'), "no newline may reach a dialog");
        assert!(!message.contains('\r'));
    }

    #[test]
    fn finds_a_link_in_argv_and_skips_everything_else() {
        assert_eq!(
            link_in_argv(["/Applications/Sovrium.app", "--flag", "sovrium://new?template=crm"]),
            Some("sovrium://new?template=crm".to_string())
        );
        assert_eq!(link_in_argv(["/Applications/Sovrium.app", "--flag"]), None);
    }

    #[test]
    fn an_oversized_argv_entry_is_not_treated_as_a_link() {
        let huge = format!("sovrium://new?template={}", "a".repeat(MAX_LINK_BYTES));
        assert_eq!(link_in_argv([huge.as_str()]), None);
    }

    #[test]
    fn the_documented_pattern_matches_the_implementation() {
        // TEMPLATE_PATTERN is quoted in docs and in the shell's error copy. If
        // the hand-written walk and the published pattern ever disagree, the
        // published one becomes a lie — so pin the pairing here.
        assert_eq!(TEMPLATE_PATTERN, "^[a-z0-9-]+(/[a-z0-9._-]+)?$");
        assert!(is_valid_template("crm"));
        assert!(is_valid_template("a-b-c"));
        assert!(is_valid_template("a/b_c.d"));
        assert!(!is_valid_template(""));
        assert!(!is_valid_template("-".repeat(101).as_str()));
    }
}
