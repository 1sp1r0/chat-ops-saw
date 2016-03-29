var sawAgent = require('../saw/saw-agent');
var slackAgent = require('../saw/slack-agent');
var HUBUT_NAME = 'hello';

sawAgent.login('http://ppmqavm153.asiapacific.hpqcorp.net:8000','100000002','devUser2@hp.com','Password1');

sawAgent.onIncidentOccur(function(incident){
	slackAgent.createRoom(incident);
	slackAgent.inviteMember(incident,HUBUT_NAME);
});

sawAgent.watchIncident();

module.exports = function(hubot) {
	hubot.hear(/badger/i,function(res) {
		res.send("Badgers? BADGERS? WE DON'T NEED NO STINKIN BADGERS");
	});
}