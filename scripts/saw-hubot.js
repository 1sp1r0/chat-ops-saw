var sawAgent = require('../saw/saw-agent');
var slackAgent = require('../saw/slack-agent');
var HUBUT_NAME = 'hello';
var util = require('util');
var Q = require('q');

sawAgent.login('http://ppmqavm153.asiapacific.hpqcorp.net:8000','100000002','devUser2@hp.com','Password1');

sawAgent.onIncidentOccur(function(result){
	result.forEach(function(incident) {
		var incidentId = incident.properties.Id;
		sawAgent.showIncident(incidentId).then(function(detail){
			var name = detail.properties.Id;
			var roomId;
			slackAgent.createRoom(name,detail.properties.Id).then(function(room) {
				roomId = room.id;
				return Q.all(detail.persons.map(function(person) {
					return slackAgent.inviteMember(room.id,slackAgent.findUserByEmail(person.properties.Email).slackId);
				}));
			}).then(function() {
				return slackAgent.inviteMember(roomId,slackAgent.findUserByName(HUBUT_NAME).slackId);
			}).then(function(){
				slackAgent.sendMessage(roomId,detail.properties.DisplayLabel,HUBUT_NAME);
			}).fail(function(e){
				console.log(e);
			});
		});
	});
});


sawAgent.watchIncident();

module.exports = function(hubot) {
	hubot.hear(/badger/i,function(res) {
		res.send("Badgers? BADGERS? WE DON'T NEED NO STINKIN BADGERS");
		res.send(util.inspect(slackAgent.listUsers()));
	});
}