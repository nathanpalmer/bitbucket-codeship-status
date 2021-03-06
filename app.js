module.exports = function () {
	var express = require('express');
	var bodyParser = require('body-parser');
	var Request = require('request');
	var basicAuth = require('basic-auth-connect');
	var app = express();

	app.use('/media', express.static(__dirname + '/media'));
	app.use(bodyParser.json());
	app.set('view engine', 'ejs');
	app.enable('trust proxy');

	app.get('/', function (req, res) {
		Request({
			url: 'https://' + process.env.BITBUCKET_USERNAME + ':' + process.env.BITBUCKET_PASSWORD + '@api.bitbucket.org/2.0/users/chesleybrown',
			method: 'GET'
		}, function (err, response, body) {
			res.render('index', {
				BITBUCKET_USERNAME: process.env.BITBUCKET_USERNAME,
				BITBUCKET_PASSWORD: Boolean(process.env.BITBUCKET_PASSWORD),
				ssl: (req.protocol === 'https') ? true : false,
				host: req.get('host'),
				authenticated: (err || response.statusCode !== 200) ? false : true
			});
		});
	});

	app.post('/pull-request/:codeshipProjectUuid/:codeshipProjectId', basicAuth(function (username, password) {
		return (username === process.env.BITBUCKET_USERNAME && password === process.env.BITBUCKET_PASSWORD);
	}), function (req, res) {
		if (Object.keys(req.body).length === 0) {
			console.log('Body is not found');
			res.status(400).end();
			return;
		}

		// verify we have the information we need
		if (!req.body.pullrequest) {
			console.log('pullrequest is not found');
			console.log(req.body);
			res.status(400).end();
			return;
		}
		var pullRequest = req.body.pullrequest;

		if (!pullRequest.id || typeof(pullRequest.description) !== 'string' || !(pullRequest.source && pullRequest.source.branch && pullRequest.source.branch.name) || !(pullRequest.source && pullRequest.source.repository && pullRequest.source.repository.full_name)) {
			console.log('description | source | source.branch | soruce.branch.name | source.repository | source.repository.full_name is not found');
			console.log(pullRequest);
			res.status(400).end();
			return;
		}

		// if it doesn't already have Codeship status at the start of the description, let's add it
		if (pullRequest.description.indexOf('[ ![Codeship Status') !== 0) {
			var widget = '[ ![Codeship Status for ' + pullRequest.source.repository.full_name + '](https://codeship.io/projects/' + req.param('codeshipProjectUuid') +'/status?branch=' + pullRequest.source.branch.name + ')](https://codeship.io/projects/' + req.param('codeshipProjectId') + ')';
			pullRequest.description = widget + '\r\n\r\n' + pullRequest.description;

			console.log('Sending request back to BitBucket');
			Request({
				url: 'https://' + process.env.BITBUCKET_USERNAME + ':' + process.env.BITBUCKET_PASSWORD + '@api.bitbucket.org/2.0/repositories/' + pullRequest.source.repository.full_name + '/pullrequests/' + pullRequest.id,
				method: 'PUT',
				json: pullRequest
			}, function (err, response, body) {
				console.log(err);
				if (err) {
					res.status(500).end();
					return;
				}

				console.log(response.body);
				if (response.body && response.body.error) {
					res.status(500).end();
					return;
				}

				res.status(204).end();
			});
		}
		else {
			res.status(204).end();
		}
	});

	return app;
};
