var model = require('duck-type').create();

model.type('SawAgent',{
	showDetail: Function,
	assignGroup: Function,
	assignPerson: Function,
	closeIncident :Function,
	login: Function,
});

model.type('SlackAgent',{
	createRoom: Function,
	inviteMember: Function,
	sendMessage: Function,
	findUserByName: Function
});

model.type('EntityUpdatedMessage',{
	message: String
});

model.type('EntityCreatedMessage',{
	message: String,
	persons: String
});


module.exports = model;