# NOGGIN Cinematic V4 — approved integration

V4 visual approval received on 30 October 2026. Do not replace the live V3 introduction until the eight 16:9 JPG frames are committed and the replacement passes full verification.

## Source-of-truth package

The approved package is `NOGGIN-CINEMATIC-V4-PREVIEW.zip` created in the conversation. It contains eight `public/tv/cinematic-v4/scene-NN.jpg` images, `cinematic-v4.js`, `cinematic-v4.css`, `install-v4.cjs`, and a standalone preview.

**All eight JPG scene images must be committed with the implementation.** Do not merge code that references missing art. Do not re-create them from low-fidelity CSS gradients.

## Safe installation and verification

Install V4 into a checkout of this feature branch using the package's `node install-v4.cjs <path-to-NOGGIN>`. The installer backs up `showcase.js` and `tv.css`, copies the eight frames, appends the isolated V4 script/CSS, and prevents the existing splash from opening.

Before committing, remove any `.before-v4.bak` files; these are local rollback aids only. Verify precisely eight JPG scenes, the approved logo at `/play/art/noggin-logo.webp`, and the two new JS/CSS assets. Then run `npm ci`, `npm run check`, and `npm test`.

## Acceptance criteria

- 15-second scene sequence matches the approved studio storyboard
- Mute, Skip and Escape work, including session skip on reload
- Reconnection and reduced-motion bypass work
- TV plus two independent phone joins and real QR remain functional
- No change to game rules, server scoring or avatars
- Stage on a Render preview before merge, with no active games running

Status: **Integration branch created, image binaries not yet committed; NOT READY TO MERGE**.
