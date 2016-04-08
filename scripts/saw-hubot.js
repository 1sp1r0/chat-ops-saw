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

sawAgent.login('http://sheyu4.hpeswlab.net:8000/','100000002','devUser2@hp.com','Password1');


module.exports = function(hubot) {
	//create room
	hubot.router.post('/saw/:entityType/:id', function(req, res) {
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

	//update message
	hubot.router.put('/saw/:entityType/:id', function(req, res) {
		var id = req.params.id,
			entityType = req.params.entityType,
			message = req.body.message;
		console.log('receive saw entity updated message',id, message);

		//entity check
		slackAgent.sendMessage(genRoomName(entityType,id), message, HUBUT_NAME);
		res.send('OK');
	});

	//message assign incident, example: @saw Update Incident #123456, Owner, expert assign to @yu

	hubot.respond(/(Update (.*) #(\d*),)? (.*) assign to @(.*)/i, function(res) {
		var entityType = res.match[1];
		var id = res.match[2];
		var fieldNames = res.match[3].split(',');
		var assignee = slackAgent.findUserByName(res.match[4]);
		if(!assignee) {
			res.send('Error');
			return;
		}

		Q.all(fieldNames.map(function(fieldName) {
			var field = sawAgent.findFieldByName(entityType, fieldName.trim());
			sawAgent.assignPersonByEmail(entityType,id, field,assignee.email);
		})).fail(function(message) {
			res.send(message);
		});
	});

	//message assign group, example: @saw Update Incident #123456, Expert Group assign group to CBA Group
	
	hubot.respond(/Update (.*) #(\d*), (.*) assign group to (.*)/i, function(res) {
		var entityType = res.match[1];
		var id = res.match[2];
		var fieldNames = res.match[3].split(',');
		var groupName = res.match[4];

		Q.all(fieldNames.map(function(fieldName) {
			var field = sawAgent.findFieldByName(entityType, fieldName.trim());
			sawAgent.assignGroupByGroupName(entityType,id, field.trim(),groupName);
		})).fail(function(message) {
			res.send(message);
		});
	});


	//message move phase, example: @saw Update Incident #2182931,move phase to abc
	hubot.respond(/Update (.*) #(\d*), move phase to (.*)/i, function(res) {
		var entityType = res.match[1];
		var id = res.match[2];
		var phase = res.match[3];

		sawAgent.updateField(entityType,id, {PhaseId:phase}).then(function() {
			res.send('done');
		}).fail(function(message) {
			res.send(message);
		});
	});

}