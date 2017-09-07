#!/usr/bin/env bash

rsync -vt ../wp-proudcity/wordpress/ src/
rsync -avh --delete-after ../wp-proudcity/wordpress/wp-admin/ src/wp-admin/
rsync -avh --delete-after ../wp-proudcity/wordpress/wp-includes/ src/wp-includes/

rsync -avh --exclude=wp-proud-*/ ../wp-proudcity/wordpress/wp-content/ src/wp-content/