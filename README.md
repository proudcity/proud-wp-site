# ProudCity Wordpress

## Scripting the container with wp-cli

You can run the "[wp](http://wp-cli.org/)" cli command as long as you include the "--allow-root" option, for example:

```bash
docker-compose run wordpress wp --allow-root plugin install hello-dolly
```

Nice, but noisy. On my own system (OS X, but this would work in Linux too), I created a wrapper for this using `alias` in my `~/.profile`:

```bash
alias docker-wp='docker-compose run wordpress wp --allow-root'
```

Which turns the above command into:

```bash
docker-wp plugin install hello-dolly
```

Another example - let's create a new plugin!

```bash
docker-wp scaffold plugin my_super_plugin --plugin_name="My Super Plugin" 
```

AWESOMESAUCE.

## Enable MultiSite

The magical, [wp-cli](http://wp-cli.org/commands/core/multisite-convert/) way:

```bash
docker-wp core multisite-convert --title="My Blog Network"
```

One caveat of the configuration is that I use "folder" rather than "subdomain" MultiSite, for ease of use. I leave the necessary DNS shenanigans for local subdomain development as an exercise for the reader :simple_smile:

## Credits

All credit must go to https://github.com/docker-library/wordpress, from which this code was shamelessly and inexpertly copied.
