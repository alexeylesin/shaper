# linkshaper
Web-service for shorten your link :p

## How to deploy?
1. Clone the repository to your server and install dependencies
```bash
$ git clone https://github.com/vlfz/linkshaper.git && cd linkshaper && npm install
```
If you have `yarn` - use it instead `npm`

2. Customize for yourself
* In `.env.example` (rename to `.env`) set the port, Discord Client ID|Secret and CallbackURI (specified in the Discord OAuth2 settings)
* In `database.example.json` (rename to `database.json`) set the connection details for MySQL (host, port, user, password and database name)

3. Launch it with `tmux`, `screen`, `pm2` and etc.
Congratulations! You passed all actions! :tada:

## License
See project license [here](https://github.com/vlfz/linkshaper/blob/master/LICENSE).