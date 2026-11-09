# flami 20261108-polish2 (published 2026-11-08 ~14:20 IST; polish1 + media-URI fix + mono sweep)

New:
- Profile photos (Settings > tap avatar, 256px square, ~100KB, stored on the profile doc) and group photos (group info, admins).
- Group management: rename group (admin), remove a member (admin), leave group (anyone; rules allow removing only yourself).
- Edit your own text messages (long-press > Edit; shows an "edited" tag).
- Search inside a chat (magnifier in the chat header; jump between matches).
- Pin chats to the top of the list (long-press or right-click a chat; stored in your private profile).
- DM call log: when a 1:1 call ends, the chat gets a "Voice call · mm:ss" card; if nobody joined, a "Missed call" card (with unread badge).
- One-time welcome tips after signup.

Performance (slow mobile data):
- Opening a chat now loads only the latest 60 messages; "Load earlier messages" pages back.
- Photos and voice audio are stored in a separate media doc and fetched only when visible/played (new sends; old messages still work).

Fixes/polish:
- Media loader accepts both raw base64 and full data: URIs (polish2).
- Full monochrome sweep: remaining warm/brown surfaces neutralized (bottom sheets, voice-recorder sheet, gif sheet, photo-send sheet, toast, game-party panel, reconnecting blink). Kept intentional reds (recording, danger) and the colorful avatar gradients the user approved in ui1.
- theme-color matches the manifest; call tiles show photos; composer textarea has an aria label.

Restored:
- /games/spyfall, /games/longwave, /games/snakeout were 404 since the mono1 deploy (hosting redeploy without the games dir). Recovered byte-identical files from hosting version f2e8e0cb1a436857 (20261107-ui1) via a preview-channel clone and redeployed. All three return 200.

Data/rules (firestore.rules, deployed with hosting):
- Verified against the deployed ui1 ruleset first (byte-level diff): only intended additions.
- profiles: +photo (string, <=150000 chars).
- chats: admins may set photo; a member may remove only themselves from members.
- messages: +type 'call'; sender may edit own text (+edited flag); mediaId allowed.
- new chats/<cid>/media/<id>: members read; sender creates (data <=980000 chars); sender/admins delete.
- Emulator suite green; 20/20 live functional checks passed (signup, DM, edit rules, media rules incl. oversize denial, call log, photos, pins, group rename/photo/remove/leave, pagination read).

Verification:
- Live visual pass in the cloud browser with throwaway accounts: chat list (pins/photos/call preview), DM (edited tag, lazy photo, call card), in-chat search with match jump, group info sheet (photo/rename/members/leave), empty state.
- All test accounts, chats, messages, media and auth users deleted afterwards (verified gone).

Not in this build:
- Push notifications need a server key (FCM) - out of free-scope for now.

---
# watch1 (2026-11-09) - Watch Party

New: Watch party in group chats. Header movie button or chat invite opens a full-screen party sheet.
- Host pastes a Dropbox share link, Google Drive link, or direct .mp4/.webm link. The app converts it to a stream URL and test-plays it before the invite can be sent, so a bad link never reaches the group.
- Invite card posts into the group chat; members tap Join party, then Join the stream (one tap, required for browser audio autoplay).
- Sync: the host's player is the single authority. Play/pause/seek + a 3s heartbeat go to Firestore; viewers extrapolate from receipt time (no cross-phone clock math), nudge playbackRate for small drift, hard-seek above 2s, and show "Waiting for the host" when the host buffers.
- Live chat inside the party sheet posts to the real group chat; emoji reactions float over the video on every screen.
- One active party per group; host can end it for everyone; minimize keeps playback running.

Known limits (honest):
- Google Drive blocks cross-site streaming (CORP same-site, no CORS, and the project's browser API key is restricted to Firebase APIs), so Drive links fail the pre-invite check with a message pointing to Dropbox. Dropbox + direct links are the working sources.
- Dropbox free accounts have daily sharing bandwidth; very large or heavily watched files can hit Dropbox's own limit.
- mkv/mov may not play in some browsers; mp4 (H.264) is the safe format.
- Fixed: esc() turned double quotes into "undefined" in rendered text.
