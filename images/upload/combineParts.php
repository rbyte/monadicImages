<?php
include 'config.php';

$filename = getRequestHeader('HTTP_X_FILENAME');
$lastChunkIndex = getRequestHeader('HTTP_X_CHUNKINDEX');
$fileSize = getRequestHeader('HTTP_X_FILESIZE');

if (isset($argv) // is run from command line (privileged manual combine)
	|| !$maximumCombinableFileSize // or no limit to combinable file size
	|| $fileSize < $maximumCombinableFileSize) {
	
	// can be run from command line also
    if ($filename === false) $filename = $argv[1];
    if ($lastChunkIndex === false) $lastChunkIndex = $argv[2];
    if ($fileSize === false) $fileSize = $argv[3];
    
	// check whether all parts exist
	for ($i = 0; $i<=$lastChunkIndex; $i++) {
		is_file(part($i)) or exit("missing ".part($i));
	}

	// combine chunks
	$f = fopen($dir.$filename, 'w') or exit("could not create ".$dir.$filename);
    for ($i = 0; $i<=$lastChunkIndex; $i++) {
    	$blob = file_get_contents(part($i)) or exit("could not read ".part($i));
    	fwrite($f, $blob) or exit("could not append ".part($i));
    	// delete
    	unlink(part($i)) or exit("could not delete ".part($i));
    }
    fclose($f) or exit("could not close ".$dir.$filename);
    echo "successfully combined ".$dir.$filename."\n";
} else {
	if (preg_match("/['\"]/", $filename.$lastChunkIndex.$fileSize))
		exit("error: input is not safe.");
	
	if (is_file($dir.$filename)) // prepare to overwrite
		unlink($dir.$filename) or exit("could not delete ".$dir.$filename);
	
	// may be limited to 2GiB ... bash does not have this restriction
	$cmd = "php combineParts.php '".$filename."' '".$lastChunkIndex."' '".$fileSize."'";
//	$cmd = "sh combineParts.sh '".$dir.$filename."' '".$lastChunkIndex."' '".$fileSize."'";
	echo $cmd."\n";
	// script may contain multiple snippets
	exec('echo "'.$cmd.'" >> .pendingCombines.sh');
	echo "delayed combining. run: sh manualCombine.sh";
}
