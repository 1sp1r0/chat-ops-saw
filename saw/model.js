var model = require('duck-type').create();

model.type('SawAgent',{
	assignGroup: Function,
	assignPerson: Function,
	closeIncident :Function,
	onEntityCreated : Function,
	onEntityUpdated: Function,
	login: Function,
	watch: Function
});

model.type('SlackAgent',{
	createRoom: Function,
	inviteMember: Function,
	sendMessage: Function,
	findUserByName: Function
});

model.type('Entity',{
	entity_type: String,
	properties:{
		Id: String
	}
});

model.type('Person', {
	properties:{
		Email: String
	}
})

module.exports = model;