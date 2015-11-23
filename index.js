var
	util          = require('util'),
	path          = require('path'),
	nodemailer    = require('nodemailer'),
	EmailTemplate = require('email-templates').EmailTemplate,
	task          = require('dataflo.ws/task/base'),
	dataflows     = require ('dataflo.ws');

/**
 * Batch sending of emails
 * - supports templates
 * - doesn't support guaranteed delivery of emails
 * - doesn't support guaranteed sending of emails (sends to smtp transport)
 * however, notifies transport errors to console as warnings.
 *
 * The task is completed as soon as all required fields for email sending are
 * present and all emails are forwarded to smtp transport for sending.
 *
 * The task is failed or skipped (depends on @cfg {Boolean} important) if there are problems
 * with template/contents or recipients list.
 *
 *
 *	@cfg {Object} fields - email fields to send. If we're using recipients list
 *  email fields structure will be used as defaults
 *
 * ```javascript
 * fields = {
 *		from: {String}, // optional, defaults to consumerConfig value : sender OR SMTP.auth.user
 *		to: {String}, // can be also named "email"
 *		cc: {String},
 *		bcc: {String},
 *		subject: {String},
 *		text: {String}, // text template
 *		html : {String}, // html template
 *  	attachments: {Array}
 *	}
 *
 * ```
 *
 *	@cfg {String} template - name of template
 *	template is ejs based, generates Text and HTML
 * templates are to be located in <project_root>/templates/email
 * see details: https://github.com/niftylettuce/node-email-templates
 *
 *	! template OR text OR html OR subject MUST be provided
 *
 *
 *
 * @cfg {Array} recipients - list for batch sending
 *
 *	recipients = ["<email>", "<email>",...]
 *	recipients = [{
 *		email: {String}, // can be named "to" or otherwise (see below) substitutes email.to
 *		// name,... - other fields used in template
 *	}]
 *
 * @cfg {String} emailField - if present recipients[emailField] whill be taken as email.to
 *
 *	! email.to OR recipients MUST be provided
 *
*/

// mail task need two things to get configured: transports and templates
// without dataflows project you need to pass whole transport configuration
// in transport key and can use full paths for templates (absolute or within current dir)

var
	mailConfig,
	templatesDir;


var mailTask = module.exports = function (config) {

	this.init (config);

};

util.inherits (mailTask, task);

mailTask.checkConfig = function () {

	var config;

	if ('project' in global && project.config && project.config.service && project.config.service.mail) {
		config = project.config;
	} else if ('config' in dataflows && dataflows.config && dataflows.config.service && dataflows.config.service.mail) {
		config = dataflows.config;
	} else {
		return;
	}

	mailConfig = config.service.mail;
	templatesDir = mailConfig.templatesDir || 'share/presentation/email';

}

mailTask.checkConfig ();

mailTask.prototype.run = function (args) {

	var
		args       = args || this,
		fields     = args.fields,
		recipients = args.recipients,
		vars       = args.vars,
		emails     = [];

	if (!recipients || recipients.length === 0) {
		var email = this.checkFields (fields);
		if (!email) {
			return;
		}
		emails.push (email);
	} else {
		for (var recId = 0; recId < recipients.length; recId ++) {
			var email = this.checkFields (recipients[recId], fields);
			if (!email) {
				return;
			}
			emails.push (email);
		}
	}

	var transport = this.resolveTransport (args.transport);
	if (!transport)
		return;

	this.transporter = this.createTransport (transport);
	this.transporter.use ('compile', this.render.bind (this));

	var sentCount = 0;

	emails.forEach (function (email, idx) {

		email.vars = vars;

		/* RFC 2606

		…

		To safely satisfy these needs, four domain names are reserved as
		listed and described below.

			.test
			.example
			.invalid
			.localhost

		…

		The Internet Assigned Numbers Authority (IANA) also currently has the
		following second level domain names reserved which can be used as
		examples.

			example.com
			example.net
			example.org
		*/

		/* RFC 6761

		Application software SHOULD NOT recognize test names as special,
		and SHOULD use test names as they would other domain names.

		Application software MAY recognize localhost names as special, or
		MAY pass them to name resolution APIs as they would for other
		domain names.

		Application software MAY recognize "invalid" names as special or
		MAY pass them to name resolution APIs as they would for other
		domain names.

		Application software SHOULD NOT recognize example names as
		special and SHOULD use example names as they would other domain
		names.

		*/

		if (email.to.constructor !== Array) email.to = [email.to];

		email.to = email.to.filter (function (recipient) {
			// TODO: check for unicode alphanumeric like IDNA without Punycode
			if (recipient.match (/\@\w[\w\.]+(?:invalid|localhost)$/)) {
				return false;
			}
			return true;
		});

		// only invalid recipients, skip email sending
		if (email.to.length === 0) {
			sentCount ++;

			if (sentCount === emails.length) {
				this.completed ();
			}

			return;
		}

		this.transporter.sendMail (email, function (error, response) {

			// console.log (error, response);

			if (error)
				return this.failed (error);

			this.emit ('log', 'Email sent to ' + email.to);

			sentCount ++;

			if (sentCount === emails.length) {
				this.completed ();
			}
		}.bind (this));

	}.bind (this));

}

/**
 * Check for all required fields to be present for email
 * @param   {Object|String} fields   envelope fields like from, to and so on; assume `to` if string provided
 * @param   {Object}        defaults envelope template
 * @returns {Object}        envelope with fields
 */
mailTask.prototype.checkFields = function (fields, defaults) {

	var email = {};

	if (fields.constructor === String) {
		fields = {to: fields};
	}

	if (defaults)
	for (var f in defaults) {
		email[f] = defaults[f];
	}

	for (var f in fields) {
		email[f] = fields[f];
	}

	email.to   = email.email  || email.to;
	email.from = email.sender || email.from;

	if (!email.to || !email.from || !email.subject)
		return this.failed ('from, to and subject must be provided');
	if (!email.text && !email.html && !email.template)
		return this.failed ('text/html or template must be provided');

	return email;
}

/**
 * Creating transports for nodemail
 * @param   {String} transport configuration, can be plain
 *                             (like {service: "gmail"}, or for plugin —
 *                             {plugin: "ses", config: <config object>})
 * @returns {Object} transporter
 */
mailTask.prototype.createTransport = function (transport) {
	// TODO: create all needed transports from project config in app start
	// to ensure every plugin will be loaded

	if (transport === "test") {
		return nodemailer.createTransport ({
			name: 'testsend',
			version: '1',
			send: function(data, callback) {
				callback();
			}
		});
	}

	if (transport.plugin) {
		var transPlugin = require (transport.plugin);
		return nodemailer.createTransport (transPlugin (transport.config));
	}

	return nodemailer.createTransport (transport);
}

/**
 * Resolve transport by config key
 * @param   {String|Object} transConf key to resolve transport in config or complete transport configuration
 * @returns {Object}        transport configuration
 */
mailTask.prototype.resolveTransport = function (transConf) {
	// you can use transport string only if dataflows project configuration defined
	if (transConf === "test") {
		return transConf;
	} else if (transConf.constructor === String) {
		if (!mailConfig) {
			return this.failed ("you must supply transport configuration via dataflows.config");
		}

		return mailConfig.transports[transConf];
	}

	return transConf;
}


mailTask.prototype.render = function (mail, done) {

	if (!mail || !mail.data) {
		return done ("mail data is undefined, WTF???");
	}

	// text/html hardcoded in configuration
	if (mail.data.html || mail.data.text) {
		console.error ('email contents hardcoded in configuration');
		return done ();
	}

	var templatePath;
	// local path
	if (mail.data.template.match (/^\.*\//)) {
		templatePath = path.resolve (mail.data.template);
	} else if (!templatesDir) {
		return done ("You need to define template dir to use template names");
	} else {
		templatePath = path.join (templatesDir, mail.data.template);
	}

	var emailTemplate = new EmailTemplate (templatePath);
	emailTemplate.render (mail.data.vars, function (err, result) {

		// console.log (err, result);

		if (err) return done (err);

		mail.data.html = result.html;
		mail.data.text = result.text;
		done ();
	})

	// done();
}
