# dataflows-task-mail
email task for dataflows

Batch sending of emails
 - supports templates
 - doesn't support guaranteed delivery of emails
 - doesn't support guaranteed sending of emails (sends to smtp transport)

However, transport errors logged to console as warnings.

The task is completed as soon as all required fields for email sending are
present and all emails are forwarded to smtp transport for sending.

If there are problems with template, contents or recipients list task will fail.

### Synopsis

Tests have usage examples for dataflows and standalone.

### Parameters

**fields** - email fields to send. If we're using recipients list
 email fields structure will be used as defaults

```javascript
fields = {
	from: {String},
	to: {Array|String},
	cc: {String}, // optional
	bcc: {String}, // optional
	subject: {String},
	text: {String}, // hardcoded text
	html : {String}, // hardcoded html
	template : {String}, // template directory to use by [email-templates](https://github.com/niftylettuce/node-email-templates)
	attachments: {Array} // optional
}
```

**vars** - variables to expand in template

**transport** - transport parameters

```javascript
var mandrillTransport = {
	plugin: "nodemailer-mandrill-transport",
	config: {
		auth: {apiKey: "kNjbd7IINJy5bEMf19sf2A"}
	}
}

var sendmailTransport = {
	"plugin": "nodemailer-sendmail-transport",
	"config": {
		"path": "sendmail",
		"args": []
	}
};
```

Without dataflows project you need to pass whole transport configuration
in transport key and can use full paths for templates (absolute or within current dir)
