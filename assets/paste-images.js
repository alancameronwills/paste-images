/* global pasteImagesSettings, wp */
( function( $ ) {
	'use strict';

	if ( typeof pasteImagesSettings === 'undefined' ) {
		return;
	}

	var HINT_FLAG_ATTR = 'data-paste-images-ready';

	function isVisible( el ) {
		// offsetParent is null both when hidden AND when the element (or an
		// ancestor) is position:fixed - which is exactly how .media-modal is
		// styled - so it's not a reliable visibility test inside a modal.
		return !! ( el && ( el.offsetWidth || el.offsetHeight || el.getClientRects().length ) );
	}

	/**
	 * The uploader's drop zone. Two different markups exist in core:
	 *
	 * - `#drag-drop-area`: the legacy multi-file uploader, only used on the
	 *   standalone "Upload New Media" screen (wp-admin/includes/media.php).
	 * - `.uploader-inline`: wp.media.view.UploaderInline, used by every
	 *   Backbone `wp.media()` modal - the post editor, featured image,
	 *   galleries, and any plugin's own wp.media() picker.
	 *
	 * Uses querySelectorAll rather than getElementById/querySelector: a
	 * modal that gets torn down and rebuilt can briefly leave a stale,
	 * hidden element behind, and the first match in the document isn't
	 * necessarily the live, visible one.
	 */
	function findDropArea() {
		var candidates = document.querySelectorAll( '.uploader-inline, #drag-drop-area' );

		for ( var i = 0; i < candidates.length; i++ ) {
			if ( isVisible( candidates[ i ] ) ) {
				return candidates[ i ];
			}
		}

		return null;
	}

	/**
	 * Where to append our hint/feedback text within a drop area, matching
	 * whichever of the two markups (see findDropArea) we're inside.
	 */
	function findAnchorContainer( area ) {
		return area.querySelector( '.upload-ui' ) || area.querySelector( '.drag-drop-inside' ) || area;
	}

	function insertHint( area ) {
		if ( area.getAttribute( HINT_FLAG_ATTR ) ) {
			return;
		}

		var container = findAnchorContainer( area );
		var hint = document.createElement( 'p' );

		hint.className = 'paste-images-hint description';
		hint.textContent = pasteImagesSettings.i18n.hint;
		container.appendChild( hint );

		area.setAttribute( HINT_FLAG_ATTR, '1' );
	}

	function watchForDropArea() {
		var area = findDropArea();

		if ( area ) {
			insertHint( area );
		}
	}

	// The modal's uploader markup is injected/re-rendered dynamically,
	// so watch for it rather than relying on a single DOM-ready pass.
	var observer = new MutationObserver( watchForDropArea );
	observer.observe( document.documentElement, { childList: true, subtree: true } );

	$( watchForDropArea );

	function getCurrentPostId() {
		if ( window.wp && wp.media && wp.media.view && wp.media.view.settings && wp.media.view.settings.post ) {
			return wp.media.view.settings.post.id;
		}

		var field = document.getElementById( 'post_ID' );
		return field ? field.value : 0;
	}

	function extractImageFile( clipboardData ) {
		if ( ! clipboardData || ! clipboardData.items ) {
			return null;
		}

		for ( var i = 0; i < clipboardData.items.length; i++ ) {
			var item = clipboardData.items[ i ];

			if ( item.kind === 'file' && item.type.indexOf( 'image/' ) === 0 ) {
				return item.getAsFile();
			}
		}

		return null;
	}

	function setFeedback( area, message, isError ) {
		var container = findAnchorContainer( area );
		var el = container.querySelector( '.paste-images-feedback' );

		if ( ! message ) {
			if ( el ) {
				el.remove();
			}
			return;
		}

		if ( ! el ) {
			el = document.createElement( 'p' );
			el.className = 'paste-images-feedback description';
			container.appendChild( el );
		}

		el.textContent = message;
		el.classList.toggle( 'paste-images-error', !! isError );
	}

	function guessExtension( mimeType ) {
		var map = {
			'image/jpeg': 'jpg',
			'image/png': 'png',
			'image/gif': 'gif',
			'image/webp': 'webp',
			'image/bmp': 'bmp'
		};

		return map[ mimeType ] || 'png';
	}

	function registerAttachment( attachmentData ) {
		if ( ! window.wp || ! wp.media || ! wp.media.model || ! wp.media.model.Attachment ) {
			return;
		}

		var attachment = wp.media.model.Attachment.create( attachmentData );

		if ( ! wp.Uploader || ! wp.Uploader.queue || ! wp.Uploader.queue.add ) {
			return;
		}

		// wp.Uploader.queue is the same collection core's own plupload flow
		// feeds into. Adding to it re-uses all of core's built-in handling
		// for a finished upload - see Library.prototype.uploading in
		// media-views.js - which switches the active state from the Upload
		// Files tab to Media Library and adds the attachment to the current
		// selection, exactly as a normal browse-upload would.
		wp.Uploader.queue.add( attachment );

		// Mirrors wp-plupload.js's own queue-draining check: once nothing
		// left in the queue is still uploading, clear it.
		var allDone = wp.Uploader.queue.all( function( a ) {
			return ! a.get( 'uploading' );
		} );

		if ( allDone ) {
			wp.Uploader.queue.reset();
		}
	}

	function uploadPastedFile( file, area ) {
		var formData = new FormData();
		var filename = 'pasted-image-' + Date.now() + '.' + guessExtension( file.type );

		formData.append( 'action', 'paste_images_upload' );
		formData.append( '_wpnonce', pasteImagesSettings.nonce );
		formData.append( 'async-upload', file, filename );

		var postId = getCurrentPostId();

		if ( postId ) {
			formData.append( 'post_id', postId );
		}

		setFeedback( area, pasteImagesSettings.i18n.uploading, false );

		fetch( pasteImagesSettings.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			body: formData
		} )
			.then( function( response ) {
				return response.json();
			} )
			.then( function( response ) {
				if ( ! response || ! response.success ) {
					var message = ( response && response.data && response.data.message ) || pasteImagesSettings.i18n.error;
					setFeedback( area, message, true );
					return;
				}

				setFeedback( area, pasteImagesSettings.i18n.done, false );
				registerAttachment( response.data );

				window.setTimeout( function() {
					setFeedback( area, null, false );
				}, 4000 );
			} )
			.catch( function() {
				setFeedback( area, pasteImagesSettings.i18n.error, true );
			} );
	}

	document.addEventListener( 'paste', function( event ) {
		var area = findDropArea();

		if ( ! area ) {
			return;
		}

		var file = extractImageFile( event.clipboardData );

		if ( ! file ) {
			return;
		}

		event.preventDefault();
		uploadPastedFile( file, area );
	} );

} )( jQuery );
