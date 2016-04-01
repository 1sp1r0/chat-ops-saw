var sawAgent = require('../saw/saw-agent');
var slackAgent = require('../saw/slack-agent');
var HUBUT_NAME = 'hello';
var util = require('util');
var Q = require('q');

sawAgent.login('http://ppmqavm155.asiapacific.hpqcorp.net:8000/','100000002','devUser2@hp.com','Password1');

sawAgent.onIncidentOccur(function(result){
	result.forEach(function(incident) {

		var incidentId = incident.properties.Id , roomName = 'incident-' + incidentId;
		sawAgent.showIncident(incidentId).then(function(detail){
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


sawAgent.watchIncident();

module.exports = function(hubot) {
	hubot.hear(/badger/i,function(res) {
		res.send("Badgers? BADGERS? WE DON'T NEED NO STINKIN BADGERS");
		res.send(util.inspect(slackAgent.listUsers()));
	});
}