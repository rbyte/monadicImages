# Monadic Images

A research prototype for exploring an image collection.

Demo: http://uclabserver.fh-potsdam.de/~mgraf/monadicImages/

Inspired by http://mariandoerk.de/monadicexploration/

Requires Javascript Harmony support!

### Usage

*   Click on any image to focus on it.
*   Hover over any image to bring it to the foreground.
*   Use the mouse wheel to zoom.
*   The gear in the top right corner exposes the display parameters.

### Parameters

*   The *Growth* parameters control what the zooming does.
*   **Save** stores in `localStorage`.
*   **Reset** clears `localStorage` and reverts to defaults.
*   **Export** lets you set `images/customParameters.json` on the server-side (optional). 

### Requirements

*   Webserver (with PHP)
*   NodeJS (>v6.2) with JS Harmony support
*   ImageMagick (convert, compare)

### Setting up new images

**On the server side**:
*   `cd images`
*   `sh clearAll.sh`
*   `cp yourImages upload/files/`
*   `node preprocess.js` (may take hours for large collections)

This should generate `images.json` and `area*` folders the contain resized versions of the source images. `node modifyManually.js` may be used to add custom fields to the `meta` object in `images.json` in order for them to be displayed in the `infoBox`.

**On the client side**: open `images/config.html` and follow the steps. For this to work, PHP must be able to `exec(node ...)` and have the correct file permissions: r/w/x in `images/`, `images/upload/files/`, etc. Allowing the client to make these changes is a severe security risk. Restrict access appropriately. You may want to use the `~.htaccess` files in `images` and `upload` or delete all PHP files.

