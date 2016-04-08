var model = require('duck-type').create();

model.type('SawAgent',{
	getEntity: Function,
	getPersonsByGroupId: Function,
	getPersonByEmail: Function,
	getGroupByName: Function,
	updateField: Function,
	assignGroupByGroupName: Function,
	assignPersonByEmail: Function,
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