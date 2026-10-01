# Overlay identity

`stow` uses the `origin` remote's two `owner/repo` path segments. `--repo OWNER/REPO` lets a user choose an identity when the remote does not provide one. The skill files stay in the user's home directory, so adding a skill never writes into the target checkout. An existing skill name is an error because replacing a private skill could discard local edits.

The CLI manages files. A host owns discovery and slash completion. This boundary lets a host use its existing skill rules while sharing one repository-specific overlay location.
