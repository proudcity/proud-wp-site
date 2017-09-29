FROM wordpress:php7.0-apache

MAINTAINER Alex Schmoe <alex@getproudcity.com>

# Add sudo in order to run wp-cli as the www-data user 
RUN apt-get update \
  && apt-get install -y sudo mysql-client less unzip git libcurl4-openssl-dev libmcrypt-dev \
  && docker-php-ext-install mcrypt

# Install XDebug
#RUN pecl install xdebug-2.5.5 \
#  && docker-php-ext-enable xdebug

# Add WP-CLI 
RUN curl -o /bin/wp-cli.phar https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
COPY wp-su.sh /bin/wp
RUN chmod +x /bin/wp-cli.phar /bin/wp

# Cleanup
RUN apt-get clean
RUN rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY xdebug.sh /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/xdebug.sh"]

CMD ["apache2-foreground"]