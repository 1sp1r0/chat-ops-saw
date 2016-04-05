var util = require('util');
var Q = require('q');

var sawAgent = require('../saw/saw-agent');
var slackAgent = require('../saw/slack-agent');
var model = require('../saw/model');

var HUBUT_NAME = 'hello';



function genRoomName(entity) {
	return [entity.entity_type.toLowerCase(),entity.properties.Id].join('-');
}

function genUpdateMessage(entity) {
	return [entity.entity_type,entity.properties.Id,'updated'].join(' ');
}

sawAgent.login('http://ppmqavm155.asiapacific.hpqcorp.net:8000/','100000002','devUser2@hp.com','Password1');

sawAgent.onEntityCreated(function(entities){
	model([model.Entity]).match(entities);

	entities.forEach(function(entity) {
		var roomName = genRoomName(entity);
		sawAgent.showDetail(entity.properties.Id).then(function(detail){
			model(model.and(model.Entity,{
				persons:[model.and(model.Entity, model.Person)]
			}));

			slackAgent.createRoom(roomName).then(function() {
				return Q.all(detail.persons.map(function(person) {
					return slackAgent.inviteMember(roomName,{email:person.properties.Email});
				}));
			}).then(function() {
				return slackAgent.inviteMember(roomName,{name:HUBUT_NAME});
			}).then(function(){
				slackAgent.sendMessage(roomName,detail.properties.DisplayLabel,HUBUT_NAME);
			}).fail(function(e){
				console.log(e);
			});
		});
	});
});

sawAgent.onEntityUpdated(function(entities) {
	model([model.Entity]).match(entities);
	
	entities.forEach(function(entity) {
		slackAgent.sendMessage(genRoomName(entity), genUpdateMessage(entity), HUBUT_NAME);
	});
});

sawAgent.watch();

module.exports = function(hubot) {
	hubot.hear(/badger/i,function(res) {
		res.send("Badgers? BADGERS? WE DON'T NEED NO STINKIN BADGERS");
		res.send(util.inspect(slackAgent.listUsers()));
	});
}