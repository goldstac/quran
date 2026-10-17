Standard release stages (SemVer):

- alpha: very early, unstable, experimental. Used for internal testing or very rough previews. High chance of breaking changes.
- beta: feature-complete-ish but still may have bugs. Public testing before RC. More stable than alpha.
- rc (release candidate): near final. Usually no new features, just bug fixes. If no critical issues, becomes stable.
- stable: the final release (no prerelease suffix). e.g. 1.2.0

Other common ones (less used but exist):
- snapshot/dev/build: development builds, not real releases usually.
- pre-alpha: even earlier than alpha.
- nightly: automated daily builds.
- milestone (M1/M2): sometimes used by some projects, not standard SemVer labels but human-friendly.
- canary: bleeding edge, often auto-deployed from main.
- preview/early access: marketing terms.

For SemVer prerelease identifiers, you can use any dot-separated alphanumerics (e.g. 1.2.0-alpha.1, 1.2.0-rc.4). The common progression is: 1.2.0-alpha -> 1.2.0-beta -> 1.2.0-rc.1 -> 1.2.0.

So for this project, alpha/beta/rc + stable is the full typical flow. No need for others unless you want to be fancy.
