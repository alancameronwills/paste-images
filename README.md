# Paste Images

A WordPress plugin that lets you paste images straight into the media uploader instead of saving them to disk first.

It adds a "paste an image" option right next to the existing **Select Files** button, wherever WordPress's media uploader appears.

## Why

Typical use cases:

- Taking a screenshot and pasting it directly (Ctrl+V / Cmd+V) instead of saving it to disk first.
- Choosing "Copy image" on an image in a web browser, then pasting it in.
- Copying an image file from your local file system and pasting it in.

## Where it works

- The standalone **Media > Add New** screen (`media-new.php`).
- Any `wp.media()` modal — the post/page editor's "Add Media", the featured image picker, galleries, and any other plugin's own media picker (it doesn't need to know about this plugin).

A pasted image is uploaded through WordPress's normal upload pipeline, so it becomes a completely ordinary attachment: thumbnails, metadata, and (inside a modal) the same "switch to Media Library and select it" behavior you get from a normal browse-upload.

## Requirements

- WordPress 5.3+
- PHP 7.0+

## Installation

1. Copy the `paste-images` folder into `wp-content/plugins/`.
2. Activate **Paste Images** on the Plugins screen.
3. Open any media uploader and paste an image.

## Development

This is a small, dependency-free plugin — plain PHP and vanilla JS, no build step or package manager.

- `paste-images.php` — enqueues the assets and handles the upload via AJAX.
- `assets/paste-images.js` — detects the uploader UI, shows the paste hint, and handles the paste event.
- `assets/paste-images.css` — minor styling for the hint/feedback text.

Lint the PHP with a PHP CLI, e.g.:

```
php -l paste-images.php
```

There's no automated test suite; changes are verified by hand in a browser, since the interesting logic is DOM/JavaScript integration with WordPress's media modal rather than pure PHP.

See `CLAUDE.md` for a deeper look at the internals (the two different uploader markups WordPress ships, and how uploads are integrated back into the Backbone media frame).

## License

GPL-2.0-or-later
