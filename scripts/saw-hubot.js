var util = require('util');
var Q = require('q');
var argv = require('minimist')(process.argv.slice(2));

var model = require('../saw/model');
var sawAgent = argv.mock.indexOf('saw') < 0 ? require('../saw/saw-agent') : model.generate(model.SawAgent);
var slackAgent = argv.mock.indexOf('slack') < 0? require('../saw/slack-agent') : model.generate(model.SlackAgent);

var HUBUT_NAME = 'hello';

model(model.SawAgent,model.SlackAgent).match(sawAgent, slackAgent);

function genRoomName(entity) {
	return [entity.entity_type.toLowerCase(),entity.properties.Id].join('-');
}

function parseRoomName(roomName) {
	var result = roomName.split('-');
	return {
		entityType: 'Incident',
		Id: result[1]
	};
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
				persons:[model.Person]
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
	});

	hubot.respond(/Update #(\d*), (.*) assignee assign to @(.*)/i, function(res) {
		var incidentId = res.match[1], 
			fields = res.match[2],
			assignee = slackAgent.findUserByName(res.match[3]), 
			entityInfo = parseRoomName(res.message.room);

		if(!assignee) {
			res.send('who is ' + res.match[3] + '?');
			return;
		}
		res.send('OK, I will update ' + incidentId);
		sawAgent.assignEntity('Incident',entityInfo.Id,assignee).then(function() {
			res.send('Done.');
		});

	});
}