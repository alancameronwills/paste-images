# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A WordPress plugin (four files, no build tooling, no package manager, no tests) that adds clipboard-paste-to-upload to every WordPress media uploader — the standalone "Upload New Media" screen (`media-new.php`) and any Backbone `wp.media()` modal (post editor, featured image, galleries, and any other plugin's own picker, e.g. a custom `wp.media({...})` call).

- `paste-images.php` — plugin bootstrap, asset enqueueing, and the AJAX upload handler.
- `assets/paste-images.js` — detects the uploader UI, adds the "or paste an image" hint, listens for `paste`, and uploads/integrates the result.
- `assets/paste-images.css` — minor styling for the hint/feedback text.
- `readme.txt` — standard WordPress.org-style plugin readme.

## Commands

There is no build step, package manager, or test suite in this repo — it's plain PHP + vanilla JS served directly.

Lint the PHP with the PHP CLI bundled with the local UniServer install (there's no `php` on `PATH`):

```
"/c/Users/alan/UniServerZ/core/php83/php.exe" -l paste-images.php
```

To actually exercise a change, activate the plugin in `wp-admin/plugins.php` on the local UniServer WordPress install (site root: `C:\Users\alan\UniServerZ\www`) and test by hand in a browser — paste an image into an uploader's Upload Files tab. There's no automated way to verify behavior; changes here have repeatedly needed live-browser verification because the bugs are in DOM/Backbone integration, not PHP logic.

Bump `Version:` in the plugin header docblock **and** the `PASTE_IMAGES_VERSION` constant together on every asset change — `wp_enqueue_script`/`style` use that constant as the cache-busting `?ver=`, and without a bump the browser (or the user) can end up testing a stale cached copy.

## Architecture

### Two enqueue paths, one guarded function

`paste_images_enqueue_assets()` is hooked both to WordPress core's `wp_enqueue_media` action (fires exactly once per request, from inside `wp_enqueue_media()` itself — admin **or** front-end, regardless of which plugin called it) and to `admin_enqueue_scripts` for a fixed list of admin screens, as a belt-and-braces fallback. A `static $enqueued` flag prevents double-enqueueing when both fire in the same request. Hooking the core action (rather than only specific admin screens) is what makes this plugin work inside *any* plugin's `wp.media()` picker without that plugin needing to know paste-images exists — see `gigiau-events-posters/gigio-edit.js`'s `openMediaPopup()` for a live example of a third-party consumer.

### The AJAX handler reuses core's own upload pipeline

`paste_images_handle_upload()` (hooked to `wp_ajax_paste_images_upload`) does not implement its own file-handling — it calls `media_handle_upload( 'async-upload', $post_id )` and `wp_prepare_attachment_for_js()`, the same two calls core's own `wp_ajax_upload_attachment()` uses for a normal plupload upload. The `'async-upload'` field name and `'media-form'` nonce action are not arbitrary — they match what core's uploader already expects, so a pasted image becomes an entirely ordinary attachment (thumbnails, metadata, everything) with no custom storage logic to maintain.

### Two different uploader markups to detect

This is the trickiest part of the JS and the source of most bugs so far. WordPress ships two unrelated HTML structures for "the uploader":

- `#drag-drop-area` / `.drag-drop-inside` — the legacy uploader, written directly in PHP in `wp-admin/includes/media.php`, used **only** by the standalone `media-new.php` screen.
- `.uploader-inline` / `.upload-ui` — `wp.media.view.UploaderInline`'s Backbone template (`wp-includes/media-template.php`, `tmpl-uploader-inline`), used by **every** `wp.media()` modal (core's own "Add Media" and any plugin's custom picker).

`findDropArea()` matches both selectors and picks the first *visible* match; `findAnchorContainer()` picks the right child container to append hint/feedback text into for whichever markup matched. Do not assume `#drag-drop-area` is universal — it caused this plugin to silently no-op inside every Backbone modal until the two-selector fix landed. Visibility is checked via `offsetWidth`/`offsetHeight`/`getClientRects()`, not `offsetParent` — `offsetParent` is `null` for anything with `position: fixed`, which is how `.media-modal` itself is styled, so it gave false negatives inside modals.

Because the modal's DOM is created/destroyed dynamically (not present at page load), detection runs via a `MutationObserver` on `document.documentElement`, not a one-shot DOM-ready check.

### Integrating a paste with the Backbone frame after upload

After a successful upload, `registerAttachment()` creates the Backbone model (`wp.media.model.Attachment.create()`) and adds it to `wp.Uploader.queue` — the same shared collection core's real plupload flow feeds into. This is deliberate: the active frame state already listens for `add` events on that queue (`Library.prototype.uploading` in `wp-includes/js/media-views.js`) and, on its own, switches the modal from the Upload Files tab to Media Library and adds the new attachment to the current selection. Do not reimplement tab-switching or selection-add logic manually — earlier versions of this plugin did (`state.get('library').unshift(...)`, manual `selection.add()`), and it only partially matched core's real behavior. Routing through `wp.Uploader.queue` gets full parity with a normal browse-upload for free, in both single- and multi-select frames.

This whole integration layer touches undocumented `wp.media`/`wp.Uploader` internals (there is no public API for "I uploaded something out-of-band, please integrate it"). It has needed a live-browser fix at every WordPress core version boundary encountered so far; treat any change here as needing manual verification in an actual modal, not just a syntax check.
