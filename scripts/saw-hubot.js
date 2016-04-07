var util = require('util');
var Q = require('q');
var argv = require('minimist')(process.argv.slice(2));

var model = require('../saw/model');
var sawAgent = (argv.mock || []).indexOf('saw') < 0 ? require('../saw/saw-agent') : model.generate(model.SawAgent);
var slackAgent = (argv.mock || []).indexOf('slack') < 0? require('../saw/slack-agent') : model.generate(model.SlackAgent);

var HUBUT_NAME = 'hello';

model(model.SawAgent,model.SlackAgent).match(sawAgent, slackAgent);

var roomEntitiesMapping = {};

function genRoomName(entityType, id) {
	return [entityType.toLowerCase(),id].join('-');
}

function parseRoomName(roomName) {
	return roomEntitiesMapping[roomName];
}

function genUpdateMessage(message) {
	return message;
}

function parsePersons(personsStr) {
	return (personsStr||'').slice(1,personsStr.length - 1).split(', ');
}

sawAgent.login('http://ppmqavm155.asiapacific.hpqcorp.net:8000/','100000002','devUser2@hp.com','Password1');


module.exports = function(hubot) {
	hubot.hear(/badger/i,function(res) {
		res.send("Badgers? BADGERS? WE DON'T NEED NO STINKIN BADGERS");
	});

	hubot.respond(/Update #(\d*), (.*) assignee assign to @(.*)/i, function(res) {
		var incidentId = res.match[1], 
			fields = res.match[2].split(','),
			assignee = slackAgent.findUserByName(res.match[3]), 
			entityInfo = parseRoomName(res.message.room);
		if(!assignee) {
			res.send('who is ' + res.match[3] + '?');
			return;
		}

		res.send('OK, I will update ' + incidentId);

		Q.all(fields.map(function(field) {
			return sawAgent.assignPerson('Incident',entityInfo.Id,field,assignee.email);
		}));
	});

	hubot.router.put('/saw/:entityType/:id', function(req, res) {
		console.log(req.body);
		var id = req.params.id,
			entityType = req.params.entityType,
			message = req.body.message,
			persons = parsePersons(req.body.persons),
			roomName = genRoomName(entityType,id);

		console.log('receive saw entity created message',id, message, persons);


		slackAgent.createRoom(roomName).then(function() {
			roomEntitiesMapping[roomName] = {
				entityType: entityType,
				id: id
			};
			return Q.all(persons.map(function(person) {
				return slackAgent.inviteMember(roomName,{email:person});
			}));
		}).then(function() {
			return slackAgent.inviteMember(roomName,{name:HUBUT_NAME});
		}).then(function(){
			slackAgent.sendMessage(roomName,message,HUBUT_NAME);
		}).fail(function(e){
			console.log(e);
			res.send('Error:' + e);
		});
		res.send('OK');
	});

	hubot.router.post('/saw/:entityType/:id', function(req, res) {
		var id = req.params.id,
			entityType = req.params.entityType,
			message = req.body.message;
		console.log('receive saw entity updated message',id, message);			
		slackAgent.sendMessage(genRoomName(entityType,id), message, HUBUT_NAME);
		res.send('OK');
	});
}