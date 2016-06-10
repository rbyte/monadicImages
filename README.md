Monadic Images
====

Inspired by http://mariandoerk.de/monadicexploration/

File permissions need to be to correctly for Apache-PHP to be able r/w/x in images/, images/upload/files/, etc.

Requires Javascript Harmony support in Browser and NodeJS (>v6.2).

PHP needs to be able to exec(node...). For this, apache needs to have nodejs in its PATH (/usr/local/bin). If not, see
http://stackoverflow.com/questions/6833939/path-environment-variable-for-apache2-on-mac

Requires ImageMagick on server.

Security (!): use ~.htaccess
