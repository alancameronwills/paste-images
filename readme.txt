=== Paste Images ===
Contributors: alancameronwills
Tags: media, upload, paste, clipboard, screenshot
Requires at least: 5.3
Tested up to: 6.6
Requires PHP: 7.0
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Paste images straight into the WordPress media uploader instead of saving them to disk first.

== Description ==

Adds a "paste an image" option to the standard WordPress media uploader, right next to the
existing **Select Files** button. Works anywhere the uploader's drag-and-drop area appears:
the media modal (post editor, block editor, featured image, etc.) and the standalone
**Media > Add New** screen.

Typical use cases:

* Taking a screenshot and pasting it directly (Ctrl+V / Cmd+V) instead of saving it to disk first.
* Choosing "Copy image" on an image in a web browser, then pasting it in.
* Copying an image file from your local file system and pasting it in.

Pasted images are uploaded through WordPress's own upload pipeline, so they become
completely ordinary attachments with the usual thumbnails and metadata.

== Installation ==

1. Copy the `paste-images` folder into `wp-content/plugins/`.
2. Activate the plugin through the "Plugins" screen in WordPress.
3. Open any media uploader and paste an image.

== Changelog ==

= 1.0.0 =
* Initial release.
