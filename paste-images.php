<?php
/**
 * Plugin Name: Paste Images
 * Description: Lets you paste images (screenshots, "Copy image" from a browser, or a file copied from your OS) straight into the WordPress media uploader, right next to the Select Files button.
 * Version: 1.5.0
 * Requires at least: 5.3
 * Requires PHP: 7.0
 * Author: Alan Cameron Wills
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: paste-images
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PASTE_IMAGES_VERSION', '1.5.0' );
define( 'PASTE_IMAGES_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Auto-update from GitHub releases.
require __DIR__ . '/plugin-update-checker/plugin-update-checker.php';
$paste_images_update_checker = YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
	'https://github.com/alancameronwills/paste-images/',
	__FILE__,
	'paste-images'
);
$paste_images_update_checker->setBranch( 'main' );
$paste_images_update_checker->getVcsApi()->enableReleaseAssets();
if ( defined( 'PASTE_IMAGES_GITHUB_TOKEN' ) && PASTE_IMAGES_GITHUB_TOKEN ) {
	// Raises the GitHub API rate limit from 60/hr (shared per-IP) to 5000/hr;
	// avoids "puc-github-http-error" 403s on hosts sharing a busy IP.
	// Set define('PASTE_IMAGES_GITHUB_TOKEN', '...'); in wp-config.php - a
	// public-repo token needs no scopes.
	$paste_images_update_checker->setAuthentication( PASTE_IMAGES_GITHUB_TOKEN );
}

/**
 * Enqueue our assets whenever the media uploader itself is enqueued
 * (post editor, block editor, "Add New" media screen, etc.), and also
 * proactively on a few known admin screens in case wp_enqueue_media()
 * runs after admin_enqueue_scripts on a given screen.
 */
add_action( 'wp_enqueue_media', 'paste_images_enqueue_assets' );
add_action( 'admin_enqueue_scripts', 'paste_images_maybe_enqueue_on_screen' );

/**
 * @param string $hook_suffix Current admin page hook suffix.
 */
function paste_images_maybe_enqueue_on_screen( $hook_suffix ) {
	$screens_with_uploader = array( 'media-new.php', 'upload.php', 'post.php', 'post-new.php' );

	if ( in_array( $hook_suffix, $screens_with_uploader, true ) ) {
		paste_images_enqueue_assets();
	}
}

function paste_images_enqueue_assets() {
	static $enqueued = false;

	if ( $enqueued || ! current_user_can( 'upload_files' ) ) {
		return;
	}

	$enqueued = true;

	wp_enqueue_style(
		'paste-images',
		PASTE_IMAGES_PLUGIN_URL . 'assets/paste-images.css',
		array(),
		PASTE_IMAGES_VERSION
	);

	wp_enqueue_script(
		'paste-images',
		PASTE_IMAGES_PLUGIN_URL . 'assets/paste-images.js',
		array( 'jquery', 'media-views' ),
		PASTE_IMAGES_VERSION,
		true
	);

	wp_localize_script(
		'paste-images',
		'pasteImagesSettings',
		array(
			'ajaxUrl' => admin_url( 'admin-ajax.php' ),
			'nonce'   => wp_create_nonce( 'media-form' ),
			'i18n'    => array(
				'hint'      => __( 'or paste an image (screenshot, copied image, or copied file)', 'paste-images' ),
				'uploading' => __( 'Uploading pasted image…', 'paste-images' ),
				'done'      => __( 'Image uploaded.', 'paste-images' ),
				'error'     => __( 'Could not upload the pasted image.', 'paste-images' ),
			),
		)
	);
}

add_action( 'wp_ajax_paste_images_upload', 'paste_images_handle_upload' );

/**
 * Handle a pasted image the same way core handles a normal plupload
 * upload: via media_handle_upload(), so the result is a completely
 * ordinary attachment (with thumbnails, metadata, etc.).
 */
function paste_images_handle_upload() {
	check_ajax_referer( 'media-form' );

	if ( ! current_user_can( 'upload_files' ) ) {
		wp_send_json_error( array( 'message' => __( 'You are not allowed to upload files.', 'paste-images' ) ), 403 );
	}

	if ( empty( $_FILES['async-upload'] ) ) {
		wp_send_json_error( array( 'message' => __( 'No image data was received.', 'paste-images' ) ), 400 );
	}

	$post_id = isset( $_POST['post_id'] ) ? absint( wp_unslash( $_POST['post_id'] ) ) : 0;

	if ( $post_id && ! current_user_can( 'edit_post', $post_id ) ) {
		wp_send_json_error( array( 'message' => __( 'You are not allowed to edit this post.', 'paste-images' ) ), 403 );
	}

	require_once ABSPATH . 'wp-admin/includes/image.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';

	$attachment_id = media_handle_upload( 'async-upload', $post_id );

	if ( is_wp_error( $attachment_id ) ) {
		wp_send_json_error( array( 'message' => $attachment_id->get_error_message() ) );
	}

	$attachment = wp_prepare_attachment_for_js( $attachment_id );

	if ( ! $attachment ) {
		wp_send_json_error( array( 'message' => __( 'Could not prepare the uploaded attachment.', 'paste-images' ) ) );
	}

	wp_send_json_success( $attachment );
}
