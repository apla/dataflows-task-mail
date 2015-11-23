var testCommon = require ("dataflo.ws/test/common");
testCommon.injectMain ();

var dataflows = require ('dataflo.ws');

var task = require ('../');

var baseName = testCommon.baseName (__filename);

var testData = testCommon.initTests (__dirname, baseName);

var verbose = false;

var descriptor = {

	beforeEach: function (done) {
		return done();
		if (process.version.indexOf ('v0.10') === 0) {
			server = new simplesmtp.createServer({
				ignoreTLS: true,
				disableDNSValidation: true,
				requireAuthentication: true,
				debug: false,
				authMethods: ['PLAIN', 'XOAUTH2']
			});

			server.on('startData', function(connection) {
				connection.hash = crypto.createHash('md5');
			});

			server.on('data', function(connection, chunk) {
				connection.hash.update(chunk.toString('utf-8'));
			});

			server.on('dataReady', function(connection, callback) {
				var hash = connection.hash.digest('hex');
				callback(null, hash); // ABC1 is the queue id to be advertised to the client
			});

			server.on('authorizeUser', function(connection, username, pass, callback) {
				callback(null, username === 'testuser' && (pass === 'testpass' || pass === 'testtoken'));
			});

			server.on('validateSender', function(connection, email, callback) {
				callback(!/@valid.sender/.test(email) && new Error('Invalid sender'));
			});

			server.on('validateRecipient', function(connection, email, callback) {
				callback(!/@valid.recipient/.test(email) && new Error('Invalid recipient'));
			});

			server.listen(PORT_NUMBER, done);
		}
	},
	afterEach: function (done) {
		return done();
		server.end(done);
	}
};

describe (baseName + " mail", testCommon.runTests.bind (descriptor, testData, {
	apiKeys: {
		mandrill: process.env.MANDRILL_API_KEY
	}
}, verbose));

var testData2 = {
	templates: {task: {}},
	tests: {"sharklasers-dataflows": Object.create(testData.tests["sharklasers-template-df"])}
}

testData2.tests["sharklasers-dataflows"].skip = false;
//testData2.tests["sharklasers-dataflows"].only = true;

var descriptor2 = {
	before: function () {
		// dataflows config will be defined before task launch

		dataflows.config = {service: {mail: {
			transports: {
				mandrill: {
					"plugin": "nodemailer-mandrill-transport",
					"config": {
						"auth": {"apiKey": process.env.MANDRILL_API_KEY}
					}
				}
			},
			templatesDir: "./test"
		}}};

		task.checkConfig ();

		global.project = {config: dataflows.config};

		task.checkConfig ();
	}
}

describe (baseName + " mail with dataflows.config", testCommon.runTests.bind (descriptor2, testData2, {
	apiKeys: {
		mandrill: process.env.MANDRILL_API_KEY
	}
}, verbose));


return;

describe('Nodemailer integration tests', function() {
	this.timeout(10000);
	var server;

	it('should log in and send mail', function(done) {
		var nm = nodemailer.createTransport({
			host: 'localhost',
			port: PORT_NUMBER,
			auth: {
				user: 'testuser',
				pass: 'testpass'
			},
			ignoreTLS: true
		});

		var mailData = {
			from: 'from@valid.sender',
			sender: 'sender@valid.sender',
			to: ['to1@valid.recipient', 'to2@valid.recipient', 'to@invalid.recipient'],
			subject: 'test',
			date: new Date('Mon, 31 Jan 2011 23:01:00 +0000'),
			messageId: 'abc@def',
			xMailer: 'aaa',
			text: 'uuu'
		};

		nm.sendMail(mailData, function(err, info) {
			expect(err).to.not.exist;
			expect(info.accepted).to.deep.equal([
				'to1@valid.recipient',
				'to2@valid.recipient'
			]);
			expect(info.rejected).to.deep.equal([
				'to@invalid.recipient'
			]);
			expect(info.messageId).to.equal('abc@def');
			expect(/538ec1431ce376bc46f11b0f51849beb/i.test(info.response)).to.be.true;
			done();
		});
	});

	it('should response auth error', function(done) {
		var nm = nodemailer.createTransport({
			host: 'localhost',
			port: PORT_NUMBER,
			auth: {
				user: 'invalid user',
				pass: 'testpass'
			},
			ignoreTLS: true
		});

		var mailData = {
			from: 'from@valid.sender',
			to: ['to1@valid.recipient', 'to2@valid.recipient', 'to@invalid.recipient'],
			subject: 'test',
			date: new Date('Mon, 31 Jan 2011 23:01:00 +0000'),
			messageId: 'abc@def',
			xMailer: 'aaa',
			text: 'uuu'
		};

		nm.sendMail(mailData, function(err, info) {
			expect(err).to.exist;
			expect(info).to.not.exist;
			expect(err.code).to.equal('EAUTH');
			done();
		});
	});

	it('should response envelope error', function(done) {
		var nm = nodemailer.createTransport({
			host: 'localhost',
			port: PORT_NUMBER,
			auth: {
				user: 'testuser',
				pass: 'testpass'
			},
			ignoreTLS: true
		});

		var mailData = {
			from: 'from@valid.sender',
			to: ['to@invalid.recipient'],
			subject: 'test',
			date: new Date('Mon, 31 Jan 2011 23:01:00 +0000'),
			messageId: 'abc@def',
			xMailer: 'aaa',
			text: 'uuu'
		};

		nm.sendMail(mailData, function(err, info) {
			expect(err).to.exist;
			expect(info).to.not.exist;
			expect(err.code).to.equal('EENVELOPE');
			done();
		});
	});

	it('should override envelope', function(done) {
		var nm = nodemailer.createTransport({
			host: 'localhost',
			port: PORT_NUMBER,
			auth: {
				user: 'testuser',
				pass: 'testpass'
			},
			ignoreTLS: true
		});

		var mailData = {
			from: 'from@valid.sender',
			to: ['to1@valid.recipient', 'to2@valid.recipient', 'to@invalid.recipient'],
			subject: 'test',
			date: new Date('Mon, 31 Jan 2011 23:01:00 +0000'),
			messageId: 'abc@def',
			xMailer: 'aaa',
			text: 'uuu',
			envelope: {
				from: 'aaa@valid.sender',
				to: 'vvv@valid.recipient'
			}
		};

		nm.sendMail(mailData, function(err, info) {
			expect(err).to.not.exist;
			expect(info.accepted).to.deep.equal([
				'vvv@valid.recipient'
			]);
			expect(info.rejected).to.deep.equal([]);
			expect(info.messageId).to.equal('abc@def');
			expect(/eaa13435e1401328be32bc7a4c629f9f/i.test(info.response)).to.be.true;
			done();
		});
	});
});
