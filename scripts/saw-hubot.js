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
	if(roomName === 'Shell') {
		return {
			entityType: 'Incident',
			Id: 123456
		}
	}
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


	hubot.respond(/help/i, function(res){
		res.send('help...');
	});
	

	//assign person, example: @saw assign-person Incident #1234 Owner to @yu
	hubot.respond(/assign-person( (\w+) #(\d+))? ([\w, ]+) to @([\w ]+)/i, function(res) {
		var entityInfo = parseRoomName(res.message.room);
		var entityType = res.match[2] || entityInfo.entityType; 
		var id = res.match[3] || entityInfo.Id;
		var fieldNames = res.match[4].split(',');
		var assigneeName = res.match[5];

		console.log('assign-person',entityType,id, fieldNames, assignee);

		var assignee = slackAgent.findUserByName(assigneeName);

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


	//assign group, example: @saw assign-group Incident #1234 Owner to yu
	hubot.respond(/assign-group( (\w+) #(\d+))? ([\w, ]+) to ([\w ]+)/i, function(res) {
		var entityInfo = parseRoomName(res.message.room);
		var entityType = res.match[2] || entityInfo.entityType; 
		var id = res.match[3] || entityInfo.Id;
		var fieldNames = res.match[4].split(',');
		var groupName = res.match[5];

		console.log('assign-group',entityType,id, fieldNames, groupName);

		Q.all(fieldNames.map(function(fieldName) {
			var field = sawAgent.findFieldByName(entityType, fieldName.trim());
			sawAgent.assignGroupByGroupName(entityType,id, field.trim(),groupName);
		})).fail(function(message) {
			res.send(message);
		});
	});


	//move phase, example: @saw move-phase Incident #1234 to Close
	hubot.respond(/move-phase( (\w+) #(\d+))? to ([\w]+)/i, function(res) {
		var entityInfo = parseRoomName(res.message.room);
		var entityType = res.match[2] || entityInfo.entityType; 
		var id = res.match[3] || entityInfo.Id;
		var phase = res.match[4];

		console.log('move-phase',entityType,id, phase);

		sawAgent.updateField(entityType,id, {PhaseId:phase}).then(function() {
			res.send('done');
		}).fail(function(message) {
			res.send(message);
		});
	});

	//get detail, example: @saw show-detail Incident #1234
	hubot.respond(/show-detail( (\w+) #(\d+))?/i, function(res) {
		var entityInfo = parseRoomName(res.message.room);
		var entityType = res.match[2] || entityInfo.entityType; 
		var id = res.match[3] || entityInfo.Id;

		console.log('show-detail',entityType,id );

	});

	//get attributes which include attachment, example: @saw show Change #12345 Owner,Test
	hubot.respond(/show( (\w+) #(\d+))?([\w, ]*)/i, function(res) {
		var entityInfo = parseRoomName(res.message.room);
		var entityType = res.match[2] || entityInfo.entityType; 
		var id = res.match[3] || entityInfo.Id;
		var fieldNames = res.match[4].split(',');

		console.log('show',entityType, id, fieldNames);

	});

	//set attribute, example: @saw update Change #12345 Owner,Test value XXX
	hubot.respond(/update( (\w+) #(\d+))? ([\w, ]+) value ([\w ]+)/i, function(res) {
		var entityInfo = parseRoomName(res.message.room);
		var entityType = res.match[2] || entityInfo.entityType; 
		var id = res.match[3] || entityInfo.Id;
		var fieldNames = res.match[4].split(',');
		var value = res.match[5];

		console.log('update',entityType, id, fieldNames, value);
	});

	//search, example: @saw search Change by abcd XXX
	hubot.respond(/search( (\w+))? by ([\w, ]+)/i, function(res) {
		var entityInfo = parseRoomName(res.message.room);
		var entityType = res.match[2] || entityInfo.entityType; 
		var keywords = res.match[3].split(',').join(' ');

		console.log('search',entityType, keywords);
	});


	//invite person, example: @saw invite Change #1234 Owner, Expert
	hubot.respond(/invite( (\w+) #(\d+))? ([\w, ]+)/i, function(res) {
		var entityInfo = parseRoomName(res.message.room);
		var entityType = res.match[2] || entityInfo.entityType; 
		var id = res.match[3] || entityInfo.Id;
		var fieldNames = res.match[4].split(',').join(' ');

		console.log('invite',entityType, id, fieldNames);
	});

	//attch 
}