var verbose = false;

var dfMail = require ('dataflows-task-mail');


describe ("002-task-alone", function () {

	it ("sending email", function (done) {
		var task = new dfMail ({});

		task.run ({
			transport: {
				plugin: "nodemailer-mandrill-transport",
				config: {
					auth: {apiKey: process.env.MANDRILL_API_KEY}
				}
			},
			fields: {
				from: "from@valid.sender",
				to: "mdoxfzzy@sharklasers.com",
				subject: "Mail task for dataflows is working!",
				template: "./test/001-email-task"
			},
			vars: {
				title: "Mail task for dataflows is working!",
				msg: "You can check additional details at https://github.com/apla/dataflows-task-mail"
			}
		});

		task.on ('complete', function () {
			done ();
		});

		task.on ('fail', function () {
			assert (false);
		});

	});

});

