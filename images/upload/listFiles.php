<?php
include 'config.php';

function getFiles() {
	global $dir;
	$files = [];
	foreach (scandir($dir) as $id => $filename) {
		// exclude directories and hidden files (like .htaccess and .keep)
		if (!is_dir($dir.$filename) && $filename[0] !== '.') {
			// echo PHP_INT_MAX; // may be 2 147 483 647 => 2GiB => larger files are not reported correctly
			// may produce: Warning: filesize(): stat failed
			// @ suppresses Warning
			$size = @filesize($dir.$filename);
			
			// returns number as string!
			// if file does not exist returns empty string, and in JS: Number("") === 0, which is ok
			// TODO OSX: #stat: illegal option -- -
			// $size = exec('stat --printf="%s" "'.$dir.$filename.'"');
			// append
			$files[] = array('name' => $filename, 'size' => ($size === false ? 0 : $size));
		}
	}
	return $files;
}

function totalSpaceUsed() {
	$totalSize = 0;
	foreach (getFiles() as $id => $file)
		$totalSize += $file["size"];
	return $totalSize;
}


if (!debug_backtrace()) {
	echo json_encode(getFiles());
}
