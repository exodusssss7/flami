# Third-party notices

Flami's own code is MIT licensed (see `LICENSE`). The party games under
`app/games/` are builds of other people's open source projects, bundled so the
games open inside a Flami group chat. Each project is MIT licensed, and each
license text is kept in `licenses/`.

| Game | Upstream project | Author | License | License text |
| --- | --- | --- | --- | --- |
| Spyfall | https://github.com/tannerkrewson/spyfall | Tanner Krewson | MIT | `licenses/spyfall-MIT.txt` |
| Snakeout | https://github.com/tannerkrewson/snakeout | Tanner Krewson | MIT | `licenses/snakeout-MIT.txt` |
| Longwave | https://github.com/cynicaloptimist/longwave | Evan Bailey | MIT | `licenses/longwave-MIT.txt` |
| Drawphone | https://github.com/tannerkrewson/drawphone | Tanner Krewson | not bundled | Flami links to the hosted game at drawphone.tannerkrewson.com and does not copy its code |

License texts were fetched from each upstream repository's license file on 2026-11-09.

## What is in `app/games/`

- Each game folder holds a pre-built, minified `game.js` and `game.css` plus a small Flami wrapper page (`index.html`).
  The builds were modified for Flami (identity hand-off, embedding). The unmodified source lives in the upstream repositories above.
- The bundles carry their own dependencies under their own licenses, for example React (MIT), Firebase JS SDK (Apache-2.0),
  Skeleton (MIT), SweetAlert2 (MIT), Font Awesome (CC BY 4.0 icons, SIL OFL 1.1 fonts, MIT code) and Bootstrap (MIT).
  Their notices are preserved inside the bundle files.
- **Longwave** is an online adaptation of the board game *Wavelength*. Its code is MIT, but the game concept and name belong to
  the Wavelength designers and publisher. This repo claims no rights in them.
- **Longwave backend:** the upstream Longwave build ships with the Longwave author's own Firebase Realtime Database
  configuration (`wavelength-online`). That is their public client config, not a Flami secret, but it means Longwave games
  run on their free backend. If you fork Flami for real use, consider rebuilding Longwave from upstream against your own Firebase project.

## Services Flami calls

GIPHY (GIF picker, requires GIPHY attribution, shown in the app), Metered (optional TURN relay for calls) and Firebase.
Each needs your own free account and key, see `app/config.example.js`.
