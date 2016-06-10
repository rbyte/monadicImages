<?php
//include 'config.php';
include 'listFiles.php';

$filename = getRequestHeader('HTTP_X_FILENAME');
$i = getRequestHeader('HTTP_X_CHUNKINDEX');

function hasFreeSpaceLeft() {
	global $dir, $chunkSizeBytes, $totalUploadLimit;
	// calling disk_free_space may result in a 503 Service Temporarily Unavailable
	// or: disk_free_space(): Value too large for defined data type
//	return disk_free_space($dir) > $chunkSizeBytes && totalSpaceUsed() + $chunkSizeBytes < $totalUploadLimit;
	return totalSpaceUsed() + $chunkSizeBytes < $totalUploadLimit;
}

if (!hasFreeSpaceLeft())
	exit("no free space left!");

file_put_contents(part($i), file('php://input'))
	or exit("error writing ".part($i));
