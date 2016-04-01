var model = require('duck-type').create();

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