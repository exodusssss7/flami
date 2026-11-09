<div align="center">

<img src="docs/banner.png" alt="Flami: your crew, one flame" width="100%">

# flami

**Group chat, voice notes, calls, party games and synced watch parties for your crew.**
A dark, fast, installable web app. No build step. Runs on free tiers.

[![Live demo](https://img.shields.io/badge/live-flami--7ea7b.web.app-EDEDEF?style=for-the-badge&labelColor=0B0B0D)](https://flami-7ea7b.web.app)

![License: MIT](https://img.shields.io/badge/license-MIT-EDEDEF?labelColor=0B0B0D)
![No build step](https://img.shields.io/badge/build-none-EDEDEF?labelColor=0B0B0D)
![Firebase Spark](https://img.shields.io/badge/firebase-Spark%20(free)-EDEDEF?labelColor=0B0B0D)
![PWA](https://img.shields.io/badge/PWA-installable-EDEDEF?labelColor=0B0B0D)
![Vanilla JS](https://img.shields.io/badge/vanilla-JavaScript-EDEDEF?labelColor=0B0B0D)

</div>

---

## Why Flami

Flami is built for a small crew: friends, a team, the people who work with you. Group chat comes first.
Everything runs in the browser against a free Firebase project, so a whole crew can run on **zero monthly cost**.

## Features

| | |
| --- | --- |
| **Group chat first** | Groups up to 100 people, private chats, replies, emoji reactions, read ticks, unread counts, edit your own messages, search inside a chat, pin chats |
| **Voice notes** | Hold-to-record sheet with a live waveform, lock mode, 60 second clips |
| **Calls** | Voice and group calls over WebRTC with a mute control, call log cards and a missed-call badge |
| **Watch party** | The host pastes a Dropbox or direct video link. Everyone watches in sync, with live chat and floating reactions. Links are test-played before the invite goes out |
| **Party games** | Drawphone, Spyfall, Longwave and Snakeout open inside the chat as a sheet. Flami handles the invite, lobby and player names |
| **GIFs and photos** | GIPHY picker, photo sending with on-device resizing, lightbox |
| **Fast on slow data** | Latest 60 messages load first, media loads only when visible |
| **Feels native** | Smooth morphs at 60 fps, haptics, installable PWA, works on any screen size |
| **Private by rules** | Members-only reads, field-whitelisted writes, size caps, see [SECURITY.md](SECURITY.md) |

## Screenshots

Captured from the running app with demo accounts (390 x 844 phone viewport).

<table>
<tr>
<td align="center"><img src="docs/screenshots/01-sign-in.png" width="190"><br><sub>Sign in</sub></td>
<td align="center"><img src="docs/screenshots/02-create-account.png" width="190"><br><sub>Create account</sub></td>
<td align="center"><img src="docs/screenshots/04-chat-list.png" width="190"><br><sub>Chat list</sub></td>
<td align="center"><img src="docs/screenshots/05-people.png" width="190"><br><sub>People</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/06-search.png" width="190"><br><sub>Search</sub></td>
<td align="center"><img src="docs/screenshots/07-settings.png" width="190"><br><sub>Settings</sub></td>
<td align="center"><img src="docs/screenshots/08-new-chat.png" width="190"><br><sub>New chat</sub></td>
<td align="center"><img src="docs/screenshots/09-new-group.png" width="190"><br><sub>New group</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/10-group-chat.png" width="190"><br><sub>Group chat</sub></td>
<td align="center"><img src="docs/screenshots/11-group-info.png" width="190"><br><sub>Group info</sub></td>
<td align="center"><img src="docs/screenshots/12-gif-picker.png" width="190"><br><sub>GIF picker</sub></td>
<td align="center"><img src="docs/screenshots/13-voice-recorder.png" width="190"><br><sub>Voice recorder</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/14-chat-search.png" width="190"><br><sub>Search in chat</sub></td>
<td align="center"><img src="docs/screenshots/21-message-menu.png" width="190"><br><sub>Message menu</sub></td>
<td align="center"><img src="docs/screenshots/22-group-call.png" width="190"><br><sub>Group call</sub></td>
<td align="center"><img src="docs/screenshots/15-game-party-lobby.png" width="190"><br><sub>Party games</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/16-watch-party-setup.png" width="190"><br><sub>Watch party setup</sub></td>
<td align="center"><img src="docs/screenshots/17-watch-party-link-checked.png" width="190"><br><sub>Link checked</sub></td>
<td align="center"><img src="docs/screenshots/19-watch-invite-card.png" width="190"><br><sub>Invite card</sub></td>
<td align="center"><img src="docs/screenshots/18-watch-party-host.png" width="190"><br><sub>Host view</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/20-watch-party-viewer.png" width="190"><br><sub>Viewer with reactions</sub></td>
<td colspan="3" align="center"><img src="docs/screenshots/23-desktop-chat.png" width="560"><br><sub>Desktop layout</sub></td>
</tr>
</table>

## Quick start

You need a free [Firebase](https://firebase.google.com) project (Spark plan) and, optionally, free GIPHY and Metered accounts.

1. **Create the Firebase project.** Add a Web app. Turn on **Authentication > Email/Password** (Flami signs users in with `name@flami.chat` aliases, so nobody needs a real email) and create a **Firestore** database.
2. **Add your config.**
   ```sh
   cp app/config.example.js app/config.js     # then fill in your values
   cp .firebaserc.example .firebaserc         # then set your project id
   ```
   `config.js` and `.firebaserc` are gitignored.
3. **Run it locally.**
   ```sh
   python3 -m http.server 8000 --directory app
   # open http://localhost:8000
   ```
4. **Deploy rules and hosting** (free).
   ```sh
   npm i -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,hosting
   ```
5. **Lock down the API key.** In Google Cloud Console, restrict the Firebase web API key to your site's domain. See [SECURITY.md](SECURITY.md).

Keys are optional. Without a GIPHY key the GIF picker stays empty. Without a Metered TURN credential calls use STUN only and can fail on strict mobile networks.

## Project layout

```
app/
  index.html, app.js, app.css   the whole client (ES modules, no bundler)
  sw.js, manifest.json          offline shell and PWA install
  config.example.js             copy to config.js with your own keys
  games/                        Spyfall, Longwave, Snakeout (MIT, see THIRD_PARTY_NOTICES.md)
firestore.rules                 all data access rules
firebase.json                   hosting and rules config
docs/                           banner and screenshots
licenses/                       license texts for bundled games
```

## Watch party notes

- Works with Dropbox share links and direct `.mp4` or `.webm` links.
- **Google Drive links do not work.** Google blocks Drive videos from playing inside other web apps and there is no free way around it. Flami tells the host and suggests Dropbox.
- The video streams from the host's link, never through Flami. Dropbox free accounts have a daily sharing bandwidth limit, so very large files can stop after heavy viewing.

## Known limits

Not end to end encrypted. Calls only ring for people who have the app open. The free Firebase database pauses after a week of no use. The Metered free relay is about 500 MB a month. Full list in [SECURITY.md](SECURITY.md).

## Credits and licenses

Flami is released under the [MIT License](LICENSE). Bundled games and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Drawphone, Spyfall and Snakeout by Tanner Krewson. Longwave by Evan Bailey, adapted from the board game Wavelength. GIFs by GIPHY.

See [CHANGELOG.md](CHANGELOG.md) for what changed in each release.
